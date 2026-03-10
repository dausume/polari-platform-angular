import { Component, Input, Output, EventEmitter, OnInit, OnChanges, OnDestroy, AfterViewInit, SimpleChanges, Type, ElementRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { Display } from '@models/dashboards/Display';
import { DisplayRow } from '@models/dashboards/DisplayRow';
import { DisplayColumn } from '@models/dashboards/DisplayColumn';
import { DisplayItem, DisplayItemType, MetricData } from '@models/dashboards/DisplayItem';
import { DISPLAY_COMPONENT_REGISTRY } from '@models/dashboards/ComponentRegistry';
import { DisplayMetricCardComponent } from '@components/dashboard/dashboard-metric-card/dashboard-metric-card';

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
    imports: [CommonModule, MatIconModule, DisplayMetricCardComponent]
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

    constructor(private elementRef: ElementRef, private ngZone: NgZone) {}

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
        const itemInputs = item.componentProps?.inputs || {};
        return { ...this.context, ...defaultInputs, ...itemInputs };
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
        return item.item as string || '';
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
