import { Component, Input, Output, EventEmitter, OnInit, OnChanges, OnDestroy, AfterViewInit, SimpleChanges, Type, ElementRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { ReactiveFormsModule, FormControl, FormGroup } from '@angular/forms';
import { Subscription } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { Display } from '@models/dashboards/Display';
import { DisplayRow } from '@models/dashboards/DisplayRow';
import { DisplayColumn } from '@models/dashboards/DisplayColumn';
import { DisplayItem, DisplayItemType, MetricData, FormDisplayConfig, ButtonDisplayConfig } from '@models/dashboards/DisplayItem';
import { DISPLAY_COMPONENT_REGISTRY } from '@models/dashboards/ComponentRegistry';
import { DisplayMetricCardComponent } from '@components/dashboard/dashboard-metric-card/dashboard-metric-card';
import {
  ScreenSupportNoticeComponent, SupportedScreen,
} from '@components/shared/screen-support-notice/screen-support-notice.component';
import { DisplaySolutionRunnerService, DisplayRunSummary } from '@services/no-code-services/display-solution-runner.service';
import { DisplayFormFeedbackService, DisplayFormFeedback } from '@services/no-code-services/display-form-feedback.service';
import { hasDatePlaceholder, resolveDatePlaceholders, todayIso } from '../../../utils/display-placeholders';

/**
 * Runtime state for a 'form' display item (P4 — forms now actually
 * execute their linked no-code solution instead of rendering a
 * placeholder). Keyed by DisplayItem.id.
 *
 * In-flight + outcome state is NOT here: the renderer is destroyed and
 * rebuilt when the page refreshes (the solution's own 'refreshDisplay'
 * event does exactly that), so it lives in DisplayFormFeedbackService
 * keyed by display id + item id and is read back on every render.
 */
interface FormRuntimeState {
    group: FormGroup;
    fields: Array<{ key: string; label: string; inputType: 'text' | 'number' | 'checkbox'; required: boolean; placeholder: string }>;
    fieldErrors: Record<string, string[]>;
    debounceSub?: Subscription;
    /** Fields whose default carries {today}/{now}: re-resolved when the
     *  local date rolls over under an open page (pristine fields only). */
    dateDefaults: Array<{ key: string; template: string }>;
    /** Local date the date defaults were last resolved for. */
    resolvedDate: string;
}

/**
 * Context data passed to child components within the dashboard
 */
export interface DisplayContext {
    className?: string;
    classTypeData?: any;
    [key: string]: any;
}

/**
 * Represents a single cell in the grid (either an item or empty space).
 * Used for both horizontal cells in rows and vertical cells in columns.
 */
export interface GridCell {
    type: 'item' | 'empty';
    item?: DisplayItem;
    startSegment: number;   // 1-based
    spanSegments: number;
}

/**
 * Component that renders a Display model into the UI.
 * Handles grid-based layout, dynamic component loading, and
 * edit-mode cell selection with explicit grid positioning.
 */
@Component({
  standalone: true,
    selector: 'dashboard-renderer',
    templateUrl: './dashboard-renderer.html',
    styleUrls: ['./dashboard-renderer.css'],
    imports: [CommonModule, MatIconModule, MatButtonModule, ReactiveFormsModule, DisplayMetricCardComponent, ScreenSupportNoticeComponent]
})
export class DisplayRendererComponent implements OnInit, OnChanges, AfterViewInit, OnDestroy {
    /** The dashboard model to render */
    @Input() dashboard: Display | null = null;

    /** Context data to pass to child components */
    @Input() context: DisplayContext = {};

    /** Whether to show in compact mode */
    @Input() compactMode: boolean = false;

    /** Whether edit mode is active (shows empty cell placeholders) */
    @Input() editMode: boolean = false;

    /** Whether to show grid guidelines */
    @Input() showGridlines: boolean = false;

    /** Emitted when an empty cell is selected in edit mode.
     *  Carries a DisplayRow reference so nesting works transparently. */
    @Output() cellSelected = new EventEmitter<{row: DisplayRow, startSegment: number, spanSegments: number, availableWidth: number} | null>();

    /** Emitted when a user removes an item in edit mode */
    @Output() itemRemoved = new EventEmitter<{row: DisplayRow, itemIndex: number}>();

    /** Emitted when an empty cell in a column is selected in edit mode */
    @Output() columnCellSelected = new EventEmitter<{column: DisplayColumn, startSegment: number, spanSegments: number, availableHeight: number} | null>();

    /** Emitted when a user removes an item from a column in edit mode */
    @Output() columnItemRemoved = new EventEmitter<{column: DisplayColumn, itemIndex: number}>();

    /** Emitted when the container element width is measured or changes */
    @Output() containerWidthMeasured = new EventEmitter<number>();

    /** Measured width of the .dashboard-container element */
    containerWidth: number = 0;

    /** Currently selected range in edit mode (row horizontal selection) */
    selectedRange: {row: DisplayRow, startSegment: number, endSegment: number, availableWidth: number} | null = null;

    /** Anchor point for row range selection (the first click) */
    private selectionAnchor: {row: DisplayRow, segment: number, availableWidth: number} | null = null;

    /** Currently selected range in a column (vertical selection) */
    selectedColumnRange: {column: DisplayColumn, startSegment: number, endSegment: number, availableHeight: number} | null = null;

    /** Anchor point for column range selection */
    private columnSelectionAnchor: {column: DisplayColumn, segment: number, availableHeight: number} | null = null;

    private resizeObserver?: ResizeObserver;

    constructor(private elementRef: ElementRef, private ngZone: NgZone,
                private solutionRunner: DisplaySolutionRunnerService,
                private feedback: DisplayFormFeedbackService) {}

    ngOnInit(): void {}

    ngOnChanges(changes: SimpleChanges): void {
        if (changes['dashboard']) {
            this.clearSelection();
            this.clearColumnSelection();
        }
        if (changes['editMode'] && !this.editMode) {
            this.clearSelection();
            this.clearColumnSelection();
        }
    }

    ngAfterViewInit(): void {
        const el = this.elementRef.nativeElement.querySelector('.dashboard-container');
        if (el) {
            this.containerWidth = el.clientWidth;
            this.containerWidthMeasured.emit(this.containerWidth);
            this.resizeObserver = new ResizeObserver(entries => {
                this.ngZone.run(() => {
                    this.containerWidth = entries[0].contentRect.width;
                    this.containerWidthMeasured.emit(this.containerWidth);
                });
            });
            this.resizeObserver.observe(el);
        }
    }

    ngOnDestroy(): void {
        this.resizeObserver?.disconnect();
        for (const state of this.formStates.values()) {
            state.debounceSub?.unsubscribe();
        }
    }

    // ================================================================
    // Form / button runtime (P4 — the display event/validation bridge)
    // ================================================================

    private formStates = new Map<string, FormRuntimeState>();

    // ---- submission feedback (survives the refreshDisplay re-render) ----

    private feedbackKey(item: DisplayItem): string {
        return DisplayFormFeedbackService.key(this.dashboard?.id, item.id);
    }

    /** The item's last outcome line (or in-flight marker), if any. */
    feedbackOf(item: DisplayItem): DisplayFormFeedback | null {
        return this.feedback.get(this.feedbackKey(item));
    }

    /** True while this item's solution request is in flight — even
     *  across a re-render, so the submit button stays disabled. */
    isRunning(item: DisplayItem): boolean {
        return this.feedback.isRunning(this.feedbackKey(item));
    }

    dismissFeedback(item: DisplayItem): void {
        this.feedback.clear(this.feedbackKey(item));
    }

    /** Words, not JSON: the solution's own message when it reported
     *  one, else Saved./Done, with at most a count as the detail. */
    private outcomeWords(summary: DisplayRunSummary | null): { text: string; detail?: string } {
        const message = summary?.message || '';
        const committed = summary?.committed?.length ?? 0;
        const written = summary?.written ?? null;
        const saved = committed > 0 || (written ?? 0) > 0;
        const refreshed = (summary?.events || []).some(e => e?.name === 'refreshDisplay');
        const text = message
            || (saved ? 'Saved.' : refreshed ? 'Done — display refreshed' : 'Done.');
        let detail: string | undefined;
        if (written !== null) {
            detail = `${written} ${written === 1 ? 'row' : 'rows'} written`;
        } else if (committed > 0) {
            detail = `${committed} ${committed === 1 ? 'change' : 'changes'} saved`;
        }
        if (refreshed && (message || saved)) {
            detail = detail ? `${detail} · display refreshed` : 'Display refreshed';
        }
        return detail ? { text, detail } : { text };
    }

    /** Lazily build (and cache) the reactive form for a 'form' item;
     *  on every call, roll {today}/{now} defaults if the date changed. */
    getFormState(item: DisplayItem): FormRuntimeState {
        let state = this.formStates.get(item.id);
        if (state) { this.rollDateDefaults(state); return state; }

        const config = (item.item || {}) as FormDisplayConfig;
        const fields: FormRuntimeState['fields'] = [];
        const controls: Record<string, FormControl> = {};

        const sorted = [...(config.formFields || [])]
            .filter(f => f.visible !== false)
            .sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0));
        for (const f of sorted) {
            const ftype = (f.fieldType || '').toLowerCase();
            const inputType = ['int', 'integer', 'float', 'number', 'num'].includes(ftype)
                ? 'number' : ['bool', 'boolean'].includes(ftype) ? 'checkbox' : 'text';
            fields.push({
                key: f.fieldName,
                label: f.displayName || f.fieldName,
                inputType,
                required: !!f.required,
                placeholder: f.placeholder || '',
            });
            controls[f.fieldName] = new FormControl(inputType === 'checkbox' ? false : '');
        }
        const dateDefaults: FormRuntimeState['dateDefaults'] = [];
        const at = new Date();
        for (const v of config.extraVariables || []) {
            const inputType = v.dataType === 'number' ? 'number'
                : v.dataType === 'boolean' ? 'checkbox' : 'text';
            fields.push({
                key: v.variableName,
                label: v.displayName || v.variableName,
                inputType,
                required: !!v.required,
                placeholder: v.placeholder || '',
            });
            // {today}/{now} are resolved HERE, at render time (the page
            // may have substituted already and left the raw template in
            // defaultValueTemplate; a form reached without display-page
            // still resolves its own).
            const template = (v as any).defaultValueTemplate
                ?? (hasDatePlaceholder(v.defaultValue) ? v.defaultValue : null);
            if (typeof template === 'string') {
                dateDefaults.push({ key: v.variableName, template });
            }
            const initial = template !== null && template !== undefined
                ? resolveDatePlaceholders(template, at) : v.defaultValue;
            controls[v.variableName] = new FormControl(
                initial ?? (inputType === 'checkbox' ? false : ''));
        }

        state = {
            group: new FormGroup(controls),
            fields,
            fieldErrors: {},
            dateDefaults,
            resolvedDate: todayIso(at),
        };
        // Debounce mode: value changes auto-submit after quiet time
        // (mirrors the IC editor's debounce pattern).
        if (config.submissionMode === 'debounce') {
            state.debounceSub = state.group.valueChanges
                .pipe(debounceTime(config.debounceDelayMs || 400))
                .subscribe(() => this.submitForm(item));
        }
        this.formStates.set(item.id, state);
        return state;
    }

    /** A page left open past midnight: re-resolve {today}/{now} defaults
     *  for fields the user has not touched. Cheap — one string compare
     *  per change-detection pass, work only on the day boundary. */
    private rollDateDefaults(state: FormRuntimeState): void {
        if (!state.dateDefaults.length) { return; }
        const at = new Date();
        const today = todayIso(at);
        if (state.resolvedDate === today) { return; }
        state.resolvedDate = today;
        for (const d of state.dateDefaults) {
            const control = state.group.get(d.key);
            if (control && control.pristine) {
                control.setValue(resolveDatePlaceholders(d.template, at), { emitEvent: false });
            }
        }
    }

    /** Submit a form item: run its linked solution through the
     *  EXECUTION path and surface verdicts inline. The outcome is
     *  written to DisplayFormFeedbackService (not to this instance) so
     *  it is still on screen after the solution's refreshDisplay
     *  rebuilds the renderer. */
    async submitForm(item: DisplayItem): Promise<void> {
        if (this.editMode) return;   // edit mode never fires solutions
        const config = (item.item || {}) as FormDisplayConfig;
        const state = this.getFormState(item);
        const key = this.feedbackKey(item);
        if (this.feedback.isRunning(key)) return;
        if (!config.linkedSolutionName) {
            this.feedback.setOutcome(key, 'error', 'No solution is linked to this form.');
            return;
        }
        this.feedback.markRunning(key);
        state.fieldErrors = {};
        try {
            const result = await this.solutionRunner.run(
                config.linkedSolutionName, state.group.value);
            const summary = result.summary;
            if (summary?.validation) {
                for (const [fname, verdict] of Object.entries(summary.validation)) {
                    if (verdict && !verdict.valid) {
                        state.fieldErrors[fname] = verdict.errors || ['Invalid.'];
                    }
                }
            }
            if (result.success && summary?.formValid !== false) {
                const words = this.outcomeWords(summary);
                this.feedback.setOutcome(key, 'ok', words.text, words.detail);
            } else if (summary?.formValid === false) {
                const bad = summary?.invalidFields?.length ?? Object.keys(state.fieldErrors).length;
                this.feedback.setOutcome(key, 'error', 'Please fix the highlighted fields.',
                    bad > 0 ? `${bad} ${bad === 1 ? 'field needs' : 'fields need'} attention` : undefined);
            } else {
                this.feedback.setOutcome(key, 'error', result.error || 'The linked solution failed.');
            }
        } catch (err: any) {
            this.feedback.setOutcome(key, 'error', err?.message || 'The linked solution failed.');
        }
    }

    /** Click a button item: run its linked solution with params mapped
     *  from the display context. Same feedback store as forms. */
    async onButtonClick(item: DisplayItem): Promise<void> {
        if (this.editMode) return;
        const config = (item.item || {}) as ButtonDisplayConfig;
        const key = this.feedbackKey(item);
        if (this.feedback.isRunning(key)) return;
        if (!config.linkedSolutionName) {
            this.feedback.setOutcome(key, 'error', 'No solution is linked to this button.');
            return;
        }
        const params: Record<string, any> = {};
        for (const [paramName, contextKey] of Object.entries(config.paramMappings || {})) {
            params[paramName] = (this.context as any)?.[contextKey];
        }
        this.feedback.markRunning(key);
        try {
            const result = await this.solutionRunner.run(
                config.linkedSolutionName, params);
            if (result.success) {
                const words = this.outcomeWords(result.summary);
                this.feedback.setOutcome(key, 'ok', words.text, words.detail);
            } else {
                this.feedback.setOutcome(key, 'error', result.error || 'The linked solution failed.');
            }
        } catch (err: any) {
            this.feedback.setOutcome(key, 'error', err?.message || 'The linked solution failed.');
        }
    }

    // ================================================================
    // Width calculation helpers
    // ================================================================

    /** CSS constants (must match dashboard-renderer.css) */
    private static readonly EDIT_GAP = 6;
    private static readonly NORMAL_GAP = 16;
    private static readonly NESTED_PAD = 8;
    private static readonly MIN_CELL = 40;

    /**
     * Calculate the available pixel width for nested rows inside a container item.
     * Accounts for the parent grid gap, item span, and nested-row-container padding.
     */
    calculateNestedWidth(parentWidthPx: number, itemSegments: number, parentSegments: number): number {
        const gap = this.editMode ? DisplayRendererComponent.EDIT_GAP : DisplayRendererComponent.NORMAL_GAP;
        const colWidth = (parentWidthPx - gap * (parentSegments - 1)) / parentSegments;
        const itemWidth = colWidth * itemSegments + gap * (itemSegments - 1);
        return itemWidth - 2 * DisplayRendererComponent.NESTED_PAD;
    }

    /**
     * Calculate the maximum number of grid columns that fit in the given pixel width.
     * Uses MIN_CELL as the minimum usable cell width.
     */
    calculateMaxColumns(availableWidthPx: number): number {
        const gap = this.editMode ? DisplayRendererComponent.EDIT_GAP : DisplayRendererComponent.NORMAL_GAP;
        if (availableWidthPx < DisplayRendererComponent.MIN_CELL) return 0;
        return Math.max(1, Math.floor((availableWidthPx + gap) / (DisplayRendererComponent.MIN_CELL + gap)));
    }

    // ================================================================
    // Cell map — position-aware grid analysis
    // ================================================================

    /**
     * Builds a cell map for a row. Items with gridColumnStart are placed
     * at their explicit position; items without are auto-flowed into the
     * first available contiguous gap. Every remaining segment becomes an
     * individually selectable empty cell.
     */
    getRowCellMap(row: DisplayRow): GridCell[] {
        const cells: GridCell[] = [];
        const occupied: Set<number> = new Set();
        const itemStarts: Map<DisplayItem, number> = new Map();

        // Phase 0: mark segments occupied by columns (columns share the same row grid)
        for (const col of row.columns) {
            if (col.gridColumnStart != null) {
                for (let s = col.gridColumnStart; s < col.gridColumnStart + col.columnSegmentsUsed; s++) {
                    occupied.add(s);
                }
            }
        }
        // Auto-place columns without gridColumnStart
        for (const col of row.columns) {
            if (col.gridColumnStart == null) {
                for (let start = 1; start <= row.rowSegments - col.columnSegmentsUsed + 1; start++) {
                    let fits = true;
                    for (let s = start; s < start + col.columnSegmentsUsed; s++) {
                        if (occupied.has(s)) { fits = false; break; }
                    }
                    if (fits) {
                        for (let s = start; s < start + col.columnSegmentsUsed; s++) {
                            occupied.add(s);
                        }
                        break;
                    }
                }
            }
        }

        // Phase 1: place explicitly positioned items
        for (const item of row.dashboardItems) {
            if (item.gridColumnStart != null) {
                itemStarts.set(item, item.gridColumnStart);
                for (let s = item.gridColumnStart; s < item.gridColumnStart + item.rowSegmentsUsed; s++) {
                    occupied.add(s);
                }
            }
        }

        // Phase 2: auto-place items without gridColumnStart
        for (const item of row.dashboardItems) {
            if (item.gridColumnStart == null) {
                for (let start = 1; start <= row.rowSegments - item.rowSegmentsUsed + 1; start++) {
                    let fits = true;
                    for (let s = start; s < start + item.rowSegmentsUsed; s++) {
                        if (occupied.has(s)) { fits = false; break; }
                    }
                    if (fits) {
                        itemStarts.set(item, start);
                        for (let s = start; s < start + item.rowSegmentsUsed; s++) {
                            occupied.add(s);
                        }
                        break;
                    }
                }
            }
        }

        // Phase 3: walk segments left-to-right and build the cell list
        const processedItems = new Set<DisplayItem>();
        let seg = 1;
        while (seg <= row.rowSegments) {
            // Check if a (not-yet-processed) item starts here
            let itemHere: DisplayItem | undefined;
            for (const item of row.dashboardItems) {
                if (itemStarts.get(item) === seg && !processedItems.has(item)) {
                    itemHere = item;
                    break;
                }
            }

            if (itemHere) {
                processedItems.add(itemHere);
                cells.push({
                    type: 'item',
                    item: itemHere,
                    startSegment: seg,
                    spanSegments: itemHere.rowSegmentsUsed
                });
                seg += itemHere.rowSegmentsUsed;
            } else if (occupied.has(seg)) {
                // Continuation of an item (shouldn't normally be hit as item start)
                seg++;
            } else {
                cells.push({
                    type: 'empty',
                    startSegment: seg,
                    spanSegments: 1
                });
                seg++;
            }
        }

        return cells;
    }

    // ================================================================
    // Cell selection (range-based, works at any nesting depth)
    // ================================================================

    /**
     * Handles clicking an empty cell for range selection.
     *  - Clicking an already-selected cell: deselects everything
     *  - First click (or different row): sets anchor + selects one cell
     *  - Second click in same row: extends range from anchor to clicked cell
     */
    selectCell(row: DisplayRow, segment: number, availableWidth: number): void {
        // Clear column selection when selecting in a row
        this.clearColumnSelection();

        // If clicking any cell that is already selected, deselect everything
        if (this.isCellSelected(row, segment)) {
            this.clearSelection();
            this.emitSelection();
            return;
        }

        // Different row or no anchor: start fresh selection
        if (!this.selectionAnchor || this.selectionAnchor.row !== row) {
            this.selectionAnchor = { row, segment, availableWidth };
            this.selectedRange = { row, startSegment: segment, endSegment: segment, availableWidth };
        } else {
            // Same row: extend range from anchor to clicked cell
            const start = Math.min(this.selectionAnchor.segment, segment);
            const end = Math.max(this.selectionAnchor.segment, segment);
            this.selectedRange = { row, startSegment: start, endSegment: end, availableWidth: this.selectionAnchor.availableWidth };
        }

        this.emitSelection();
    }

    /** Whether this segment is within the selected range */
    isCellSelected(row: DisplayRow, segment: number): boolean {
        if (!this.selectedRange || this.selectedRange.row !== row) return false;
        return segment >= this.selectedRange.startSegment && segment <= this.selectedRange.endSegment;
    }

    /** Whether this segment is the first in the selected range */
    isSelectionStart(row: DisplayRow, segment: number): boolean {
        return !!this.selectedRange &&
            this.selectedRange.row === row &&
            this.selectedRange.startSegment === segment;
    }

    /** Whether this segment is the last in the selected range */
    isSelectionEnd(row: DisplayRow, segment: number): boolean {
        return !!this.selectedRange &&
            this.selectedRange.row === row &&
            this.selectedRange.endSegment === segment;
    }

    /** Whether the selection spans exactly one cell */
    isSingleCellSelection(): boolean {
        return !!this.selectedRange &&
            this.selectedRange.startSegment === this.selectedRange.endSegment;
    }

    // ================================================================
    // Column cell map — vertical segment analysis
    // ================================================================

    /**
     * Builds a cell map for a column's vertical segments.
     * Works like getRowCellMap but for top→bottom placement.
     * Items use rowSegmentsUsed as the number of vertical segments they occupy.
     */
    getColumnCellMap(column: DisplayColumn): GridCell[] {
        const cells: GridCell[] = [];
        const occupied: Set<number> = new Set();
        const itemStarts: Map<DisplayItem, number> = new Map();

        // Phase 1: place explicitly positioned items
        for (const item of column.dashboardItems) {
            if (item.gridColumnStart != null) {
                itemStarts.set(item, item.gridColumnStart);
                for (let s = item.gridColumnStart; s < item.gridColumnStart + item.rowSegmentsUsed; s++) {
                    occupied.add(s);
                }
            }
        }

        // Phase 2: auto-place items without gridColumnStart
        for (const item of column.dashboardItems) {
            if (item.gridColumnStart == null) {
                for (let start = 1; start <= column.columnSegments - item.rowSegmentsUsed + 1; start++) {
                    let fits = true;
                    for (let s = start; s < start + item.rowSegmentsUsed; s++) {
                        if (occupied.has(s)) { fits = false; break; }
                    }
                    if (fits) {
                        itemStarts.set(item, start);
                        for (let s = start; s < start + item.rowSegmentsUsed; s++) {
                            occupied.add(s);
                        }
                        break;
                    }
                }
            }
        }

        // Phase 3: walk segments top-to-bottom and build cell list
        const processedItems = new Set<DisplayItem>();
        let seg = 1;
        while (seg <= column.columnSegments) {
            let itemHere: DisplayItem | undefined;
            for (const item of column.dashboardItems) {
                if (itemStarts.get(item) === seg && !processedItems.has(item)) {
                    itemHere = item;
                    break;
                }
            }

            if (itemHere) {
                processedItems.add(itemHere);
                cells.push({
                    type: 'item',
                    item: itemHere,
                    startSegment: seg,
                    spanSegments: itemHere.rowSegmentsUsed
                });
                seg += itemHere.rowSegmentsUsed;
            } else if (occupied.has(seg)) {
                seg++;
            } else {
                cells.push({
                    type: 'empty',
                    startSegment: seg,
                    spanSegments: 1
                });
                seg++;
            }
        }

        return cells;
    }

    // ================================================================
    // Column cell selection (vertical range, mirrors row selection)
    // ================================================================

    /**
     * Handles clicking an empty cell in a column for vertical range selection.
     * Clears any active row selection when a column cell is clicked.
     */
    selectColumnCell(column: DisplayColumn, segment: number, availableHeight: number): void {
        // Clear row selection when selecting in a column
        this.clearSelection();

        // If clicking an already-selected column cell, deselect
        if (this.isColumnCellSelected(column, segment)) {
            this.clearColumnSelection();
            this.emitColumnSelection();
            return;
        }

        // Different column or no anchor: start fresh
        if (!this.columnSelectionAnchor || this.columnSelectionAnchor.column !== column) {
            this.columnSelectionAnchor = { column, segment, availableHeight };
            this.selectedColumnRange = { column, startSegment: segment, endSegment: segment, availableHeight };
        } else {
            // Same column: extend range
            const start = Math.min(this.columnSelectionAnchor.segment, segment);
            const end = Math.max(this.columnSelectionAnchor.segment, segment);
            this.selectedColumnRange = { column, startSegment: start, endSegment: end, availableHeight: this.columnSelectionAnchor.availableHeight };
        }

        this.emitColumnSelection();
    }

    isColumnCellSelected(column: DisplayColumn, segment: number): boolean {
        if (!this.selectedColumnRange || this.selectedColumnRange.column !== column) return false;
        return segment >= this.selectedColumnRange.startSegment && segment <= this.selectedColumnRange.endSegment;
    }

    isColumnSelectionStart(column: DisplayColumn, segment: number): boolean {
        return !!this.selectedColumnRange &&
            this.selectedColumnRange.column === column &&
            this.selectedColumnRange.startSegment === segment;
    }

    isColumnSelectionEnd(column: DisplayColumn, segment: number): boolean {
        return !!this.selectedColumnRange &&
            this.selectedColumnRange.column === column &&
            this.selectedColumnRange.endSegment === segment;
    }

    isSingleColumnCellSelection(): boolean {
        return !!this.selectedColumnRange &&
            this.selectedColumnRange.startSegment === this.selectedColumnRange.endSegment;
    }

    clearColumnSelection(): void {
        this.selectedColumnRange = null;
        this.columnSelectionAnchor = null;
        this.columnCellSelected.emit(null);
    }

    private emitColumnSelection(): void {
        if (this.selectedColumnRange) {
            const span = this.selectedColumnRange.endSegment - this.selectedColumnRange.startSegment + 1;
            this.columnCellSelected.emit({
                column: this.selectedColumnRange.column,
                startSegment: this.selectedColumnRange.startSegment,
                spanSegments: span,
                availableHeight: this.selectedColumnRange.availableHeight
            });
        } else {
            this.columnCellSelected.emit(null);
        }
    }

    // ================================================================
    // Item removal
    // ================================================================

    /** Removes an item from a row and emits the event */
    onRemoveItem(row: DisplayRow, itemIndex: number, event: Event): void {
        event.stopPropagation();
        this.itemRemoved.emit({ row, itemIndex });
    }

    /** Removes an item from a column and emits the event */
    onRemoveColumnItem(column: DisplayColumn, itemIndex: number, event: Event): void {
        event.stopPropagation();
        this.columnItemRemoved.emit({ column, itemIndex });
    }

    // ================================================================
    // Grid helpers
    // ================================================================

    /** Gets the grid template columns CSS value for a row */
    getGridTemplate(row: DisplayRow): string {
        return `repeat(${row.rowSegments}, 1fr)`;
    }

    /** Gets the row height style */
    getRowStyle(row: DisplayRow): { [key: string]: string } {
        const style: { [key: string]: string } = {};
        if (!row.autoHeight) {
            style['min-height'] = `${row.minRowHeight}px`;
            if (row.maxRowHeight) {
                style['max-height'] = `${row.maxRowHeight}px`;
            }
        }
        return style;
    }

    /**
     * Gets the grid-column CSS value for an item.
     * Explicit: "3 / span 5"   Auto: "span 5"
     */
    getItemGridColumn(item: DisplayItem): string {
        if (item.gridColumnStart != null) {
            return `${item.gridColumnStart} / span ${item.rowSegmentsUsed}`;
        }
        return `span ${item.rowSegmentsUsed}`;
    }

    // ================================================================
    // Column grid helpers
    // ================================================================

    /** Gets the grid template rows CSS value for a column */
    getColumnGridTemplate(column: DisplayColumn): string {
        return `repeat(${column.columnSegments}, 1fr)`;
    }

    /** Gets the grid-column CSS for a column within its parent row */
    getColumnGridColumn(column: DisplayColumn): string {
        if (column.gridColumnStart != null) {
            return `${column.gridColumnStart} / span ${column.columnSegmentsUsed}`;
        }
        return `span ${column.columnSegmentsUsed}`;
    }

    /** Gets the grid-row CSS for an item inside a column (vertical placement) */
    getItemGridRow(item: DisplayItem): string {
        if (item.gridColumnStart != null) {
            return `${item.gridColumnStart} / span ${item.rowSegmentsUsed}`;
        }
        return `span ${item.rowSegmentsUsed}`;
    }

    /** Gets the column style (min/max height) */
    getColumnStyle(column: DisplayColumn): { [key: string]: string } {
        const style: { [key: string]: string } = {};
        if (!column.autoHeight) {
            style['min-height'] = `${column.minColumnHeight}px`;
            if (column.maxColumnHeight) {
                style['max-height'] = `${column.maxColumnHeight}px`;
            }
        }
        return style;
    }

    // ================================================================
    // Component resolution
    // ================================================================

    /** Gets the Angular component class for a component item */
    getComponent(item: DisplayItem): Type<any> | null {
        if (item.type !== 'component') return null;
        const componentName = item.componentProps?.componentName;
        if (!componentName) return null;
        const entry = DISPLAY_COMPONENT_REGISTRY.getComponent(componentName);
        return entry ? entry.component : null;
    }

    /** Gets the inputs to pass to a component item */
    getComponentInputs(item: DisplayItem): Record<string, any> {
        const componentName = item.componentProps?.componentName;
        const entry = componentName ? DISPLAY_COMPONENT_REGISTRY.getComponent(componentName) : null;
        const defaultInputs = entry?.defaultInputs || {};
        // `supportedScreen` is the renderer-level disclaimer knob, not a
        // component input — consumed by screen-support-notice instead.
        const { supportedScreen, ...itemInputs } =
            item.componentProps?.inputs || {};
        return { ...this.context, ...defaultInputs, ...itemInputs };
    }

    /** The item's declared supported-screen range (disclaimer knob). */
    supportedScreenOf(item: DisplayItem): SupportedScreen | null {
        const support = item.componentProps?.inputs?.['supportedScreen'];
        return support && typeof support === 'object'
            ? support as SupportedScreen : null;
    }

    // ================================================================
    // Content helpers
    // ================================================================

    getMetricData(item: DisplayItem): MetricData | null {
        if (item.type !== 'metric') return null;
        return item.item as MetricData;
    }

    getTextContent(item: DisplayItem): string {
        if (item.type !== 'text') return '';
        const content = item.item;
        if (content === null || content === undefined) return '';
        if (typeof content === 'string') return content;
        // `item` is typed `any`, so a text item may legitimately arrive
        // as an object. Blind-casting it to string rendered the words
        // "[object Object]" on the page; accept the shapes a configurer
        // would reasonably write, and fall back to readable JSON rather
        // than a cast artifact.
        if (typeof content === 'object') {
            const named = (content as any).content ?? (content as any).text
                ?? (content as any).value;
            if (typeof named === 'string') return named;
            if (named !== null && named !== undefined) return String(named);
            try {
                return JSON.stringify(content);
            } catch {
                return '';
            }
        }
        return String(content);
    }

    isItemVisible(item: DisplayItem): boolean {
        return item.visible !== false;
    }

    // ================================================================
    // CSS class helpers
    // ================================================================

    getItemClasses(item: DisplayItem): string {
        const classes: string[] = ['dashboard-item', `dashboard-item-${item.type}`];
        if (item.cssClass) classes.push(item.cssClass);
        if (item.collapsed) classes.push('collapsed');
        return classes.join(' ');
    }

    getRowClasses(row: DisplayRow): string {
        const classes: string[] = ['dashboard-row'];
        if (row.cssClass) classes.push(row.cssClass);
        if (row.autoHeight) classes.push('auto-height');
        return classes.join(' ');
    }

    getColumnClasses(column: DisplayColumn): string {
        const classes: string[] = ['dashboard-column'];
        if (column.cssClass) classes.push(column.cssClass);
        if (column.autoHeight) classes.push('auto-height');
        return classes.join(' ');
    }

    // ================================================================
    // Track functions
    // ================================================================

    trackRow(index: number, row: DisplayRow): number {
        return row.index;
    }

    trackColumn(index: number, column: DisplayColumn): number {
        return column.index;
    }

    trackItem(index: number, item: DisplayItem): string {
        return item.id;
    }

    trackCell(index: number, cell: GridCell): string {
        return `${cell.type}-${cell.startSegment}`;
    }

    // ================================================================
    // Private
    // ================================================================

    clearSelection(): void {
        this.selectedRange = null;
        this.selectionAnchor = null;
        this.cellSelected.emit(null);
    }

    private emitSelection(): void {
        if (this.selectedRange) {
            const span = this.selectedRange.endSegment - this.selectedRange.startSegment + 1;
            this.cellSelected.emit({
                row: this.selectedRange.row,
                startSegment: this.selectedRange.startSegment,
                spanSegments: span,
                availableWidth: this.selectedRange.availableWidth
            });
        } else {
            this.cellSelected.emit(null);
        }
    }
}
