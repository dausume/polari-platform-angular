import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PsppService } from '@services/pspp/pspp.service';

/**
 * Cure-progress explorer (ReactionProgressModel v1 — measured curves
 * only). Supported exactly where the book measured: §8.2.8 setting
 * classes at 80 °C, Fig 8.20 temperature ladder near MR=1.83.
 * Everything else REFUSES and names the dataset a scientist would
 * enter to support it — the refusal is the feature.
 */
@Component({
  selector: 'pspp-progress',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
  <div class="prog">
    <h2>PSPP — Cure progress (v1, measured curves only)</h2>
    <div class="form">
      <label>K-silicate MR
        <input type="number" step="0.01" [(ngModel)]="mr"/></label>
      <label>cure T (°C)
        <input type="number" [(ngModel)]="temperature"/></label>
      <label>hours
        <input type="number" [(ngModel)]="hours"/></label>
      <button (click)="run()">Estimate</button>
      <span class="presets">Measured MRs: 1.23 · 1.83 · 1.96 · 2.08 ·
        2.24 · 2.43 · 2.85 — at 80 °C</span>
    </div>
    <div *ngIf="result?.ok" class="card">
      <div><b>MR {{ result.MR }}</b> at {{ result.cureTemperatureC }}°C
        — setting class {{ result.settingClass }}, completion
        ≈ {{ result.completionHours | number:'1.0-2' }} h</div>
      <svg viewBox="0 0 560 180" class="chart">
        <line x1="40" y1="150" x2="540" y2="150" class="axis"/>
        <line x1="40" y1="20" x2="40" y2="150" class="axis"/>
        <text x="290" y="172" class="ax">hours</text>
        <text x="12" y="88" class="ax" transform="rotate(-90 12,88)">
          reaction extent</text>
        <polyline [attr.points]="points" class="line"/>
      </svg>
      <div class="assume" *ngFor="let a of result.assumptions">
        • {{ a }}</div>
      <div class="assume">evidence: {{ result.evidence.method }} from
        {{ result.evidence.datasets.join(', ') }}</div>
    </div>
    <div *ngIf="result && !result.ok" class="refusal">
      <b>Refused:</b> {{ result.refusal }}
      <div>{{ result.suggestion }}</div>
    </div>
  </div>`,
  styles: [`
    :host { display: block; color: var(--text-on-bg); }
    .card, .panel, .section, .form, .pspp-chart-card, .home a.card { color: var(--text-on-card); }
    .prog { max-width: 620px; margin: 0 auto; padding: 12px; }
    .form { display: flex; gap: 10px; align-items: end;
      flex-wrap: wrap; }
    .form label { font-size: 12px; display: flex;
      flex-direction: column; }
    .form input { width: 80px; }
    .presets { font-size: 10px; color: var(--text-tertiary); }
    .card { border: 1px solid var(--border-light); border-radius: 8px;
      padding: 10px; margin-top: 8px; background: var(--surface-primary);
      font-size: 13px; }
    .chart .axis { stroke: var(--chart-text); }
    .chart .ax { font-size: 10px; fill: var(--chart-text); }
    .chart .line { fill: none; stroke: #4a6b8a; stroke-width: 2; }
    .assume { font-size: 11px; color: var(--text-secondary); }
    .refusal { background: var(--color-error-bg); border: 1px solid var(--color-error-border);
      border-radius: 6px; padding: 8px; font-size: 12px;
      margin-top: 8px; }
  `],
})
export class PsppProgressComponent implements OnInit {
  mr = 1.83;
  temperature = 80;
  hours = 6;
  result: any = null;
  points = '';

  constructor(private pspp: PsppService) {}

  ngOnInit(): void { this.run(); }

  async run(): Promise<void> {
    this.result = await this.pspp.progress(
      this.mr, this.temperature, this.hours);
    if (this.result?.ok) {
      const curve = this.result.curve;
      const maxH = curve[curve.length - 1].hours || 1;
      this.points = curve.map((c: any) =>
        `${40 + (c.hours / maxH) * 500},`
        + `${150 - c.reactionExtent * 130}`).join(' ');
    }
  }
}
