import {
  Component, ElementRef, Input, OnChanges, ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { PsppService } from '@services/pspp/pspp.service';

/**
 * One digitized dataset as a book-proofable chart. The SOURCE points
 * (the book's own values) draw as dots; interpolated samples draw as
 * lines with min/max bands; discrete datasets draw points only —
 * the chart never invents a curve the data does not support.
 * Rendered with Observable Plot (already a repo dependency).
 */
@Component({
  selector: 'pspp-dataset-chart',
  standalone: true,
  imports: [CommonModule],
  template: `
  <div class="pspp-chart-card">
    <div class="head" *ngIf="payload">
      <div class="title">{{ payload.name }}</div>
      <div class="cite">{{ payload.source }}</div>
    </div>
    <div *ngIf="refusal" class="refusal">
      <b>Not rendered:</b> {{ refusal.refusal }}
      <div class="suggest" *ngIf="refusal.suggestion">
        {{ refusal.suggestion }}</div>
      <div class="suggest" *ngIf="refusal.qualitativeShape">
        Shape per source: {{ refusal.qualitativeShape }}</div>
    </div>
    <div #plot class="plot"></div>
    <div class="foot" *ngIf="payload">
      <span>{{ payload.digitizationMethod }}</span>
      <span *ngIf="payload.digitizationError">
        · error: {{ payload.digitizationError }}</span>
      <span> · interpolation: {{ payload.interpolationPolicy }}
        · extrapolation: UNSUPPORTED</span>
    </div>
  </div>`,
  styles: [`
    .pspp-chart-card { border: 1px solid #d7d2c4; border-radius: 8px;
      padding: 10px 12px; margin: 8px 0; background: #fffdf7; }
    .title { font-weight: 600; font-size: 14px; }
    .cite { font-size: 11px; color: #6b6455; margin-bottom: 4px; }
    .foot { font-size: 10px; color: #8a8272; margin-top: 4px; }
    .refusal { background: #fdf0ee; border: 1px solid #e0b4ac;
      border-radius: 6px; padding: 8px; font-size: 12px; }
    .suggest { color: #7a5c55; margin-top: 3px; }
  `],
})
export class PsppDatasetChartComponent implements OnChanges {
  @Input({ required: true }) name!: string;
  @ViewChild('plot', { static: true }) plotHost!: ElementRef;

  payload: any = null;
  refusal: any = null;

  constructor(private pspp: PsppService) {}

  async ngOnChanges(): Promise<void> {
    if (!this.name) { return; }
    const result = await this.pspp.curve(this.name);
    if (!result || result.ok === false) {
      this.refusal = result
        ?? { refusal: 'backend unreachable', suggestion: '' };
      this.payload = null;
      return;
    }
    this.refusal = null;
    this.payload = result;
    await this.render();
  }

  private async render(): Promise<void> {
    const Plot = await import('@observablehq/plot');
    const p = this.payload;
    const marks: any[] = [];
    const multiDep = p.dependentVariables.length > 1;
    const logY = this.shouldLog(p);
    for (const series of p.series) {
      for (const dep of p.dependentVariables) {
        const label = (p.series.length > 1 ? series.series
          : (multiDep ? dep : series.series));
        const sampled = series.sampled
          .filter((s: any) => s.values[dep] !== undefined)
          .map((s: any) => ({
            x: s.x, y: s.values[dep],
            lo: s.band[dep]?.[0], hi: s.band[dep]?.[1], label,
          }));
        if (sampled.length) {
          marks.push(Plot.areaY(sampled, {
            x: 'x', y1: 'lo', y2: 'hi', fill: 'label',
            fillOpacity: 0.12 }));
          marks.push(Plot.lineY(sampled, {
            x: 'x', y: 'y', stroke: 'label', strokeWidth: 1.6 }));
        }
        const dots = series.sourcePoints
          .filter((sp: any) => typeof sp[dep] === 'number')
          .map((sp: any) => ({ x: sp[p.xVariable], y: sp[dep], label }));
        marks.push(Plot.dot(dots, {
          x: 'x', y: 'y', fill: 'label', r: 3.5,
          title: (d: any) => `${d.label}: ${d.x}, ${d.y}` }));
      }
    }
    const figure = Plot.plot({
      width: 560, height: 300, grid: true,
      x: { label: `${p.xVariable} (${p.units[p.xVariable] ?? ''})` },
      y: {
        label: multiDep ? 'value'
          : `${p.dependentVariables[0]} `
            + `(${p.units[p.dependentVariables[0]] ?? ''})`,
        type: logY ? 'log' : 'linear',
      },
      color: { legend: true },
      marks,
    });
    const host = this.plotHost.nativeElement as HTMLElement;
    host.replaceChildren(figure as any);
  }

  private shouldLog(p: any): boolean {
    const values: number[] = [];
    for (const s of p.series) {
      for (const sp of s.sourcePoints) {
        for (const dep of p.dependentVariables) {
          if (typeof sp[dep] === 'number' && sp[dep] > 0) {
            values.push(sp[dep]);
          }
        }
      }
    }
    if (values.length < 2) { return false; }
    return Math.max(...values) / Math.min(...values) > 25;
  }
}
