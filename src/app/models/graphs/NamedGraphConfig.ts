import { PlotFigure, PlotFigureOptions, PlotRenderStyle } from './plotFigure';
import { PlotBoundDimension } from './plotBoundDimension';
import { DataSeries } from '@models/dataseries/dataSeries';
import { DataSeriesPoint } from '@models/dataseries/dataSeriesDataPoint';
import { DataSeriesDimension } from '@models/dataseries/dataSeriesDimension';
import { CompressionStrategy } from '@models/dataseries/compressionStrategy';

export interface GraphDefinitionSummary {
  id: string;
  name: string;
  description: string;
  source_class: string;
}

/**
 * Aggregation configuration for grouped data (bar charts, etc.)
 */
export interface AggregationConfig {
  enabled: boolean;
  strategy: CompressionStrategy;
}

/**
 * Serializable graph configuration stored in the definition JSON.
 * This is the subset of PlotFigure settings that we persist —
 * the actual PlotFigure (with live data, library refs, etc.) is
 * reconstructed at render time from this config + data.
 */
export interface GraphConfigData {
  /** Which render style to use (lineY, barY, dot, etc.) */
  renderStyle: PlotRenderStyle;

  /** Dimension name mapped to the X axis */
  xDimension: string;

  /** Dimension names mapped to the Y axis (supports multiple series) */
  yDimensions: string[];

  /** Per-series colours (parallel to yDimensions) */
  seriesColors: string[];

  /** Plot figure options (size, margins, legend, grid) */
  options: PlotFigureOptions;

  /** Aggregation settings (groupBy X, aggregate Y values) */
  aggregation: AggregationConfig;
}

const DEFAULT_AGGREGATION: AggregationConfig = {
  enabled: false,
  strategy: 'average'
};

const DEFAULT_GRAPH_CONFIG: GraphConfigData = {
  renderStyle: 'lineY',
  xDimension: '',
  yDimensions: [],
  seriesColors: [],
  options: {
    width: 800,
    height: 400,
    marginTop: 20,
    marginRight: 30,
    marginBottom: 40,
    marginLeft: 50,
    showLegend: true,
    showGrid: true
  },
  aggregation: { ...DEFAULT_AGGREGATION }
};

export class NamedGraphConfig {
  id: string;
  name: string;
  description: string;
  source_class: string;
  graphConfig: GraphConfigData;

  constructor(id: string, name: string, description: string, sourceClass: string) {
    this.id = id;
    this.name = name;
    this.description = description;
    this.source_class = sourceClass;
    this.graphConfig = {
      ...DEFAULT_GRAPH_CONFIG,
      options: { ...DEFAULT_GRAPH_CONFIG.options },
      aggregation: { ...DEFAULT_AGGREGATION }
    };
  }

  toDefinitionJSON(): string {
    return JSON.stringify({
      graphConfig: this.graphConfig
    });
  }

  static fromBackend(backendObj: any): NamedGraphConfig {
    const config = new NamedGraphConfig(
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

        if (parsed.graphConfig) {
          config.graphConfig = {
            ...DEFAULT_GRAPH_CONFIG,
            ...parsed.graphConfig,
            options: {
              ...DEFAULT_GRAPH_CONFIG.options,
              ...(parsed.graphConfig.options || {})
            },
            aggregation: {
              ...DEFAULT_AGGREGATION,
              ...(parsed.graphConfig.aggregation || {})
            }
          };
        }
      } catch (e) {
        console.warn('[NamedGraphConfig] Failed to parse definition:', e);
      }
    }

