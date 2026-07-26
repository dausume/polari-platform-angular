import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PsppService } from '@services/pspp/pspp.service';
import {
  PsppDatasetChartComponent,
} from '@components/pspp/pspp-dataset-chart.component';

/**
 * Book-proofing wall: one chart per DigitizedDataset row, enumerated
 * live — a scientist who enters a new dataset row (auto-CRUDE) gets a
 * rendered, evidence-annotated chart here with zero code. Lay the
 * book figure beside its chart to proof the transcription.
 */
@Component({
  selector: 'pspp-proofing',
  standalone: true,
  imports: [CommonModule, PsppDatasetChartComponent],
  template: `
  <div class="pspp-page">
    <h2>PSPP — Book proofing charts</h2>
    <p class="hint">Every chart below is generated from a
      DigitizedDataset row (Davidovits, <i>Geopolymer Chemistry and
      Applications</i>). Dots are the book's own values; lines are
      interpolation inside the stated validity domain with min/max
      bands; out-of-range is refused, never extrapolated. Edit the
      row and the chart follows.</p>
    <div *ngIf="!catalog" class="hint">Loading catalog…</div>
    <pspp-dataset-chart *ngFor="let d of ready" [name]="d.name">
    </pspp-dataset-chart>
    <div *ngFor="let d of notReady" class="pending">
      <b>{{ d.name }}</b> — {{ d.status }} ({{ d.digitizationMethod }}).
      {{ d.qualitativeShape }}
    </div>
  </div>`,
  styles: [`
    :host { display: block; color: var(--text-on-bg); }
    .card, .panel, .section, .form, .pspp-chart-card, .home a.card { color: var(--text-on-card); }
    .pspp-page { max-width: 640px; margin: 0 auto; padding: 12px; }
    .hint { font-size: 12px; color: var(--text-on-bg-muted); }
    .pending { border: 1px dashed var(--border-light); border-radius: 6px;
      padding: 8px; margin: 8px 0; font-size: 12px; color: var(--text-secondary); }
  `],
})
export class PsppProofingComponent implements OnInit {
  catalog: any = null;
  ready: any[] = [];
  notReady: any[] = [];

  constructor(private pspp: PsppService) {}

  async ngOnInit(): Promise<void> {
    this.catalog = await this.pspp.catalog();
    const datasets = this.catalog?.datasets ?? [];
    this.ready = datasets.filter(
      (d: any) => d.status === 'ready' && d.pointCount > 0);
    this.notReady = datasets.filter(
      (d: any) => d.status !== 'ready' || d.pointCount === 0);
  }
}
