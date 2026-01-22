/**
 * tableConfiguration.ts
 * BACKWARD COMPATIBILITY LAYER
 *
 * This file provides backward compatibility for code using the old TableConfig class.
 * New code should import from '@models/tables' instead.
 *
 * @deprecated Use TableConfiguration from '@models/tables' for new code
 */

// Import new models for use in this file
import {
    TableConfiguration as NewTableConfiguration,
    ITableConfiguration,
    SortOrder,
    SortDirection,
    TableDensity,
    SelectionMode,
    PaginationConfig,
    FilterConfig,
    SectionState
} from './tables/TableConfiguration';

import {
    ColumnConfiguration as NewColumnConfiguration,
    IColumnConfiguration,
    ColumnFormat,
    ColumnAlignment
} from './tables/ColumnConfiguration';

// Re-export new models for forward compatibility
export {
    NewTableConfiguration as TableConfiguration,
    ITableConfiguration,
    SortOrder,
    SortDirection,
    TableDensity,
    SelectionMode,
    PaginationConfig,
    FilterConfig,
    SectionState
};

export {
    NewColumnConfiguration as ColumnConfiguration,
    IColumnConfiguration,
    ColumnFormat,
    ColumnAlignment
};

/**
 * Legacy TableConfiguration interface
 * @deprecated Use ITableConfiguration from '@models/tables'
 */
export interface LegacyTableConfiguration {
    sortOrder: 'alphabetical' | 'custom' | 'type' | 'none';
    sortDirection: 'asc' | 'desc';
    expandedSections: string[];
    defaultExpanded: boolean;
    visibleColumns: string[];
    columnOrder: string[];
    removedColumns: string[];
    showHeaders: boolean;
    compactMode: boolean;
}

/**
 * Legacy TableConfig class - provides backward compatibility
 * Maps old interface to new TableConfiguration class
 *
 * @deprecated Use TableConfiguration from '@models/tables' for new code
 */
export class TableConfig implements LegacyTableConfiguration {
    sortOrder: 'alphabetical' | 'custom' | 'type' | 'none' = 'alphabetical';
    sortDirection: 'asc' | 'desc' = 'asc';
    expandedSections: string[] = [];
    defaultExpanded: boolean = false;
    visibleColumns: string[] = [];
    columnOrder: string[] = [];
    removedColumns: string[] = [];
    showHeaders: boolean = true;
    compactMode: boolean = false;

    constructor(config?: Partial<LegacyTableConfiguration>) {
        if (config) {
            Object.assign(this, config);
        }
    }

    /**
     * Save configuration to localStorage (legacy format)
     */
    save(key: string): void {
        try {
            localStorage.setItem(`table_config_${key}`, JSON.stringify(this));
        } catch (e) {
            console.warn('Failed to save table configuration:', e);
        }
    }

    /**
     * Load configuration from localStorage (handles both legacy and new formats)
     */
    static load(key: string): TableConfig {
        try {
            // Try legacy format first
            const legacySaved = localStorage.getItem(`table_config_${key}`);
            if (legacySaved) {
                return new TableConfig(JSON.parse(legacySaved));
            }

            // Try new format and convert
            const newSaved = localStorage.getItem(`table_config_v2_${key}`);
            if (newSaved) {
                const newConfig = JSON.parse(newSaved);
                return TableConfig.fromNewFormat(newConfig);
            }
        } catch (e) {
            console.warn('Failed to load table configuration:', e);
        }
        return new TableConfig();
    }

    /**
     * Convert from new TableConfiguration format to legacy format
     */
    private static fromNewFormat(newConfig: any): TableConfig {
        const legacy = new TableConfig();

        legacy.sortOrder = newConfig.sortOrder || 'alphabetical';
        legacy.sortDirection = newConfig.sortDirection || 'asc';
        legacy.removedColumns = newConfig.removedColumns || [];
        legacy.showHeaders = newConfig.showHeaders ?? true;
        legacy.compactMode = newConfig.density === 'compact';

        // Convert sections to expandedSections array
        if (newConfig.sections) {
            if (newConfig.sections.configExpanded) legacy.expandedSections.push('main');
            if (newConfig.sections.dataExpanded) legacy.expandedSections.push('data');
        }

        // Convert columns to visibleColumns
        if (newConfig.columns) {
            legacy.visibleColumns = newConfig.columns
                .filter((c: any) => c.visible)
                .sort((a: any, b: any) => a.order - b.order)
                .map((c: any) => c.name);
            legacy.columnOrder = newConfig.columns
                .sort((a: any, b: any) => a.order - b.order)
                .map((c: any) => c.name);
        }

        return legacy;
    }

    /**
     * Toggle expansion state for a section
     */
    toggleSection(sectionName: string): void {
        const index = this.expandedSections.indexOf(sectionName);
        if (index >= 0) {
            this.expandedSections.splice(index, 1);
        } else {
            this.expandedSections.push(sectionName);
        }
    }

    /**
     * Check if a section is expanded
     */
    isSectionExpanded(sectionName: string): boolean {
        return this.expandedSections.includes(sectionName);
    }

    /**
     * Convert to new TableConfiguration format
     */
    toNewFormat(className: string): NewTableConfiguration {
        const newConfig = new NewTableConfiguration(className, {
            sortOrder: this.sortOrder,
            sortDirection: this.sortDirection,
            removedColumns: this.removedColumns,
            showHeaders: this.showHeaders,
            density: this.compactMode ? 'compact' : 'standard',
            sections: {
                configExpanded: this.expandedSections.includes('main'),
                dataExpanded: this.expandedSections.includes('data'),
                customSections: {}
            }
        });

        // Convert visible columns to column configurations
        this.visibleColumns.forEach((colName, index) => {
            newConfig.columns.push(new NewColumnConfiguration(colName, {
                visible: true,
                order: index
            }));
        });

        return newConfig;
    }
}
