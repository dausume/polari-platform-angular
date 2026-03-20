import { DataSeriesFilterChain } from '@models/dataseries/filterChain';
import { FilterChainLinkDef, FilterChainSegmentDef } from './NamedDataSetConfig';

export interface FilterChainDefinitionSummary {
    id: string;
    name: string;
    description: string;
    source_class: string;
}

export class NamedFilterChainConfig {
    id: string;
    name: string;
    description: string;
    source_class: string;

    /** The filter chain as a serializable array of filter links (flat/legacy mode) */
    filterChainLinks: FilterChainLinkDef[];

    /** Named segments for composable filter chains with set operations */
    segments: FilterChainSegmentDef[];

    /** Whether end users can modify the filter configuration */
    disableUserConfigChanges: boolean;

    /** The field profile used as context when defining this chain's filters */
    sampleFieldProfileId: string;

    constructor(id: string, name: string, description: string, sourceClass: string) {
        this.id = id;
        this.name = name;
        this.description = description;
        this.source_class = sourceClass;
        this.filterChainLinks = [];
        this.segments = [];
        this.disableUserConfigChanges = false;
        this.sampleFieldProfileId = '';
    }

    toDefinitionJSON(): string {
        return JSON.stringify({
            filterChainLinks: this.filterChainLinks,
            segments: this.segments,
            disableUserConfigChanges: this.disableUserConfigChanges,
            sampleFieldProfileId: this.sampleFieldProfileId
        });
    }

    static fromBackend(backendObj: any): NamedFilterChainConfig {
        const config = new NamedFilterChainConfig(
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
                config.segments = parsed.segments || [];
                config.disableUserConfigChanges = parsed.disableUserConfigChanges || false;
                config.sampleFieldProfileId = parsed.sampleFieldProfileId || '';
            } catch (e) {
                console.warn('[NamedFilterChainConfig] Failed to parse definition:', e);
            }
        }

        return config;
    }

    /**
     * Returns the set of field names this chain filters on.
     * Checks both flat filterChainLinks and segment filterLinks.
     */
    getUsedFieldNames(): Set<string> {
        const names = new Set(this.filterChainLinks.map(link => link.variableName));
        for (const seg of this.segments) {
            if (seg.type === 'filter') {
                for (const link of seg.filterLinks) {
                    names.add(link.variableName);
                }
            }
        }
        return names;
    }

    /** Whether this chain uses segments (vs flat filterChainLinks only) */
    get hasSegments(): boolean {
        return this.segments.length > 0;
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
     * Uses segments if available, otherwise falls back to flat filterChainLinks.
     * @param resolveReference optional callback to resolve referenced filter chains by ID
     */
    applyToInstances(
        instances: any[],
        resolveReference?: (filterChainId: string) => Array<{ id: string; type: string; filterLinks: Array<{ variableName: string; filterValue: any; filterType: string }>; sourceSegmentIds: string[]; referenceFilterChainId?: string }> | null
    ): any[] {
        if (this.segments.length > 0) {
            return DataSeriesFilterChain.executeSegments(this.segments, instances, resolveReference);
        }
        const chain = this.buildFilterChain();
        if (!chain) return instances;
        return chain.applyDataSeriesFilterChain(instances);
    }
}
