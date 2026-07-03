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
import {
  MultiScaleSimDefinitionService, StageSearchReport,
} from '@services/multi-scale/multi-scale-sim-definition.service';
import { MsimProofService } from '@services/multi-scale/msim-proof.service';
import { SimulationRunService } from '@services/sim-space/simulation-run.service';
import { evaluateExpression } from '@models/multi-scale/safe-expression';

interface Verdict {
  valid: boolean;
  hasValidator: boolean;
  reason: string;
  error: string | null;
}

type ChoiceProofState = 'plain' | 'unproven' | 'proving' | 'proven' | 'impossible';

/**
 * The INTERACTIVE IC-interface panel (Phase 4 + Milestone B): a
 * choicePreset picker (e.g. the bob's material).
 *
 * Milestone B — Dustin's canonical flow, live: when the picker declares
 * a `provingStage` and a choice carries `substanceParams`, selecting the
 * choice asks the FIRST-PRINCIPLES material space to PROVE it — the
 * stage's solution search tries temperature/pressure candidates until a
 * solid ball is achievable (or the candidates are exhausted):
 *   * PROVEN  → the run's parameters switch from the hand preset to the
 *     gate's derived values (real mass/size from the proven solid), and
 *     "Start run with this material" uses them.
 *   * IMPOSSIBLE → the choice is disabled WITH REASON AND DATA: the
 *     plain-language gate reason plus every attempted condition.
 * Proof results are session-cached (the search itself is stateless and
 * resumable server-side) and shared with the page's stage stepper.
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
              [class.proven]="proofStateOf(choice) === 'proven'"
              [class.impossible]="proofStateOf(choice) === 'impossible'"
              [matTooltip]="choiceTooltip(choice)"
              [disabled]="busy || creating"
              (click)="select(choice)">
        <mat-icon class="chip-state ok" *ngIf="proofStateOf(choice) === 'proven'">verified</mat-icon>
        <mat-icon class="chip-state bad" *ngIf="proofStateOf(choice) === 'impossible'">block</mat-icon>
        {{ choice.label }}
        <span class="ic-choice-meta" *ngIf="choice.setParams?.['mass'] !== undefined">
          {{ choice.setParams?.['mass'] | number:'1.0-2' }} kg
        </span>
      </button>
    </div>

    <!-- Proof progress: the material space proving the selected substance -->
    <div class="ic-proof proving" *ngIf="proving">
      <mat-spinner diameter="16"></mat-spinner>
      <span>
        Proving a solid ball is possible…
        <ng-container *ngIf="proofProgress">
          tried {{ proofProgress.attempted }} of {{ proofProgress.totalCandidates }} conditions
        </ng-container>
      </span>
      <button mat-button (click)="stopProofRequested = true">Stop</button>
    </div>

    <!-- PROVEN: the first-principles space achieved a solution -->
    <div class="ic-proof ok" *ngIf="!proving && selectedProof?.achieved && selectedProof?.winner as w">
      <mat-icon>verified</mat-icon>
      <div>
        <strong>Proven:</strong> {{ provenSummary(w) }}
        <div class="proof-note">The run will use these PROVEN values (not the preset).</div>
      </div>
    </div>

    <!-- IMPOSSIBLE: disabled with reason and data -->
    <div class="ic-proof bad" *ngIf="!proving && selectedProof && selectedProof.exhausted && !selectedProof.achieved">
      <mat-icon>block</mat-icon>
      <div class="proof-body">
        <strong>This material can't form a solid ball in the searched conditions.</strong>
        <div class="proof-note">
          {{ selectedProof.attempts[0]?.reason || 'No condition produced a solid.' }}
        </div>
        <button mat-button class="attempts-toggle" (click)="attemptsExpanded = !attemptsExpanded">
          <mat-icon>{{ attemptsExpanded ? 'expand_less' : 'expand_more' }}</mat-icon>
          {{ attemptsExpanded ? 'Hide' : 'Show' }} the {{ selectedProof.attempts.length }} tried conditions
        </button>
        <table class="attempts-table" *ngIf="attemptsExpanded">
          <tr *ngFor="let a of selectedProof.attempts">
            <td>{{ candidateText(a.candidate) }}</td>
            <td>{{ a.reason || a.error || '—' }}</td>
          </tr>
        </table>
        <button mat-stroked-button (click)="retryProof()">
          <mat-icon>refresh</mat-icon> Try again
        </button>
      </div>
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
      <span class="ic-params" *ngIf="paramSummary">
        <span class="param-source" [class.proven-tag]="paramSource === 'proven'">{{ paramSource }}</span>
        {{ paramSummary }}
      </span>
    </div>

    <div class="ic-actions" *ngIf="selectedKey">
      <button mat-flat-button color="primary"
              [disabled]="busy || creating || validating || proving
                          || verdict?.valid === false || selectedImpossible"
              [matTooltip]="selectedImpossible
                ? 'This material was proven impossible — pick another.' : ''"
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
    .ic-description, .ic-choices, .ic-proof, .ic-verdict, .ic-actions {
      padding-left: 12px; padding-right: 12px;
    }
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
    .ic-choice-btn.proven { border-color: #2e7d32; }
    .ic-choice-btn.impossible {
      border-color: #c62828; opacity: 0.75;
      text-decoration: line-through;
    }
    .ic-choice-btn:disabled { opacity: 0.6; cursor: default; }
    .ic-choice-meta { font-size: 0.75rem; opacity: 0.7; }
    .chip-state { font-size: 16px; width: 16px; height: 16px; }
    .chip-state.ok { color: #2e7d32; }
    .chip-state.bad { color: #c62828; }
    .ic-proof {
      display: flex; align-items: flex-start; gap: 8px;
      font-size: 0.85rem; margin: 6px 0; border-radius: 8px;
      padding: 8px 10px;
    }
    .ic-proof mat-icon { font-size: 18px; width: 18px; height: 18px; flex-shrink: 0; }
    .ic-proof.proving { background: #e3f2fd; color: #0d47a1; align-items: center; }
    .ic-proof.ok { background: #e8f5e9; color: #1b5e20; }
    .ic-proof.bad { background: #fbe9e7; color: #8d2f23; }
    .proof-note { font-style: italic; margin-top: 2px; }
    .proof-body { flex: 1; }
    .attempts-toggle { font-size: 0.8rem; }
    .attempts-table {
      border-collapse: collapse; font-size: 12px; margin: 4px 0 8px;
    }
    .attempts-table td {
      border-top: 1px solid rgba(0,0,0,0.1); padding: 3px 10px 3px 0;
    }
    .ic-verdict {
      display: flex; align-items: center; gap: 6px;
      font-size: 0.85rem; min-height: 24px; flex-wrap: wrap;
    }
    .ic-verdict .ok { color: #2e7d32; }
    .ic-verdict .bad { color: #c62828; }
    .ic-params { font-size: 0.75rem; opacity: 0.7; }
    .param-source {
      text-transform: uppercase; font-size: 0.65rem; letter-spacing: 0.5px;
      border: 1px solid currentColor; border-radius: 6px; padding: 0 4px;
      margin-right: 4px; opacity: 0.8;
    }
    .param-source.proven-tag { color: #2e7d32; opacity: 1; }
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
  /** Which channel the overrides came from: the hand preset (instant
   *  preview) or the material space's PROVEN solution. */
  paramSource: 'preset' | 'proven' = 'preset';
  validating = false;
  verdict: Verdict | null = null;
  creating = false;
  statusMessage: string | null = null;

  // Milestone B proof state (for the SELECTED choice).
  proving = false;
  stopProofRequested = false;
  proofProgress: StageSearchReport | null = null;
  selectedProof: StageSearchReport | null = null;
  attemptsExpanded = false;

  private debounceTimer: any = null;
  private proofTimer: any = null;
  private validateSeq = 0;
  private readonly DEBOUNCE_MS = 400;
  private readonly PROOF_DEBOUNCE_MS = 500;
  private readonly PROOF_BATCH = 5;
  private readonly PROOF_MAX_CALLS = 10;

  constructor(
    private runService: SimulationRunService,
    private msimService: MultiScaleSimDefinitionService,
    private proofService: MsimProofService,
  ) {}

  ngOnDestroy(): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    if (this.proofTimer) clearTimeout(this.proofTimer);
    this.stopProofRequested = true;
  }

  // ---------------------------------------------------------------
  // Choice selection
  // ---------------------------------------------------------------

  select(choice: IcChoice): void {
    this.selectedKey = choice.key;
    this.statusMessage = null;
    this.attemptsExpanded = false;
    // Instant preview from the hand preset; the proof (if any) upgrades
    // these to the PROVEN values when it lands.
    this.paramSource = 'preset';
    this.paramOverrides = this.buildOverrides(choice.setParams ?? {});
    this.updateParamSummary();
    this.scheduleValidate();

    // Milestone B: prove the substance via the first-principles stage.
    this.selectedProof = null;
    if (this.proofTimer) clearTimeout(this.proofTimer);
    if (this.provable(choice)) {
      const cached = this.proofService.get(
        this.ic.provingStage!.msim, this.ic.provingStage!.stageKey, choice.key);
      if (cached) {
        this.applyProof(choice, cached);
      } else {
        this.proofTimer = setTimeout(
          () => this.runProof(choice), this.PROOF_DEBOUNCE_MS);
      }
    }
  }

  private provable(choice: IcChoice): boolean {
    return !!(this.ic.provingStage && choice.substanceParams
              && Object.keys(choice.substanceParams).length);
  }

  proofStateOf(choice: IcChoice): ChoiceProofState {
    if (!this.provable(choice)) return 'plain';
    if (this.proving && choice.key === this.selectedKey) return 'proving';
    const cached = this.proofService.get(
      this.ic.provingStage!.msim, this.ic.provingStage!.stageKey, choice.key);
    if (!cached) return 'unproven';
    if (cached.achieved) return 'proven';
    if (cached.exhausted) return 'impossible';
    return 'unproven';
  }

  get selectedImpossible(): boolean {
    return !!(this.selectedProof
              && this.selectedProof.exhausted && !this.selectedProof.achieved);
  }

  choiceTooltip(choice: IcChoice): string {
    const state = this.proofStateOf(choice);
    if (state === 'proven') return `${choice.description || ''} — proven by the material space`.trim();
    if (state === 'impossible') return 'Proven impossible in the searched conditions — click to see why.';
    return choice.description || '';
  }

  // ---------------------------------------------------------------
  // Milestone B: the proof flow (stage solution search per substance)
  // ---------------------------------------------------------------

  private async runProof(choice: IcChoice): Promise<void> {
    if (this.proving || !this.provable(choice)) return;
    const ps = this.ic.provingStage!;
    this.proving = true;
    this.stopProofRequested = false;
    this.proofProgress = null;
    let report: StageSearchReport | null = null;
    try {
      // One call per batch; stateless + resumable server-side.
      for (let i = 0; i < this.PROOF_MAX_CALLS; i++) {
        report = await this.msimService.runStageSearch(
          ps.msim, ps.stageKey, this.PROOF_BATCH,
          choice.substanceParams, choice.key);
        this.proofProgress = report;
        if (report.error || report.achieved || report.exhausted
            || this.stopProofRequested) break;
      }
    } catch (err: any) {
      this.statusMessage = `Proof check failed: ${err?.message || err}`;
    } finally {
      this.proving = false;
    }
    if (report && (report.achieved || report.exhausted)) {
      this.proofService.set(ps.msim, ps.stageKey, choice.key, choice.label, report);
      if (this.selectedKey === choice.key) this.applyProof(choice, report);
    }
  }

  retryProof(): void {
    const choice = this.ic.choices.find(c => c.key === this.selectedKey);
    if (!choice || !this.provable(choice)) return;
    const ps = this.ic.provingStage!;
    this.proofService.clear(ps.msim, ps.stageKey, choice.key, choice.label);
    this.selectedProof = null;
    void this.runProof(choice);
  }

  /** A finished proof lands on the selected choice: PROVEN switches the
   *  overrides to the derived values; IMPOSSIBLE blocks the run. */
  private applyProof(choice: IcChoice, report: StageSearchReport): void {
    this.selectedProof = report;
    if (report.achieved) {
      const proven = report.deriveResolved?.params?.[this.ic.targetSimulationRef];
      if (proven && Object.keys(proven).length) {
        this.paramSource = 'proven';
        this.paramOverrides = this.buildOverrides(proven);
        this.updateParamSummary();
        this.scheduleValidate();
      }
    }
  }

  provenSummary(winner: NonNullable<StageSearchReport['winner']>): string {
    const c = winner.candidate ?? {};
    const d = (winner.derivedValues ?? {}) as Record<string, unknown>;
    const parts: string[] = [];
    if (typeof c['target_temp'] === 'number') parts.push(`solid at ${c['target_temp']} K`);
    if (typeof c['pressure_pa'] === 'number') parts.push(`${(c['pressure_pa'] / 1000)} kPa`);
    const mass = Number(d['ball_mass']);
    const radius = Number(d['ball_radius']);
    const density = Number(d['ball_density']);
    const ball: string[] = [];
    if (isFinite(mass)) ball.push(`${mass.toFixed(2)} kg`);
    if (isFinite(radius)) ball.push(`Ø${(radius * 200).toFixed(0)} cm`);
    if (isFinite(density)) ball.push(`${density.toFixed(0)} kg/m³`);
    if (ball.length) parts.push(`ball: ${ball.join(', ')}`);
    return parts.join(' — ') || 'a valid solid ball exists';
  }

  candidateText(candidate: Record<string, number> | null | undefined): string {
    if (!candidate) return '';
    return Object.entries(candidate)
      .map(([k, v]) => k === 'pressure_pa' ? `${v / 1000} kPa`
        : k === 'target_temp' ? `${v} K` : `${k} = ${v}`)
      .join(', ');
  }

  // ---------------------------------------------------------------
  // Overrides + validation (unchanged contract from Phase 4)
  // ---------------------------------------------------------------

  /** base params + derivedParams (safe arithmetic over the values, with
   *  pi available — NO eval). A derived expression that fails is
   *  skipped; the backend still validates whatever we send. */
  private buildOverrides(base: Record<string, number>): Record<string, number> {
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(base)) {
      if (typeof v === 'number' && isFinite(v)) out[k] = v;
    }
    for (const [param, expr] of Object.entries(this.ic.derivedParams ?? {})) {
      try {
        out[param] = evaluateExpression(String(expr), out);
      } catch { /* skipped — expression referenced something unset */ }
    }
    return out;
  }

  private updateParamSummary(): void {
    this.paramSummary = Object.entries(this.paramOverrides)
      .map(([k, v]) => `${k}=${Number(v.toPrecision(4))}`)
      .join('  ');
  }

  private scheduleValidate(): void {
    this.verdict = null;
    this.validating = true;
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => this.validate(), this.DEBOUNCE_MS);
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
    if (!this.selectedKey || this.creating || this.selectedImpossible) return;
    const choice = this.ic.choices.find(c => c.key === this.selectedKey);
    this.creating = true;
    this.statusMessage = 'Creating run…';
    try {
      const provenNote = this.paramSource === 'proven' ? ' (proven)' : '';
      const created = await this.runService.create(
        this.ic.targetSimulationRef,
        `Pendulum — ${choice?.label ?? this.selectedKey} bob${provenNote}`,
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
