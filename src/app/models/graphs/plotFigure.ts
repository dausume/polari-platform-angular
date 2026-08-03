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
    /** Axis labels — the place to carry UNITS so readers know what the
     *  numbers are (e.g. 'time (s)', 'temperature (K)'). Default: the
     *  dimension (field) name Observable Plot infers. */
    xLabel?: string;
    yLabel?: string;
}

/**
 * Plot render style definitions (wraps Observable Plot mark types)
 */
export type PlotRenderStyle = 'lineY' | 'barY' | 'lineX' | 'barX' | 'dot' | 'areaX' | 'areaY';

/**
 * Represents a complete plot figure with data series, axes, and dimension renderers.
 * The PlotFigure class is the central model for visualization configuration.
 */
/** Rough width of one tick-label character at the default font size.
 *  Used to predict collision; approximate on purpose — the cost of
 *  being slightly wrong is a rotated label that did not need it. */
const TICK_CHAR_PX = 6.5;

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
            // Computed FIRST: it may widen the bottom margin to make
            // room for rotated tick labels, and an object literal
            // evaluates its properties in order — reading
            // marginBottom before this ran would capture the old value.
            const xScale = this.xScaleOptions();
            return Plot.plot({
                marks,
                width: this.options.width || 800,
                height: this.options.height || 400,
                marginTop: this.options.marginTop || 20,
                marginRight: this.options.marginRight || 30,
                marginBottom: this.options.marginBottom || 40,
                marginLeft: this.options.marginLeft || 50,
                grid: this.options.showGrid ?? true,
                x: xScale,
                ...(this.options.yLabel ? { y: { label: this.options.yLabel } } : {})
            });
        } catch (e) {
            console.error('[PlotFigure] Rendering failed:', e);
            return null;
        }
    }

    /**
     * X scale options, with categorical labels kept readable.
     *
     * A categorical x axis (part names, run names, material refs) puts
     * one tick per row, and they overlap into an unreadable smear as
     * soon as the labels are wider than the plot — which is what a
     * configured bar chart of motor parts looked like. Rotate them
     * when the predicted width will not fit, and give the rotated
     * text vertical room so it does not clip.
     */
    private xScaleOptions(): Record<string, unknown> {
        const scale: Record<string, unknown> = {};
        if (this.options.xLabel) {
            scale['label'] = this.options.xLabel;
        }
        const labels = this.categoricalXLabels();
        if (!labels.length) {
            return scale;
        }
        // Collision is about WIDTH, not count: seven parts named
        // "Coil winding (1500 t, 44 AWG)" overlap just as badly as
        // thirty short ones. Predict the laid-out width and rotate
        // only when it will not fit.
        const needed = labels.reduce(
            (total, label) => total + label.length * TICK_CHAR_PX + 10, 0);
        const available = (this.options.width || 800)
            - (this.options.marginLeft || 50)
            - (this.options.marginRight || 30);
        if (needed > available) {
            scale['tickRotate'] = -35;
            const longest = labels.reduce(
                (max, label) => Math.max(max, label.length), 0);
            // Rotated labels need vertical room or they clip.
            const room = Math.min(160, Math.round(longest * TICK_CHAR_PX * 0.6) + 30);
            if (room > (this.options.marginBottom || 40)) {
                (this.options as any).marginBottom = room;
            }
            // A label rotated anticlockwise leans LEFT of its tick, so
            // the first category overhangs the plot and gets clipped
            // by the container. Give it somewhere to lean.
            const overhang = Math.min(90, Math.round(room * 0.7));
            if (overhang > (this.options.marginLeft || 50)) {
                (this.options as any).marginLeft = overhang;
            }
        }
        return scale;
    }

    /** The distinct categorical x labels; empty when x is not
     *  categorical or the data is unavailable. */
    private categoricalXLabels(): string[] {
        const axis = this.Xaxes?.[0];
        const field = axis?.dimension?.name;
        const points = this.dataseries?.dataPoints;
        if (!field || !Array.isArray(points) || points.length === 0) {
            return [];
        }
        const seen = new Set<string>();
        for (const point of points) {
            const value = (point as any)?.[field]
                ?? (point as any)?.values?.[field];
            if (typeof value === 'string') {
                seen.add(value);
            }
        }
        return [...seen];
    }
}
