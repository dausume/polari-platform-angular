/**
 * TableConfiguration.ts
 * Main table configuration model - coordinates sub-configurations
 *
 * This is the primary configuration class for dynamic class tables.
 * It uses composition to organize related settings into logical groups:
 * - ColumnConfiguration: Per-column display and behavior settings
 * - PaginationConfig: Page size and navigation settings
 * - FilterConfig: Search and filter settings
 * - SectionState: UI section expansion states
 */

import { ColumnConfiguration, IColumnConfiguration } from './ColumnConfiguration';
import { PaginationConfig, IPaginationConfig } from './PaginationConfig';
import { FilterConfig, IFilterConfig } from './FilterConfig';
import { SectionState, ISectionState } from './SectionState';

// Re-export sub-module types for convenience
export { PaginationConfig, IPaginationConfig } from './PaginationConfig';
export { FilterConfig, IFilterConfig } from './FilterConfig';
export { SectionState, ISectionState } from './SectionState';

/**
 * Sort order options for column arrangement
 */
export type SortOrder = 'alphabetical' | 'custom' | 'type' | 'none';

/**
 * Sort direction for column/data sorting
 */
export type SortDirection = 'asc' | 'desc';

/**
 * Table density/spacing options
 */
export type TableDensity = 'compact' | 'standard' | 'comfortable';

/**
 * Row selection mode
 */
export type SelectionMode = 'none' | 'single' | 'multiple';

/**
 * Current configuration schema version (for migrations)
 */
const CURRENT_VERSION = 1;

/**
 * Storage key prefix for localStorage
 */
const STORAGE_PREFIX = 'table_config_v2_';

/**
 * Complete table configuration interface
 */
export interface ITableConfiguration {
    id: string;
    className: string;
    displayName?: string;

    // Column settings
    columns: IColumnConfiguration[];
    removedColumns: string[];

    // Sorting
    sortOrder: SortOrder;
    sortDirection: SortDirection;
    sortColumn?: string;

    // Sub-configurations
    pagination: IPaginationConfig;
    filter: IFilterConfig;
    sections: ISectionState;

    // Display settings
    density: TableDensity;
    selectionMode: SelectionMode;
    showRowNumbers: boolean;
    showHeaders: boolean;
    stripedRows: boolean;
    showGridLines: boolean;
    hoverHighlight: boolean;
    reorderableColumns: boolean;
    fixedHeight?: number;
    cssClass?: string;

    // Metadata
    lastModified: number;
    version: number;
}

/**
 * Table configuration class
 *
 * USAGE IN COMPONENTS:
 * -------------------
 * // Load existing or create new configuration
 * const config = TableConfiguration.load('MyClassName');
 *
 * // Initialize columns from class type data
 * config.initializeFromClassTypeData(classTypeData);
 *
 * // Access sub-configurations
 * config.pagination.setPageSize(25);
 * config.filter.setColumnFilter('name', 'search term');
 * config.sections.toggle('config');
 *
 * // Save changes
 * config.save();
 */
export class TableConfiguration implements ITableConfiguration {
    id: string;
    className: string;
    displayName?: string;

    // Column management
    columns: ColumnConfiguration[] = [];
    removedColumns: string[] = [];

    // Sorting configuration
    sortOrder: SortOrder = 'alphabetical';
    sortDirection: SortDirection = 'asc';
    sortColumn?: string;

    // Sub-configurations (composed objects)
    pagination: PaginationConfig;
    filter: FilterConfig;
    sections: SectionState;

    // Display settings
    density: TableDensity = 'standard';
    selectionMode: SelectionMode = 'none';
    showRowNumbers: boolean = false;
    showHeaders: boolean = true;
    stripedRows: boolean = true;
    showGridLines: boolean = false;
    hoverHighlight: boolean = true;
    reorderableColumns: boolean = true;
    fixedHeight?: number;
    cssClass?: string;

    // Metadata
    lastModified: number = Date.now();
    version: number = CURRENT_VERSION;

    constructor(className: string, config?: Partial<ITableConfiguration>) {
        this.className = className;
        this.id = config?.id || `table-${className}-${Date.now().toString(36)}`;

        // Initialize sub-configurations with defaults
        this.pagination = new PaginationConfig(config?.pagination);
        this.filter = new FilterConfig(config?.filter);
        this.sections = new SectionState(config?.sections);

        if (config) {
            this.applyConfig(config);
        }
    }

