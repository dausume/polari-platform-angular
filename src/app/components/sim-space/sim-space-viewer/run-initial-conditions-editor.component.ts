/**
 * @cross-cutting
 * @tags @xc:bindings
 * @consumers
 *   - SimulationRunPanelComponent ("Configure initial conditions" section)
 * @impact-on-edit
 *   Live debounced validation surface — emits the current proposed
 *   per-class overrides as the user edits, plus the latest validator
 *   verdict so the parent can gate "Create Run" on `valid=true`.
 *
 * Per-class editable initial-conditions form. Pulls the participating
 * *SimState classes + their merged class-default + sim-def-override
 * baseline from `/api/simulations/{simRef}/solutions`. Lets the user
 * tweak any field for THIS run only; debounces 400 ms after typing
 * stops, then calls `/validate-initial-conditions` and surfaces the
 * verdict inline.
 */

import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Inject,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatButtonModule } from '@angular/material/button';
import { Subject, Subscription, timer } from 'rxjs';
import { debounce } from 'rxjs/operators';

import {
  SimulationRunService,
  InitialConditionsForClass,
  FieldPoliciesForClass,
  FieldSavePolicy,
  FieldSaveRule,
  StorageEstimate,
} from '@services/sim-space/simulation-run.service';
import { XR_PANEL_CONTEXT } from '@models/xr/xr-panel-context';

/** What the editor reports up to its parent. */
export interface RunInitialConditionsState {
  overrides: Record<string, Record<string, unknown>>;
  /** Per-run dt in seconds. 0 = inherit from the sim def. */
  timeStepSeconds: number;
  /** Per-`<class>.<field>` save-rule overrides this run will apply on
   *  top of the sim def's field policies. Cleared entries fall back to
   *  the effective class/sim default. */
  fieldSaveOverrides: Record<string, FieldSaveRule>;
  /** Latest live estimate of how much data this configuration would
   *  persist. `null` while loading or when the simulation has no
   *  participating classes. */
  storageEstimate: StorageEstimate | null;
  /** True when the validator reports valid OR the sim has no
   *  validator OR the proposed values are unchanged from class
   *  defaults (in which case validation is implicitly OK). */
  valid: boolean;
  hasValidator: boolean;
  reason: string;
  error: string | null;
  /** Whether the editor is currently mid-flight asking the backend to
   *  validate. Parents can disable "Create Run" while this is true. */
  validating: boolean;
}

