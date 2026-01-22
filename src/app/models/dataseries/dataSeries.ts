import { DataSeriesPoint } from "./dataSeriesDataPoint";
import { DataSeriesDimension } from "./dataSeriesDimension";

/**
 * Map of dimension names to their data types
 */
export interface DimensionTypesMap {
    string: string[];
    number: string[];
    boolean: string[];
    date: string[];
}

/**
 * Data source information
 */
export interface DataSource {
    type: 'api' | 'file' | 'static' | 'stream';
    endpoint?: string;
    refreshInterval?: number;
    lastUpdated?: Date;
}

/**
 * Represents a collection of data points with defined dimensions.
 * A DataSeries is the fundamental data container for visualization.
 */
export class DataSeries {
    /** Unique identifier for the data series */
    id: string;

    /** Display name of the data series */
    name: string;

    /** Dimension definitions describing the structure of data points */
    dimensions: DataSeriesDimension[];

    /** The actual data points in this series */
    dataPoints: DataSeriesPoint[];

    /** Categorization of dimensions by their data type */
    dimensionTypesMap: DimensionTypesMap;

    /** Source information for the data */
    source?: DataSource;

    constructor(
        id: string = '',
        name: string = '',
        dimensions: DataSeriesDimension[] = [],
        dataPoints: DataSeriesPoint[] = [],
        source?: DataSource
    ) {
        this.id = id;
        this.name = name;
        this.dimensions = dimensions;
        this.dataPoints = dataPoints;
        this.dimensionTypesMap = {
            string: [],
            number: [],
            boolean: [],
            date: []
        };
        this.source = source;

        // Auto-categorize dimensions by type
        this.categorizeDimensions();
    }

    /**
     * Categorizes dimensions by their data type
     */
    private categorizeDimensions(): void {
        this.dimensionTypesMap = {
            string: [],
            number: [],
            boolean: [],
            date: []
        };

        for (const dim of this.dimensions) {
            const type = dim.dataType.toLowerCase();
            if (type in this.dimensionTypesMap) {
                this.dimensionTypesMap[type as keyof DimensionTypesMap].push(dim.name);
            }
        }
    }

    /**
     * Adds a dimension to the data series
     */
    addDimension(dimension: DataSeriesDimension): void {
        this.dimensions.push(dimension);
        this.categorizeDimensions();
    }

    /**
     * Adds a data point to the series
     */
    addDataPoint(dataPoint: DataSeriesPoint): void {
        this.dataPoints.push(dataPoint);
    }

    /**
     * Adds multiple data points to the series
     */
    addDataPoints(dataPoints: DataSeriesPoint[]): void {
        this.dataPoints.push(...dataPoints);
    }

    /**
     * Gets a dimension by name
     */
    getDimension(name: string): DataSeriesDimension | undefined {
        return this.dimensions.find(d => d.name === name);
    }

    /**
     * Gets all dimension names of a specific type
     */
    getDimensionsByType(type: keyof DimensionTypesMap): string[] {
        return this.dimensionTypesMap[type];
    }

    /**
     * Extracts values for a specific dimension from all data points
     */
    getValuesForDimension(dimensionName: string): any[] {
        return this.dataPoints.map(dp => dp[dimensionName]);
    }

    /**
     * Gets the min and max values for a numeric dimension
     */
    getDimensionRange(dimensionName: string): { min: number; max: number } | null {
        const values = this.getValuesForDimension(dimensionName)
            .filter(v => typeof v === 'number' && !isNaN(v));

        if (values.length === 0) return null;

        return {
            min: Math.min(...values),
            max: Math.max(...values)
        };
    }

    /**
     * Filters data points based on a predicate
     */
    filter(predicate: (dp: DataSeriesPoint) => boolean): DataSeriesPoint[] {
        return this.dataPoints.filter(predicate);
    }

    /**
     * Creates a new DataSeries with filtered data points
     */
    createFiltered(predicate: (dp: DataSeriesPoint) => boolean): DataSeries {
        return new DataSeries(
            `${this.id}-filtered`,
            `${this.name} (filtered)`,
            [...this.dimensions],
            this.filter(predicate),
            this.source
        );
    }

    /**
     * Returns the count of data points
     */
    get length(): number {
        return this.dataPoints.length;
    }

    /**
     * Checks if the data series has data
     */
    hasData(): boolean {
        return this.dataPoints.length > 0;
    }

    /**
     * Clears all data points
     */
    clear(): void {
        this.dataPoints = [];
    }
}
