import { DisplayItem } from "./DisplayItem";

/**
 * Represents a row within a dashboard, containing multiple dashboard items
 * arranged in a grid-like layout.
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
        this.autoHeight = false;
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