    return config;
  }

  // ==================== Data Transformation & Rendering ====================

  /**
   * Builds a fully configured PlotFigure from this config + raw instance data.
   * This is the primary entry point: config + data → renderable PlotFigure.
   *
   * @param instanceData - Flat objects from CRUDE (e.g. [{id: "1", name: "foo", value: 42}, ...])
   * @param classTypeData - Optional class typing data (variablePolyTyping dict) for value coercion
   * @returns A PlotFigure ready to call .render() on
   */
  buildPlotFigure(instanceData: any[], classTypeData?: any): PlotFigure {
    const gc = this.graphConfig;

    // 1. Build DataSeries from raw instance data (with type coercion)
    let dataSeries = this.buildDataSeries(instanceData, classTypeData);

    // 2. Apply aggregation if enabled (group by X, aggregate Y)
    if (gc.aggregation.enabled && gc.xDimension && gc.yDimensions.length > 0) {
      dataSeries = this.aggregateData(dataSeries, gc.xDimension, gc.yDimensions, gc.aggregation.strategy);
    }

    // 3. Sort data for continuous chart types (lines, areas)
    const continuousStyles: PlotRenderStyle[] = ['lineY', 'lineX', 'areaX', 'areaY'];
    if (continuousStyles.includes(gc.renderStyle) && gc.xDimension) {
      this.sortDataByDimension(dataSeries, gc.xDimension);
    }

    // 4. Create PlotFigure with processed data
    const figure = new PlotFigure(this.id, this.name, dataSeries, gc.options);

    // Determine if this is an X-type chart (barX, lineX).
    // In the config, xDimension is always the single-select "category" field
    // and yDimensions is always the multi-select "value" fields.
    // For Y-type charts: category → X axis, values → Y axis marks
    // For X-type charts: category → Y axis, values → X axis marks
    const isXType = gc.renderStyle === 'barX' || gc.renderStyle === 'lineX' || gc.renderStyle === 'areaX';

    // 5. Set up the category axis
    if (gc.xDimension) {
      const categoryBound = new PlotBoundDimension(gc.xDimension);
      if (isXType) {
        categoryBound.yAxis = true;
        figure.addYAxis({ dimension: categoryBound });
      } else {
        categoryBound.xAxis = true;
        figure.addXAxis({ dimension: categoryBound });
      }
    }

    // 6. Create PlotDimensionRenderers for each value dimension
    gc.yDimensions.forEach((valueDim, i) => {
      if (i === 0) {
        const valueBound = new PlotBoundDimension(valueDim);
        if (isXType) {
          valueBound.xAxis = true;
          figure.addXAxis({ dimension: valueBound });
        } else {
          valueBound.yAxis = true;
          figure.addYAxis({ dimension: valueBound });
        }
      }
      figure.createPlotForDimension(valueDim, gc.renderStyle, gc.seriesColors[i]);
    });

    return figure;
  }

  /**
   * Converts flat CRUDE instance objects into a DataSeries.
   * Uses classTypeData (variablePolyTyping) for type coercion when available,
   * since CRUDE serializes all values as strings.
   *
   * @param instanceData - Raw instance objects from CRUDE
   * @param classTypeData - Optional typing dict: { fieldName: { variablePythonType: 'int' | 'str' | ... } }
   */
  private buildDataSeries(instanceData: any[], classTypeData?: any): DataSeries {
    if (!instanceData || instanceData.length === 0) {
      return new DataSeries(this.id, this.name);
    }

    // Build a type map from classTypeData for fast lookup
    const typeMap: Record<string, string> = {};
    if (classTypeData) {
      for (const key of Object.keys(classTypeData)) {
        const pythonType = classTypeData[key]?.variablePythonType;
        if (pythonType) {
          typeMap[key] = pythonType;
        }
      }
    }

    // Infer dimension types from classTypeData or fallback to JS typeof
    const sampleInstance = instanceData[0];
    const dimensions: DataSeriesDimension[] = Object.keys(sampleInstance).map(key => {
      const pythonType = typeMap[key];
      let dataType = 'string';
      if (pythonType) {
        if (pythonType === 'int' || pythonType === 'float') dataType = 'number';
        else if (pythonType === 'bool') dataType = 'boolean';
        else if (pythonType === 'date' || pythonType === 'datetime') dataType = 'date';
        else dataType = 'string';
      } else {
        // Fallback: infer from JS value
        const value = sampleInstance[key];
        if (typeof value === 'number') dataType = 'number';
        else if (typeof value === 'boolean') dataType = 'boolean';
        else if (value instanceof Date) dataType = 'date';
      }
      return new DataSeriesDimension(key, '', dataType);
    });

    // Convert instances to DataSeriesPoints with type coercion
    const dataPoints: DataSeriesPoint[] = instanceData.map(instance => {
      const coerced: Record<string, any> = {};
      for (const key of Object.keys(instance)) {
        coerced[key] = this.coerceValue(instance[key], typeMap[key]);
      }
      return new DataSeriesPoint(coerced);
    });

    return new DataSeries(this.id, this.name, dimensions, dataPoints);
  }

  /**
   * Coerces a raw CRUDE value to the correct JS type based on Python type info.
   * CRUDE serializes everything as strings, so "123" needs to become 123 for int fields.
   */
  private coerceValue(value: any, pythonType?: string): any {
    if (value == null) return value;
    if (!pythonType) return value;

    switch (pythonType) {
      case 'int': {
        if (typeof value === 'number') return value;
        const parsed = parseInt(String(value), 10);
        return isNaN(parsed) ? value : parsed;
      }
      case 'float': {
        if (typeof value === 'number') return value;
        const parsed = parseFloat(String(value));
        return isNaN(parsed) ? value : parsed;
      }
      case 'bool': {
        if (typeof value === 'boolean') return value;
        const str = String(value).toLowerCase();
        return str === 'true' || str === '1';
      }
      default:
        return value;
    }
  }

  /**
   * Groups data by the X dimension and aggregates Y values using the given strategy.
   * Used for bar charts and other grouped visualizations.
   *
   * @param dataSeries - Source data
   * @param groupField - Dimension to group by (X axis)
   * @param valueFields - Dimensions to aggregate (Y axes)
   * @param strategy - Aggregation strategy (average, sum, count, etc.)
   * @returns New DataSeries with aggregated data
   */
  private aggregateData(
    dataSeries: DataSeries,
    groupField: string,
    valueFields: string[],
    strategy: CompressionStrategy
  ): DataSeries {
    if (!dataSeries.hasData()) return dataSeries;

    // Group data points by the groupField value
    const groups = new Map<string, DataSeriesPoint[]>();
    for (const point of dataSeries.dataPoints) {
      const key = String(point[groupField] ?? '');
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(point);
    }

    // Aggregate each group
    const aggregatedPoints: DataSeriesPoint[] = [];
    for (const [groupKey, points] of groups) {
      const aggregated: { [key: string]: any } = {};
      aggregated[groupField] = this.parseGroupKey(groupKey, points[0]?.[groupField]);

      for (const field of valueFields) {
        const values = points
          .map(p => p[field])
          .filter(v => typeof v === 'number' && !isNaN(v));

        aggregated[field] = this.applyStrategy(values, strategy);
      }

      aggregatedPoints.push(new DataSeriesPoint(aggregated));
    }

    return new DataSeries(
      `${dataSeries.id}-aggregated`,
      dataSeries.name,
      [...dataSeries.dimensions],
      aggregatedPoints,
      dataSeries.source
    );
  }

  /**
   * Applies a compression strategy to an array of numeric values.
   */
  private applyStrategy(values: number[], strategy: CompressionStrategy): number {
    if (values.length === 0) return 0;

    switch (strategy) {
      case 'average':
        return values.reduce((a, b) => a + b, 0) / values.length;
      case 'sum':
        return values.reduce((a, b) => a + b, 0);
      case 'count':
        return values.length;
      case 'start-of-time-step':
        return values[0];
      case 'end-of-time-step':
        return values[values.length - 1];
      case 'none':
      default:
        return values[0];
    }
  }

  /**
   * Preserves the original type of the group key where possible.
   */
  private parseGroupKey(stringKey: string, originalValue: any): any {
    if (typeof originalValue === 'number') {
      const num = Number(stringKey);
      return isNaN(num) ? stringKey : num;
    }
    return originalValue ?? stringKey;
  }

  /**
   * Sorts a DataSeries' data points in-place by the given dimension.
   */
  private sortDataByDimension(dataSeries: DataSeries, dimensionName: string): void {
    dataSeries.dataPoints.sort((a, b) => {
      const aVal = a[dimensionName];
      const bVal = b[dimensionName];
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return -1;
      if (bVal == null) return 1;
      if (typeof aVal === 'number' && typeof bVal === 'number') return aVal - bVal;
      return String(aVal).localeCompare(String(bVal));
    });
  }
}
