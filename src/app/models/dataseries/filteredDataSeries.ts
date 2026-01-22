import { DataSeries } from "./dataSeries";
import { DataSeriesPoint } from "./dataSeriesDataPoint";
import { DataSeriesFilterChain } from "./filterChain";

/**
 * Represents a filtered view of a DataSeries.
 * Maintains a reference to the source data and applies filters on demand.
 */
export class FilteredDataSeries extends DataSeries {
    /** The original unfiltered data series */
    sourceDataSeries: DataSeries;

    /** The filter chain to apply */
    filterChain: DataSeriesFilterChain | null;

    /** Whether to automatically update when source changes */
    autoUpdate: boolean;

    /** Cached filtered data points */
    private _cachedFilteredPoints: DataSeriesPoint[] | null;

    /** Whether the cache is valid */
    private _cacheValid: boolean;

    constructor(
        sourceDataSeries: DataSeries,
        filterChain?: DataSeriesFilterChain,
        autoUpdate: boolean = true
    ) {
        super(
            `${sourceDataSeries.id}-filtered`,
            `${sourceDataSeries.name} (filtered)`,
            [...sourceDataSeries.dimensions],
            [],
            sourceDataSeries.source
        );

        this.sourceDataSeries = sourceDataSeries;
        this.filterChain = filterChain || null;
        this.autoUpdate = autoUpdate;
        this._cachedFilteredPoints = null;
        this._cacheValid = false;
    }

    /**
     * Gets the filtered data points, applying the filter chain
     */
    getFilteredDataPoints(): DataSeriesPoint[] {
        if (this._cacheValid && this._cachedFilteredPoints) {
            return this._cachedFilteredPoints;
        }

        this._cachedFilteredPoints = this.applyFilters();
        this._cacheValid = true;
        return this._cachedFilteredPoints;
    }

    /**
     * Applies the filter chain to the source data
     */
    private applyFilters(): DataSeriesPoint[] {
        if (!this.filterChain) {
            return [...this.sourceDataSeries.dataPoints];
        }

        return this.filterChain.applyDataSeriesFilterChain(this.sourceDataSeries.dataPoints);
    }

    /**
     * Sets a new filter chain
     */
    setDataSeriesFilterChain(filterChain: DataSeriesFilterChain | null): this {
        this.filterChain = filterChain;
        this.invalidateCache();
        return this;
    }

    /**
     * Adds a filter to the chain
     */
    addFilter(variableName: string, filterValue: any, filterType: string): this {
        const newFilter = new DataSeriesFilterChain(variableName, filterValue, filterType);

        if (this.filterChain) {
            this.filterChain.pushFilter(newFilter);
        } else {
            this.filterChain = newFilter;
        }

        this.invalidateCache();
        return this;
    }

    /**
     * Clears all filters
     */
    clearFilters(): this {
        this.filterChain = null;
        this.invalidateCache();
        return this;
    }

    /**
     * Invalidates the cached filtered data
     */
    invalidateCache(): void {
        this._cacheValid = false;
        this._cachedFilteredPoints = null;
    }

    /**
     * Forces a refresh of the filtered data
     */
    refresh(): DataSeriesPoint[] {
        this.invalidateCache();
        return this.getFilteredDataPoints();
    }

    /**
     * Gets the count of filtered data points
     */
    getFilteredLength(): number {
        return this.getFilteredDataPoints().length;
    }

    /**
     * Gets the count of source data points (before filtering)
     */
    get sourceLength(): number {
        return this.sourceDataSeries.dataPoints.length;
    }

    /**
     * Gets the filter ratio (filtered / source)
     */
    get filterRatio(): number {
        if (this.sourceLength === 0) return 0;
        return this.getFilteredLength() / this.sourceLength;
    }

    /**
     * Creates a new FilteredDataSeries from this one with an additional filter
     */
    withFilter(variableName: string, filterValue: any, filterType: string): FilteredDataSeries {
        const clonedChain = this.filterChain?.clone() || null;
        const newFilter = new DataSeriesFilterChain(variableName, filterValue, filterType);

        if (clonedChain) {
            clonedChain.pushFilter(newFilter);
        }

        return new FilteredDataSeries(
            this.sourceDataSeries,
            clonedChain || newFilter,
            this.autoUpdate
        );
    }
}
