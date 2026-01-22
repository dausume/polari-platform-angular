/**
 * ColumnConfiguration.ts
 *
 * TEMPLATE configuration for table columns - defines the structure and defaults.
 * This is the "admin/developer" level configuration that establishes:
 * - Which columns exist and their data types
 * - Default display settings (format, alignment, width)
 * - Whether columns are available for end-users to toggle
 *
 * AVAILABILITY vs VISIBILITY:
 * ---------------------------
 * - `available`: Admin-controlled. If false, column is completely hidden from
 *   the UI and cannot be toggled on by end-users. Set via the X button in
 *   the configuration component. Maps to `removedColumns` in TableConfiguration.
 *
 * - `visible`: User-controlled (within ColumnPersonalization). If false, column
 *   is hidden but can be toggled back on via visibility chips/toggles.
 *   This ties directly to column visibility styling in the table.
 *
 * See also: ColumnPersonalization for end-user customizable settings.
 */

/**
 * Column display format options
 */
export type ColumnFormat =
    | 'default'      // Use default formatting based on type
    | 'truncate'     // Truncate long text
    | 'wrap'         // Wrap text
    | 'code'         // Code/monospace formatting
    | 'currency'     // Currency formatting
    | 'percent'      // Percentage formatting
    | 'date'         // Date only
    | 'datetime'     // Date and time
    | 'relative'     // Relative time (e.g., "2 hours ago")
    | 'badge'        // Display as badge/chip
    | 'link'         // Display as clickable link
    | 'image'        // Display as image thumbnail
    | 'custom';      // Custom formatter function

/**
 * Column alignment options
 */
export type ColumnAlignment = 'left' | 'center' | 'right';

/**
 * Configuration interface for a single table column (template level)
 */
export interface IColumnConfiguration {
    /** Column identifier (matches data property name) */
    name: string;

    /** Display label for column header */
    displayName?: string;

    /** Data type of the column (from polyTyping) */
    dataType?: string;

    /**
     * AVAILABLE: Admin-controlled column availability
     * -----------------------------------------------
     * - true: Column is available in the table configuration UI
     * - false: Column is completely removed from the UI (X button pressed)
     *
     * When false:
     * - Column does not appear in configuration component
     * - Column cannot be toggled on by end-users
     * - Column appears in "Removed" section with + button to restore
     *
     * This is separate from `visible` which controls display within available columns.
     */
    available: boolean;

    /**
     * VISIBLE: Default visibility state for this column
     * --------------------------------------------------
     * - true: Column is shown in the data table by default
     * - false: Column is hidden but can be toggled on via visibility chips
     *
     * This ties directly to:
     * - The visibility chip styling (selected/unselected state)
     * - The column's presence in the displayed table
     * - CSS class application for column visibility
     *
     * Note: Only applies if `available` is true.
     */
    visible: boolean;

    /** Column order/position (0-based index) */
    order: number;

    /** Whether the column can be sorted by clicking header */
    sortable: boolean;

    /** Whether the column can be filtered */
    filterable: boolean;

    /** Whether the column can be resized by dragging */
    resizable: boolean;

    /** Fixed width in pixels (undefined = auto) */
    width?: number;

    /** Minimum width in pixels */
    minWidth?: number;

    /** Maximum width in pixels */
    maxWidth?: number;

    /** Column alignment */
    alignment: ColumnAlignment;

    /** Display format */
    format: ColumnFormat;

    /** Custom format options (e.g., date format string, truncate length) */
    formatOptions?: Record<string, any>;

    /** Whether this column is pinned/frozen */
    pinned?: 'left' | 'right' | false;

    /** Custom CSS class for this column */
    cssClass?: string;

    /** Whether to show type icon in header */
    showTypeIcon: boolean;

    /** Whether this column can be hidden by end-users */
    userCanHide: boolean;

    /** Whether this column can be reordered by end-users */
    userCanReorder: boolean;
}

/**
 * Column configuration class with defaults and utility methods
 */
export class ColumnConfiguration implements IColumnConfiguration {
    name: string;
    displayName?: string;
    dataType?: string;
    available: boolean = true;
    visible: boolean = true;
    order: number = 0;
    sortable: boolean = true;
    filterable: boolean = true;
    resizable: boolean = true;
    width?: number;
    minWidth: number = 50;
    maxWidth?: number;
    alignment: ColumnAlignment = 'left';
    format: ColumnFormat = 'default';
    formatOptions?: Record<string, any>;
    pinned?: 'left' | 'right' | false = false;
    cssClass?: string;
    showTypeIcon: boolean = true;
    userCanHide: boolean = true;
    userCanReorder: boolean = true;

    constructor(name: string, config?: Partial<IColumnConfiguration>) {
        this.name = name;
        if (config) {
            Object.assign(this, config);
        }
        // Generate display name if not provided
        if (!this.displayName) {
            this.displayName = this.formatDisplayName(name);
        }
    }

