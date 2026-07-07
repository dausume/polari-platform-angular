import { Component, Input, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTooltipModule } from '@angular/material/tooltip';

/** One refine-trajectory entry (batch_refine trajectory shape). */
interface TrajectoryPoint {
  batch: number;
  score?: number;
  move?: string;
  loadingStep?: number;
  [k: string]: unknown;
}

/**
 * The refinement trajectory as a small dependency-free inline SVG:
 * batch number vs score, with markers where the adaptive stepper
 * HALVED its loading step (coarse approach → fine landing). Hover a
 * point for the named move.
 */
@Component({
  standalone: true,
  selector: 'formulation-trajectory-graph',
  imports: [CommonModule, MatTooltipModule],
  template: `
    <div class="trajectory" *ngIf="points.length > 1; else noTrajectory">
      <svg [attr.viewBox]="'0 0 ' + W + ' ' + H" preserveAspectRatio="none">
        <polyline [attr.points]="polyline" fill="none"
                  stroke="#159588" stroke-width="2"/>
        <g *ngFor="let p of plotted">
          <circle [attr.cx]="p.x" [attr.cy]="p.y" r="4"
                  [attr.fill]="p.halved ? '#b26a00' : '#159588'">
            <title>batch {{ p.batch }} — score {{ p.score }}
{{ p.move || '' }}{{ p.halved ? ' (step halved)' : '' }}</title>
          </circle>
        </g>
      </svg>
      <div class="axis-note">
        batch → (score ↑, {{ points.length }} batches;
        <span class="halve-dot"></span> = adaptive step halved)
      </div>
    </div>
    <ng-template #noTrajectory>
      <p class="no-data">No refinement trajectory yet — run the search
        (grid-mode runs have no trajectory; the ranked list is the
        product).</p>
    </ng-template>
  `,
  styles: [`
    .trajectory svg {
      width: 100%; height: 160px; background: var(--surface-secondary, #fafafa);
      border: 1px solid var(--border-light, #eee); border-radius: 8px;
    }
    .axis-note { font-size: 11px; color: var(--text-secondary, #777);
                 margin-top: 3px; }
    .halve-dot {
      display: inline-block; width: 8px; height: 8px; border-radius: 4px;
      background: #b26a00; vertical-align: baseline;
    }
    .no-data { font-size: 12px; color: var(--text-secondary, #777); }
  `],
})
export class FormulationTrajectoryGraphComponent implements OnChanges {
  @Input() trajectory: TrajectoryPoint[] = [];

  readonly W = 600;
  readonly H = 160;
  points: TrajectoryPoint[] = [];
  plotted: { x: number; y: number; batch: number; score: number;
             move: string; halved: boolean }[] = [];
  polyline = '';

  ngOnChanges(): void {
    this.points = (this.trajectory || [])
      .filter(p => typeof p?.score === 'number');
    if (this.points.length < 2) { this.plotted = []; return; }
    const scores = this.points.map(p => p.score as number);
    const min = Math.min(...scores);
    const max = Math.max(...scores);
    const span = max - min || 1;
    const pad = 12;
    let prevStep: number | undefined;
    this.plotted = this.points.map((p, i) => {
      const x = pad + (i / (this.points.length - 1)) * (this.W - 2 * pad);
      const y = this.H - pad
        - (((p.score as number) - min) / span) * (this.H - 2 * pad);
      const halved = prevStep !== undefined
        && typeof p.loadingStep === 'number' && p.loadingStep < prevStep;
      if (typeof p.loadingStep === 'number') prevStep = p.loadingStep;
      return { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10,
               batch: p.batch, score: p.score as number,
               move: String(p.move ?? ''), halved };
    });
    this.polyline = this.plotted.map(p => `${p.x},${p.y}`).join(' ');
  }
}
