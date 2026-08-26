import {
  Component, ElementRef, Input, OnChanges, ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';

export interface SciSeries {
  label: string;
  /** stick = vertical rule from 0 to y (XRD-pattern idiom);
   *  errorbar = vertical lo..hi segment per point (digitization
   *  error bars — the figure-replica idiom). */
  kind: 'line' | 'scatter' | 'band' | 'stick' | 'errorbar';
  /** band/errorbar series read lo/hi; line/scatter/stick read y. */
  points: { x: number; y?: number; lo?: number; hi?: number }[];
  color?: string;
  /** dashed line stroke (e.g. a Laplace seed vs its SCF result). */
  dash?: boolean;
}

export interface SciTick {
  value: number;
  label: string;
}

/**
 * Reusable 2D scientific XY chart (ssp-6) — the one home for
 * line/scatter/band plots with axes, optional log Y, a zero line, and
 * CATEGORICAL X TICKS with vertical guides (the band-structure /
 * phonon-dispersion k-path idiom: ticks at Γ, X, L…). Rendered with
 * Observable Plot (already a repo dependency, lazy-imported so it
 * stays out of the main bundle).
 *
 * Deliberately data-in/chart-out: no fetching, no domain knowledge —
 * phonon views, XRD patterns and future band structures all feed it
 * their own series.
 */
@Component({
  selector: 'sci-xy-chart',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="sci-chart">
      <div class="chart-title" *ngIf="title">{{ title }}</div>
      <div #plot class="plot-host"></div>
      <div class="chart-note" *ngIf="note">{{ note }}</div>
    </div>`,
  styles: [`
    .sci-chart { width: 100%; }
    .chart-title { font-weight: 600; font-size: 13px;
      color: var(--text-primary, #263238); margin-bottom: 2px; }
    .plot-host { width: 100%; overflow-x: auto; }
    .chart-note { font-size: 11px;
      color: var(--text-secondary, #607d8b); margin-top: 2px; }
  `],
})
export class SciXyChartComponent implements OnChanges {
  @Input({ required: true }) series: SciSeries[] = [];
  @Input() title = '';
  @Input() note = '';
  @Input() xLabel = '';
  @Input() yLabel = '';
  @Input() logY = false;
  @Input() logX = false;
  @Input() zeroLine = false;
  /** Categorical ticks: draws ONLY these x ticks + vertical guides. */
  @Input() xTicks: SciTick[] | null = null;
  @Input() height = 300;
  @Input() width = 560;

  @ViewChild('plot', { static: true }) plotHost!: ElementRef;

  async ngOnChanges(): Promise<void> {
    if (!this.series?.length) {
      (this.plotHost.nativeElement as HTMLElement).replaceChildren();
      return;
    }
    const Plot = await import('@observablehq/plot');
    const marks: any[] = [];
    if (this.xTicks?.length) {
      marks.push(Plot.ruleX(this.xTicks.map(t => t.value), {
        stroke: '#b0bec5', strokeDasharray: '2,3' }));
    }
    if (this.zeroLine) {
      marks.push(Plot.ruleY([0], { stroke: '#90a4ae' }));
    }
    for (const s of this.series) {
      const stroke = s.color ?? undefined;
      if (s.kind === 'band') {
        marks.push(Plot.areaY(s.points, {
          x: 'x', y1: 'lo', y2: 'hi',
          fill: stroke ?? s.label, fillOpacity: 0.15 }));
      } else if (s.kind === 'errorbar') {
        marks.push(Plot.ruleX(s.points, {
          x: 'x', y1: 'lo', y2: 'hi', strokeWidth: 1.5,
          stroke: stroke ?? s.label }));
      } else if (s.kind === 'stick') {
        marks.push(Plot.ruleX(s.points, {
          x: 'x', y: 'y', strokeWidth: 1.6,
          stroke: stroke ?? s.label,
          title: (d: any) => `${d.x}°: ${d.y}` }));
      } else if (s.kind === 'scatter') {
        marks.push(Plot.dot(s.points, {
          x: 'x', y: 'y', r: 2.5, fill: stroke ?? s.label,
          title: (d: any) => `${s.label}: ${d.x}, ${d.y}` }));
      } else {
        marks.push(Plot.lineY(s.points, {
          x: 'x', y: 'y', strokeWidth: 1.4,
          stroke: stroke ?? s.label,
          strokeDasharray: s.dash ? '6,4' : undefined }));
      }
    }
    const tickMap = new Map(
      (this.xTicks ?? []).map(t => [t.value, t.label]));
    const figure = Plot.plot({
      width: this.width, height: this.height, grid: !this.xTicks,
      x: {
        label: this.xLabel || null,
        type: this.logX ? 'log' : 'linear',
        ...(this.xTicks?.length ? {
          ticks: this.xTicks.map(t => t.value),
          tickFormat: (v: number) => tickMap.get(v) ?? '',
        } : {}),
      },
      y: {
        label: this.yLabel || null,
        type: this.logY ? 'log' : 'linear',
      },
      marks,
    });
    (this.plotHost.nativeElement as HTMLElement)
      .replaceChildren(figure as any);
  }
}
