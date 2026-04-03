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

            // Geographic / Bounding Box Operators
            // filterValue = [south, west, north, east] i.e. [minLat, minLng, maxLat, maxLng]
            //
            // "geometry" variants check ALL coordinates (vertices, endpoints, etc.)
            // "center" variants check ONLY the center-point / centroid

            case 'geometryInBoundingBox':
                if (Array.isArray(filterValue) && filterValue.length === 4) {
                    const [south, west, north, east] = filterValue.map(Number);
                    return dataPoints.filter(dp => {
                        const coords = this.extractAllGeoCoordinates(gv(dp));
                        if (coords.length === 0) return false;
                        return coords.some(([lat, lng]) =>
                            lat >= south && lat <= north && lng >= west && lng <= east
                        );
                    });
                }
                return dataPoints;
            case 'geometryOutsideBoundingBox':
                if (Array.isArray(filterValue) && filterValue.length === 4) {
                    const [south, west, north, east] = filterValue.map(Number);
                    return dataPoints.filter(dp => {
                        const coords = this.extractAllGeoCoordinates(gv(dp));
                        if (coords.length === 0) return true;
                        return coords.every(([lat, lng]) =>
                            lat < south || lat > north || lng < west || lng > east
                        );
                    });
                }
                return dataPoints;
            case 'centerInBoundingBox':
                if (Array.isArray(filterValue) && filterValue.length === 4) {
                    const [south, west, north, east] = filterValue.map(Number);
                    return dataPoints.filter(dp => {
                        const center = this.extractGeoCenterPoint(gv(dp));
                        if (!center) return false;
                        const [lat, lng] = center;
                        return lat >= south && lat <= north && lng >= west && lng <= east;
                    });
                }
                return dataPoints;
            case 'centerOutsideBoundingBox':
                if (Array.isArray(filterValue) && filterValue.length === 4) {
                    const [south, west, north, east] = filterValue.map(Number);
                    return dataPoints.filter(dp => {
                        const center = this.extractGeoCenterPoint(gv(dp));
                        if (!center) return true;
                        const [lat, lng] = center;
                        return lat < south || lat > north || lng < west || lng > east;
                    });
                }
                return dataPoints;

            // Duration Operators
            // Duration values stored as JSON: { start: ISO, end: ISO }
            // filterValue for comparison: milliseconds (number) or ISO date string
            // filterValue for range: [startISO, endISO]

            case 'durationGreaterThan':
                return dataPoints.filter(dp => {
                    const ms = this.extractDurationMs(gv(dp));
                    return ms !== null && ms > Number(filterValue);
                });
            case 'durationLessThan':
                return dataPoints.filter(dp => {
                    const ms = this.extractDurationMs(gv(dp));
                    return ms !== null && ms < Number(filterValue);
                });
            case 'durationInRange':
                if (Array.isArray(filterValue) && filterValue.length === 2) {
                    const [minMs, maxMs] = filterValue.map(Number);
                    return dataPoints.filter(dp => {
                        const ms = this.extractDurationMs(gv(dp));
                        return ms !== null && ms >= minMs && ms <= maxMs;
                    });
                }
                return dataPoints;
            case 'startsAfter':
                return dataPoints.filter(dp => {
                    const dur = this.parseDurationValue(gv(dp));
                    return dur?.start !== null && dur!.start > new Date(filterValue).getTime();
                });
            case 'startsBefore':
                return dataPoints.filter(dp => {
                    const dur = this.parseDurationValue(gv(dp));
                    return dur?.start !== null && dur!.start < new Date(filterValue).getTime();
                });
            case 'endsAfter':
                return dataPoints.filter(dp => {
                    const dur = this.parseDurationValue(gv(dp));
                    return dur?.end !== null && dur!.end > new Date(filterValue).getTime();
                });
            case 'endsBefore':
                return dataPoints.filter(dp => {
                    const dur = this.parseDurationValue(gv(dp));
                    return dur?.end !== null && dur!.end < new Date(filterValue).getTime();
                });
            case 'overlapsRange':
                if (Array.isArray(filterValue) && filterValue.length === 2) {
                    const rangeStart = new Date(filterValue[0]).getTime();
                    const rangeEnd = new Date(filterValue[1]).getTime();
                    return dataPoints.filter(dp => {
                        const dur = this.parseDurationValue(gv(dp));
                        if (!dur || dur.start === null || dur.end === null) return false;
                        return dur.start <= rangeEnd && dur.end >= rangeStart;
                    });
                }
                return dataPoints;

            default:
                console.warn(`DataSeriesFilterChain: Unknown filter type "${filterType}"`);
                return dataPoints;
        }
    }

    /**
     * Parse a duration field value { start, end } into epoch timestamps.
     */
    private parseDurationValue(value: any): { start: number | null; end: number | null } | null {
        if (value == null) return null;
        if (typeof value === 'string') {
            try { value = JSON.parse(value); } catch { return null; }
        }
        if (!value || typeof value !== 'object') return null;
        const s = value.start ? new Date(value.start).getTime() : null;
        const e = value.end ? new Date(value.end).getTime() : null;
        if (s !== null && isNaN(s)) return null;
        if (e !== null && isNaN(e)) return null;
        return { start: s, end: e };
    }

    /**
     * Extract the span in milliseconds from a duration field value.
     */
    private extractDurationMs(value: any): number | null {
        const dur = this.parseDurationValue(value);
        if (!dur || dur.start === null || dur.end === null) return null;
        return Math.abs(dur.end - dur.start);
    }

    /**
     * Parse a geo field value from raw data (handles JSON strings).
     */
    private parseGeoValue(value: any): any {
        if (value == null) return null;
        if (typeof value === 'string') {
            try { return JSON.parse(value); }
            catch { return null; }
        }
        return value;
    }

    /**
     * Extract ALL [lat, lng] coordinate pairs from a geo field value.
     * Used by "geometry" bounding box filters to check every vertex/endpoint.
     *
     * Handles:
     *   - { lat, lng } — point
     *   - [lat, lng] tuple
     *   - { start_lat, start_lng, end_lat, end_lng } — line segment endpoints
     *   - { vertices: [[lng,lat], ...] } — polygon vertices
     *   - { center_lat, center_lng } — centroid (included as fallback)
     *   - { coordinates: [...] } — GeoJSON coordinate arrays
     *   - JSON string of any of the above
     */
    private extractAllGeoCoordinates(rawValue: any): [number, number][] {
        let value = this.parseGeoValue(rawValue);
        if (value == null) return [];

        // Simple [lat, lng] tuple
        if (Array.isArray(value) && value.length === 2 &&
            typeof value[0] === 'number' && typeof value[1] === 'number') {
            return [[value[0], value[1]]];
        }

        if (typeof value !== 'object' || value === null) return [];

        const coords: [number, number][] = [];

        // Point: { lat, lng }
        if (typeof value.lat === 'number' && typeof value.lng === 'number') {
            coords.push([value.lat, value.lng]);
        }

        // Line segment endpoints: { start_lat, start_lng, end_lat, end_lng }
        if (typeof value.start_lat === 'number' && typeof value.start_lng === 'number') {
            coords.push([value.start_lat, value.start_lng]);
        }
        if (typeof value.end_lat === 'number' && typeof value.end_lng === 'number') {
            coords.push([value.end_lat, value.end_lng]);
        }

        // Polygon vertices: { vertices: [[lng, lat], ...] } (GeoJSON order)
        if (Array.isArray(value.vertices)) {
            for (const v of value.vertices) {
                if (Array.isArray(v) && v.length >= 2 &&
                    typeof v[0] === 'number' && typeof v[1] === 'number') {
                    coords.push([v[1], v[0]]); // [lng,lat] → [lat,lng]
                }
            }
        }

        // GeoJSON coordinates: { coordinates: [[lng, lat], ...] }
        if (Array.isArray(value.coordinates)) {
            const flatCoords = Array.isArray(value.coordinates[0]?.[0])
                ? value.coordinates.flat() // Polygon ring: [[[lng,lat],...]]
                : value.coordinates;       // LineString: [[lng,lat],...]
            for (const c of flatCoords) {
                if (Array.isArray(c) && c.length >= 2 &&
                    typeof c[0] === 'number' && typeof c[1] === 'number') {
                    coords.push([c[1], c[0]]); // [lng,lat] → [lat,lng]
                }
            }
        }

        // Centroid as fallback if no other coords were found
        if (coords.length === 0 && typeof value.center_lat === 'number' && typeof value.center_lng === 'number') {
            let lat = value.center_lat;
            let lng = value.center_lng;
            if (typeof value.center_offset_lat === 'number') lat += value.center_offset_lat;
            if (typeof value.center_offset_lng === 'number') lng += value.center_offset_lng;
            coords.push([lat, lng]);
        }

        return coords;
    }

    /**
     * Extract ONLY the center-point [lat, lng] from a geo field value.
     * Used by "center" bounding box filters.
     *
     * Priority:
     *   1. Explicit centroid: { center_lat, center_lng } (with offset support)
     *   2. Point: { lat, lng }
     *   3. [lat, lng] tuple
     *   4. Midpoint of line segment endpoints
     *   5. Average of polygon vertices
     *   6. Centroid from GeoJSON coordinates
     */
    private extractGeoCenterPoint(rawValue: any): [number, number] | null {
        let value = this.parseGeoValue(rawValue);
        if (value == null) return null;

        // Simple [lat, lng] tuple — treat as both the point and its center
        if (Array.isArray(value) && value.length === 2 &&
            typeof value[0] === 'number' && typeof value[1] === 'number') {
            return [value[0], value[1]];
        }

        if (typeof value !== 'object' || value === null) return null;

        // Explicit centroid (polygons and lines store this)
        if (typeof value.center_lat === 'number' && typeof value.center_lng === 'number') {
            let lat = value.center_lat;
            let lng = value.center_lng;
            if (typeof value.center_offset_lat === 'number') lat += value.center_offset_lat;
            if (typeof value.center_offset_lng === 'number') lng += value.center_offset_lng;
            return [lat, lng];
        }

        // Point: { lat, lng }
        if (typeof value.lat === 'number' && typeof value.lng === 'number') {
            return [value.lat, value.lng];
        }

        // Line segment midpoint
        if (typeof value.start_lat === 'number' && typeof value.start_lng === 'number' &&
            typeof value.end_lat === 'number' && typeof value.end_lng === 'number') {
            return [
                (value.start_lat + value.end_lat) / 2,
                (value.start_lng + value.end_lng) / 2
            ];
        }

        // Average of polygon vertices
        if (Array.isArray(value.vertices) && value.vertices.length > 0) {
            let sumLat = 0, sumLng = 0, count = 0;
            for (const v of value.vertices) {
                if (Array.isArray(v) && v.length >= 2 &&
                    typeof v[0] === 'number' && typeof v[1] === 'number') {
                    sumLat += v[1]; // [lng,lat] → lat
                    sumLng += v[0]; // [lng,lat] → lng
                    count++;
                }
            }
            if (count > 0) return [sumLat / count, sumLng / count];
        }

        // Average of GeoJSON coordinates
        if (Array.isArray(value.coordinates)) {
            const flatCoords = Array.isArray(value.coordinates[0]?.[0])
                ? value.coordinates.flat()
                : value.coordinates;
            let sumLat = 0, sumLng = 0, count = 0;
            for (const c of flatCoords) {
                if (Array.isArray(c) && c.length >= 2 &&
                    typeof c[0] === 'number' && typeof c[1] === 'number') {
                    sumLat += c[1]; // [lng,lat] → lat
                    sumLng += c[0]; // [lng,lat] → lng
                    count++;
                }
            }
            if (count > 0) return [sumLat / count, sumLng / count];
        }

        return null;
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