    /**
     * Apply configuration values from a partial config object
     */
    private applyConfig(config: Partial<ITableConfiguration>): void {
        // Apply simple properties
        if (config.displayName !== undefined) this.displayName = config.displayName;
        if (config.removedColumns) this.removedColumns = [...config.removedColumns];
        if (config.sortOrder) this.sortOrder = config.sortOrder;
        if (config.sortDirection) this.sortDirection = config.sortDirection;
        if (config.sortColumn) this.sortColumn = config.sortColumn;
        if (config.density) this.density = config.density;
        if (config.selectionMode) this.selectionMode = config.selectionMode;
        if (config.showRowNumbers !== undefined) this.showRowNumbers = config.showRowNumbers;
        if (config.showHeaders !== undefined) this.showHeaders = config.showHeaders;
        if (config.stripedRows !== undefined) this.stripedRows = config.stripedRows;
        if (config.showGridLines !== undefined) this.showGridLines = config.showGridLines;
        if (config.hoverHighlight !== undefined) this.hoverHighlight = config.hoverHighlight;
        if (config.reorderableColumns !== undefined) this.reorderableColumns = config.reorderableColumns;
        if (config.fixedHeight !== undefined) this.fixedHeight = config.fixedHeight;
        if (config.cssClass) this.cssClass = config.cssClass;
        if (config.lastModified) this.lastModified = config.lastModified;
        if (config.version) this.version = config.version;

        // Convert column configs to ColumnConfiguration instances
        if (config.columns) {
            this.columns = config.columns.map(colConfig =>
                colConfig instanceof ColumnConfiguration
                    ? colConfig
                    : new ColumnConfiguration(colConfig.name, colConfig)
            );
        }
    }

    // ==================== Column Management ====================

    /**
     * Initialize columns from class type data (polyTyping)
     * Call this after loading config to sync with current class structure
     */
    initializeFromClassTypeData(classTypeData: Record<string, any>): void {
        const existingColumnNames = new Set(this.columns.map(c => c.name));
        const varNames = Object.keys(classTypeData);

        // Add new columns that don't exist yet
        varNames.forEach((varName, index) => {
            if (!existingColumnNames.has(varName) && !this.removedColumns.includes(varName)) {
                const column = ColumnConfiguration.fromPolyTyping(
                    varName,
                    classTypeData[varName],
                    this.columns.length + index
                );
                this.columns.push(column);
            }
        });

        // Remove columns that no longer exist in classTypeData
        this.columns = this.columns.filter(col => varNames.includes(col.name));
        this.removedColumns = this.removedColumns.filter(name => varNames.includes(name));

        this.applySorting();
    }

    /**
     * Get visible columns in display order
     */
    getVisibleColumns(): ColumnConfiguration[] {
        return this.columns
            .filter(col => col.visible && !this.removedColumns.includes(col.name))
            .sort((a, b) => a.order - b.order);
    }

    /**
     * Get visible column names (convenience method)
     */
    getVisibleColumnNames(): string[] {
        return this.getVisibleColumns().map(col => col.name);
    }

    /**
     * Get column by name
     */
    getColumn(name: string): ColumnConfiguration | undefined {
        return this.columns.find(col => col.name === name);
    }

    /**
     * Remove a column (moves to removedColumns list)
     */
    removeColumn(columnName: string): void {
        if (!this.removedColumns.includes(columnName)) {
            this.removedColumns.push(columnName);
            this.markModified();
        }
    }

    /**
     * Restore a previously removed column
     */
    restoreColumn(columnName: string): void {
        const index = this.removedColumns.indexOf(columnName);
        if (index >= 0) {
            this.removedColumns.splice(index, 1);
            this.applySorting();
            this.markModified();
        }
    }

    /**
     * Move column up in display order
     */
    moveColumnUp(columnName: string): void {
        const column = this.getColumn(columnName);
        if (!column || column.order === 0) return;

        const prevColumn = this.columns.find(c => c.order === column.order - 1);
        if (prevColumn) {
            prevColumn.order = column.order;
            column.order = column.order - 1;
            this.sortOrder = 'custom';
            this.markModified();
        }
    }

    /**
     * Move column down in display order
     */
    moveColumnDown(columnName: string): void {
        const column = this.getColumn(columnName);
        const maxOrder = Math.max(...this.columns.map(c => c.order));
        if (!column || column.order >= maxOrder) return;

        const nextColumn = this.columns.find(c => c.order === column.order + 1);
        if (nextColumn) {
            nextColumn.order = column.order;
            column.order = column.order + 1;
            this.sortOrder = 'custom';
            this.markModified();
        }
    }

    // ==================== Sorting ====================

    /**
     * Apply current sort order to columns
     */
    applySorting(): void {
        const visibleCols = this.columns.filter(c => !this.removedColumns.includes(c.name));

        if (this.sortOrder === 'alphabetical') {
            visibleCols.sort((a, b) => {
                const comparison = a.name.localeCompare(b.name);
                return this.sortDirection === 'asc' ? comparison : -comparison;
            });
        } else if (this.sortOrder === 'type') {
            const typeOrder = ['str', 'int', 'float', 'bool', 'date', 'datetime', 'list', 'dict', 'object'];
            visibleCols.sort((a, b) => {
                const aIdx = typeOrder.indexOf(a.dataType?.toLowerCase() || '') ?? 999;
                const bIdx = typeOrder.indexOf(b.dataType?.toLowerCase() || '') ?? 999;
                const comparison = aIdx - bIdx || a.name.localeCompare(b.name);
                return this.sortDirection === 'asc' ? comparison : -comparison;
            });
        }

        // Update order values
        visibleCols.forEach((col, index) => {
            col.order = index;
        });
    }

