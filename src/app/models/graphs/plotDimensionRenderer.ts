import { PlotFigure, PlotRenderStyle } from "./plotFigure";

/**
 * Observable Plot library interface (optional dependency)
 * The library will be loaded dynamically if available
 */
interface PlotLibraryInterface {
    lineY(data: any, options?: any): any;
    lineX(data: any, options?: any): any;
    barY(data: any, options?: any): any;
    barX(data: any, options?: any): any;
    dot(data: any, options?: any): any;
    area(data: any, options?: any): any;
    areaY(data: any, options?: any): any;
}

/**
 * Represents a single dimension renderer within a plot figure.
 * Handles the creation of Observable Plot marks for visualization.
 * Note: Observable Plot (@observablehq/plot) is an optional dependency.
 */
export class PlotDimensionRenderer {
    /** Reference to the Observable Plot library (loaded dynamically) */
    private static PlotLib: PlotLibraryInterface | null = null;
    private static plotLibLoaded = false;

    /** Valid render styles for XY visualizations */
    static validRenderStyles: PlotRenderStyle[] = [
        "lineY",
        "barY",
        "lineX",
        "barX",
        "dot",
        "area",
        "areaY"
    ];

    /** Default colors for plots */
    static defaultColors = [
        "steelblue",
        "#e15759",
        "#59a14f",
        "#f28e2c",
        "#76b7b2",
        "#edc949",
        "#af7aa1",
        "#ff9da7"
    ];

    /** The dimension name this renderer represents */
    dimensionName: string;

    /** The render style (lineY, barY, etc.) */
    renderStyle: PlotRenderStyle;

    /** Reference to the parent plot figure */
    plotFigure: PlotFigure;

    /** Color for this plot */
    color: string;

    /** Unique identifier for this plot */
    id: string;

    /** Optional label override for legend */
    label?: string;

    /** Stroke width for line plots */
    strokeWidth: number;

    /** Whether to show markers on line plots */
    showMarkers: boolean;

    /** Opacity for the plot (0-1) */
    opacity: number;

    constructor(
        dimensionName: string,
        renderStyle: PlotRenderStyle | string,
        plotFigure: PlotFigure,
        color?: string,
        id?: string
    ) {
        this.dimensionName = dimensionName;
        this.renderStyle = renderStyle as PlotRenderStyle;
        this.plotFigure = plotFigure;
        this.color = color || PlotDimensionRenderer.defaultColors[0];
        this.id = id || `${plotFigure.id}-${dimensionName}-${renderStyle}`;
        this.strokeWidth = 2;
        this.showMarkers = true;
        this.opacity = 1;
    }

    /**
     * Attempts to load the Observable Plot library.
     * Call this method before using createDimensionPlot() if you have the library installed.
     */
    static async loadPlotLibrary(): Promise<boolean> {
        if (PlotDimensionRenderer.plotLibLoaded) {
            return PlotDimensionRenderer.PlotLib !== null;
        }

        try {
            // Dynamic import for Observable Plot - using variable to prevent TypeScript resolution
            const plotModuleName = "@observablehq/plot";
            const module = await (Function('modulePath', 'return import(modulePath)')(plotModuleName));
            PlotDimensionRenderer.PlotLib = module as unknown as PlotLibraryInterface;
            PlotDimensionRenderer.plotLibLoaded = true;
            console.log("[PlotDimensionRenderer] Observable Plot library loaded successfully");
            return true;
        } catch (e) {
            console.warn("[PlotDimensionRenderer] Observable Plot library not available:", e);
            PlotDimensionRenderer.plotLibLoaded = true;
            return false;
        }
    }

    /**
     * Sets the Plot library manually (useful for testing or alternative loading)
     */
    static setPlotLibrary(lib: PlotLibraryInterface): void {
        PlotDimensionRenderer.PlotLib = lib;
        PlotDimensionRenderer.plotLibLoaded = true;
    }

