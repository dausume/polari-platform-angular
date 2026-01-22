/**
 * FilterConfig.ts
 * Configuration for table filtering behavior
 */

/**
 * Filter configuration interface
 */
export interface IFilterConfig {
    /** Whether global (search all columns) filter is enabled */
    globalFilterEnabled: boolean;

    /** Placeholder text for the global filter input */
    globalFilterPlaceholder: string;

    /** Debounce time in milliseconds for filter input */
    filterDebounceMs: number;

    /** Whether per-column filters are enabled */
    columnFiltersEnabled: boolean;

    /** Currently active filter values by column name */
    activeFilters: Record<string, string>;

    /** Whether filter is case-sensitive */
    caseSensitive: boolean;
}

/**
 * Default filter values
 */
export const DEFAULT_FILTER: IFilterConfig = {
    globalFilterEnabled: true,
    globalFilterPlaceholder: 'Search...',
    filterDebounceMs: 300,
    columnFiltersEnabled: false,
    activeFilters: {},
    caseSensitive: false
};

/**
 * Filter configuration class with utility methods
 */
export class FilterConfig implements IFilterConfig {
    globalFilterEnabled: boolean = true;
    globalFilterPlaceholder: string = 'Search...';
    filterDebounceMs: number = 300;
    columnFiltersEnabled: boolean = false;
    activeFilters: Record<string, string> = {};
    caseSensitive: boolean = false;

    constructor(config?: Partial<IFilterConfig>) {
        if (config) {
            Object.assign(this, config);
            // Ensure activeFilters is a new object
            this.activeFilters = { ...(config.activeFilters || {}) };
        }
    }

    /**
     * Set filter value for a specific column
     */
    setColumnFilter(columnName: string, value: string): void {
        if (value && value.trim()) {
            this.activeFilters[columnName] = value.trim();
        } else {
            delete this.activeFilters[columnName];
        }
    }

    /**
     * Get filter value for a column
     */
    getColumnFilter(columnName: string): string | undefined {
        return this.activeFilters[columnName];
    }

    /**
     * Check if any filters are active
     */
    hasActiveFilters(): boolean {
        return Object.keys(this.activeFilters).length > 0;
    }

    /**
     * Get count of active filters
     */
    getActiveFilterCount(): number {
        return Object.keys(this.activeFilters).length;
    }

    /**
     * Clear filter for a specific column
     */
    clearColumnFilter(columnName: string): void {
        delete this.activeFilters[columnName];
    }

    /**
     * Clear all active filters
     */
    clearAllFilters(): void {
        this.activeFilters = {};
    }

    /**
     * Get list of columns with active filters
     */
    getFilteredColumns(): string[] {
        return Object.keys(this.activeFilters);
    }

    /**
     * Create from defaults
     */
    static createDefault(): FilterConfig {
        return new FilterConfig(DEFAULT_FILTER);
    }

    /**
     * Serialize to plain object
     */
    toJSON(): IFilterConfig {
        return {
            globalFilterEnabled: this.globalFilterEnabled,
            globalFilterPlaceholder: this.globalFilterPlaceholder,
            filterDebounceMs: this.filterDebounceMs,
            columnFiltersEnabled: this.columnFiltersEnabled,
            activeFilters: { ...this.activeFilters },
            caseSensitive: this.caseSensitive
        };
    }
}
