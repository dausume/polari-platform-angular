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
     * Applies a single filter to the data points
     */
    private applyFilter(dataPoints: any[], filter: DataSeriesFilterChain): any[] {
        const { variableName, filterValue, filterType } = filter;

        switch (filterType) {
            case 'noop':
                return dataPoints;

            // Numeric/Equality Operators
            case 'equals':
                return dataPoints.filter(dp => dp[variableName] === filterValue);
            case 'notEquals':
                return dataPoints.filter(dp => dp[variableName] !== filterValue);
            case 'greaterThan':
                return dataPoints.filter(dp => dp[variableName] > filterValue);
            case 'lessThan':
                return dataPoints.filter(dp => dp[variableName] < filterValue);
            case 'greaterThanOrEqual':
                return dataPoints.filter(dp => dp[variableName] >= filterValue);
            case 'lessThanOrEqual':
                return dataPoints.filter(dp => dp[variableName] <= filterValue);
            case 'inRange':
                if (Array.isArray(filterValue) && filterValue.length === 2) {
                    return dataPoints.filter(dp =>
                        dp[variableName] >= filterValue[0] &&
                        dp[variableName] <= filterValue[1]
                    );
                }
                return dataPoints;
            case 'notInRange':
            case 'excludeRange':
                if (Array.isArray(filterValue) && filterValue.length === 2) {
                    return dataPoints.filter(dp =>
                        dp[variableName] < filterValue[0] ||
                        dp[variableName] > filterValue[1]
                    );
                }
                return dataPoints;

            // String Operators
            case 'contains':
                return dataPoints.filter(dp =>
                    typeof dp[variableName] === 'string' &&
                    dp[variableName].includes(filterValue)
                );
            case 'notContains':
                return dataPoints.filter(dp =>
                    typeof dp[variableName] === 'string' &&
                    !dp[variableName].includes(filterValue)
                );
            case 'startsWith':
                return dataPoints.filter(dp =>
                    typeof dp[variableName] === 'string' &&
                    dp[variableName].startsWith(filterValue)
                );
            case 'endsWith':
                return dataPoints.filter(dp =>
                    typeof dp[variableName] === 'string' &&
                    dp[variableName].endsWith(filterValue)
                );
            case 'regexMatch':
                try {
                    const regex = new RegExp(filterValue);
                    return dataPoints.filter(dp =>
                        typeof dp[variableName] === 'string' &&
                        regex.test(dp[variableName])
                    );
                } catch {
                    console.warn(`DataSeriesFilterChain: Invalid regex pattern "${filterValue}"`);
                    return dataPoints;
                }

            // Boolean Operators
            case 'isTrue':
                return dataPoints.filter(dp => dp[variableName] === true);
            case 'isFalse':
                return dataPoints.filter(dp => dp[variableName] === false);

            // Null Checks
            case 'isNull':
                return dataPoints.filter(dp =>
                    dp[variableName] === null || dp[variableName] === undefined
                );
            case 'isNotNull':
                return dataPoints.filter(dp =>
                    dp[variableName] !== null && dp[variableName] !== undefined
                );

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
}
