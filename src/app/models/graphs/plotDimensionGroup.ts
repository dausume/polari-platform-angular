import { PlotBoundDimension } from "./plotBoundDimension";

/**
 * Represents a grouping of related data dimensions.
 * Used to organize dimensions for grouped visualizations (e.g., stacked bar charts).
 */
export class PlotDimensionGroup {
    /** Unique identifier for this group */
    id: string;

    /** Display name for the group */
    name: string;

    /** The dimensions contained in this group */
    dimensions: PlotBoundDimension[];

    /** Whether this group is enabled for visualization */
    enabled: boolean;

    /** Color scheme for this group */
    colorScheme?: string[];

    constructor(id: string = '', name: string = '', dimensions: PlotBoundDimension[] = []) {
        this.id = id || this.generateId();
        this.name = name;
        this.dimensions = dimensions;
        this.enabled = true;
    }

    /**
     * Generates a unique ID for the group
     */
    private generateId(): string {
        return 'dimgroup-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 11);
    }

    /**
     * Adds a dimension to this group
     */
    addDimension(dimension: PlotBoundDimension): this {
        this.dimensions.push(dimension);
        return this;
    }

    /**
     * Removes a dimension from this group by name
     */
    removeDimension(dimensionName: string): boolean {
        const index = this.dimensions.findIndex(d => d.name === dimensionName);
        if (index !== -1) {
            this.dimensions.splice(index, 1);
            return true;
        }
        return false;
    }

    /**
     * Gets a dimension by name
     */
    getDimension(name: string): PlotBoundDimension | undefined {
        return this.dimensions.find(d => d.name === name);
    }

    /**
     * Gets all dimension names in this group
     */
    getDimensionNames(): string[] {
        return this.dimensions.map(d => d.name);
    }

    /**
     * Gets the number of dimensions in this group
     */
    get size(): number {
        return this.dimensions.length;
    }

    /**
     * Checks if the group is empty
     */
    isEmpty(): boolean {
        return this.dimensions.length === 0;
    }

    /**
     * Sets the color scheme for this group
     */
    setColorScheme(colors: string[]): this {
        this.colorScheme = colors;
        return this;
    }

    /**
     * Toggles the enabled state
     */
    toggle(): this {
        this.enabled = !this.enabled;
        return this;
    }
}
