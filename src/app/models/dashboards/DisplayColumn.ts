import { DisplayItem } from "./DisplayItem";

/**
 * Represents a column within a dashboard, containing multiple dashboard items
 * arranged vertically. This is the 90-degree counterpart of DisplayRow:
 *   - DisplayRow:    horizontal strip, items flow left→right, segments = columns
 *                    Width is managed by segments. Height is configured manually (min/max).
 *   - DisplayColumn: vertical strip, items flow top→bottom, segments = rows
 *                    Width is managed by row segments (columnSegmentsUsed).
 *                    Height is configured manually (min/max).
 *
 * A column occupies a fixed number of horizontal segments in its parent row
 * (via columnSegmentsUsed) and divides its own height into `columnSegments`
 * for placing items vertically.
 */
export class DisplayColumn {
    /** Position index of this column within the parent row */
    index: number;

    /** How many horizontal segments this column occupies in the parent row */
    columnSegmentsUsed: number;

    /** Explicit grid column start position (1-based) within the parent row.
     *  When set, the column is placed at this position; unset columns auto-flow. */
    gridColumnStart?: number;

    /** Total number of vertical segments (rows) in this column's internal grid */
    columnSegments: number;

    /** Minimum height of the column in pixels */
    minColumnHeight: number;

    /** Maximum height of the column in pixels (undefined = no max) */
    maxColumnHeight?: number;

    /** Items contained in this column, arranged vertically */
    dashboardItems: DisplayItem[];

    /** Whether the column height should auto-adjust to content */
    autoHeight: boolean;

    /** Optional CSS class for styling */
    cssClass?: string;

    constructor(
        index: number = 0,
        columnSegmentsUsed: number = 6,
        columnSegments: number = 12,
        minColumnHeight: number = 250,
        maxColumnHeight?: number
    ) {
        this.index = index;
        this.columnSegmentsUsed = columnSegmentsUsed;
        this.columnSegments = columnSegments;
        this.minColumnHeight = minColumnHeight;
        this.maxColumnHeight = maxColumnHeight;
        this.dashboardItems = [];
        this.autoHeight = false;
    }

    /**
     * Adds an item to this column
     */
    addItem(item: DisplayItem): this {
        item.index = this.dashboardItems.length;
        this.dashboardItems.push(item);
        return this;
    }

    /**
     * Removes an item at the specified index
     */
    removeItem(index: number): DisplayItem | undefined {
        if (index >= 0 && index < this.dashboardItems.length) {
            const removed = this.dashboardItems.splice(index, 1)[0];
            this.reindexItems();
            return removed;
        }
        return undefined;
    }

    /**
     * Reindexes all items after a removal
     */
    private reindexItems(): void {
        this.dashboardItems.forEach((item, idx) => {
            item.index = idx;
        });
    }

    /**
     * Gets the total vertical segments used by all items
     */
    getUsedSegments(): number {
        return this.dashboardItems.reduce((sum, item) => sum + item.rowSegmentsUsed, 0);
    }

    /**
     * Gets the remaining available vertical segments
     */
    getAvailableSegments(): number {
        return this.columnSegments - this.getUsedSegments();
    }

    /**
     * Checks if there's room for an item with the specified segment count
     */
    canFitItem(segmentsNeeded: number): boolean {
        return this.getAvailableSegments() >= segmentsNeeded;
    }

    /**
     * Gets the number of items in this column
     */
    get itemCount(): number {
        return this.dashboardItems.length;
    }

    /**
     * Checks if the column is empty
     */
    isEmpty(): boolean {
        return this.dashboardItems.length === 0;
    }
}
