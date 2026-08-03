/**
 * @cross-cutting
 * @tags @xc:bindings
 * @consumers
 *   - SimSpaceSimulationRunPanelComponent (rendered after IC editor
 *     once the selected run has at least step-0 committed)
 * @impact-on-edit
 *   Read-only readout — no inputs, no service calls beyond
 *   `currentStateFor`. Refreshes on the parent's stepCommitted /
 *   selected-run-change events; never polls.
 *
 * Live current-state display. Shows the most recent persisted row per
 * participating *SimState class for the selected run. Per-class
 * sections mirror the IC editor's per-class collapsing behavior so
 * the eye learns one layout.
 */

import {
  ChangeDetectionStrategy,
  Component,
  Input,
  OnChanges,
  SimpleChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

import { SimulationRunService } from '@services/sim-space/simulation-run.service';
import {
  formatTimeValue,
  TimeDisplayMode,
  TimeUnitId,
} from '@models/sim-space/time-units';

/** Framework-stamped identity fields we surface in their own row at
 *  the top of each class section (rather than mixing them in with the
 *  user-declared schema). */
const IDENTITY_FIELDS = new Set(['name', 'simulation_run_ref', 'step', 'time']);

interface ClassBlock {
  name: string;
  step: number | null;
  time: number | null;
  fieldRows: Array<{ name: string; value: unknown }>;
  open: boolean;
}

@Component({
  standalone: true,
  selector: 'run-current-state-display',
  imports: [
    CommonModule, MatIconModule, MatTooltipModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="display" *ngIf="runName">
      <p class="muted small" *ngIf="!blocks.length">
        No committed rows yet — set initial conditions or step once.
      </p>

      <section class="class-block" *ngFor="let block of blocks; let i = index">
        <button type="button" class="class-header"
                (click)="toggle(i)"
                [attr.aria-expanded]="block.open">
          <mat-icon class="chevron">
            {{ block.open ? 'expand_less' : 'expand_more' }}
          </mat-icon>
          <mat-icon>category</mat-icon>
          <span class="class-name mono">{{ block.name }}</span>
          <span class="class-tag muted small">
            step {{ block.step }} · t = {{ formatTime(block.time) }}
          </span>
        </button>

        <ul class="field-list" *ngIf="block.open">
          <li class="field-row" *ngFor="let row of block.fieldRows">
            <code class="field-name">{{ row.name }}</code>
            <span class="field-value mono">{{ formatValue(row.value) }}</span>
          </li>
        </ul>
      </section>
    </div>
  `,
  styles: [`
    .display {
      display: flex;
      flex-direction: column;
      gap: 8px;
      max-height: 320px;
      overflow-y: auto;
    }
    .class-block {
      border: 1px solid var(--border-light, #e0e3e9);
      border-radius: 6px;
      background: var(--surface-secondary, #fafbfc);
    }
    .class-header {
      display: flex; align-items: center; gap: 6px;
      padding: 6px 10px;
      border: none; background: var(--surface-primary); width: 100%;
      border-bottom: 1px solid var(--border-light, #e0e3e9);
      border-top-left-radius: 6px; border-top-right-radius: 6px;
      cursor: pointer; text-align: left; font: inherit; color: inherit;
    }
    .class-header[aria-expanded="false"] { border-bottom-color: transparent; }
    .class-header:hover { background: #f3f7fc; }
    .class-header mat-icon { font-size: 18px; width: 18px; height: 18px; color: #1976d2; }
    .class-header .chevron { color: #555; }
    .class-name { font-size: 12px; font-weight: 600; color: #0d47a1; flex: 1 1 auto; }
    .class-tag { white-space: nowrap; font-family: monospace; }
    .field-list { list-style: none; margin: 0; padding: 6px 10px; display: flex; flex-direction: column; gap: 4px; }
    .field-row {
      display: grid;
      grid-template-columns: minmax(80px, 1fr) minmax(0, 2fr);
      align-items: center;
      gap: 8px;
      font-size: 11px;
    }
    .field-name { color: #333; font-family: monospace; }
    .field-value {
      color: #0d47a1; font-weight: 500;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .muted { color: #888; }
    .small { font-size: 0.85em; }
    .mono { font-family: monospace; }
  `]
})
export class RunCurrentStateDisplayComponent implements OnChanges {

  /** The run we're displaying state for. Null = nothing rendered. */
  @Input() runName: string | null = null;

  /** Bumped by the parent every time a step commits. Forces a refresh
   *  without polling. */
  @Input() refreshKey: number = 0;

  /** Display unit + mode passed through from the parent so the time
   *  readouts match the scrubber's formatter. */
  @Input() timeUnit: TimeUnitId = 'second';
  @Input() timeDisplayMode: TimeDisplayMode = 'flexible';

  blocks: ClassBlock[] = [];

  /** Preserve open/closed state across refreshes — keyed by class name
   *  so toggles persist when new state lands. */
  private openByClass: Record<string, boolean> = {};

  constructor(private runService: SimulationRunService) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['runName'] || changes['refreshKey']) {
      this.refresh();
    }
  }

  toggle(index: number): void {
    const block = this.blocks[index];
    if (!block) return;
    block.open = !block.open;
    this.openByClass[block.name] = block.open;
  }

  formatTime(value: number | null): string {
    if (value == null) return '?';
    return formatTimeValue(value, this.timeUnit, this.timeDisplayMode);
  }

  formatValue(value: unknown): string {
    if (value === null || value === undefined) return '(unset)';
    if (typeof value === 'number') {
      return parseFloat(value.toPrecision(6)).toString();
    }
    if (typeof value === 'object') {
      try { return JSON.stringify(value); } catch { return String(value); }
    }
    return String(value);
  }

  private async refresh(): Promise<void> {
    if (!this.runName) {
      this.blocks = [];
      return;
    }
    try {
      const resp = await this.runService.currentStateFor(this.runName);
      const perClass = resp.perClass ?? {};
      this.blocks = Object.keys(perClass).sort().map(cls => {
        const row = perClass[cls] || {};
        const step = (row['step'] as number) ?? null;
        const time = (row['time'] as number) ?? null;
        const fieldRows = Object.keys(row)
          .filter(k => !IDENTITY_FIELDS.has(k))
          .sort()
          .map(name => ({ name, value: row[name] }));
        return {
          name: cls,
          step,
          time,
          fieldRows,
          open: this.openByClass[cls] !== false,
        };
      });
    } catch (err) {
      console.warn('[RunCurrentStateDisplay] currentStateFor failed:', err);
    }
  }
}
