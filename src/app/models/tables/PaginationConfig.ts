/**
 * PaginationConfig.ts
 * Configuration for table pagination behavior
 */

/**
 * Pagination configuration interface
 */
export interface IPaginationConfig {
    /** Whether pagination is enabled */
    enabled: boolean;

    /** Current page size (number of rows per page) */
    pageSize: number;

    /** Available page size options for user selection */
    pageSizeOptions: number[];

    /** Whether to show first/last page navigation buttons */
    showFirstLastButtons: boolean;

    /** Whether to show page size selector */
    showPageSizeSelector: boolean;

    /** Label format for range display (e.g., "1-10 of 100") */
    rangeLabel?: string;
}

/**
 * Default pagination values
 */
export const DEFAULT_PAGINATION: IPaginationConfig = {
    enabled: true,
    pageSize: 10,
    pageSizeOptions: [5, 10, 25, 50, 100],
    showFirstLastButtons: true,
    showPageSizeSelector: true
};

/**
 * Pagination configuration class with utility methods
 */
export class PaginationConfig implements IPaginationConfig {
    enabled: boolean = true;
    pageSize: number = 10;
    pageSizeOptions: number[] = [5, 10, 25, 50, 100];
    showFirstLastButtons: boolean = true;
    showPageSizeSelector: boolean = true;
    rangeLabel?: string;

    constructor(config?: Partial<IPaginationConfig>) {
        if (config) {
            Object.assign(this, config);
        }
    }

    /**
     * Set page size, ensuring it's within available options
     */
    setPageSize(size: number): void {
        if (this.pageSizeOptions.includes(size)) {
            this.pageSize = size;
        } else {
            // Find closest available option
            const closest = this.pageSizeOptions.reduce((prev, curr) =>
                Math.abs(curr - size) < Math.abs(prev - size) ? curr : prev
            );
            this.pageSize = closest;
        }
    }

    /**
     * Add a page size option
     */
    addPageSizeOption(size: number): void {
        if (!this.pageSizeOptions.includes(size)) {
            this.pageSizeOptions.push(size);
            this.pageSizeOptions.sort((a, b) => a - b);
        }
    }

    /**
     * Create from defaults
     */
    static createDefault(): PaginationConfig {
        return new PaginationConfig(DEFAULT_PAGINATION);
    }

    /**
     * Serialize to plain object
     */
    toJSON(): IPaginationConfig {
        return {
            enabled: this.enabled,
            pageSize: this.pageSize,
            pageSizeOptions: [...this.pageSizeOptions],
            showFirstLastButtons: this.showFirstLastButtons,
            showPageSizeSelector: this.showPageSizeSelector,
            rangeLabel: this.rangeLabel
        };
    }
}
