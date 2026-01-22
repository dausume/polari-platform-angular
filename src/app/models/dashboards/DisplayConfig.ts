/**
 * Configuration/customization interface for dashboards.
 * Stored in localStorage for user preferences.
 */
export interface DisplayConfig {
    /** Unique identifier matching the dashboard */
    displayId: string;

    /** Custom row ordering (array of row indices) */
    rowOrder?: number[];

    /** Items hidden by user (array of item IDs) */
    hiddenItems?: string[];

    /** Per-item customizations */
    itemCustomizations?: {
        [itemId: string]: ItemCustomization;
    };

    /** Timestamp of last modification */
    lastModified: number;

    /** Whether to show dashboard in compact mode */
    compactMode?: boolean;

    /** Custom dashboard title (overrides default) */
    customTitle?: string;
}

/**
 * Customization options for individual dashboard items
 */
export interface ItemCustomization {
    /** Custom grid segment width */
    segments?: number;

    /** Whether the item is collapsed */
    collapsed?: boolean;

    /** Custom title for the item */
    title?: string;

    /** Whether to show the item header */
    showHeader?: boolean;

    /** Custom CSS class */
    cssClass?: string;
}

/**
 * Creates a default configuration for a dashboard
 */
export function createDefaultDisplayConfig(displayId: string): DisplayConfig {
    return {
        displayId,
        rowOrder: undefined,
        hiddenItems: [],
        itemCustomizations: {},
        lastModified: Date.now(),
        compactMode: false
    };
}

/**
 * Merges saved configuration with defaults
 */
export function mergeDisplayConfig(
    saved: Partial<DisplayConfig> | null,
    displayId: string
): DisplayConfig {
    const defaults = createDefaultDisplayConfig(displayId);
    if (!saved) return defaults;

    return {
        ...defaults,
        ...saved,
        displayId, // Ensure ID is always correct
        itemCustomizations: {
            ...defaults.itemCustomizations,
            ...saved.itemCustomizations
        }
    };
}
