import { DisplayRow } from "./DisplayRow";

/**
 * Represents a complete dashboard containing multiple rows of items.
 * Displays organize content into a grid-based layout system.
 */
export class Display {
    /** Unique identifier for the dashboard */
    id: string;

    /** Display name of the dashboard */
    name: string;

    /** Optional description of the dashboard's purpose */
    description: string;

    /** Ordered list of rows in this dashboard */
    rows: DisplayRow[];

    /** Timestamp of last modification */
    lastModified?: number;

    constructor(id?: string, name?: string, description?: string) {
        this.id = id || this.generateId();
        this.name = name || '';
        this.description = description || '';
        this.rows = [];
        this.lastModified = Date.now();
    }

    /**
     * Generates a unique ID for the dashboard
     */
    private generateId(): string {
        return 'dashboard-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 11);
    }

    /**
     * Adds a row to the dashboard (fluent builder pattern)
     */
    addRow(row: DisplayRow): this {
        row.index = this.rows.length;
        this.rows.push(row);
        this.lastModified = Date.now();
        return this;
    }

    /**
     * Removes a row at the specified index
     */
    removeRow(index: number): DisplayRow | undefined {
        if (index >= 0 && index < this.rows.length) {
            const removed = this.rows.splice(index, 1)[0];
            this.reindexRows();
            this.lastModified = Date.now();
            return removed;
        }
        return undefined;
    }

    /**
     * Reindexes all rows after a removal
     */
    private reindexRows(): void {
        this.rows.forEach((row, idx) => {
            row.index = idx;
        });
    }

    /**
     * Gets the total number of rows
     */
    get rowCount(): number {
        return this.rows.length;
    }

    /**
     * Checks if the dashboard has any rows
     */
    isEmpty(): boolean {
        return this.rows.length === 0;
    }

    /**
     * Gets a row by index
     */
    getRow(index: number): DisplayRow | undefined {
        return this.rows[index];
    }

    /**
     * Creates a deep clone of this dashboard
     */
    clone(): Display {
        const cloned = new Display(this.id + '-clone', this.name, this.description);
        this.rows.forEach(row => {
            // Create new row with same configuration
            const clonedRow = new DisplayRow(
                row.index,
                row.rowSegments,
                row.minRowHeight,
                row.maxRowHeight
            );
            clonedRow.autoHeight = row.autoHeight;
            clonedRow.cssClass = row.cssClass;
            // Copy items (shallow copy for now)
            row.dashboardItems.forEach(item => clonedRow.addItem(item));
            cloned.addRow(clonedRow);
        });
        return cloned;
    }

    /**
     * Static factory: Creates a dashboard for a specific class/object type
     */
    static createForClass(className: string, displayName?: string): Display {
        const name = displayName || Display.formatClassName(className);
        return new Display(
            `dashboard-${className}`,
            `${name} Display`
        );
    }

    /**
     * Formats a camelCase class name to display format
     * e.g., "dataStream" -> "Data Stream"
     */
    static formatClassName(className: string): string {
        if (!className) return '';
        return className
            .replace(/([A-Z])/g, ' $1')
            .replace(/^./, s => s.toUpperCase())
            .trim();
    }
}
