import { PlotFigure } from "@models/graphs/plotFigure";
import { DisplayRow } from "./DisplayRow";

/**
 * Types of items that can be displayed in a dashboard
 */
export type DisplayItemType = 'graph' | 'table' | 'component' | 'container' | 'text' | 'metric' | 'form' | 'button';

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
 * Configuration for form display items.
 * Forms are bound to a class and linked to a FormSubscription no-code solution.
 */
export interface FormDisplayConfig {
    /** The class this form is bound to */
    boundClassName: string;
    /** Which fields to show (auto-populated from class, user can reorder/hide) */
    formFields: FormFieldConfig[];
    /** The FormSubscription no-code solution to invoke on form change */
    linkedSolutionName: string;
    /** Layout style for the form */
    formLayout: 'vertical' | 'horizontal' | 'grid';
    /**
     * How the form triggers its linked solution:
     * - 'button': User clicks a submit button to trigger
     * - 'debounce': Triggers after a delay of inactivity (data-entry-delay-based)
     */
    submissionMode: 'button' | 'debounce';
    /** Submit button label (only used when submissionMode is 'button') */
    submitLabel?: string;
    /** Debounce delay in ms (only used when submissionMode is 'debounce') */
    debounceDelayMs?: number;
    /** Optional field profile ID/name to control which class fields appear */
    fieldProfileName?: string;
    /** Arbitrary extra variables for data entry not tied to the object's fields.
     *  These get passed as additional parameters into the linked solution. */
    extraVariables: FormExtraVariable[];
}

/**
 * An arbitrary variable on a form that is not tied to any class field.
 * Used to collect additional user input to pass into the linked solution.
 */
export interface FormExtraVariable {
    /** Variable name passed to the solution */
    variableName: string;
    /** Display label shown on the form */
    displayName: string;
    /** Data type for input rendering and validation */
    dataType: 'string' | 'number' | 'boolean' | 'date' | 'text';
    /** Default value */
    defaultValue?: any;
    /** Placeholder text */
    placeholder?: string;
    /** Whether this variable is required */
    required?: boolean;
}

/**
 * Configuration for a single form field
 */
export interface FormFieldConfig {
    /** Field name from the bound class */
    fieldName: string;
    /** Display label */
    displayName: string;
    /** Field data type (str, int, bool, etc.) */
    fieldType: string;
    /** Whether this field is visible in the form */
    visible: boolean;
    /** Display order index */
    orderIndex: number;
    /** Whether this field is required */
    required?: boolean;
    /** Placeholder text */
    placeholder?: string;
}

/**
 * Configuration for button display items.
 * Buttons invoke a DirectInvocation frontend no-code solution on click.
 */
export interface ButtonDisplayConfig {
    /** Button label */
    label: string;
    /** Material icon name */
    iconName?: string;
    /** Button color (hex) */
    color?: string;
    /** The DirectInvocation no-code solution to invoke on click */
    linkedSolutionName: string;
    /** Parameter mappings from display context to solution input params */
    paramMappings: { [paramName: string]: string };
    /** Button style variant */
    variant: 'raised' | 'flat' | 'stroked' | 'icon';
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

    /** Explicit grid column start position (1-based). When set, the item is
     *  placed at this column; unset items auto-flow left-to-right. */
    gridColumnStart?: number;

    /** For container types: nested rows enabling arbitrarily complex layouts */
    nestedRows: DisplayRow[];

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
        this.nestedRows = [];
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
     * Sets the explicit grid column start position (1-based)
     */
    setGridColumnStart(start: number): this {
        this.gridColumnStart = start;
        return this;
    }

    /**
     * Adds a nested row (for container types)
     */
    addNestedRow(row: DisplayRow): this {
        row.index = this.nestedRows.length;
        this.nestedRows.push(row);
        return this;
    }

    /**
     * Removes a nested row at the specified index
     */
    removeNestedRow(index: number): DisplayRow | undefined {
        if (index >= 0 && index < this.nestedRows.length) {
            const removed = this.nestedRows.splice(index, 1)[0];
            this.nestedRows.forEach((r, i) => r.index = i);
            return removed;
        }
        return undefined;
    }

    /**
     * Sets component properties
     */
    setComponentProps(props: ComponentProps): this {
        this.componentProps = { ...this.componentProps, ...props };
        return this;
    }

    /**
     * Checks if this item is a container with nested items or nested rows
     */
    isContainer(): boolean {
        return this.type === 'container' && (this.items.length > 0 || this.nestedRows.length > 0);
    }

    /**
     * Checks if this item has valid content
     */
    hasContent(): boolean {
        return this.item !== null || this.items.length > 0 || this.nestedRows.length > 0;
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

    /**
     * Creates a row container — a container that holds nested DisplayRows,
     * enabling arbitrarily complex grid-within-grid layouts.
     * @param segments Grid segments to occupy in the parent row
     * @param initialRowSegments Number of columns for the first nested row (default 12)
     */
    static createRowContainerItem(
        segments: number = 12,
        initialRowSegments: number = 12
    ): DisplayItem {
        const item = new DisplayItem(0, 'container', null, segments);
        const row = new DisplayRow(0, initialRowSegments, 100);
        row.autoHeight = true;
        item.nestedRows.push(row);
        return item;
    }

    /**
     * Creates a form display item linked to a FormSubscription solution
     * @param boundClassName Class the form is bound to
     * @param linkedSolutionName FormSubscription solution to invoke on change
     * @param segments Grid segments to occupy (default 12)
     */
    static createFormItem(
        boundClassName: string,
        linkedSolutionName: string = '',
        segments: number = 12
    ): DisplayItem {
        const config: FormDisplayConfig = {
            boundClassName,
            formFields: [],
            linkedSolutionName,
            formLayout: 'vertical',
            submissionMode: 'button',
            submitLabel: 'Save',
            debounceDelayMs: 1500,
            extraVariables: []
        };
        return new DisplayItem(0, 'form', config, segments);
    }

    /**
     * Creates a button display item linked to a DirectInvocation solution
     * @param label Button label text
     * @param linkedSolutionName DirectInvocation solution to invoke on click
     * @param segments Grid segments to occupy (default 3)
     */
    static createButtonItem(
        label: string,
        linkedSolutionName: string = '',
        segments: number = 3
    ): DisplayItem {
        const config: ButtonDisplayConfig = {
            label,
            linkedSolutionName,
            paramMappings: {},
            variant: 'raised'
        };
        return new DisplayItem(0, 'button', config, segments);
    }
}
