import { Component, Input, OnInit, OnChanges, SimpleChanges, Type } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { Display } from '@models/dashboards/Display';
import { DisplayRow } from '@models/dashboards/DisplayRow';
import { DisplayItem, DisplayItemType, MetricData } from '@models/dashboards/DisplayItem';
import { DISPLAY_COMPONENT_REGISTRY } from '@models/dashboards/ComponentRegistry';
import { DisplayMetricCardComponent } from '@components/dashboard/dashboard-metric-card/dashboard-metric-card';

/**
 * Context data passed to child components within the dashboard
 */
export interface DisplayContext {
    className?: string;
    classTypeData?: any;
    [key: string]: any;
}

/**
 * Component that renders a Display model into the UI.
 * Handles grid-based layout and dynamic component loading.
 */
@Component({
  standalone: true,
    selector: 'dashboard-renderer',
    templateUrl: './dashboard-renderer.html',
    styleUrls: ['./dashboard-renderer.css'],
    imports: [CommonModule, MatIconModule, DisplayMetricCardComponent]
})
export class DisplayRendererComponent implements OnInit, OnChanges {
    /** The dashboard model to render */
    @Input() dashboard: Display | null = null;

    /** Context data to pass to child components */
    @Input() context: DisplayContext = {};

    /** Whether to show in compact mode */
    @Input() compactMode: boolean = false;

    ngOnInit(): void {
        // Initial setup if needed
    }

    ngOnChanges(changes: SimpleChanges): void {
        if (changes['dashboard']) {
            console.log('[DisplayRenderer] Display changed:', this.dashboard?.name);
        }
    }

    /**
     * Gets the grid template columns CSS value for a row
     */
    getGridTemplate(row: DisplayRow): string {
        return `repeat(${row.rowSegments}, 1fr)`;
    }

    /**
     * Gets the row height style
     */
    getRowStyle(row: DisplayRow): { [key: string]: string } {
        const style: { [key: string]: string } = {};

        if (!row.autoHeight) {
            style['min-height'] = `${row.minRowHeight}px`;
            if (row.maxRowHeight) {
                style['max-height'] = `${row.maxRowHeight}px`;
            }
        }

        return style;
    }

    /**
     * Gets the grid column span style for an item
     */
    getItemGridColumn(item: DisplayItem): string {
        return `span ${item.rowSegmentsUsed}`;
    }

    /**
     * Gets the Angular component class for a component item
     */
    getComponent(item: DisplayItem): Type<any> | null {
        if (item.type !== 'component') return null;

        const componentName = item.componentProps?.componentName;
        if (!componentName) {
            console.warn('[DisplayRenderer] Component item missing componentName');
            return null;
        }

        const entry = DISPLAY_COMPONENT_REGISTRY.getComponent(componentName);
        if (!entry) {
            console.warn(`[DisplayRenderer] Component "${componentName}" not found in registry`);
            return null;
        }

        return entry.component;
    }

    /**
     * Gets the inputs to pass to a component item
     */
    getComponentInputs(item: DisplayItem): Record<string, any> {
        const componentName = item.componentProps?.componentName;
        const entry = componentName ? DISPLAY_COMPONENT_REGISTRY.getComponent(componentName) : null;

        // Start with default inputs from registry
        const defaultInputs = entry?.defaultInputs || {};

        // Merge with item-specific inputs
        const itemInputs = item.componentProps?.inputs || {};

        // Merge with context (context has lowest priority)
        return {
            ...this.context,
            ...defaultInputs,
            ...itemInputs
        };
    }

    /**
     * Gets metric data for a metric item
     */
    getMetricData(item: DisplayItem): MetricData | null {
        if (item.type !== 'metric') return null;
        return item.item as MetricData;
    }

    /**
     * Gets text content for a text item
     */
    getTextContent(item: DisplayItem): string {
        if (item.type !== 'text') return '';
        return item.item as string || '';
    }

    /**
     * Checks if an item should be visible
     */
    isItemVisible(item: DisplayItem): boolean {
        return item.visible !== false;
    }

    /**
     * Gets CSS classes for an item
     */
    getItemClasses(item: DisplayItem): string {
        const classes: string[] = ['dashboard-item', `dashboard-item-${item.type}`];

        if (item.cssClass) {
            classes.push(item.cssClass);
        }

        if (item.collapsed) {
            classes.push('collapsed');
        }

        return classes.join(' ');
    }

    /**
     * Gets CSS classes for a row
     */
    getRowClasses(row: DisplayRow): string {
        const classes: string[] = ['dashboard-row'];

        if (row.cssClass) {
            classes.push(row.cssClass);
        }

        if (row.autoHeight) {
            classes.push('auto-height');
        }

        return classes.join(' ');
    }

    /**
     * Track function for rows
     */
    trackRow(index: number, row: DisplayRow): number {
        return row.index;
    }

    /**
     * Track function for items
     */
    trackItem(index: number, item: DisplayItem): string {
        return item.id;
    }
}
