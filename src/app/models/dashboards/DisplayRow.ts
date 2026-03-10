import { DisplayItem } from "./DisplayItem";
import { DisplayColumn } from "./DisplayColumn";

/**
 * Represents a row within a dashboard, containing multiple dashboard items
 * arranged in a grid-like layout.
 *
 * A row can contain:
 *   - dashboardItems: items that flow left→right across the row's horizontal segments
 *   - columns: vertical subdivisions that each occupy some horizontal segments
 *              and internally divide their height into vertical segments (rows)
 *
 * When a row has columns, the columns act like items in terms of horizontal
 * placement but provide their own vertical grid for nesting items top→bottom.
 */
export class DisplayRow {
    /** Position index of this row within the dashboard */
    index: number;

    /** Minimum height of the row in pixels */
    minRowHeight: number;

    /** Maximum height of the row in pixels (undefined = no max) */
    maxRowHeight?: number;

    /** Total number of segments (columns) in this row's grid */
    rowSegments: number;

    /** Items contained in this row */
    dashboardItems: DisplayItem[];

    /** Columns contained in this row — vertical subdivisions that stack items top→bottom */
    columns: DisplayColumn[];

    /** Whether the row height should auto-adjust to content */
    autoHeight: boolean;

    /** Optional CSS class for styling */
    cssClass?: string;

    constructor(
        index: number = 0,
        rowSegments: number = 12,
        minRowHeight: number = 250,
        maxRowHeight?: number
    ) {
        this.index = index;
        this.rowSegments = rowSegments;
        this.minRowHeight = minRowHeight;
        this.maxRowHeight = maxRowHeight;
        this.dashboardItems = [];
        this.columns = [];
        this.autoHeight = false;
    }

    /**
     * Adds a column to this row.
     * The column's columnSegmentsUsed determines how many horizontal
     * segments it consumes (just like an item's rowSegmentsUsed).
     */
    addColumn(column: DisplayColumn): this {
        column.index = this.columns.length;
        this.columns.push(column);
        return this;
    }

    /**
     * Removes a column at the specified index
     */
    removeColumn(index: number): DisplayColumn | undefined {
        if (index >= 0 && index < this.columns.length) {
            const removed = this.columns.splice(index, 1)[0];
            this.columns.forEach((col, idx) => col.index = idx);
            return removed;
        }
        return undefined;
    }

    /**
     * Checks if this row uses a column-based layout
     */
    hasColumns(): boolean {
        return this.columns.length > 0;
    }

    /**
     * Gets the total horizontal segments used by columns
     */
    getColumnsUsedSegments(): number {
        return this.columns.reduce((sum, col) => sum + col.columnSegmentsUsed, 0);
    }

    /**
     * Adds an item to this row
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
     * Gets the total segments used by all items
     */
    getUsedSegments(): number {
        return this.dashboardItems.reduce((sum, item) => sum + item.rowSegmentsUsed, 0);
    }

    /**
     * Gets the remaining available segments
     */
    getAvailableSegments(): number {
        return this.rowSegments - this.getUsedSegments();
    }

    /**
     * Checks if there's room for an item with the specified segment count
     */
    canFitItem(segmentsNeeded: number): boolean {
        return this.getAvailableSegments() >= segmentsNeeded;
    }

    /**
     * Gets the number of items in this row
     */
    get itemCount(): number {
        return this.dashboardItems.length;
    }

    /**
     * Checks if the row is empty
     */
    isEmpty(): boolean {
        return this.dashboardItems.length === 0;
    }
}
