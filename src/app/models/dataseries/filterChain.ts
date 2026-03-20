import type { FilterMethod } from "./filterTypeOptions";

/**
 * Represents a linked list of filters that can be applied to data points.
 * Each link in the chain contains a filter operation that can be applied sequentially.
 */
export class DataSeriesFilterChain {
    /** The name of the variable/property to filter on */
    variableName: string;

    /** The value to compare against */
    filterValue: any;

    /** The type of filter operation */
    filterType: FilterMethod | string;

    /** Reference to the next filter in the chain */
    nextDataSeriesFilterChainLink: DataSeriesFilterChain | null;

    constructor(
        variableName: string,
        filterValue: any,
        filterType: FilterMethod | string,
        nextDataSeriesFilterChainLink?: DataSeriesFilterChain | null
    ) {
        this.variableName = variableName;
        this.filterValue = filterValue;
        this.filterType = filterType;
        this.nextDataSeriesFilterChainLink = nextDataSeriesFilterChainLink ?? null;
    }

    /**
     * Applies this filter chain to an array of data points
     */
    applyDataSeriesFilterChain(dataPoints: any[]): any[] {
        if (!dataPoints || dataPoints.length === 0) {
            return [];
        }

        let filteredData = dataPoints;
        let current: DataSeriesFilterChain | null = this;

        while (current) {
            filteredData = this.applyFilter(filteredData, current);
            current = current.nextDataSeriesFilterChainLink;
        }

        return filteredData;
    }

    /**
     * Coerce a filter value to match the type of the actual data value.
     * Input fields always produce strings, but data values may be numbers,
     * booleans, etc. Without coercion, strict equality and comparisons fail.
     */
    private coerceValue(filterVal: any, sampleDataVal: any): any {
        if (filterVal === null || filterVal === undefined) return filterVal;
        if (typeof filterVal !== 'string') return filterVal; // already typed

        if (typeof sampleDataVal === 'number') {
            const n = Number(filterVal);
            return isNaN(n) ? filterVal : n;
        }
        if (typeof sampleDataVal === 'boolean') {
            const lower = filterVal.toLowerCase().trim();
            if (lower === 'true' || lower === '1') return true;
            if (lower === 'false' || lower === '0') return false;
            return filterVal;
        }
        return filterVal;
    }

    /**
     * Resolve a field value from a data point.
     * Supports dot-notation (e.g. "plant.commonName") by reading from _resolvedFields.
     */
    private getFieldValue(dp: any, variableName: string): any {
        if (variableName.includes('.')) {
            const [refVar, fieldName] = variableName.split('.', 2);
            return dp._resolvedFields?.[refVar]?.[fieldName] ?? dp[variableName];
        }
        return dp[variableName];
    }

    /**
     * Find a representative non-null sample value for a field across the data
     * so we know what type to coerce the filter value to.
     */
    private findSampleValue(dataPoints: any[], variableName: string): any {
        for (const dp of dataPoints) {
            const val = this.getFieldValue(dp, variableName);
            if (val !== null && val !== undefined) return val;
        }
        return undefined;
    }

