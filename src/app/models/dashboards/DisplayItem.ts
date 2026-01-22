import { PlotFigure } from "@models/graphs/plotFigure";

/**
 * Types of items that can be displayed in a dashboard
 */
export type DisplayItemType = 'graph' | 'table' | 'component' | 'container' | 'text' | 'metric';

/**
 * Component-specific properties for custom components
 */
export interface ComponentProps {
    componentName?: string;
    inputs?: Record<string, any>;
    outputs?: Record<string, (event: any) => void>;
    [key: string]: any;
}

/**
 * Data structure for metric items
 */
export interface MetricData {
    label: string;
    value: any;
    icon?: string;
    trend?: 'up' | 'down' | 'neutral';
    format?: 'number' | 'percent' | 'currency' | 'text';
}

/**
 * Represents a single item within a dashboard row.
 * Can contain graphs, tables, custom components, or nested containers.
 */
export class DisplayItem {
    /** Unique identifier for this item (used for customization tracking) */
    id: string;

    /** Position index within the row */
    index: number;

    /** Type of this dashboard item */
    type: DisplayItemType;

    /** The primary content item (PlotFigure, DataTable, MetricData, text string, etc.) */
    item: PlotFigure | MetricData | string | any | null;

    /** For container types: nested items */
    items: DisplayItem[];

    /** Number of row segments this item occupies (for grid layout) */
    rowSegmentsUsed: number;

    /** Properties for custom component rendering */
    componentProps: ComponentProps;

    /** Display title for this item */
    title?: string;

    /** Whether this item is visible */
    visible: boolean;

    /** Whether this item is collapsed (header only) */
    collapsed: boolean;

    /** Optional CSS class for styling */
    cssClass?: string;

    constructor(
        index: number = 0,
        type: DisplayItemType = 'graph',
        item: PlotFigure | MetricData | string | any | null = null,
        rowSegmentsUsed: number = 1,
        componentProps: ComponentProps = {}
    ) {
        this.id = DisplayItem.generateId();
        this.index = index;
        this.type = type;
        this.item = item;
        this.items = [];
        this.rowSegmentsUsed = rowSegmentsUsed;
        this.componentProps = componentProps;
        this.visible = true;
        this.collapsed = false;
    }

    /**
     * Generates a unique ID for the item
     */
    private static generateId(): string {
        return 'item-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 11);
    }

    /**
     * Sets the primary item content
     */
    setItem(item: PlotFigure | any): this {
        this.item = item;
        return this;
    }

    /**
     * Sets the title
     */
    setTitle(title: string): this {
        this.title = title;
        return this;
    }

    /**
     * Sets visibility
     */
    setVisible(visible: boolean): this {
        this.visible = visible;
        return this;
    }

    /**
     * Sets collapsed state
     */
    setCollapsed(collapsed: boolean): this {
        this.collapsed = collapsed;
        return this;
    }

    /**
     * Sets CSS class
     */
    setCssClass(cssClass: string): this {
        this.cssClass = cssClass;
        return this;
    }

    /**
     * Adds a nested item (for container types)
     */
    addNestedItem(item: DisplayItem): this {
        this.items.push(item);
        return this;
    }

    /**
     * Sets the number of segments this item uses
     */
    setSegments(segments: number): this {
        this.rowSegmentsUsed = segments;
        return this;
    }

    /**
     * Sets component properties
     */
    setComponentProps(props: ComponentProps): this {
        this.componentProps = { ...this.componentProps, ...props };
        return this;
    }

    /**
     * Checks if this item is a container with nested items
     */
    isContainer(): boolean {
        return this.type === 'container' && this.items.length > 0;
    }

    /**
     * Checks if this item has valid content
     */
    hasContent(): boolean {
        return this.item !== null || this.items.length > 0;
    }

    // ============================================
    // Static Factory Methods
    // ============================================

    /**
     * Creates a component item that wraps an Angular component
     * @param componentName Name of the component (must be registered in ComponentRegistry)
     * @param inputs Input properties to pass to the component
     * @param segments Grid segments to occupy (default 12 = full width)
     */
    static createComponentItem(
        componentName: string,
        inputs: Record<string, any> = {},
        segments: number = 12
    ): DisplayItem {
        const item = new DisplayItem(0, 'component', null, segments, {
            componentName,
            inputs
        });
        return item;
    }

    /**
     * Creates a metric display item
     * @param label Label for the metric
     * @param value Value to display
     * @param segments Grid segments to occupy (default 3)
     * @param options Additional metric options
     */
    static createMetricItem(
        label: string,
        value: any,
        segments: number = 3,
        options: Partial<MetricData> = {}
    ): DisplayItem {
        const metricData: MetricData = {
            label,
            value,
            icon: options.icon,
            trend: options.trend,
            format: options.format || 'text'
        };
        const item = new DisplayItem(0, 'metric', metricData, segments);
        return item;
    }

    /**
     * Creates a text/title item
     * @param text Text content to display
     * @param segments Grid segments to occupy (default 12)
     * @param cssClass Optional CSS class for styling
     */
    static createTextItem(
        text: string,
        segments: number = 12,
        cssClass?: string
    ): DisplayItem {
        const item = new DisplayItem(0, 'text', text, segments);
        if (cssClass) {
            item.cssClass = cssClass;
        }
        return item;
    }

    /**
     * Creates a table item
     * @param tableData Data or configuration for the table
     * @param segments Grid segments to occupy (default 12)
     */
    static createTableItem(
        tableData: any,
        segments: number = 12
    ): DisplayItem {
        return new DisplayItem(0, 'table', tableData, segments);
    }

    /**
     * Creates a graph item
     * @param graph PlotFigure configuration
     * @param segments Grid segments to occupy (default 12)
     */
    static createPlotFigureItem(
        graph: PlotFigure,
        segments: number = 12
    ): DisplayItem {
        return new DisplayItem(0, 'graph', graph, segments);
    }

    /**
     * Creates a container item that can hold nested items
     * @param segments Grid segments to occupy (default 12)
     */
    static createContainerItem(segments: number = 12): DisplayItem {
        return new DisplayItem(0, 'container', null, segments);
    }
}
