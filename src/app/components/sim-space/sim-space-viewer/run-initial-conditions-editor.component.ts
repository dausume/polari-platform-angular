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
  Component,
  EventEmitter,
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
} from '@services/sim-space/simulation-run.service';

/** What the editor reports up to its parent. */
export interface RunInitialConditionsState {
  overrides: Record<string, Record<string, unknown>>;
  /** Per-run dt in seconds. 0 = inherit from the sim def. */
  timeStepSeconds: number;
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
        <p class="hint">
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
            <input class="field-input dt-input"
                   type="text"
                   [placeholder]="formatValue(defaultDtSeconds)"
                   [value]="dtOverride"
                   (input)="onDtEdit($any($event.target).value)" />
            <button mat-icon-button class="clear-btn"
                    *ngIf="dtOverride"
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
                  *ngIf="overrideCountFor(cls.name) > 0">
              {{ overrideCountFor(cls.name) }} edited
            </span>
          </button>

          <ul class="field-list" *ngIf="isClassOpen(cls.name)">
            <li class="field-row" *ngFor="let field of cls.fieldList">
              <label class="field-label">
                <code class="field-name">{{ field }}</code>
                <span class="default-hint muted small"
                      [class.is-default]="!hasOverride(cls.name, field)"
                      [matTooltip]="defaultTooltip(cls.name, field)">
                  default: {{ formatValue(cls.baseline[field]) }}
                </span>
              </label>
              <input class="field-input"
                     type="text"
                     [placeholder]="formatValue(cls.baseline[field])"
                     [value]="overrideStringFor(cls.name, field)"
                     (input)="onFieldEdit(cls.name, field, $any($event.target).value)" />
              <button mat-icon-button class="clear-btn"
                      *ngIf="hasOverride(cls.name, field)"
                      (click)="clearOverride(cls.name, field)"
                      matTooltip="Reset to default">
                <mat-icon>refresh</mat-icon>
              </button>
            </li>
          </ul>
        </section>

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
      grid-template-columns: minmax(0, 1fr) minmax(120px, 1fr) auto;
      align-items: center;
      gap: 8px;
    }
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
  }> = [];

  /** User's per-class overrides. Strings here so we don't strip the
   *  user's "0." mid-typing — parsed on emit. */
  private overrides: Record<string, Record<string, string>> = {};

  /** Per-class open/closed state. Defaults to open on first load so
   *  the user sees what's editable; collapses preserve across edits. */
  private classOpen: Record<string, boolean> = {};

  loadingClasses = false;
  /** Raw dt override string from the input — empty = inherit default. */
  dtOverride: string = '';
  state: RunInitialConditionsState = {
    overrides: {},
    timeStepSeconds: 0,
    valid: true,
    hasValidator: false,
    reason: '',
    error: null,
    validating: false,
  };

  // Expose Object to the template (no built-in pipe for `keys` length).
  readonly Object = Object;

  private editPing$ = new Subject<void>();
  private editSub: Subscription;

  constructor(private runService: SimulationRunService) {
    this.editSub = this.editPing$
      .pipe(debounce(() => timer(400)))
      .subscribe(() => this.runValidation());
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['simulationDefinitionName']) {
      this.reloadBaseline();
    }
  }

  ngOnDestroy(): void {
    this.editSub.unsubscribe();
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
      this.classes = (resp.simStateClasses || []).map(name => {
        const block: InitialConditionsForClass = ic[name] ?? { classDefaults: {}, simOverrides: {} };
        const baseline = { ...(block.classDefaults || {}), ...(block.simOverrides || {}) };
        return {
          name,
          baseline,
          fieldList: Object.keys(baseline).sort(),
        };
      });
      // Reset overrides scaffolding (preserve nothing across sim switches).
      this.overrides = Object.fromEntries(this.classes.map(c => [c.name, {}]));
      // Default every class to open; subsequent toggles persist.
      this.classOpen = Object.fromEntries(this.classes.map(c => [c.name, true]));
      this.runValidation();   // initial verdict for the unchanged baseline
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
    if (this.overrides[cls]) {
      delete this.overrides[cls][field];
    }
    this.emitState();
    this.editPing$.next();
  }

  onDtEdit(raw: string): void {
    this.dtOverride = raw;
    this.emitState();
    // dt change doesn't affect validity — no need to re-validate.
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
        overrides: this.parsedOverrides(),
        timeStepSeconds: this.parsedDt(),
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
    };
    this.stateChange.emit(this.state);
  }
}