    /**
     * Creates the Observable Plot mark for this dimension plot.
     * @returns The plot mark or null if data is not available
     */
    createDimensionPlot(): any {
        // Check if Plot library is available
        if (!PlotDimensionRenderer.PlotLib) {
            console.warn("[PlotDimensionRenderer] Observable Plot library not loaded. Call loadPlotLibrary() first.");
            return null;
        }

        const dataSeries = this.plotFigure.dataseries?.dataPoints;

        // Validate data exists
        if (!dataSeries || dataSeries.length === 0) {
            console.warn(`[PlotDimensionRenderer] No data available for ${this.dimensionName}`);
            return null;
        }

        // Determine X and Y dimensions based on plot type
        const { xDimension, yDimension } = this.resolveDimensions();

        if (!xDimension || !yDimension) {
            console.warn(`[PlotDimensionRenderer] Could not resolve dimensions for ${this.renderStyle}`);
            return null;
        }

        // Create the appropriate plot mark
        return this.createPlotMark(dataSeries, xDimension, yDimension);
    }

    /**
     * Resolves X and Y dimensions based on plot type
     */
    private resolveDimensions(): { xDimension?: string; yDimension?: string } {
        let xDimension: string | undefined;
        let yDimension: string | undefined;

        if (this.renderStyle.includes('Y') || this.renderStyle === 'dot') {
            // Plot type maps to Y axis - use primary X axis
            if (!this.plotFigure.Xaxes[0]) {
                console.error("[PlotDimensionRenderer] No primary X axis defined for graph.");
                return {};
            }
            xDimension = this.plotFigure.Xaxes[0].dimension.name;
            yDimension = this.dimensionName;
        } else if (this.renderStyle.includes('X')) {
            // Plot type maps to X axis - use primary Y axis
            if (!this.plotFigure.Yaxes[0]) {
                console.error("[PlotDimensionRenderer] No primary Y axis defined for graph.");
                return {};
            }
            xDimension = this.dimensionName;
            yDimension = this.plotFigure.Yaxes[0].dimension.name;
        }

        return { xDimension, yDimension };
    }

    /**
     * Creates the specific plot mark based on plot type
     */
    private createPlotMark(
        data: any[],
        xDimension: string,
        yDimension: string
    ): any {
        const Plot = PlotDimensionRenderer.PlotLib;
        if (!Plot) return null;

        const baseOptions = {
            x: xDimension,
            y: yDimension,
            opacity: this.opacity
        };

        switch (this.renderStyle) {
            case "lineY":
                return Plot.lineY(data, {
                    ...baseOptions,
                    stroke: this.color,
                    strokeWidth: this.strokeWidth,
                    marker: this.showMarkers
                });

            case "lineX":
                return Plot.lineX(data, {
                    ...baseOptions,
                    stroke: this.color,
                    strokeWidth: this.strokeWidth,
                    marker: this.showMarkers
                });

            case "barY":
                return Plot.barY(data, {
                    ...baseOptions,
                    fill: this.color
                });

            case "barX":
                return Plot.barX(data, {
                    ...baseOptions,
                    fill: this.color
                });

            case "dot":
                return Plot.dot(data, {
                    ...baseOptions,
                    fill: this.color,
                    r: 3
                });

            case "area":
                return Plot.area(data, {
                    ...baseOptions,
                    fill: this.color,
                    fillOpacity: 0.3
                });

            case "areaY":
                return Plot.areaY(data, {
                    ...baseOptions,
                    fill: this.color,
                    fillOpacity: 0.3
                });

            default:
                console.warn(`[PlotDimensionRenderer] Unknown plot type "${this.renderStyle}"`);
                return null;
        }
    }

    /**
     * Sets the color for this plot
     */
    setColor(color: string): this {
        this.color = color;
        return this;
    }

    /**
     * Sets the stroke width for line plots
     */
    setStrokeWidth(width: number): this {
        this.strokeWidth = width;
        return this;
    }

    /**
     * Enables or disables markers on line plots
     */
    setShowMarkers(show: boolean): this {
        this.showMarkers = show;
        return this;
    }

    /**
     * Sets the opacity for this plot
     */
    setOpacity(opacity: number): this {
        this.opacity = Math.max(0, Math.min(1, opacity));
        return this;
    }

    /**
     * Validates that this render style is supported
     */
    static isValidRenderStyle(type: string): type is PlotRenderStyle {
        return PlotDimensionRenderer.validRenderStyles.includes(type as PlotRenderStyle);
    }

    /**
     * Checks if the Observable Plot library is available
     */
    static isPlotLibraryAvailable(): boolean {
        return PlotDimensionRenderer.PlotLib !== null;
    }
}
