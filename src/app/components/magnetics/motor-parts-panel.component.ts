import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * The mass bill, rendered.
 *
 * `motor_parts.part_report` already had a first-class rendering
 * inside clock-motor; clock-views dumped the same payload as JSON.
 * Extracted so the section's declared renderer resolves to it.
 *
 * Every part expands to its material, why that material, and the
 * measured properties WITH provenance — the point of the bill is that
 * a number can be traced, so provenance travels with the value rather
 * than being a footnote elsewhere.
 *
 * Shape-gated throughout: a rung whose payload omits a block omits
 * the block, not the panel.
 */
@Component({
  standalone: true,
  selector: 'motor-parts-panel',
  imports: [CommonModule],
  template: `
    <div class="parts" *ngIf="payload as p">
      <div class="totals">
        <span *ngIf="p.count != null"><b>{{ p.count }}</b> pieces</span>
        <span *ngIf="p.totalMassG != null">
          total <b>{{ p.totalMassG }} g</b></span>
        <span class="hint" *ngIf="p.massNote">{{ p.massNote }}</span>
      </div>

      <div class="part" *ngFor="let part of p.parts"
           [class.active]="selected === part.part"
           (click)="toggle(part.part)">
        <div class="part-head">
          <b>{{ part.displayName || part.part }}</b>
          <span class="chip chip-outline" *ngIf="part.function">
            {{ part.function }}</span>
          <span class="chip chip-outline" *ngIf="part.quantity > 1">
            ×{{ part.quantity }}</span>
          <span class="grow"></span>
          <span class="nums" *ngIf="part.volumeCm3 != null">
            {{ part.volumeCm3 }} cm³
            <ng-container *ngIf="part.massG != null">
              · <b>{{ part.massG }} g</b></ng-container>
          </span>
        </div>

        <div class="purpose" *ngIf="part.purpose">{{ part.purpose }}</div>

        <ng-container *ngIf="selected === part.part">
          <div class="mat" *ngIf="part.material">
            <span class="label">made of</span>
            <code>{{ part.material }}</code>
            <span class="chip chip-outline" *ngIf="part.realizationLevel">
              {{ part.realizationLevel }}</span>
          </div>
          <div class="why" *ngIf="part.whyThisMaterial">
            <span class="label">why this material</span>
            {{ part.whyThisMaterial }}
          </div>
          <table class="props" *ngIf="part.properties?.length">
            <tr><th>property</th><th>value</th><th>unit</th>
              <th>provenance</th></tr>
            <tr *ngFor="let pr of part.properties">
              <td><code>{{ pr.property }}</code></td>
              <td class="num">{{ pr.value }}</td>
              <td>{{ pr.unit }}</td>
              <td><span class="chip chip-outline">{{ pr.provenance }}</span></td>
            </tr>
          </table>
          <div class="hint warn" *ngIf="part.materialGap">
            ⚠ {{ part.materialGap }}</div>
          <div class="hint" *ngIf="part.notes">{{ part.notes }}</div>
          <div class="hint" *ngIf="part.shapeRef">
            shape row <code>{{ part.shapeRef }}</code>
            <ng-container *ngIf="part.shapeUnits">
              ({{ part.shapeUnits }} units)</ng-container>
          </div>
        </ng-container>
      </div>
    </div>
  `,
  styles: [`
    .parts { display: block; color: var(--text-on-card); min-width: 0; }
    .totals {
      display: flex; flex-wrap: wrap; gap: 10px;
      align-items: baseline; margin-bottom: 8px; font-size: 0.9em;
    }
    .part {
      border: 1px solid var(--surface-outline);
      border-radius: 8px; padding: 8px 10px; margin-bottom: 6px;
      cursor: pointer;
    }
    .part.active { background: var(--surface-secondary); }
    .part-head {
      display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
    }
    .grow { flex: 1 1 auto; }
    .nums { font-variant-numeric: tabular-nums; font-size: 0.9em; }
    .purpose {
      font-size: 12px; color: var(--text-on-card-muted); margin-top: 3px;
    }
    .mat, .why { font-size: 12px; margin-top: 6px; }
    .label {
      text-transform: uppercase; letter-spacing: 0.04em;
      font-size: 10px; color: var(--text-on-card-muted);
      margin-right: 6px;
    }
    .props { border-collapse: collapse; font-size: 12px; margin-top: 6px; width: 100%; }
    .props th {
      text-align: left; font-size: 10px; text-transform: uppercase;
      letter-spacing: 0.04em; color: var(--text-on-card-muted);
      padding: 3px 8px 3px 0;
    }
    .props td {
      padding: 2px 8px 2px 0;
      border-top: 1px dashed var(--border-light);
    }
    .num { text-align: right; font-variant-numeric: tabular-nums; }
    .hint { font-size: 11.5px; color: var(--text-on-card-muted); margin-top: 4px; }
    .hint.warn { color: var(--color-warn-text); }
  `],
})
export class MotorPartsPanelComponent {
  /** The `part_report` payload. */
  @Input() payload: any = null;

  /** Which part is expanded. One at a time — the bill is long and a
   *  fully-expanded list is unreadable. */
  selected = '';

  toggle(part: string): void {
    this.selected = this.selected === part ? '' : part;
  }
}
