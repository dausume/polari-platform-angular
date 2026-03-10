import { DataSeriesFilterChain } from '@models/dataseries/filterChain';

export interface DataSetDefinitionSummary {
    id: string;
    name: string;
    description: string;
    source_class: string;
}

/**
 * A single filter link definition — serializable form of a DataSeriesFilterChain node.
 */
export interface FilterChainLinkDef {
    variableName: string;
    filterType: string;
    filterValue: any;
}

/**
 * A configured filter for end-user display within a filter panel.
 * Controls how a filter appears and behaves for end users.
 *
 * - "Pre-Set": default value filled but user can change
 * - "Enforced": always applied with configured value, user cannot change
 * - locked: true makes the row read-only in the UI
 * - hidden: true applies the filter silently (not shown to user)
 */
export interface ConfiguredFilterDef {
    variableName: string;
    filterConfigType: 'Checkbox' | 'MultiSelect' | 'RangeSlider' | 'SingleSelect'
        | 'DateRangePicker' | 'Dropdown' | 'ToggleSwitch' | 'Pre-Set' | 'Enforced';
    filterType: string;
    defaultValue?: any;
    defaultSecondValue?: any;
    locked: boolean;
    hidden: boolean;
}

/**
 * A named panel grouping multiple configured filters.
 */
export interface ConfiguredFilterPanelDef {
    panelName: string;
    filters: ConfiguredFilterDef[];
}

export class NamedDataSetConfig {
    id: string;
    name: string;
    description: string;
    source_class: string;

    /** The active filter chain as a serializable array of filter links */
    filterChainLinks: FilterChainLinkDef[];

    /** Configured filter panels for end-user UI */
    filterPanels: ConfiguredFilterPanelDef[];

    /** Whether end users can modify the filter configuration */
    disableUserConfigChanges: boolean;

    constructor(id: string, name: string, description: string, sourceClass: string) {
        this.id = id;
        this.name = name;
        this.description = description;
        this.source_class = sourceClass;
        this.filterChainLinks = [];
        this.filterPanels = [];
        this.disableUserConfigChanges = false;
    }

    toDefinitionJSON(): string {
        return JSON.stringify({
            filterChainLinks: this.filterChainLinks,
            filterPanels: this.filterPanels,
            disableUserConfigChanges: this.disableUserConfigChanges
        });
    }

    static fromBackend(backendObj: any): NamedDataSetConfig {
        const config = new NamedDataSetConfig(
            backendObj.id || '',
            backendObj.name || '',
            backendObj.description || '',
            backendObj.source_class || ''
        );

        if (backendObj.definition && backendObj.definition !== '{}') {
            try {
                const parsed = typeof backendObj.definition === 'string'
                    ? JSON.parse(backendObj.definition)
                    : backendObj.definition;

                config.filterChainLinks = parsed.filterChainLinks || [];
                config.filterPanels = parsed.filterPanels || [];
                config.disableUserConfigChanges = parsed.disableUserConfigChanges || false;
            } catch (e) {
                console.warn('[NamedDataSetConfig] Failed to parse definition:', e);
            }
        }

        return config;
    }

    /**
     * Builds a DataSeriesFilterChain from the stored link definitions.
     */
    buildFilterChain(): DataSeriesFilterChain | null {
        if (this.filterChainLinks.length === 0) return null;
        return DataSeriesFilterChain.fromArray(this.filterChainLinks);
    }

    /**
     * Applies the filter chain to raw instance data, returning the filtered array.
     */
    applyToInstances(instances: any[]): any[] {
        const chain = this.buildFilterChain();
        if (!chain) return instances;
        return chain.applyDataSeriesFilterChain(instances);
    }
}
