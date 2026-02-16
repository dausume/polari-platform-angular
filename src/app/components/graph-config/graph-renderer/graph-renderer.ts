import {
  Component, Input, OnChanges, SimpleChanges,
  ViewChild, ElementRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { NamedGraphConfig } from '@models/graphs/NamedGraphConfig';

/**
 * Thin rendering component for graph visualization.
 *
 * All logic lives in the model layer:
 *   NamedGraphConfig.buildPlotFigure(data)  →  PlotFigure.render()  →  SVG Element
 *
 * This component simply mounts the resulting SVG into the DOM.
 */
@Component({
  standalone: true,
  selector: 'graph-renderer',
  template: `
    <div #chartContainer class="chart-container">
      <div *ngIf="loading" class="chart-loading">
        <mat-spinner diameter="32"></mat-spinner>
        <span>Rendering chart...</span>
      </div>
      <div *ngIf="error" class="chart-error">
        <mat-icon>warning</mat-icon>
        <span>{{ error }}</span>
      </div>
      <div *ngIf="!loading && !error && noData" class="chart-empty">
        <mat-icon>show_chart</mat-icon>
        <span>Configure X and Y dimensions to render a chart</span>
      </div>
    </div>
  `,
  styleUrls: ['./graph-renderer.css'],
  imports: [CommonModule, MatIconModule, MatProgressSpinnerModule]
})
export class GraphRendererComponent implements OnChanges {
  @Input() config!: NamedGraphConfig;
  @Input() instanceData: any[] = [];
  @Input() classTypeData: any = {};

  @ViewChild('chartContainer', { static: true }) container!: ElementRef;

  loading = false;
  error = '';
  noData = false;

  async ngOnChanges(changes: SimpleChanges): Promise<void> {
    if (changes['config'] || changes['instanceData'] || changes['classTypeData']) {
      await this.renderChart();
    }
  }

  private async renderChart(): Promise<void> {
    this.error = '';
    this.noData = false;

    // Clear previous chart
    const containerEl = this.container?.nativeElement;
    if (!containerEl) return;

    // Remove previously rendered SVG elements (keep Angular template nodes)
    const existingSvg = containerEl.querySelector('svg, figure');
    if (existingSvg) {
      containerEl.removeChild(existingSvg);
    }

    // Validate inputs
    if (!this.config) return;

    const gc = this.config.graphConfig;
    if (!gc.xDimension || gc.yDimensions.length === 0) {
      this.noData = true;
      return;
    }

    if (!this.instanceData || this.instanceData.length === 0) {
      this.noData = true;
      return;
    }

    this.loading = true;

    try {
      // Build PlotFigure from config + data + type info (model layer)
      const figure = this.config.buildPlotFigure(this.instanceData, this.classTypeData);

      // Render to SVG element (model layer)
      const element = await figure.render();

      this.loading = false;

      if (element) {
        containerEl.appendChild(element);
      } else {
        this.error = 'Failed to render chart. Check that dimensions are valid.';
      }
    } catch (e: any) {
      this.loading = false;
      this.error = e?.message || 'An error occurred while rendering the chart.';
      console.error('[GraphRenderer] Render error:', e);
    }
  }
}
