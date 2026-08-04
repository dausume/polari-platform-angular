import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * The drive profile — board, pole pairs, phase-to-terminal bindings
 * and the generated controller config.
 *
 * `motor_drive.simplefoc_config` already rendered as a real table in
 * motor-view while clock-views JSON-dumped it. Extracted so the
 * section's declared renderer resolves to it.
 *
 * The `<pre>` here is NOT an object dump: `configSnippet` is generated
 * controller source (SimpleFOC/Arduino C++), and preformatted text is
 * the correct rendering for source. It scrolls in its own box so a
 * long snippet cannot widen the page.
 */
@Component({
  standalone: true,
  selector: 'motor-drive-panel',
  imports: [CommonModule],
  template: `
    <div class="drive" *ngIf="payload as d">
      <div class="readout">
        <span *ngIf="d.board">board <b>{{ d.board }}</b></span>
        <span *ngIf="d.profile">profile <b>{{ d.profile }}</b></span>
        <span *ngIf="d.polePairs != null">
          pole pairs <b>{{ d.polePairs }}</b></span>
        <span *ngIf="d.rateHz != null">{{ d.rateHz }} Hz</span>
        <span *ngIf="d.kind">{{ d.kind }}</span>
      </div>

      <table class="bindings" *ngIf="d.phaseBindings?.length">
        <tr><th>phase</th><th>shield terminal</th><th>FPGA PWM</th></tr>
        <tr *ngFor="let b of d.phaseBindings">
          <td>{{ b.phase }}</td>
          <td>{{ b.shieldTerminal }}</td>
          <td class="muted">{{ b.fpgaPwmChannel }}</td>
        </tr>
      </table>

      <details *ngIf="d.configSnippet">
        <summary class="label">generated controller config</summary>
        <pre class="snippet">{{ d.configSnippet }}</pre>
      </details>

      <p class="hint" *ngIf="d.honesty">{{ d.honesty }}</p>
      <p class="hint warn" *ngIf="d.refusal">{{ d.refusal }}</p>
    </div>
  `,
  styles: [`
    .drive { display: block; color: var(--text-on-card); min-width: 0; }
    .readout {
      display: flex; flex-wrap: wrap; gap: 10px;
      font-size: 0.9em; margin-bottom: 8px;
    }
    .readout span {
      border: 1px solid var(--surface-outline);
      border-radius: 10px; padding: 0 8px;
    }
    .bindings { border-collapse: collapse; font-size: 12px; width: 100%; }
    .bindings th {
      text-align: left; font-size: 10px; text-transform: uppercase;
      letter-spacing: 0.04em; color: var(--text-on-card-muted);
      padding: 3px 8px 3px 0;
    }
    .bindings td {
      padding: 3px 8px 3px 0;
      border-top: 1px dashed var(--border-light);
    }
    .muted { color: var(--text-on-card-muted); }
    .label {
      font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em;
      color: var(--text-on-card-muted); cursor: pointer;
    }
    /* Generated SOURCE, not an object dump — and it scrolls in its own
       box so a long snippet never widens the page. */
    .snippet {
      background: var(--surface-secondary);
      color: var(--text-on-card);
      border-radius: 6px; padding: 8px;
      font-size: 11.5px; margin: 6px 0;
      max-height: 320px; overflow: auto; max-width: 100%;
    }
    .hint { font-size: 12px; color: var(--text-on-card-muted); margin: 4px 0; }
    .hint.warn { color: var(--color-warn-text); }
  `],
})
export class MotorDrivePanelComponent {
  /** The `simplefoc_config` payload. */
  @Input() payload: any = null;
}
