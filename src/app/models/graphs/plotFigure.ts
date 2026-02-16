import { DataSeries } from "@models/dataseries/dataSeries";
import { PlotDimensionGroup } from "./plotDimensionGroup";
import { PlotBoundDimension } from "./plotBoundDimension";
import { PlotDimensionRenderer } from "./plotDimensionRenderer";

/**
 * Represents a plot figure axis configuration
 */
export interface PlotAxis {
    dimension: PlotBoundDimension;
    label?: string;
    scale?: 'linear' | 'log' | 'time' | 'band';
    domain?: [number, number] | string[];
    tickFormat?: string;
}

/**
 * Plot figure configuration options
 */
export interface PlotFigureOptions {
    title?: string;
    width?: number;
    height?: number;
    marginTop?: number;
    marginRight?: number;
    marginBottom?: number;
    marginLeft?: number;
    showLegend?: boolean;
    showGrid?: boolean;
}

/**
 * Plot render style definitions (wraps Observable Plot mark types)
 */
export type PlotRenderStyle = 'lineY' | 'barY' | 'lineX' | 'barX' | 'dot' | 'areaX' | 'areaY';

/**
 * Represents a complete plot figure with data series, axes, and dimension renderers.
 * The PlotFigure class is the central model for visualization configuration.
 */
export class PlotFigure {
    /** Unique identifier for the plot figure */
    id: string;

    /** Display name of the plot figure */
    name: string;

    /** Optional description */
    description?: string;

    /** The data series containing the data points to visualize */
    dataseries: DataSeries;

    /** X-axis configurations (supports multiple for overlay plots) */
    Xaxes: PlotAxis[];

    /** Y-axis configurations (supports multiple for dual-axis charts) */
    Yaxes: PlotAxis[];

    /** Grouped dimensions for organized data representation */
    dimensionGroups: PlotDimensionGroup[];

    /** Individual dimension renderers (lines, bars, etc.) */
    dimensionPlots: PlotDimensionRenderer[];

    /** Plot figure rendering options */
    options: PlotFigureOptions;

    constructor(
        id: string = '',
        name: string = '',
        dataseries?: DataSeries,
        options?: Partial<PlotFigureOptions>
    ) {
        this.id = id;
        this.name = name;
        this.dataseries = dataseries || new DataSeries();
        this.Xaxes = [];
        this.Yaxes = [];
        this.dimensionGroups = [];
        this.dimensionPlots = [];
        this.options = {
            width: 800,
            height: 400,
            marginTop: 20,
            marginRight: 30,
            marginBottom: 40,
            marginLeft: 50,
            showLegend: true,
            showGrid: true,
            ...options
        };
    }

    /**
     * Adds an X-axis to the plot figure
     */
    addXAxis(axis: PlotAxis): void {
        this.Xaxes.push(axis);
    }

    /**
     * Adds a Y-axis to the plot figure
     */
    addYAxis(axis: PlotAxis): void {
        this.Yaxes.push(axis);
    }

    /**
     * Adds a dimension renderer to the plot figure
     */
    addDimensionPlot(plot: PlotDimensionRenderer): void {
        this.dimensionPlots.push(plot);
    }

    /**
     * Creates a dimension renderer for a given dimension
     */
    createPlotForDimension(
        dimensionName: string,
        plotType: PlotRenderStyle,
        color?: string
    ): PlotDimensionRenderer {
        const plot = new PlotDimensionRenderer(
            dimensionName,
            plotType,
            this,
            color,
            `${this.id}-${dimensionName}-${plotType}`
        );
        this.addDimensionPlot(plot);
        return plot;
    }

    /**
     * Gets the primary X dimension name
     */
    getPrimaryXDimension(): string | undefined {
        return this.Xaxes[0]?.dimension?.name;
    }

    /**
     * Gets the primary Y dimension name
     */
    getPrimaryYDimension(): string | undefined {
        return this.Yaxes[0]?.dimension?.name;
    }

    /**
     * Validates that the graph has required configuration
     */
    isValid(): boolean {
        return !!(
            this.dataseries &&
            this.dataseries.dataPoints &&
            this.dataseries.dataPoints.length > 0 &&
            this.Xaxes.length > 0 &&
            this.Yaxes.length > 0
        );
    }

    /**
     * Gets all dimension plot marks for rendering
     */
    getAllPlotMarks(): any[] {
        return this.dimensionPlots
            .map(plot => plot.createDimensionPlot())
            .filter(mark => mark !== null);
    }

    /**
     * Renders this plot figure to an SVG/HTML element using Observable Plot.
     * This is the single standard rendering entry point — call this on any
     * fully configured PlotFigure to get a mountable DOM element.
     */
    async render(): Promise<SVGSVGElement | HTMLElement | null> {
        const loaded = await PlotDimensionRenderer.loadPlotLibrary();
        if (!loaded) {
            console.warn('[PlotFigure] Observable Plot library could not be loaded');
            return null;
        }

        const Plot = PlotDimensionRenderer.getPlotLibrary();
        if (!Plot) return null;

        const marks = this.getAllPlotMarks();
        if (marks.length === 0) {
            console.warn('[PlotFigure] No valid marks to render');
            return null;
        }

        try {
            return Plot.plot({
                marks,
                width: this.options.width || 800,
                height: this.options.height || 400,
                marginTop: this.options.marginTop || 20,
                marginRight: this.options.marginRight || 30,
                marginBottom: this.options.marginBottom || 40,
                marginLeft: this.options.marginLeft || 50,
                grid: this.options.showGrid ?? true
            });
        } catch (e) {
            console.error('[PlotFigure] Rendering failed:', e);
            return null;
        }
    }
}