    /**
     * Convert camelCase/snake_case to readable display name
     */
    private formatDisplayName(name: string): string {
        return name
            // Insert space before capital letters
            .replace(/([A-Z])/g, ' $1')
            // Replace underscores with spaces
            .replace(/_/g, ' ')
            // Capitalize first letter
            .replace(/^./, str => str.toUpperCase())
            .trim();
    }

    /**
     * Get the type icon for this column
     */
    getTypeIcon(): string {
        const typeMap: Record<string, string> = {
            'str': 'T',
            'string': 'T',
            'int': '#',
            'integer': '#',
            'float': '∞',
            'number': '∞',
            'bool': '✓',
            'boolean': '✓',
            'list': '[]',
            'array': '[]',
            'dict': '{}',
            'object': '{}',
            'date': '📅',
            'datetime': '🕐',
            'polariList': '📋',
            'polariDict': '📚',
            'uuid': '🔑',
            'email': '✉',
            'url': '🔗'
        };
        return typeMap[this.dataType?.toLowerCase() || ''] || '◆';
    }

    /**
     * Get CSS classes for visibility styling
     * Returns classes that should be applied to the column based on visibility state
     */
    getVisibilityClasses(): string[] {
        const classes: string[] = [];

        if (!this.available) {
            classes.push('column-unavailable');
        } else if (!this.visible) {
            classes.push('column-hidden');
        } else {
            classes.push('column-visible');
        }

        return classes;
    }

    /**
     * Get CSS class string for visibility (convenience method)
     */
    getVisibilityClass(): string {
        return this.getVisibilityClasses().join(' ');
    }

    /**
     * Check if column should be displayed in the table
     */
    isDisplayed(): boolean {
        return this.available && this.visible;
    }

    /**
     * Check if column can be toggled by end-user
     */
    isToggleable(): boolean {
        return this.available && this.userCanHide;
    }

    /**
     * Mark column as unavailable (removed from configuration)
     * This is called when user clicks X on the configuration component
     */
    markUnavailable(): void {
        this.available = false;
        // When unavailable, also set invisible
        this.visible = false;
    }

    /**
     * Restore column to available state
     * This is called when user clicks + to add back a removed column
     */
    markAvailable(): void {
        this.available = true;
        // Restore to visible by default when made available again
        this.visible = true;
    }

    /**
     * Toggle visibility (only if available)
     */
    toggleVisibility(): void {
        if (this.available && this.userCanHide) {
            this.visible = !this.visible;
        }
    }

    /**
     * Determine default alignment based on data type
     */
    static getDefaultAlignment(dataType: string): ColumnAlignment {
        const rightAligned = ['int', 'integer', 'float', 'number', 'currency', 'percent'];
        const centerAligned = ['bool', 'boolean', 'date', 'datetime'];

        const lowerType = dataType?.toLowerCase() || '';
        if (rightAligned.includes(lowerType)) return 'right';
        if (centerAligned.includes(lowerType)) return 'center';
        return 'left';
    }

    /**
     * Determine default format based on data type
     */
    static getDefaultFormat(dataType: string): ColumnFormat {
        const formatMap: Record<string, ColumnFormat> = {
            'date': 'date',
            'datetime': 'datetime',
            'bool': 'badge',
            'boolean': 'badge',
            'url': 'link',
            'email': 'link'
        };
        return formatMap[dataType?.toLowerCase() || ''] || 'default';
    }

    /**
     * Create a column configuration from polyTyping variable data
     */
    static fromPolyTyping(varName: string, varData: any, order: number = 0): ColumnConfiguration {
        const dataType = varData?.variablePythonType || 'unknown';

        return new ColumnConfiguration(varName, {
            displayName: varData?.displayName,
            dataType: dataType,
            order: order,
            available: true,
            visible: true,
            alignment: ColumnConfiguration.getDefaultAlignment(dataType),
            format: ColumnConfiguration.getDefaultFormat(dataType),
            sortable: !['list', 'dict', 'object', 'polariList', 'polariDict'].includes(dataType.toLowerCase()),
            filterable: !['list', 'dict', 'object', 'polariList', 'polariDict'].includes(dataType.toLowerCase())
        });
    }

    /**
     * Clone this configuration
     */
    clone(): ColumnConfiguration {
        return new ColumnConfiguration(this.name, { ...this });
    }

    /**
     * Serialize to plain object for storage
     */
    toJSON(): IColumnConfiguration {
        return {
            name: this.name,
            displayName: this.displayName,
            dataType: this.dataType,
            available: this.available,
            visible: this.visible,
            order: this.order,
            sortable: this.sortable,
            filterable: this.filterable,
            resizable: this.resizable,
            width: this.width,
            minWidth: this.minWidth,
            maxWidth: this.maxWidth,
            alignment: this.alignment,
            format: this.format,
            formatOptions: this.formatOptions,
            pinned: this.pinned,
            cssClass: this.cssClass,
            showTypeIcon: this.showTypeIcon,
            userCanHide: this.userCanHide,
            userCanReorder: this.userCanReorder
        };
    }
}
