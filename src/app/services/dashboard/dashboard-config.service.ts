import { Injectable } from '@angular/core';
import { Display } from '@models/dashboards/Display';
import { DisplayConfig, ItemCustomization, createDefaultDisplayConfig, mergeDisplayConfig } from '@models/dashboards/DisplayConfig';

/**
 * Service for managing dashboard configuration persistence.
 * Uses localStorage to store user customizations (similar to TableConfig pattern).
 */
@Injectable({
    providedIn: 'root'
})
export class DisplayConfigService {
    private readonly STORAGE_PREFIX = 'dashboard_config_';

    /**
     * Saves a dashboard configuration to localStorage
     */
    saveDisplayConfig(dashboardId: string, config: DisplayConfig): void {
        try {
            config.lastModified = Date.now();
            const key = this.STORAGE_PREFIX + dashboardId;
            localStorage.setItem(key, JSON.stringify(config));
        } catch (e) {
            console.warn('[DisplayConfigService] Failed to save config:', e);
        }
    }

    /**
     * Loads a dashboard configuration from localStorage
     */
    loadDisplayConfig(dashboardId: string): DisplayConfig | null {
        try {
            const key = this.STORAGE_PREFIX + dashboardId;
            const saved = localStorage.getItem(key);
            if (saved) {
                return JSON.parse(saved) as DisplayConfig;
            }
        } catch (e) {
            console.warn('[DisplayConfigService] Failed to load config:', e);
        }
        return null;
    }

    /**
     * Gets configuration for a dashboard, creating defaults if not found
     */
    getOrCreateConfig(dashboardId: string): DisplayConfig {
        const saved = this.loadDisplayConfig(dashboardId);
        return mergeDisplayConfig(saved, dashboardId);
    }

    /**
     * Applies saved configuration to a dashboard model
     */
    applyConfig(dashboard: Display, config: DisplayConfig): Display {
        // Apply row ordering if specified
        if (config.rowOrder && config.rowOrder.length > 0) {
            const reorderedRows = config.rowOrder
                .map(idx => dashboard.rows[idx])
                .filter(row => row !== undefined);

            // Add any rows not in the order (new rows)
            dashboard.rows.forEach((row, idx) => {
                if (!config.rowOrder!.includes(idx)) {
                    reorderedRows.push(row);
                }
            });

            dashboard.rows = reorderedRows;
            // Reindex
            dashboard.rows.forEach((row, idx) => row.index = idx);
        }

        // Apply item customizations
        dashboard.rows.forEach(row => {
            row.dashboardItems.forEach(item => {
                // Check if item is hidden
                if (config.hiddenItems?.includes(item.id)) {
                    item.visible = false;
                }

                // Apply item-specific customizations
                const customization = config.itemCustomizations?.[item.id];
                if (customization) {
                    this.applyItemCustomization(item, customization);
                }
            });
        });

        // Apply custom title if set
        if (config.customTitle) {
            dashboard.name = config.customTitle;
        }

        return dashboard;
    }

    /**
     * Applies customization to a single dashboard item
     */
    private applyItemCustomization(item: any, customization: ItemCustomization): void {
        if (customization.segments !== undefined) {
            item.rowSegmentsUsed = customization.segments;
        }
        if (customization.collapsed !== undefined) {
            item.collapsed = customization.collapsed;
        }
        if (customization.title !== undefined) {
            item.title = customization.title;
        }
        if (customization.cssClass !== undefined) {
            item.cssClass = customization.cssClass;
        }
    }

    /**
     * Updates a specific item's customization
     */
    updateItemCustomization(
        dashboardId: string,
        itemId: string,
        changes: Partial<ItemCustomization>
    ): void {
        const config = this.getOrCreateConfig(dashboardId);

        if (!config.itemCustomizations) {
            config.itemCustomizations = {};
        }

        config.itemCustomizations[itemId] = {
            ...config.itemCustomizations[itemId],
            ...changes
        };

        this.saveDisplayConfig(dashboardId, config);
    }

    /**
     * Hides an item
     */
    hideItem(dashboardId: string, itemId: string): void {
        const config = this.getOrCreateConfig(dashboardId);

        if (!config.hiddenItems) {
            config.hiddenItems = [];
        }

        if (!config.hiddenItems.includes(itemId)) {
            config.hiddenItems.push(itemId);
            this.saveDisplayConfig(dashboardId, config);
        }
    }

    /**
     * Shows a previously hidden item
     */
    showItem(dashboardId: string, itemId: string): void {
        const config = this.getOrCreateConfig(dashboardId);

        if (config.hiddenItems) {
            const index = config.hiddenItems.indexOf(itemId);
            if (index !== -1) {
                config.hiddenItems.splice(index, 1);
                this.saveDisplayConfig(dashboardId, config);
            }
        }
    }

    /**
     * Saves row order
     */
    saveRowOrder(dashboardId: string, rowOrder: number[]): void {
        const config = this.getOrCreateConfig(dashboardId);
        config.rowOrder = rowOrder;
        this.saveDisplayConfig(dashboardId, config);
    }

    /**
     * Resets configuration to defaults
     */
    resetConfig(dashboardId: string): void {
        const config = createDefaultDisplayConfig(dashboardId);
        this.saveDisplayConfig(dashboardId, config);
    }

    /**
     * Deletes configuration entirely
     */
    deleteConfig(dashboardId: string): void {
        try {
            const key = this.STORAGE_PREFIX + dashboardId;
            localStorage.removeItem(key);
        } catch (e) {
            console.warn('[DisplayConfigService] Failed to delete config:', e);
        }
    }

    /**
     * Gets all saved dashboard configurations
     */
    getAllConfigs(): DisplayConfig[] {
        const configs: DisplayConfig[] = [];
        try {
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key?.startsWith(this.STORAGE_PREFIX)) {
                    const value = localStorage.getItem(key);
                    if (value) {
                        configs.push(JSON.parse(value));
                    }
                }
            }
        } catch (e) {
            console.warn('[DisplayConfigService] Failed to get all configs:', e);
        }
        return configs;
    }
}
