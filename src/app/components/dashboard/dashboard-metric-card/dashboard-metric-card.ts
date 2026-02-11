import { Component, Input } from '@angular/core';
import { MetricData } from '@models/dashboards/DisplayItem';

/**
 * Component for displaying a single metric value with label.
 * Used in default dashboards for quick statistics display.
 */
@Component({
  standalone: false,
    selector: 'dashboard-metric-card',
    templateUrl: './dashboard-metric-card.html',
    styleUrls: ['./dashboard-metric-card.css']
})
export class DisplayMetricCardComponent {
    /** The metric data to display */
    @Input() data: MetricData | null = null;

    /** Standalone label (alternative to data.label) */
    @Input() label?: string;

    /** Standalone value (alternative to data.value) */
    @Input() value?: any;

    /** Material icon name */
    @Input() icon?: string;

    /** Trend direction for styling */
    @Input() trend?: 'up' | 'down' | 'neutral';

    /**
     * Gets the display label
     */
    get displayLabel(): string {
        return this.data?.label || this.label || '';
    }

    /**
     * Gets the display value
     */
    get displayValue(): string {
        const val = this.data?.value ?? this.value;
        if (val === null || val === undefined) {
            return '...';
        }

        const format = this.data?.format || 'text';

        switch (format) {
            case 'number':
                return this.formatNumber(val);
            case 'percent':
                return this.formatPercent(val);
            case 'currency':
                return this.formatCurrency(val);
            default:
                return String(val);
        }
    }

    /**
     * Gets the icon to display
     */
    get displayIcon(): string {
        return this.data?.icon || this.icon || 'analytics';
    }

    /**
     * Gets the trend class for styling
     */
    get trendClass(): string {
        const t = this.data?.trend || this.trend;
        if (!t) return '';
        return `trend-${t}`;
    }

    /**
     * Formats a number with locale-aware formatting
     */
    private formatNumber(val: any): string {
        const num = Number(val);
        if (isNaN(num)) return String(val);
        return num.toLocaleString();
    }

    /**
     * Formats a percentage value
     */
    private formatPercent(val: any): string {
        const num = Number(val);
        if (isNaN(num)) return String(val);
        return `${(num * 100).toFixed(1)}%`;
    }

    /**
     * Formats a currency value
     */
    private formatCurrency(val: any): string {
        const num = Number(val);
        if (isNaN(num)) return String(val);
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(num);
    }
}
