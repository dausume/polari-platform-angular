import {
  Component, EventEmitter, Input, OnDestroy, Output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';

import {
  IcChoice, IcInterfaceConfig,
} from '@services/multi-scale/initial-condition-interface.service';
import { SimulationRunService } from '@services/sim-space/simulation-run.service';
import { evaluateExpression } from '@models/multi-scale/safe-expression';

interface Verdict {
  valid: boolean;
  hasValidator: boolean;
  reason: string;
  error: string | null;
}

/**
 * The INTERACTIVE IC-interface panel (Phase 4): a choicePreset picker
 * (e.g. the bob's material). Selecting a choice builds the run's
 * parameter overrides (setParams + safely-evaluated derivedParams),
 * fires the debounced initial-conditions validator (same endpoint +
 * debounce contract as the run IC editor), and can start a NEW coupled
 * run carrying those parameters — the whole page (viewers + graphs)
 * follows the new run.
 */
@Component({
  standalone: true,
  selector: 'msim-ic-panel',
  imports: [
    CommonModule, MatButtonModule, MatIconModule,
    MatProgressSpinnerModule, MatTooltipModule,
  ],
  template: `
    <div class="panel-title">
      <mat-icon>tune</mat-icon>
      {{ ic.label }}
      <span class="panel-run">initial conditions · {{ ic.targetSimulationRef }}</span>
    </div>
    <p class="ic-description">{{ ic.description }}</p>

    <div class="ic-choices">
      <button class="ic-choice-btn" *ngFor="let choice of ic.choices"
              [class.selected]="choice.key === selectedKey"
              [matTooltip]="choice.description || ''"
              [disabled]="busy || creating"
              (click)="select(choice)">
        {{ choice.label }}
        <span class="ic-choice-meta" *ngIf="choice.setParams?.['mass'] !== undefined">
          {{ choice.setParams?.['mass'] | number:'1.0-2' }} kg
        </span>
      </button>
    </div>

    <div class="ic-verdict" *ngIf="selectedKey">
      <mat-spinner *ngIf="validating" diameter="16"></mat-spinner>
      <ng-container *ngIf="!validating && verdict">
        <mat-icon class="ok" *ngIf="verdict.valid">check_circle</mat-icon>
        <mat-icon class="bad" *ngIf="!verdict.valid">error_outline</mat-icon>
        <span *ngIf="verdict.valid && verdict.hasValidator">Valid initial conditions.</span>
        <span *ngIf="verdict.valid && !verdict.hasValidator">Accepted (no validator wired for this simulation).</span>
        <span *ngIf="!verdict.valid">{{ verdict.reason || verdict.error || 'Invalid initial conditions.' }}</span>
      </ng-container>
      <span class="ic-params" *ngIf="paramSummary">{{ paramSummary }}</span>
    </div>

    <div class="ic-actions" *ngIf="selectedKey">
      <button mat-flat-button color="primary"
              [disabled]="busy || creating || validating || verdict?.valid === false"
              (click)="startRun()">
        <mat-icon>rocket_launch</mat-icon>
        Start run with this material
      </button>
      <mat-spinner *ngIf="creating" diameter="18"></mat-spinner>
      <span class="ic-status" *ngIf="statusMessage">{{ statusMessage }}</span>
    </div>
  `,
  styles: [`
    /* .panel-title mirrors the page's panel-card header — the page's
       scoped styles can't reach into this child component. */
    .panel-title {
      display: flex; align-items: center; gap: 8px;
      padding: 8px 12px; font-weight: 600; font-size: 14px;
      border-bottom: 1px solid var(--border-light, #eee);
    }
    .panel-title mat-icon { font-size: 18px; width: 18px; height: 18px; }
    .panel-title .panel-run {
      font-weight: 400; font-size: 12px; color: var(--text-secondary, #777);
    }
    .ic-description, .ic-choices, .ic-verdict, .ic-actions { padding-left: 12px; padding-right: 12px; }
    .ic-actions { padding-bottom: 10px; }
    .ic-description { font-size: 0.85rem; color: var(--text-secondary, #666); }
    .ic-choices { display: flex; flex-wrap: wrap; gap: 8px; margin: 8px 0; }
    .ic-choice-btn {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 6px 12px; border-radius: 16px; cursor: pointer;
      border: 1px solid var(--border-light, #ddd);
      background: var(--surface-primary, #fff);
      font: inherit; font-size: 0.9rem;
    }
    .ic-choice-btn.selected {
      border-color: var(--brand-teal, #159588);
      background: rgba(21, 149, 136, 0.08);
      font-weight: 600;
    }
    .ic-choice-btn:disabled { opacity: 0.6; cursor: default; }
    .ic-choice-meta { font-size: 0.75rem; opacity: 0.7; }
    .ic-verdict {
      display: flex; align-items: center; gap: 6px;
      font-size: 0.85rem; min-height: 24px; flex-wrap: wrap;
    }
    .ic-verdict .ok { color: #2e7d32; }
    .ic-verdict .bad { color: #c62828; }
    .ic-params { font-size: 0.75rem; opacity: 0.7; }
    .ic-actions { display: flex; align-items: center; gap: 10px; margin-top: 8px; }
    .ic-status { font-size: 0.8rem; color: var(--text-secondary, #666); }
  `],
})
export class MsimIcPanelComponent implements OnDestroy {
  @Input() ic!: IcInterfaceConfig;
  /** Coupled sources of the page's SELECTED run — copied onto runs this
   *  panel creates so a material-picked run still couples (e.g. to the
   *  wind field). */
  @Input() coupledRunRefs: Record<string, string> = {};
  @Input() busy = false;
  /** Emits the new run's name once created + step-0 committed. */
  @Output() runCreated = new EventEmitter<string>();

  selectedKey: string | null = null;
  paramOverrides: Record<string, number> = {};
  paramSummary = '';
  validating = false;
  verdict: Verdict | null = null;
  creating = false;
  statusMessage: string | null = null;

  private debounceTimer: any = null;
  private validateSeq = 0;
  private readonly DEBOUNCE_MS = 400;

  constructor(private runService: SimulationRunService) {}

  ngOnDestroy(): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
  }

  select(choice: IcChoice): void {
    this.selectedKey = choice.key;
    this.statusMessage = null;
    this.paramOverrides = this.buildOverrides(choice);
    this.paramSummary = Object.entries(this.paramOverrides)
      .map(([k, v]) => `${k}=${Number(v.toPrecision(4))}`)
      .join('  ');
    // Debounced validation — same contract as the run IC editor.
    this.verdict = null;
    this.validating = true;
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => this.validate(), this.DEBOUNCE_MS);
  }

  /** setParams + derivedParams (safe arithmetic over the chosen values,
   *  with pi available — NO eval). A derived expression that fails is
   *  skipped; the backend still validates whatever we send. */
  private buildOverrides(choice: IcChoice): Record<string, number> {
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(choice.setParams ?? {})) {
      if (typeof v === 'number' && isFinite(v)) out[k] = v;
    }
    for (const [param, expr] of Object.entries(this.ic.derivedParams ?? {})) {
      try {
        out[param] = evaluateExpression(String(expr), out);
      } catch { /* skipped — expression referenced something unset */ }
    }
    return out;
  }

  private async validate(): Promise<void> {
    const seq = ++this.validateSeq;
    try {
      const result = await this.runService.validateInitialConditions(
        this.ic.targetSimulationRef, {}, this.paramOverrides,
      );
      if (seq !== this.validateSeq) return; // stale reply
      this.verdict = {
        valid: result.valid,
        hasValidator: result.hasValidator,
        reason: result.reason,
        error: result.error,
      };
    } catch (err: any) {
      if (seq !== this.validateSeq) return;
      this.verdict = {
        valid: false, hasValidator: true, reason: '',
        error: err?.message || String(err),
      };
    } finally {
      if (seq === this.validateSeq) this.validating = false;
    }
  }

  async startRun(): Promise<void> {
    if (!this.selectedKey || this.creating) return;
    const choice = this.ic.choices.find(c => c.key === this.selectedKey);
    this.creating = true;
    this.statusMessage = 'Creating run…';
    try {
      const created = await this.runService.create(
        this.ic.targetSimulationRef,
        `Pendulum — ${choice?.label ?? this.selectedKey} bob`,
        {},            // IC field overrides (interface sets params)
        undefined,     // dt: inherit
        {},            // field-save overrides
        this.paramOverrides,
        this.coupledRunRefs ?? {},
      );
      this.statusMessage = 'Committing step 0…';
      await this.runService.step(created.name, 0);
      this.statusMessage = `Run "${created.name}" ready.`;
      this.runCreated.emit(created.name);
    } catch (err: any) {
      this.statusMessage = `Failed: ${err?.message || err}`;
    } finally {
      this.creating = false;
    }
  }
}
