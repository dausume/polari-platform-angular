// detail-display-renderer.ts
// Renders a detail display for a single instance using metric cards in a 4-column grid.
import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { DetailDisplayConfig, MetricCardConfig } from '@models/tables/NamedTableConfig';

export interface ResolvedMetricCard {
  config: MetricCardConfig;
  value: any;
  displayLabel: string;
}

@Component({
  standalone: false,
  selector: 'detail-display-renderer',
  templateUrl: 'detail-display-renderer.html',
  styleUrls: ['./detail-display-renderer.css']
})
export class DetailDisplayRendererComponent implements OnChanges {
  /** The detail display configuration (which cards to show) */
  @Input() config: DetailDisplayConfig | null = null;

  /** The instance data to read values from */
  @Input() instance: any = null;

  /** Class type data for deriving display names */
  @Input() classTypeData: any = {};

  /** Resolved cards ready for rendering */
  resolvedCards: ResolvedMetricCard[] = [];

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['config'] || changes['instance'] || changes['classTypeData']) {
      this.resolveCards();
    }
  }

  private resolveCards(): void {
    if (!this.config?.cards || !this.instance) {
      this.resolvedCards = [];
      return;
    }

    this.resolvedCards = this.config.cards.map(card => {
      const value = this.instance[card.fieldName];
      const displayLabel = card.label || this.getFieldDisplayName(card.fieldName);
      return { config: card, value, displayLabel };
    });
  }

  private getFieldDisplayName(fieldName: string): string {
    const varData = this.classTypeData?.[fieldName];
    if (varData?.displayName) return varData.displayName;
    if (varData?.variableName) return varData.variableName;
    // Convert camelCase to Title Case
    return fieldName.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());
  }

  formatValue(card: ResolvedMetricCard): string {
    const val = card.value;
    if (val === null || val === undefined) return '-';

    switch (card.config.format) {
      case 'number': {
        const num = Number(val);
        return isNaN(num) ? String(val) : num.toLocaleString();
      }
      case 'percent': {
        const num = Number(val);
        return isNaN(num) ? String(val) : `${(num * 100).toFixed(1)}%`;
      }
      case 'currency': {
        const num = Number(val);
        return isNaN(num) ? String(val) : new Intl.NumberFormat('en-US', {
          style: 'currency', currency: 'USD'
        }).format(num);
      }
      default: {
        const str = String(val);
        return str.length > 80 ? str.substring(0, 77) + '...' : str;
      }
    }
  }
}
