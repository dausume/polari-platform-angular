import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * The winding answer, rendered.
 *
 * `motor_winding.winding_report` already had a first-class rendering
 * inside clock-motor, but clock-views — the ONLY surface for M1 and
 * M2 — dumped the same payload as raw JSON. Extracted here so the
 * section's declared renderer (clock_views.SECTION_RENDERERS) can
 * resolve to it, and so both surfaces draw the one answer the same
 * way.
 *
 * Every field is shape-gated: a payload that does not carry a block
 * simply omits it, rather than rendering an empty card. That is the
 * m1-8 lesson — a renderer that assumes its shape breaks the moment a
 * different rung answers.
 */
@Component({
  standalone: true,
  selector: 'motor-winding-panel',
  imports: [CommonModule],
  template: `
    <div class="wind" *ngIf="payload as w">
      <div class="readout">
        <span *ngIf="w.wire?.awg != null">{{ w.wire.awg }} AWG</span>
        <span *ngIf="w.turns != null">{{ w.turns }} turns</span>
        <span *ngIf="w.fillFactor != null">
          fill <b>{{ w.fillFactor }}</b></span>
        <span *ngIf="w.resistanceOhm != null">
          {{ w.resistanceOhm }} Ω</span>
        <span *ngIf="w.voltageNeededV != null">
          <b>{{ w.voltageNeededV }} V</b>
          <ng-container *ngIf="w.supplyVoltageV != null">
            of {{ w.supplyVoltageV }} V</ng-container></span>
        <span *ngIf="w.powerDissipatedW != null">
          {{ w.powerDissipatedW }} W</span>
      </div>

      <div class="verdict"
           *ngIf="w.fitNote"
           [class.good]="w.buildable"
           [class.bad]="w.buildable === false">
        {{ w.fitNote }}
      </div>

      <p class="hint" *ngIf="w.driveNote">{{ w.driveNote }}</p>
      <p class="hint" *ngIf="w.thermalNote">{{ w.thermalNote }}</p>

      <!-- Per-phase rows: M1/M2 answer with several coils where M0
           answers with one, and the imbalance between them is the
           finding, not a footnote. -->
      <table class="phases" *ngIf="w.phases?.length">
        <tr><th>phase</th><th>turns</th><th>Ω</th><th>note</th></tr>
        <tr *ngFor="let p of w.phases">
          <td>{{ p.name || p.phase }}</td>
          <td class="num">{{ p.turns }}</td>
          <td class="num">{{ p.resistanceOhm }}</td>
          <td>{{ p.note }}</td>
        </tr>
      </table>

      <div class="warn-text" *ngFor="let i of w.invalidates">
        ⚠ {{ i }}</div>
    </div>
  `,
  styles: [`
    .wind { display: block; color: var(--text-on-card); min-width: 0; }
    .readout {
      display: flex; flex-wrap: wrap; gap: 10px;
      font-size: 0.9em; margin-bottom: 8px;
    }
    .readout span {
      border: 1px solid var(--surface-outline);
      border-radius: 10px; padding: 0 8px;
    }
    .verdict {
      border-radius: 6px; padding: 6px 10px; margin: 6px 0;
      font-size: 0.9em;
      background: var(--surface-secondary);
    }
    .verdict.good {
      background: var(--color-success-bg);
      color: var(--color-success-text);
    }
    .verdict.bad {
      background: var(--color-error-bg);
      color: var(--color-error-text);
    }
    .hint { font-size: 12px; color: var(--text-on-card-muted); margin: 4px 0; }
    .phases { border-collapse: collapse; font-size: 12px; width: 100%; }
    .phases th {
      text-align: left; font-size: 11px; text-transform: uppercase;
      letter-spacing: 0.04em; color: var(--text-on-card-muted);
      padding: 4px 8px 4px 0;
    }
    .phases td {
      padding: 3px 8px 3px 0;
      border-top: 1px dashed var(--border-light);
    }
    .num { text-align: right; font-variant-numeric: tabular-nums; }
    .warn-text { color: var(--color-warn-text); font-size: 12px; }
  `],
})
export class MotorWindingPanelComponent {
  /** The `winding_report` payload, passed straight through by the
   *  section dispatcher. */
  @Input() payload: any = null;
}
