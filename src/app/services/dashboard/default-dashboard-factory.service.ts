import { Injectable } from '@angular/core';
import { Display } from '@models/dashboards/Display';
import { DisplayRow } from '@models/dashboards/DisplayRow';
import { DisplayItem } from '@models/dashboards/DisplayItem';

/**
 * Factory service that generates default dashboards for class/object pages.
 * Creates sensible default layouts with the existing template components.
 */
@Injectable({
    providedIn: 'root'
})
export class DefaultDisplayFactory {

    /**
     * Creates a default dashboard for a class/object type.
     * Layout:
     * - Row 1: Title (8 segments) + Record count metric (4 segments)
     * - Row 2: Full-width templateClassTable component (12 segments)
     *
     * @param className The class name (e.g., "dataStream")
     * @param classTypeData The typing data for the class
     * @param instanceCount Optional count of instances for the metric
     */
    createDefaultClassDisplay(
        className: string,
        classTypeData: any,
        instanceCount?: number
    ): Display {
        const displayName = Display.formatClassName(className);
        const dashboard = Display.createForClass(className, displayName);

        // Row 1: Header with title and metrics
        const headerRow = this.createHeaderRow(displayName, instanceCount);
        dashboard.addRow(headerRow);

        // Row 2: Main content - templateClassTable component
        const tableRow = this.createTableRow(className, classTypeData);
        dashboard.addRow(tableRow);

        return dashboard;
    }

    /**
     * Creates the header row with metrics (title comes from dashboard.name)
     */
    private createHeaderRow(displayName: string, instanceCount?: number): DisplayRow {
        const headerRow = new DisplayRow(0, 12, 80);
        headerRow.cssClass = 'dashboard-header-row';

        // Record count metric (full width since title is in dashboard header)
        const countValue = instanceCount !== undefined ? instanceCount : '...';
        const metricItem = DisplayItem.createMetricItem(
            'Total Records',
            countValue,
            12,
            { icon: 'table_rows', format: 'number' }
        );
        headerRow.addItem(metricItem);

        return headerRow;
    }

    /**
     * Creates the main table row with templateClassTable component
     */
    private createTableRow(className: string, classTypeData: any): DisplayRow {
        const tableRow = new DisplayRow(1, 12, 400);
        tableRow.autoHeight = true;
        tableRow.cssClass = 'dashboard-content-row';

        // Create component item for templateClassTable
        const tableItem = DisplayItem.createComponentItem(
            'templateClassTable',
            {
                className: className,
                classTypeData: classTypeData
            },
            12
        );
        tableItem.setTitle('Data Table');
        tableRow.addItem(tableItem);

        return tableRow;
    }

    /**
     * Creates an empty dashboard for customization
     */
    createEmptyDisplay(name: string): Display {
        return new Display(undefined, name);
    }

    /**
     * Adds a metric row to an existing dashboard
     */
    addMetricRow(
        dashboard: Display,
        metrics: Array<{ label: string; value: any; icon?: string }>
    ): Display {
        const segmentsPerMetric = Math.floor(12 / metrics.length);
        const metricRow = new DisplayRow(dashboard.rowCount, 12, 100);
        metricRow.cssClass = 'dashboard-metric-row';

        metrics.forEach(metric => {
            const item = DisplayItem.createMetricItem(
                metric.label,
                metric.value,
                segmentsPerMetric,
                { icon: metric.icon }
            );
            metricRow.addItem(item);
        });

        dashboard.addRow(metricRow);
        return dashboard;
    }

    /**
     * Adds a text/description row to a dashboard
     */
    addTextRow(dashboard: Display, text: string, cssClass?: string): Display {
        const textRow = new DisplayRow(dashboard.rowCount, 12, 60);
        textRow.autoHeight = true;

        const textItem = DisplayItem.createTextItem(text, 12, cssClass);
        textRow.addItem(textItem);

        dashboard.addRow(textRow);
        return dashboard;
    }

    /**
     * Creates a dashboard with just the table component (minimal layout)
     */
    createMinimalClassDisplay(className: string, classTypeData: any): Display {
        const dashboard = Display.createForClass(className);

        const tableRow = this.createTableRow(className, classTypeData);
        dashboard.addRow(tableRow);

        return dashboard;
    }
}