    /**
     * Set sort order and re-apply sorting
     */
    setSortOrder(order: SortOrder): void {
        this.sortOrder = order;
        this.applySorting();
        this.markModified();
    }

    /**
     * Toggle sort direction
     */
    toggleSortDirection(): void {
        this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
        this.applySorting();
        this.markModified();
    }

    // ==================== Persistence ====================

    private markModified(): void {
        this.lastModified = Date.now();
    }

    /**
     * Save configuration to localStorage
     */
    save(): void {
        try {
            const key = STORAGE_PREFIX + this.className;
            localStorage.setItem(key, JSON.stringify(this.toJSON()));
        } catch (e) {
            console.warn('[TableConfiguration] Failed to save:', e);
        }
    }

    /**
     * Load configuration from localStorage
     */
    static load(className: string): TableConfiguration {
        try {
            const key = STORAGE_PREFIX + className;
            const saved = localStorage.getItem(key);
            if (saved) {
                const parsed = JSON.parse(saved);
                if (parsed.version !== CURRENT_VERSION) {
                    return TableConfiguration.migrate(parsed, className);
                }
                return new TableConfiguration(className, parsed);
            }
        } catch (e) {
            console.warn('[TableConfiguration] Failed to load:', e);
        }
        return new TableConfiguration(className);
    }

    /**
     * Migrate old configuration format to current version
     */
    private static migrate(oldConfig: any, className: string): TableConfiguration {
        // Handle migration from version 0 (legacy TableConfig format)
        if (!oldConfig.version) {
            const newConfig = new TableConfiguration(className);

            if (oldConfig.sortOrder) newConfig.sortOrder = oldConfig.sortOrder;
            if (oldConfig.sortDirection) newConfig.sortDirection = oldConfig.sortDirection;
            if (oldConfig.removedColumns) newConfig.removedColumns = oldConfig.removedColumns;
            if (oldConfig.compactMode) newConfig.density = 'compact';
            if (oldConfig.showHeaders !== undefined) newConfig.showHeaders = oldConfig.showHeaders;

            // Migrate legacy expandedSections to SectionState
            if (oldConfig.expandedSections) {
                newConfig.sections = SectionState.fromLegacyFormat(oldConfig.expandedSections);
            }

            // Migrate visible columns
            if (oldConfig.visibleColumns?.length > 0) {
                oldConfig.visibleColumns.forEach((colName: string, index: number) => {
                    newConfig.columns.push(new ColumnConfiguration(colName, {
                        visible: true,
                        order: index
                    }));
                });
            }

            return newConfig;
        }

        return new TableConfiguration(className, oldConfig);
    }

    /**
     * Check if configuration exists in storage
     */
    static exists(className: string): boolean {
        try {
            return localStorage.getItem(STORAGE_PREFIX + className) !== null;
        } catch {
            return false;
        }
    }

    /**
     * Delete saved configuration
     */
    static delete(className: string): void {
        try {
            localStorage.removeItem(STORAGE_PREFIX + className);
        } catch (e) {
            console.warn('[TableConfiguration] Failed to delete:', e);
        }
    }

    /**
     * Reset to default values
     */
    reset(): void {
        this.columns = [];
        this.removedColumns = [];
        this.sortOrder = 'alphabetical';
        this.sortDirection = 'asc';
        this.sortColumn = undefined;
        this.pagination = PaginationConfig.createDefault();
        this.filter = FilterConfig.createDefault();
        this.sections = SectionState.createDefault();
        this.density = 'standard';
        this.selectionMode = 'none';
        this.showRowNumbers = false;
        this.showHeaders = true;
        this.stripedRows = true;
        this.showGridLines = false;
        this.hoverHighlight = true;
        this.markModified();
    }

    /**
     * Serialize to plain object for storage
     */
    toJSON(): ITableConfiguration {
        return {
            id: this.id,
            className: this.className,
            displayName: this.displayName,
            columns: this.columns.map(col => col.toJSON()),
            removedColumns: [...this.removedColumns],
            sortOrder: this.sortOrder,
            sortDirection: this.sortDirection,
            sortColumn: this.sortColumn,
            pagination: this.pagination.toJSON(),
            filter: this.filter.toJSON(),
            sections: this.sections.toJSON(),
            density: this.density,
            selectionMode: this.selectionMode,
            showRowNumbers: this.showRowNumbers,
            showHeaders: this.showHeaders,
            stripedRows: this.stripedRows,
            showGridLines: this.showGridLines,
            hoverHighlight: this.hoverHighlight,
            reorderableColumns: this.reorderableColumns,
            fixedHeight: this.fixedHeight,
            cssClass: this.cssClass,
            lastModified: this.lastModified,
            version: this.version
        };
    }
}