@Component({
  standalone: true,
  selector: 'run-initial-conditions-editor',
  imports: [
    CommonModule, FormsModule, MatIconModule, MatTooltipModule,
    MatProgressSpinnerModule, MatButtonModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="editor">
      <div class="loading" *ngIf="loadingClasses">
        <mat-progress-spinner diameter="16" mode="indeterminate"></mat-progress-spinner>
        <span class="muted small">Loading class defaults…</span>
      </div>

      <p class="muted small" *ngIf="!loadingClasses && !classes.length">
        No participating *SimState classes are declared for this simulation —
        add some via the sim definition's
        <code>participating_sim_state_classes_json</code> first.
      </p>

      <ng-container *ngIf="!loadingClasses && classes.length">
        <div class="locked-banner" *ngIf="locked">
          <mat-icon>lock</mat-icon>
          <div>
            <strong>Initial conditions are locked.</strong>
            They were committed to step 0 when this run was set up — create
            a new run to use different values.
          </div>
        </div>

        <p class="hint" *ngIf="!locked">
          Tweak any field for <em>this run only</em>. Empty values fall back
          to the class default. The simulation's validator (if any) checks
          your edits after a short pause and surfaces a verdict below.
        </p>

        <section class="dt-block">
          <label class="dt-label">
            <mat-icon class="dt-icon">schedule</mat-icon>
            <span>Timestep size (s)</span>
            <span class="default-hint muted small"
                  [class.is-default]="!dtOverride"
                  matTooltip="Falls back to the sim def's value when blank">
              default: {{ formatValue(defaultDtSeconds) }}
            </span>
          </label>
          <div class="dt-row">
            <button type="button" class="xr-step-btn"
                    *ngIf="xrContext && !locked"
                    (click)="stepDt(-1)">&#8722;</button>
            <input class="field-input dt-input"
                   type="text"
                   [placeholder]="formatValue(defaultDtSeconds)"
                   [value]="dtOverride"
                   [readonly]="locked"
                   [class.locked]="locked"
                   (input)="onDtEdit($any($event.target).value)" />
            <button type="button" class="xr-step-btn"
                    *ngIf="xrContext && !locked"
                    (click)="stepDt(1)">+</button>
            <button mat-icon-button class="clear-btn"
                    *ngIf="dtOverride && !locked"
                    (click)="onDtEdit('')"
                    matTooltip="Reset to sim default">
              <mat-icon>refresh</mat-icon>
            </button>
          </div>
        </section>

        <section class="class-block" *ngFor="let cls of classes">
          <button type="button" class="class-header"
                  (click)="toggleClassOpen(cls.name)"
                  [attr.aria-expanded]="isClassOpen(cls.name)">
            <mat-icon class="chevron">
              {{ isClassOpen(cls.name) ? 'expand_less' : 'expand_more' }}
            </mat-icon>
            <mat-icon>category</mat-icon>
            <span class="class-name mono">{{ cls.name }}</span>
            <span class="class-tag muted small">
              {{ Object.keys(cls.baseline).length }} field{{ Object.keys(cls.baseline).length === 1 ? '' : 's' }}
            </span>
            <span class="class-override-tag muted small"
                  *ngIf="!locked && overrideCountFor(cls.name) > 0">
              {{ overrideCountFor(cls.name) }} edited
            </span>
          </button>

          <ul class="field-list" *ngIf="isClassOpen(cls.name)"
              [class.xr]="xrContext">
            <li class="field-row" *ngFor="let field of cls.fieldList">
              <label class="field-label">
                <code class="field-name">{{ field }}</code>
                <span class="default-hint muted small"
                      [class.is-default]="!hasOverride(cls.name, field)"
                      [matTooltip]="defaultTooltip(cls.name, field)">
                  default: {{ formatValue(cls.baseline[field]) }}
                </span>
              </label>
              <!-- XR: no keyboard in-session — numeric fields edit by
                   ±steppers (Q-C: steppers-first, free text stays a
                   flat-mode task). Step = one decade under the value's
                   own magnitude. -->
              <button type="button" class="xr-step-btn"
                      *ngIf="xrContext && !locked && isNumericField(cls.name, field)"
                      (click)="stepField(cls.name, field, -1)">&#8722;</button>
              <input class="field-input"
                     type="text"
                     [placeholder]="formatValue(cls.baseline[field])"
                     [value]="fieldDisplayValue(cls.name, field)"
                     [readonly]="locked"
                     [class.locked]="locked"
                     (input)="onFieldEdit(cls.name, field, $any($event.target).value)" />
              <button type="button" class="xr-step-btn"
                      *ngIf="xrContext && !locked && isNumericField(cls.name, field)"
                      (click)="stepField(cls.name, field, 1)">+</button>
              <button type="button" class="policy-chip"
                      [class.policy-core]="effectivePolicy(cls.name, field) === 'core'"
                      [class.policy-derivable]="effectivePolicy(cls.name, field) === 'derivable'"
                      [class.policy-skip]="effectivePolicy(cls.name, field) === 'skip'"
                      [class.is-overridden]="hasPolicyOverride(cls.name, field)"
                      [disabled]="locked"
                      (click)="cyclePolicy(cls.name, field)"
                      [matTooltip]="policyTooltip(cls.name, field)">
                {{ effectivePolicy(cls.name, field) }}
              </button>
              <button mat-icon-button class="clear-btn"
                      *ngIf="hasOverride(cls.name, field) && !locked"
                      (click)="clearOverride(cls.name, field)"
                      matTooltip="Reset value to default">
                <mat-icon>refresh</mat-icon>
              </button>
            </li>
          </ul>
        </section>

        <div class="storage-bar"
             *ngIf="state.storageEstimate"
             [class.storage-static]="state.storageEstimate.usesStaticEstimates">
          <mat-icon class="storage-icon">storage</mat-icon>
          <div class="storage-text">
            <div>
              <strong>{{ state.storageEstimate.normalCaseHuman }}</strong>
              normal case
              <span class="muted small"
                    *ngIf="state.storageEstimate.minCaseHuman !== state.storageEstimate.maxCaseHuman">
                ({{ state.storageEstimate.minCaseHuman }} – {{ state.storageEstimate.maxCaseHuman }})
              </span>
              <span class="muted small">
                over {{ state.storageEstimate.totalSteps }} step{{ state.storageEstimate.totalSteps === 1 ? '' : 's' }}
              </span>
            </div>
            <div class="storage-static-warning"
                 *ngIf="state.storageEstimate.usesStaticEstimates"
                 matTooltip="No measured byte samples yet — using conservative defaults. Numbers will tighten as more runs commit.">
              <mat-icon>info_outline</mat-icon>
              Estimate based on default sizes
            </div>
          </div>
        </div>

        <div class="verdict-bar"
             [class.verdict-ok]="!state.validating && state.valid && state.hasValidator"
             [class.verdict-bad]="!state.validating && !state.valid"
             [class.verdict-none]="!state.validating && !state.hasValidator">
          <mat-progress-spinner *ngIf="state.validating"
                                diameter="14" mode="indeterminate">
          </mat-progress-spinner>
          <mat-icon *ngIf="!state.validating && state.valid && state.hasValidator">check_circle</mat-icon>
          <mat-icon *ngIf="!state.validating && !state.valid">error_outline</mat-icon>
          <mat-icon *ngIf="!state.validating && !state.hasValidator && state.valid">info_outline</mat-icon>

          <span class="verdict-text" *ngIf="state.validating">Validating…</span>
          <span class="verdict-text" *ngIf="!state.validating && state.valid && state.hasValidator">
            Initial conditions look good.
          </span>
          <span class="verdict-text" *ngIf="!state.validating && !state.valid && state.reason">
            {{ state.reason }}
          </span>
          <span class="verdict-text" *ngIf="!state.validating && !state.valid && !state.reason && state.error">
            Validator error: {{ state.error }}
          </span>
          <span class="verdict-text" *ngIf="!state.validating && !state.hasValidator && state.valid">
            No validator wired for this simulation — proceeding without checks.
          </span>
        </div>
      </ng-container>
    </div>
  `,
  styles: [`
    .editor {
      display: flex;
      flex-direction: column;
      gap: 10px;
      max-height: 380px;
      overflow-y: auto;
    }
    .loading {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .hint {
      margin: 0;
      font-size: 11px;
      color: var(--text-secondary, #666);
      line-height: 1.4;
    }
    .class-block {
      border: 1px solid var(--border-light, #e0e3e9);
      border-radius: 6px;
      background: var(--surface-secondary, #fafbfc);
    }
    .class-header {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 6px 10px;
      border: none;
      width: 100%;
      background: white;
      border-bottom: 1px solid var(--border-light, #e0e3e9);
      border-top-left-radius: 6px;
      border-top-right-radius: 6px;
      cursor: pointer;
      text-align: left;
      font: inherit;
      color: inherit;
    }
    .class-header:hover { background: #f3f7fc; }
    .class-header[aria-expanded="false"] { border-bottom-color: transparent; }
    .class-header mat-icon { font-size: 18px; width: 18px; height: 18px; color: #1976d2; }
    .class-header .chevron { color: #555; }
    .class-name { font-size: 12px; font-weight: 600; color: #0d47a1; flex: 1 1 auto; }
    .class-tag { white-space: nowrap; }
    .class-override-tag {
      white-space: nowrap;
      background: #e3f2fd;
      color: #0d47a1;
      padding: 1px 6px;
      border-radius: 999px;
      font-weight: 600;
    }
    .field-list { list-style: none; margin: 0; padding: 6px 10px; display: flex; flex-direction: column; gap: 4px; }
    .field-row {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(120px, 1fr) auto auto;
      align-items: center;
      gap: 6px;
    }
    /* XR layout: label | − | input | + | policy | clear. */
    .field-list.xr .field-row {
      grid-template-columns:
        minmax(0, 1fr) auto minmax(90px, 1fr) auto auto auto;
    }
    .xr-step-btn {
      font-size: 18px; line-height: 1; font-weight: 700;
      padding: 8px 14px;
      border: 1px solid #b9d6f6; border-radius: 6px;
      background: #e3f2fd; color: #0d47a1;
      cursor: pointer;
    }
    .policy-chip {
      border: 1px solid var(--border-light, #d6d9df);
      border-radius: 999px;
      padding: 2px 8px;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      font-weight: 600;
      cursor: pointer;
      background: white;
      font-family: inherit;
    }
    .policy-chip:hover { filter: brightness(0.97); }
    .policy-chip.policy-core      { background: #e6f4ea; color: #1e7e34; border-color: #b6e0c0; }
    .policy-chip.policy-derivable { background: #e3f2fd; color: #0d47a1; border-color: #b9d6f6; }
    .policy-chip.policy-skip      { background: #fdecea; color: #b71c1c; border-color: #f4b4b0; }
    .policy-chip.is-overridden    { box-shadow: 0 0 0 2px rgba(25, 118, 210, 0.18); }
    .field-label { display: flex; flex-direction: column; min-width: 0; }
    .field-name { font-size: 12px; color: #333; font-family: monospace; }
    .default-hint { font-size: 10px; color: var(--text-tertiary, #888); }
    .default-hint.is-default { color: #2e7d32; }
    .field-input {
      padding: 4px 6px;
      border: 1px solid var(--border-light, #e0e3e9);
      border-radius: 3px;
      background: white;
      color: var(--text-primary, #222);
      font-size: 12px;
      font-family: monospace;
      box-sizing: border-box;
    }
    .field-input:focus { outline: none; border-color: #1976d2; }
    .field-input.locked {
      background: #f1f3f5;
      color: #555;
      cursor: default;
    }
    .field-input.locked:focus { border-color: var(--border-light, #e0e3e9); }
    .policy-chip:disabled { opacity: 0.85; cursor: default; }
    .locked-banner {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      padding: 8px 10px;
      border-radius: 6px;
      background: #eef5ff;
      color: #0d47a1;
      border: 1px solid #b9d6f6;
      font-size: 11px;
      line-height: 1.4;
    }
    .locked-banner mat-icon { font-size: 16px; width: 16px; height: 16px; flex: 0 0 16px; margin-top: 1px; }
    .clear-btn { width: 24px; height: 24px; }
    .clear-btn mat-icon { font-size: 14px; width: 14px; height: 14px; line-height: 14px; }
    .verdict-bar {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 10px;
      border-radius: 6px;
      font-size: 12px;
      line-height: 1.3;
      border: 1px solid transparent;
    }
    .verdict-bar mat-icon { font-size: 16px; width: 16px; height: 16px; flex: 0 0 16px; }
    .verdict-ok    { background: #e6f4ea; color: #1e7e34; border-color: #b6e0c0; }
    .verdict-bad   { background: #fdecea; color: #b71c1c; border-color: #f4b4b0; }
    .verdict-none  { background: #fff8e1; color: #8d6e00; border-color: #ffe082; }
    .dt-block {
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding: 6px 10px;
      background: white;
      border: 1px solid var(--border-light, #e0e3e9);
      border-radius: 6px;
    }
    .dt-label { display: flex; align-items: center; gap: 6px; font-size: 12px; color: #333; }
    .dt-icon  { font-size: 16px; width: 16px; height: 16px; color: #1976d2; }
    .dt-row   { display: flex; gap: 6px; align-items: center; }
    .dt-input { flex: 1 1 auto; }

    .storage-bar {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      padding: 8px 10px;
      border-radius: 6px;
      font-size: 11px;
      line-height: 1.4;
      background: #eef5ff;
      color: #0d47a1;
      border: 1px solid #b9d6f6;
    }
    .storage-bar.storage-static {
      background: #fff8e1;
      color: #6d4c00;
      border-color: #ffe082;
    }
    .storage-bar .storage-icon { font-size: 16px; width: 16px; height: 16px; flex: 0 0 16px; margin-top: 1px; }
    .storage-text { flex: 1 1 auto; }
    .storage-static-warning {
      display: flex; align-items: center; gap: 4px;
      margin-top: 2px;
      font-size: 10px;
      font-style: italic;
      opacity: 0.85;
    }
    .storage-static-warning mat-icon { font-size: 12px; width: 12px; height: 12px; }
    .muted { color: var(--text-secondary, #888); }
    .small { font-size: 10px; }
    .mono  { font-family: monospace; }
    code   { background: rgba(0,0,0,0.04); padding: 0 3px; border-radius: 2px; font-size: 11px; }
  `]
})
export class RunInitialConditionsEditorComponent implements OnChanges, OnDestroy {

  /** The sim def we're editing initial conditions for. */
  @Input() simulationDefinitionName: string = '';

  /** The sim def's `time_step_seconds` — surfaced as the dt input's
   *  placeholder so the user sees what they'd be inheriting if they
   *  leave the override blank. Editor itself doesn't fetch this; the
   *  parent passes it in (the run-panel already has the sim def in
   *  scope). 0 = unknown / not yet loaded. */
  @Input() defaultDtSeconds: number = 0;

  /** When true, the IC editor renders as a read-only summary — fields,
   *  dt, and policy chips are no longer editable. Set by the parent
   *  once a run has been initialized (step-0 row written), at which
   *  point the saved values are immutable and the user has to create
   *  a new run to change them. */
  @Input() locked: boolean = false;

  /** The selected run, when one is bound. Needed (only) while locked to
   *  fetch that run's committed step-0 values so they replace the
   *  editable entries. Null = nothing to fetch. */
  @Input() runName: string | null = null;

  /** Live state — emitted on every change so the parent can gate
   *  "Create Run" on `valid=true` and pass `overrides` into the
   *  create call. */
  @Output() stateChange = new EventEmitter<RunInitialConditionsState>();

  /** Per-class baseline (class defaults + sim-def overrides merged).
   *  Keyed by class name. */
  classes: Array<{
    name: string;
    baseline: Record<string, unknown>;
    fieldList: string[];
    /** Per-field effective policy BEFORE per-run overrides — class
     *  declaration merged with sim-def overrides. The user's run-level
     *  override (when present) wins over this. */
    effectivePolicies: Record<string, FieldSavePolicy>;
  }> = [];

  /** Per-run policy overrides keyed by `<class>.<field>`. Cleared
   *  entries fall back to the class+sim effective policy. */
  private policyOverrides: Record<string, FieldSavePolicy> = {};

  /** User's per-class overrides. Strings here so we don't strip the
   *  user's "0." mid-typing — parsed on emit. */
  private overrides: Record<string, Record<string, string>> = {};

  /** When locked, the run's actual committed step-0 field values per
   *  class (fetched from the backend). Displayed read-only in place of
   *  the editable override entries. */
  private lockedValues: Record<string, Record<string, unknown>> = {};

  /** Per-class open/closed state. Defaults to open on first load so
   *  the user sees what's editable; collapses preserve across edits. */
  private classOpen: Record<string, boolean> = {};

  loadingClasses = false;
  /** Raw dt override string from the input — empty = inherit default. */
  dtOverride: string = '';
  state: RunInitialConditionsState = {
    overrides: {},
    timeStepSeconds: 0,
    fieldSaveOverrides: {},
    storageEstimate: null,
    valid: true,
    hasValidator: false,
    reason: '',
    error: null,
    validating: false,
  };

  // Expose Object to the template (no built-in pipe for `keys` length).
  readonly Object = Object;

  private editPing$ = new Subject<void>();
  private estimatePing$ = new Subject<void>();
  private editSub: Subscription;
  private estimateSub: Subscription;

  constructor(
    private runService: SimulationRunService,
    private cdr: ChangeDetectorRef,
    /** True when mounted in the off-screen XR panel host — numeric
     *  fields grow ±steppers (no keyboard in-session, Q-C). */
    @Inject(XR_PANEL_CONTEXT) public xrContext: boolean,
  ) {
    this.editSub = this.editPing$
      .pipe(debounce(() => timer(400)))
      .subscribe(() => this.runValidation());
    this.estimateSub = this.estimatePing$
      .pipe(debounce(() => timer(400)))
      .subscribe(() => this.runEstimate());
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['simulationDefinitionName']) {
      this.reloadBaseline();
    }
    // Once locked, swap the editable entries for the run's real step-0
    // values. Clear them again if it ever unlocks (e.g. New Run).
    if (changes['locked'] || changes['runName']) {
      if (this.locked && this.runName) {
        this.loadLockedStep0();
      } else {
        this.lockedValues = {};
      }
    }
  }

  /** Fetch the committed step-0 row per class for the locked run so the
   *  field entries display the actual initial conditions. */
  private async loadLockedStep0(): Promise<void> {
    const runName = this.runName;
    if (!runName) return;
    try {
      const resp = await this.runService.currentStateFor(runName, 0);
      this.lockedValues = resp.perClass ?? {};
    } catch (err) {
      console.warn('[RunInitialConditionsEditor] step-0 fetch failed:', err);
      this.lockedValues = {};
    }
    this.cdr.markForCheck();
  }

  /** Value shown in a field input: the run's committed step-0 value when
   *  locked, otherwise the user's in-progress override string. */
  fieldDisplayValue(cls: string, field: string): string {
    if (this.locked) {
      const v = this.lockedValues[cls]?.[field];
      if (v !== undefined && v !== null) return this.formatValue(v);
      return '';
    }
    return this.overrideStringFor(cls, field);
  }

  ngOnDestroy(): void {
    this.editSub.unsubscribe();
    this.estimateSub.unsubscribe();
  }

  /** Schedule a debounced estimate refresh — every policy/dt edit
   *  bumps this so the readout reflects the latest config. */
  private requestEstimate(): void {
    this.estimatePing$.next();
  }

  private async runEstimate(): Promise<void> {
    if (!this.simulationDefinitionName) return;
    try {
      const est = await this.runService.estimateStorage(
        this.simulationDefinitionName,
        this.parsedFieldOverrides(),
        this.parsedDt(),
      );
      this.state = { ...this.state, storageEstimate: est };
    } catch (err) {
      // Non-fatal — just leave the previous estimate visible.
      console.warn('[RunInitialConditionsEditor] estimateStorage failed:', err);
    }
    this.stateChange.emit(this.state);
  }

  private async reloadBaseline(): Promise<void> {
    this.classes = [];
    this.overrides = {};
    this.emitState();
    if (!this.simulationDefinitionName) return;

    this.loadingClasses = true;
    try {
      const resp = await this.runService.solutionsFor(this.simulationDefinitionName);
      const ic = resp.initialConditions || {};
      const fp = resp.fieldPolicies || {};
      this.classes = (resp.simStateClasses || []).map(name => {
        const block: InitialConditionsForClass = ic[name] ?? { classDefaults: {}, simOverrides: {} };
        const baseline = { ...(block.classDefaults || {}), ...(block.simOverrides || {}) };
        const polBlock: FieldPoliciesForClass = fp[name] ?? { classDefaults: {}, simOverrides: {} };
        const effective: Record<string, FieldSavePolicy> = {};
        for (const f of Object.keys(baseline)) {
          // Class default (or 'core' fallback), then sim-def override
          // policy if present.
          effective[f] = (polBlock.classDefaults[f] as FieldSavePolicy) || 'core';
          const ov = polBlock.simOverrides[f];
          if (ov && ov.policy) effective[f] = ov.policy;
        }
        return {
          name,
          baseline,
          fieldList: Object.keys(baseline).sort(),
          effectivePolicies: effective,
        };
      });
      // Reset overrides scaffolding (preserve nothing across sim switches).
      this.overrides = Object.fromEntries(this.classes.map(c => [c.name, {}]));
      this.policyOverrides = {};
      // Default every class to open; subsequent toggles persist.
      this.classOpen = Object.fromEntries(this.classes.map(c => [c.name, true]));
      this.runValidation();   // initial verdict for the unchanged baseline
      this.requestEstimate(); // initial storage estimate
    } catch (err) {
      console.warn('[RunInitialConditionsEditor] solutionsFor failed:', err);
    } finally {
      this.loadingClasses = false;
      this.emitState();
    }
  }

  hasOverride(cls: string, field: string): boolean {
    return !!this.overrides[cls]?.[field];
  }

  overrideCountFor(cls: string): number {
    return Object.keys(this.overrides[cls] || {}).length;
  }

  isClassOpen(cls: string): boolean {
    return this.classOpen[cls] !== false;
  }

  toggleClassOpen(cls: string): void {
    this.classOpen[cls] = !this.isClassOpen(cls);
  }

  overrideStringFor(cls: string, field: string): string {
    return this.overrides[cls]?.[field] ?? '';
  }

  defaultTooltip(cls: string, field: string): string {
    const def = this.classes.find(c => c.name === cls)?.baseline[field];
    if (this.hasOverride(cls, field)) {
      return `Reverts to ${this.formatValue(def)} when cleared`;
    }
    return `Class default (no override)`;
  }

  formatValue(v: unknown): string {
    if (v === null || v === undefined) return '(unset)';
    if (typeof v === 'number') {
      // 6 sig figs is plenty for an inline default hint.
      return parseFloat(v.toPrecision(6)).toString();
    }
    return String(v);
  }

  onFieldEdit(cls: string, field: string, raw: string): void {
    if (this.locked) return;
    if (!this.overrides[cls]) this.overrides[cls] = {};
    if (raw === '') {
      delete this.overrides[cls][field];
    } else {
      this.overrides[cls][field] = raw;
    }
    this.emitState();
    this.editPing$.next();
  }

  clearOverride(cls: string, field: string): void {
    if (this.locked) return;
    if (this.overrides[cls]) {
      delete this.overrides[cls][field];
    }
    this.emitState();
    this.editPing$.next();
  }

  onDtEdit(raw: string): void {
    if (this.locked) return;
    this.dtOverride = raw;
    this.emitState();
    // dt change doesn't affect validity — but does affect the
    // storage estimate (more steps = more rows).
    this.requestEstimate();
  }

  // ─────────────────────── XR ±steppers (Q-C) ───────────────────────

  isNumericField(cls: string, field: string): boolean {
    const baseline = this.classes.find(c => c.name === cls)
      ?.baseline[field];
    return typeof baseline === 'number';
  }

  /** One decade under the value's own magnitude — 9.8 steps by 0.1,
   *  1500 steps by 100, 0.02 steps by 0.001; zero steps by 0.1. */
  private stepSizeFor(value: number): number {
    const magnitude = Math.abs(value);
    if (!Number.isFinite(magnitude) || magnitude === 0) return 0.1;
    return Math.pow(10, Math.floor(Math.log10(magnitude)) - 1);
  }

  stepField(cls: string, field: string, direction: number): void {
    if (this.locked) return;
    const baseline = this.classes.find(c => c.name === cls)
      ?.baseline[field];
    if (typeof baseline !== 'number') return;
    const raw = this.overrideStringFor(cls, field);
    const current = raw !== '' && Number.isFinite(Number(raw))
      ? Number(raw) : baseline;
    const next = current
      + direction * this.stepSizeFor(current || baseline);
    const rounded = parseFloat(next.toPrecision(10));
    this.onFieldEdit(cls, field, String(rounded));
    this.cdr.markForCheck();
  }

  stepDt(direction: number): void {
    if (this.locked) return;
    const base = this.parsedDt() || this.defaultDtSeconds || 0.1;
    let next = base + direction * this.stepSizeFor(base);
    // dt must stay positive — stepping below zero halves instead.
    if (next <= 0) next = base / 2;
    this.onDtEdit(String(parseFloat(next.toPrecision(10))));
    this.cdr.markForCheck();
  }

  // ───────────────────────── per-field save policy ─────────────────────────

  private readonly POLICY_CYCLE: FieldSavePolicy[] = ['core', 'derivable', 'skip'];

  effectivePolicy(cls: string, field: string): FieldSavePolicy {
    const key = `${cls}.${field}`;
    if (this.policyOverrides[key]) return this.policyOverrides[key];
    return this.classes.find(c => c.name === cls)?.effectivePolicies[field] || 'core';
  }

  hasPolicyOverride(cls: string, field: string): boolean {
    return !!this.policyOverrides[`${cls}.${field}`];
  }

  cyclePolicy(cls: string, field: string): void {
    if (this.locked) return;
    const current = this.effectivePolicy(cls, field);
    const idx = this.POLICY_CYCLE.indexOf(current);
    const next = this.POLICY_CYCLE[(idx + 1) % this.POLICY_CYCLE.length];
    const baseline = this.classes.find(c => c.name === cls)?.effectivePolicies[field] || 'core';
    const key = `${cls}.${field}`;
    if (next === baseline) {
      // Cycling back to the class/sim baseline — clear the override.
      delete this.policyOverrides[key];
    } else {
      this.policyOverrides[key] = next;
    }
    this.emitState();
    this.requestEstimate();
  }

  policyTooltip(cls: string, field: string): string {
    const policy = this.effectivePolicy(cls, field);
    const baseline = this.classes.find(c => c.name === cls)?.effectivePolicies[field] || 'core';
    const overridden = this.hasPolicyOverride(cls, field);
    const meaning = {
      core: 'Persisted at every recorded step.',
      derivable: 'Not persisted — recompute on read from core fields.',
      skip: 'Never persisted under any condition.',
    } as Record<FieldSavePolicy, string>;
    const sourceHint = overridden
      ? ` (overriding the ${baseline} default for this run)`
      : '';
    return `${policy} — ${meaning[policy]}${sourceHint} Click to cycle.`;
  }

  private parsedFieldOverrides(): Record<string, FieldSaveRule> {
    const out: Record<string, FieldSaveRule> = {};
    for (const [key, policy] of Object.entries(this.policyOverrides)) {
      out[key] = { policy };
    }
    return out;
  }

  private parsedDt(): number {
    if (!this.dtOverride) return 0;
    const n = Number(this.dtOverride);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }

  /** Parse the string-form overrides into the typed shape the backend
   *  expects. Numeric-looking strings parse to numbers; 'true'/'false'
   *  parse to booleans; everything else stays a string. */
  private parsedOverrides(): Record<string, Record<string, unknown>> {
    const out: Record<string, Record<string, unknown>> = {};
    for (const cls of this.classes) {
      const raw = this.overrides[cls.name] || {};
      const parsed: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(raw)) {
        if (v === '' || v === null || v === undefined) continue;
        const baselineType = typeof cls.baseline[k];
        if (baselineType === 'number') {
          const n = Number(v);
          parsed[k] = Number.isFinite(n) ? n : v;
        } else if (baselineType === 'boolean') {
          parsed[k] = v === 'true' || v === '1';
        } else {
          // Best-effort number parse anyway when the baseline is unknown.
          const n = Number(v);
          parsed[k] = Number.isFinite(n) && /^-?\d/.test(v) ? n : v;
        }
      }
      if (Object.keys(parsed).length) out[cls.name] = parsed;
    }
    return out;
  }

  private async runValidation(): Promise<void> {
    if (!this.simulationDefinitionName) return;
    this.state = { ...this.state, validating: true };
    this.emitState();
    try {
      const resp = await this.runService.validateInitialConditions(
        this.simulationDefinitionName, this.parsedOverrides(),
      );
      this.state = {
        ...this.state,
        overrides: this.parsedOverrides(),
        timeStepSeconds: this.parsedDt(),
        fieldSaveOverrides: this.parsedFieldOverrides(),
        valid: resp.valid,
        hasValidator: resp.hasValidator,
        reason: resp.reason || '',
        error: resp.error,
        validating: false,
      };
    } catch (err: any) {
      this.state = {
        ...this.state,
        valid: false,
        hasValidator: this.state.hasValidator,
        reason: '',
        error: err?.message || String(err),
        validating: false,
      };
    }
    this.emitState();
  }

  private emitState(): void {
    this.state = {
      ...this.state,
      overrides: this.parsedOverrides(),
      timeStepSeconds: this.parsedDt(),
      fieldSaveOverrides: this.parsedFieldOverrides(),
    };
    this.stateChange.emit(this.state);
  }
}