    /**
     * Applies a single filter to the data points
     */
    private applyFilter(dataPoints: any[], filter: DataSeriesFilterChain): any[] {
        const { variableName, filterType } = filter;
        let { filterValue } = filter;

        // Coerce filterValue to match the data's actual type
        const sample = this.findSampleValue(dataPoints, variableName);
        if (sample !== undefined) {
            if (Array.isArray(filterValue)) {
                filterValue = filterValue.map(v => this.coerceValue(v, sample));
            } else {
                filterValue = this.coerceValue(filterValue, sample);
            }
        }

        // Helper: get the field value, supporting dot-notation for _resolvedFields
        const gv = (dp: any) => this.getFieldValue(dp, variableName);

        switch (filterType) {
            case 'noop':
                return dataPoints;

            // Equality — case-insensitive for strings
            case 'equals':
                return dataPoints.filter(dp => {
                    const v = gv(dp);
                    if (typeof v === 'string' && typeof filterValue === 'string') {
                        return v.toLowerCase() === filterValue.toLowerCase();
                    }
                    return v === filterValue;
                });
            case 'notEquals':
                return dataPoints.filter(dp => {
                    const v = gv(dp);
                    if (typeof v === 'string' && typeof filterValue === 'string') {
                        return v.toLowerCase() !== filterValue.toLowerCase();
                    }
                    return v !== filterValue;
                });

            // Numeric/Comparison Operators
            case 'greaterThan':
                return dataPoints.filter(dp => gv(dp) > filterValue);
            case 'lessThan':
                return dataPoints.filter(dp => gv(dp) < filterValue);
            case 'greaterThanOrEqual':
                return dataPoints.filter(dp => gv(dp) >= filterValue);
            case 'lessThanOrEqual':
                return dataPoints.filter(dp => gv(dp) <= filterValue);
            case 'inRange':
                if (Array.isArray(filterValue) && filterValue.length === 2) {
                    return dataPoints.filter(dp => {
                        const v = gv(dp);
                        return v >= filterValue[0] && v <= filterValue[1];
                    });
                }
                return dataPoints;
            case 'notInRange':
            case 'excludeRange':
                if (Array.isArray(filterValue) && filterValue.length === 2) {
                    return dataPoints.filter(dp => {
                        const v = gv(dp);
                        return v < filterValue[0] || v > filterValue[1];
                    });
                }
                return dataPoints;

            // String Operators — case-insensitive
            case 'contains':
                return dataPoints.filter(dp => {
                    const v = gv(dp);
                    return v != null && String(v).toLowerCase().includes(String(filterValue).toLowerCase());
                });
            case 'notContains':
                return dataPoints.filter(dp => {
                    const v = gv(dp);
                    return v != null && !String(v).toLowerCase().includes(String(filterValue).toLowerCase());
                });
            case 'startsWith':
                return dataPoints.filter(dp => {
                    const v = gv(dp);
                    return v != null && String(v).toLowerCase().startsWith(String(filterValue).toLowerCase());
                });
            case 'endsWith':
                return dataPoints.filter(dp => {
                    const v = gv(dp);
                    return v != null && String(v).toLowerCase().endsWith(String(filterValue).toLowerCase());
                });
            case 'regexMatch':
                try {
                    const regex = new RegExp(filterValue, 'i');
                    return dataPoints.filter(dp => {
                        const v = gv(dp);
                        return v != null && regex.test(String(v));
                    });
                } catch {
                    console.warn(`DataSeriesFilterChain: Invalid regex pattern "${filterValue}"`);
                    return dataPoints;
                }

            // Boolean Operators
            case 'isTrue':
                return dataPoints.filter(dp => gv(dp) === true);
            case 'isFalse':
                return dataPoints.filter(dp => gv(dp) === false);

            // Null Checks
            case 'isNull':
                return dataPoints.filter(dp => {
                    const v = gv(dp);
                    return v === null || v === undefined;
                });
            case 'isNotNull':
                return dataPoints.filter(dp => {
                    const v = gv(dp);
                    return v !== null && v !== undefined;
                });

            default:
                console.warn(`DataSeriesFilterChain: Unknown filter type "${filterType}"`);
                return dataPoints;
        }
    }

    /**
     * Creates a deep clone of this filter chain
     */
    clone(): DataSeriesFilterChain {
        const clonedNext = this.nextDataSeriesFilterChainLink?.clone() ?? null;
        return new DataSeriesFilterChain(
            this.variableName,
            this.filterValue,
            this.filterType,
            clonedNext
        );
    }

    /**
     * Gets the size of the filter chain
     */
    getSize(): number {
        let count = 1;
        let current = this.nextDataSeriesFilterChainLink;
        const maxSize = 10000; // Prevent infinite loops

        while (current && count < maxSize) {
            count++;
            current = current.nextDataSeriesFilterChainLink;
        }

        return count;
    }

    /**
     * Gets a filter at a specific index in the chain
     */
    getFilterAtIndex(index: number): DataSeriesFilterChain | null {
        if (index < 0) return null;
        if (index === 0) return this;

        let current: DataSeriesFilterChain | null = this;
        let currentIndex = 0;

        while (current && currentIndex < index) {
            current = current.nextDataSeriesFilterChainLink;
            currentIndex++;
        }

        return current;
    }

    /**
     * Appends a filter to the end of this chain
     */
    pushFilter(newFilter: DataSeriesFilterChain): this {
        let current: DataSeriesFilterChain = this;

        while (current.nextDataSeriesFilterChainLink) {
            current = current.nextDataSeriesFilterChainLink;
        }

        current.nextDataSeriesFilterChainLink = newFilter;
        return this;
    }

    /**
     * Removes and returns the last filter in the chain
     */
    popFilter(): DataSeriesFilterChain | null {
        if (!this.nextDataSeriesFilterChainLink) {
            return null;
        }

        let current: DataSeriesFilterChain = this;

        while (current.nextDataSeriesFilterChainLink?.nextDataSeriesFilterChainLink) {
            current = current.nextDataSeriesFilterChainLink;
        }

        const removed = current.nextDataSeriesFilterChainLink;
        current.nextDataSeriesFilterChainLink = null;
        return removed;
    }

    /**
     * Removes a filter at a specific index
     */
    removeAtIndex(index: number): DataSeriesFilterChain | null {
        if (index < 0 || index >= this.getSize()) {
            return this;
        }

        // Removing the head requires special handling (return next as new head)
        if (index === 0) {
            return this.nextDataSeriesFilterChainLink;
        }

        const parent = this.getFilterAtIndex(index - 1);
        if (parent && parent.nextDataSeriesFilterChainLink) {
            parent.nextDataSeriesFilterChainLink = parent.nextDataSeriesFilterChainLink.nextDataSeriesFilterChainLink;
        }

        return this;
    }

