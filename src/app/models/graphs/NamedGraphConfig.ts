import { PlotFigure, PlotFigureOptions, PlotRenderStyle } from './plotFigure';

export interface GraphDefinitionSummary {
  id: string;
  name: string;
  description: string;
  source_class: string;
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
}

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
  }
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
    this.graphConfig = { ...DEFAULT_GRAPH_CONFIG, options: { ...DEFAULT_GRAPH_CONFIG.options } };
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
            }
          };
        }
      } catch (e) {
        console.warn('[NamedGraphConfig] Failed to parse definition:', e);
      }
    }

    return config;
  }
}
