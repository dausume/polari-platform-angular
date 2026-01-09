// tableConfiguration.ts
// Model for managing table display configuration

export interface TableConfiguration {
    // Sorting configuration
    sortOrder: 'alphabetical' | 'custom' | 'type' | 'none';
    sortDirection: 'asc' | 'desc';

    // Expansion/collapse state
    expandedSections: string[];
    defaultExpanded: boolean;

    // Column configuration
    visibleColumns: string[];
    columnOrder: string[];
    removedColumns: string[];

    // Display preferences
    showHeaders: boolean;
    compactMode: boolean;
}

export class TableConfig implements TableConfiguration {
    sortOrder: 'alphabetical' | 'custom' | 'type' | 'none' = 'alphabetical';
    sortDirection: 'asc' | 'desc' = 'asc';
    expandedSections: string[] = [];
    defaultExpanded: boolean = false;
    visibleColumns: string[] = [];
    columnOrder: string[] = [];
    removedColumns: string[] = [];
    showHeaders: boolean = true;
    compactMode: boolean = false;

    constructor(config?: Partial<TableConfiguration>) {
        if (config) {
            Object.assign(this, config);
        }
    }

    /**
     * Save configuration to localStorage
     */
    save(key: string): void {
        try {
            localStorage.setItem(`table_config_${key}`, JSON.stringify(this));
        } catch (e) {
            console.warn('Failed to save table configuration:', e);
        }
    }

    /**
     * Load configuration from localStorage
     */
    static load(key: string): TableConfig {
        try {
            const saved = localStorage.getItem(`table_config_${key}`);
            if (saved) {
                return new TableConfig(JSON.parse(saved));
            }
        } catch (e) {
            console.warn('Failed to load table configuration:', e);
        }
        return new TableConfig();
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
}