    /**
     * Replaces a filter at a specific index
     */
    replaceAtIndex(index: number, newFilter: DataSeriesFilterChain): DataSeriesFilterChain | null {
        if (index < 0 || index >= this.getSize()) {
            return this;
        }

        // Replacing the head
        if (index === 0) {
            newFilter.nextDataSeriesFilterChainLink = this.nextDataSeriesFilterChainLink;
            return newFilter;
        }

        const parent = this.getFilterAtIndex(index - 1);
        if (parent && parent.nextDataSeriesFilterChainLink) {
            newFilter.nextDataSeriesFilterChainLink = parent.nextDataSeriesFilterChainLink.nextDataSeriesFilterChainLink;
            parent.nextDataSeriesFilterChainLink = newFilter;
        }

        return this;
    }

    /**
     * Converts the filter chain to an array of filters
     */
    toArray(): DataSeriesFilterChain[] {
        const result: DataSeriesFilterChain[] = [];
        let current: DataSeriesFilterChain | null = this;

        while (current) {
            result.push(current);
            current = current.nextDataSeriesFilterChainLink;
        }

        return result;
    }

    /**
     * Creates a filter chain from an array of filter configurations
     */
    static fromArray(filters: Array<{ variableName: string; filterValue: any; filterType: string }>): DataSeriesFilterChain | null {
        if (filters.length === 0) return null;

        const chain = filters.map(f => new DataSeriesFilterChain(f.variableName, f.filterValue, f.filterType));

        for (let i = 0; i < chain.length - 1; i++) {
            chain[i].nextDataSeriesFilterChainLink = chain[i + 1];
        }

        return chain[0];
    }

    /**
     * Execute a segmented filter chain.
     * Processes segments in order; each 'filter' segment runs its links against the
     * full data. Set operations combine results from upstream segments.
     * 'reference' segments apply the segments from a referenced filter chain.
     * Returns the result of the last segment, or the full data if no segments.
     *
     * @param resolveReference optional callback that returns the segments of a referenced
     *   filter chain by ID, enabling 'reference' type segments.
     */
    static executeSegments(
        segments: Array<{ id: string; type: string; filterLinks: Array<{ variableName: string; filterValue: any; filterType: string }>; sourceSegmentIds: string[]; referenceFilterChainId?: string }>,
        dataPoints: any[],
        resolveReference?: (filterChainId: string) => Array<{ id: string; type: string; filterLinks: Array<{ variableName: string; filterValue: any; filterType: string }>; sourceSegmentIds: string[]; referenceFilterChainId?: string }> | null
    ): any[] {
        if (!segments || segments.length === 0) return dataPoints;

        const results = new Map<string, any[]>();

        for (const seg of segments) {
            let segResult: any[];

            if (seg.type === 'filter') {
                // Apply this segment's filter links to the full data
                const chain = DataSeriesFilterChain.fromArray(seg.filterLinks);
                segResult = chain ? chain.applyDataSeriesFilterChain(dataPoints) : dataPoints;
            } else if (seg.type === 'reference') {
                // Reference: execute the referenced filter chain's segments
                if (seg.referenceFilterChainId && resolveReference) {
                    const refSegments = resolveReference(seg.referenceFilterChainId);
                    if (refSegments && refSegments.length > 0) {
                        segResult = DataSeriesFilterChain.executeSegments(refSegments, dataPoints, resolveReference);
                    } else {
                        segResult = dataPoints;
                    }
                } else {
                    segResult = dataPoints;
                }
            } else {
                // Set operation — combine results from source segments
                const sources = seg.sourceSegmentIds
                    .map(id => results.get(id))
                    .filter((r): r is any[] => r !== undefined);

                if (sources.length === 0) {
                    segResult = dataPoints;
                } else if (seg.type === 'union') {
                    // Union: all unique rows across sources
                    const seen = new Set<any>();
                    segResult = [];
                    for (const src of sources) {
                        for (const row of src) {
                            if (!seen.has(row)) {
                                seen.add(row);
                                segResult.push(row);
                            }
                        }
                    }
                } else if (seg.type === 'intersection') {
                    // Intersection: only rows present in ALL sources
                    if (sources.length === 1) {
                        segResult = sources[0];
                    } else {
                        segResult = sources[0].filter(row => {
                            return sources.every(src => src === sources[0] || src.includes(row));
                        });
                    }
                } else if (seg.type === 'difference') {
                    // Difference: rows in first source but not in any subsequent source
                    if (sources.length === 1) {
                        segResult = sources[0];
                    } else {
                        const exclude = new Set<any>();
                        for (let i = 1; i < sources.length; i++) {
                            for (const row of sources[i]) {
                                exclude.add(row);
                            }
                        }
                        segResult = sources[0].filter(row => !exclude.has(row));
                    }
                } else {
                    segResult = dataPoints;
                }
            }

            results.set(seg.id, segResult);
        }

        // Return the last segment's result
        const lastSeg = segments[segments.length - 1];
        return results.get(lastSeg.id) || dataPoints;
    }
}
