import { Component, Input, Output, EventEmitter, OnInit, OnChanges, OnDestroy, AfterViewInit, SimpleChanges, Type, ElementRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { Display } from '@models/dashboards/Display';
import { DisplayRow } from '@models/dashboards/DisplayRow';
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
 * Represents a single cell in the grid (either an item or empty space)
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

    /** Emitted when the container element width is measured or changes */
    @Output() containerWidthMeasured = new EventEmitter<number>();

    /** Measured width of the .dashboard-container element */
    containerWidth: number = 0;

    /** Currently selected range in edit mode */
    selectedRange: {row: DisplayRow, startSegment: number, endSegment: number, availableWidth: number} | null = null;

    /** Anchor point for range selection (the first click) */
    private selectionAnchor: {row: DisplayRow, segment: number, availableWidth: number} | null = null;

    private resizeObserver?: ResizeObserver;

    constructor(private elementRef: ElementRef, private ngZone: NgZone) {}

    ngOnInit(): void {}

    ngOnChanges(changes: SimpleChanges): void {
        if (changes['dashboard']) {
            console.log('[DisplayRenderer] Display changed:', this.dashboard?.name);
            this.clearSelection();
        }
        if (changes['editMode'] && !this.editMode) {
            this.clearSelection();
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
    // Item removal
    // ================================================================

    /** Removes an item from a row and emits the event */
    onRemoveItem(row: DisplayRow, itemIndex: number, event: Event): void {
        event.stopPropagation();
        this.itemRemoved.emit({ row, itemIndex });
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

    // ================================================================
    // Track functions
    // ================================================================

    trackRow(index: number, row: DisplayRow): number {
        return row.index;
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
