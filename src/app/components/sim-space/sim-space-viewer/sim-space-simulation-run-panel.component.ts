/**
 * @cross-cutting
 * @tags @xc:bindings, @xc:overlay
 * @consumers
 *   - SimSpaceViewer (mounted in the top-left next to / below the
 *     editor toolbar once that lands)
 * @impact-on-edit
 *   v1 ships only the "Step Once" path — the single-step coherence
 *   check. The continuous-run path lands once /run + STOMP streaming
 *   are wired; this component is the seam those land into.
 *
 * Minimal simulation run controller. Picks one SimulationRun in the
 * simulation associated with the current SimSpace, advances it one
 * step at a time, and shows a per-binding trace result so the user
 * can see whether the engine produced sensible output before
 * committing to a multi-step run.
 *
 * Reuses the no-code engine end-to-end via the backend: clicking Step
 * triggers `POST /api/simulations/runs/{name}/step` which composes
 * each per-class `SimulationExecutionSolution`'s no-code into a single tick.
 */

import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Inject,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatInputModule } from '@angular/material/input';

import {
  SimulationRunService,
  SimulationRunSummary,
  SimulationStepResult,
} from '@services/sim-space/simulation-run.service';
import {
  RunInitialConditionsEditorComponent,
  RunInitialConditionsState,
} from './run-initial-conditions-editor.component';
import { RunCurrentStateDisplayComponent } from './run-current-state-display.component';
import {
  formatTimeValue,
  TimeDisplayMode,
  TimeUnitId,
} from '@models/sim-space/time-units';
import { XR_PANEL_CONTEXT } from '@models/xr/xr-panel-context';

@Component({
  standalone: true,
  selector: 'sim-space-simulation-run-panel',
  imports: [
    CommonModule, FormsModule, MatIconModule, MatButtonModule,
    MatSelectModule, MatFormFieldModule, MatTooltipModule,
    MatProgressSpinnerModule, MatInputModule,
    RunInitialConditionsEditorComponent,
    RunCurrentStateDisplayComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="run-panel" [class.collapsed]="collapsed">
      <button type="button" class="run-header" (click)="collapsed = !collapsed"
              [attr.aria-expanded]="!collapsed">
        <mat-icon>play_circle</mat-icon>
        <span class="run-title">Live simulation</span>
        <span class="run-status" *ngIf="activeRun">{{ activeRun.status }}</span>
        <mat-icon class="collapse-chevron">{{ collapsed ? 'expand_more' : 'expand_less' }}</mat-icon>
      </button>

      <div class="run-body" *ngIf="!collapsed"
           [style.max-height]="bodyMaxHeight">
        <!-- Filter + +New row, always visible. Searches over the
             run name + label so a long list stays manageable. The
             filter box is flat-only: no keyboard in an XR session
             (the XR run picker is the ◀ ▶ cycler below). -->
        <div class="run-list-controls">
          <mat-form-field *ngIf="!xrContext" appearance="outline" subscriptSizing="dynamic" class="run-search">
            <mat-icon matPrefix>search</mat-icon>
            <input matInput placeholder="Filter runs…"
                   [(ngModel)]="runFilterText" (ngModelChange)="onFilterChange()">
          </mat-form-field>
          <!-- Always available: spins up a fresh, uninitialized run and
               switches the whole panel to it. The new run has no step 0,
               so it reads as not-initialized → IC editor unlocks and
               Set Initial Conditions appears for it. -->
          <button mat-stroked-button class="new-run-btn"
                  [disabled]="newRunInFlight || !simulationDefinitionName"
                  matTooltip="Create a fresh run and configure its initial conditions"
                  (click)="onStartNewRun()">
            <mat-icon *ngIf="!newRunInFlight">add</mat-icon>
            <mat-progress-spinner *ngIf="newRunInFlight" diameter="14" mode="indeterminate">
            </mat-progress-spinner>
            New Run
          </button>
          <button mat-stroked-button class="new-run-btn"
                  *ngIf="!selectedRunInitialized && selectedRunName"
                  [disabled]="newRunInFlight || !simulationDefinitionName || !icState.valid"
                  [matTooltip]="newRunDisabledReason"
                  (click)="onSetInitialConditions()">
            <mat-icon *ngIf="!newRunInFlight">add_task</mat-icon>
            <mat-progress-spinner *ngIf="newRunInFlight" diameter="14" mode="indeterminate">
            </mat-progress-spinner>
            Set Initial Conditions
          </button>
        </div>

        <!-- Per-class initial-conditions editor for the next fresh run.
             Debounced validation gates the New Run button. In XR the
             CONDITIONS page-panel owns this surface — the embedded
             accordion would duplicate it on the RUN quad. -->
        <details class="ic-editor-wrap" *ngIf="simulationDefinitionName && !xrContext" open>
          <summary class="ic-summary">
            <mat-icon>tune</mat-icon>
            <span>Configure initial conditions for next run</span>
            <span class="ic-status muted small"
                  [class.ic-status-ok]="icState.valid && icState.hasValidator"
                  [class.ic-status-bad]="!icState.valid">
              <ng-container *ngIf="icState.validating">checking…</ng-container>
              <ng-container *ngIf="!icState.validating && icState.valid && icState.hasValidator">✓ valid</ng-container>
              <ng-container *ngIf="!icState.validating && !icState.hasValidator && icState.valid">no validator</ng-container>
              <ng-container *ngIf="!icState.validating && !icState.valid">✗ invalid</ng-container>
            </span>
          </summary>
          <run-initial-conditions-editor
            [simulationDefinitionName]="simulationDefinitionName"
            [defaultDtSeconds]="defaultDtSeconds"
            [locked]="selectedRunInitialized"
            [runName]="selectedRunName"
            (stateChange)="onIcStateChange($event)">
          </run-initial-conditions-editor>
        </details>

        <details class="cs-display-wrap"
                 *ngIf="simulationDefinitionName && selectedRunInitialized"
                 open>
          <summary class="cs-summary">
            <mat-icon>insights</mat-icon>
            <span>Current state</span>
          </summary>
          <run-current-state-display
            [runName]="selectedRunName"
            [refreshKey]="currentStateRefreshKey"
            [timeUnit]="timeUnit"
            [timeDisplayMode]="timeDisplayMode">
          </run-current-state-display>
        </details>

        <ng-container *ngIf="filteredRuns.length === 0 && !runs.length">
          <div class="empty muted">
            No SimulationRun exists for this scene yet. Click <strong>New Run</strong>
            to spin up a live one and Step Once from t = 0.
          </div>
        </ng-container>

        <ng-container *ngIf="runs.length > 0">
          <mat-form-field *ngIf="!xrContext" appearance="outline" subscriptSizing="dynamic" class="run-select">
            <mat-label>Run</mat-label>
            <mat-select [(value)]="selectedRunName" (selectionChange)="onSelectionChange()">
              <mat-option *ngIf="filteredRuns.length === 0" disabled>
                (no runs match the filter)
              </mat-option>
              <mat-option *ngFor="let r of filteredRuns" [value]="r.name">
                <span class="run-option-name">{{ r.label || r.name }}</span>
                <span class="run-status-pill"
                      [class.status-live]="isLiveStatus(r.status)"
                      [class.status-replay]="isReplayStatus(r.status)">
                  {{ r.status }}
                </span>
              </mat-option>
            </mat-select>
          </mat-form-field>

          <!-- XR run picker: mat-select's dropdown opens in the cdk
               overlay at document.body — OUTSIDE the rasterized
               element, so it can never appear on the quad. A ◀ ▶
               cycler over the same filteredRuns list instead. -->
          <div class="xr-run-cycler" *ngIf="xrContext">
            <button type="button" class="xr-cycle-btn"
                    [disabled]="filteredRuns.length < 2"
                    (click)="cycleRun(-1)">&#9664;</button>
            <div class="xr-run-current">
              <span class="xr-run-name">{{ activeRun ? (activeRun.label || activeRun.name) : '(no run selected)' }}</span>
              <span class="run-status-pill" *ngIf="activeRun"
                    [class.status-live]="isLiveStatus(activeRun.status)"
                    [class.status-replay]="isReplayStatus(activeRun.status)">
                {{ activeRun.status }}
              </span>
              <span class="muted small" *ngIf="filteredRuns.length > 1">
                {{ selectedRunIndex + 1 }} / {{ filteredRuns.length }}
              </span>
            </div>
            <button type="button" class="xr-cycle-btn"
                    [disabled]="filteredRuns.length < 2"
                    (click)="cycleRun(1)">&#9654;</button>
          </div>

          <div class="run-meta" *ngIf="activeRun">
            <span class="mode-pill"
                  [class.mode-live]="activeMode === 'LIVE'"
                  [class.mode-replay]="activeMode === 'REPLAY'">
              {{ activeMode }}
            </span>
            <span class="meta-pill">
              step {{ activeRun.lastRecordedStep }} / {{ activeRun.totalSteps || '?' }}
            </span>
            <span class="meta-pill err-pill" *ngIf="activeRun.errorMessage"
                  [title]="activeRun.errorMessage">err</span>
          </div>

          <div class="run-controls">
            <button mat-flat-button color="primary"
                    [disabled]="stepInFlight || batchRunInFlight || !selectedRunName || activeMode === 'REPLAY'"
                    [matTooltip]="activeMode === 'REPLAY' ? 'Precomputed / complete runs are read-only — pick or create a live run to advance.' : 'Advance this run by one timestep.'"
                    (click)="onStepOnce()">
              <mat-icon *ngIf="!stepInFlight">play_arrow</mat-icon>
              <mat-progress-spinner *ngIf="stepInFlight" diameter="16" mode="indeterminate">
              </mat-progress-spinner>
              Step Once
            </button>
            <button mat-stroked-button
                    [disabled]="stepInFlight || batchRunInFlight || !selectedRunName || activeMode === 'REPLAY'"
                    [matTooltip]="activeMode === 'REPLAY' ? 'Precomputed / complete runs are read-only.' : 'Open the batch-run form below.'"
                    (click)="batchFormOpen = !batchFormOpen">
              <mat-icon>fast_forward</mat-icon>
              Run…
            </button>
            <span class="muted small" *ngIf="!stepInFlight && lastResult">
              Last step:
              <span [class.ok]="lastResult.success" [class.err]="!lastResult.success">
                {{ lastResult.success ? 'ok' : 'failed' }}
              </span>
              <span *ngIf="lastResult.success">— step {{ lastResult.step }}, t = {{ formatTime(lastResult.time) }}</span>
            </span>
          </div>

          <!-- Inline batch-run form. Steps + dt override; submit kicks
               the /run endpoint. -->
          <div class="batch-form" *ngIf="batchFormOpen && selectedRunName && activeMode !== 'REPLAY'">
            <div class="batch-form__inputs">
              <label class="batch-field">
                <span class="batch-field__label">Steps</span>
                <input type="number" min="1" step="1" class="batch-input"
                       [(ngModel)]="batchSteps" />
              </label>
              <label class="batch-field">
                <span class="batch-field__label">Step size (s)</span>
                <input type="text" class="batch-input"
                       [placeholder]="formatDtPlaceholder()"
                       [(ngModel)]="batchDtOverride" />
              </label>
              <button mat-flat-button color="accent"
                      [disabled]="batchRunInFlight || !batchSteps || batchSteps < 1"
                      (click)="onRunBatch()">
                <mat-icon *ngIf="!batchRunInFlight">play_circle</mat-icon>
                <mat-progress-spinner *ngIf="batchRunInFlight" diameter="14" mode="indeterminate">
                </mat-progress-spinner>
                Run
              </button>
              <button mat-icon-button (click)="batchFormOpen = false"
                      matTooltip="Hide form">
                <mat-icon>close</mat-icon>
              </button>
            </div>
            <div class="batch-result" *ngIf="!batchRunInFlight && lastBatchResult"
                 [class.batch-ok]="!lastBatchResult.error"
                 [class.batch-err]="lastBatchResult.error">
              <mat-icon>{{ lastBatchResult.error ? 'error_outline' : 'done_all' }}</mat-icon>
              <div class="batch-result__text">
                <div>
                  Committed <strong>{{ lastBatchResult.committedSteps }}</strong>
                  step{{ lastBatchResult.committedSteps === 1 ? '' : 's' }}
                  <span *ngIf="lastBatchResult.finalTime !== null">
                    — end at step {{ lastBatchResult.finalStep }},
                    t = {{ formatTime(lastBatchResult.finalTime) }}
                  </span>
                </div>
                <div class="batch-result__err" *ngIf="lastBatchResult.error">
                  {{ lastBatchResult.error }}
                </div>
              </div>
            </div>
          </div>

          <!-- Per-solution result rows. Skipped rows (empty
               solution_definition_ref) show as a yellow "skipped" pill. -->
          <ul class="binding-list" *ngIf="lastResult">
            <li *ngFor="let b of lastResult.solutionTraces" class="binding-row"
                [class.status-ok]="b.status === 'completed'"
                [class.status-skip]="b.status === 'skipped'"
                [class.status-err]="b.status !== 'completed' && b.status !== 'skipped' && b.status !== 'initial-conditions'">
              <span class="binding-class mono">{{ b.simStateClass }}</span>
              <span class="binding-status">{{ b.status }}</span>
              <span class="binding-detail muted small"
                    *ngIf="b.reason || b.error || b.stepCount !== undefined"
                    [title]="b.reason || b.error || ''">
                <ng-container *ngIf="b.stepCount !== undefined">{{ b.stepCount }} states</ng-container>
                <ng-container *ngIf="b.reason">— {{ b.reason }}</ng-container>
                <ng-container *ngIf="b.error">— err</ng-container>
              </span>
            </li>
          </ul>

          <div class="warnings" *ngIf="lastResult?.warnings?.length">
            <div class="warning-line muted small" *ngFor="let w of lastResult!.warnings">
              ⚠ {{ w }}
            </div>
          </div>

          <div class="error-banner" *ngIf="lastResult && !lastResult.success && lastResult.error">
            {{ lastResult.error }}
          </div>
        </ng-container>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; pointer-events: auto; }
    .run-panel {
      background: rgba(255, 255, 255, 0.98);
      border: 1px solid #c8c8c8;
      border-radius: 8px;
      box-shadow: 0 4px 14px rgba(0, 0, 0, 0.12);
      padding: 6px 10px 10px 10px;
      min-width: 340px;
      max-width: 460px;
      font-size: 0.82rem;
      display: flex;
      flex-direction: column;
    }
    .run-body {
      display: flex;
      flex-direction: column;
      gap: 8px;
      overflow-y: auto;
      overflow-x: hidden;
      padding-right: 2px;
    }
    .run-header {
      display: flex; align-items: center; gap: 6px;
      width: 100%; padding: 4px;
      background: transparent; border: none; cursor: pointer;
      color: inherit; font: inherit; text-align: left;
    }
    .run-header:hover { background: rgba(0, 0, 0, 0.03); border-radius: 4px; }
    .run-panel:not(.collapsed) .run-header {
      border-bottom: 1px solid #eee;
      margin-bottom: 6px;
    }
    .run-title { font-weight: 600; flex: 1; }
    .run-status {
      font-size: 0.7rem; color: #555;
      padding: 1px 6px; background: #eef1f6; border-radius: 3px;
      letter-spacing: 0.04em; text-transform: uppercase;
    }
    .collapse-chevron { color: #888; }
    .run-body {
      display: flex; flex-direction: column; gap: 8px;
      padding-top: 2px;
    }
    .empty { padding: 8px 4px; }
    .run-select { width: 100%; }
    .run-select ::ng-deep .mat-mdc-form-field-subscript-wrapper { display: none; }
    .run-list-controls {
      display: flex; gap: 6px; align-items: center;
    }
    .run-search { flex: 1; }
    .run-search ::ng-deep .mat-mdc-form-field-subscript-wrapper { display: none; }
    .new-run-btn {
      white-space: nowrap;
      font-size: 0.75rem;
    }
    .ic-editor-wrap {
      border: 1px solid var(--border-light, #e0e3e9);
      border-radius: 6px;
      padding: 6px 10px;
      background: rgba(0,0,0,0.015);
    }
    .ic-summary {
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 0.78rem;
      font-weight: 500;
      color: var(--text-primary, #222);
      list-style: none;
      padding-bottom: 4px;
    }
    .ic-summary::-webkit-details-marker { display: none; }
    .ic-summary mat-icon { font-size: 16px; width: 16px; height: 16px; color: #1976d2; }
    .ic-status { margin-left: auto; font-weight: 600; }
    .ic-status-ok  { color: #1e7e34; }
    .ic-status-bad { color: #b71c1c; }

    .cs-display-wrap {
      border: 1px solid var(--border-light, #e0e3e9);
      border-radius: 6px;
      padding: 6px 10px;
      background: rgba(13, 71, 161, 0.025);
    }
    .cs-summary {
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 0.78rem;
      font-weight: 500;
      color: var(--text-primary, #222);
      list-style: none;
      padding-bottom: 4px;
    }
    .cs-summary::-webkit-details-marker { display: none; }
    .cs-summary mat-icon { font-size: 16px; width: 16px; height: 16px; color: #1976d2; }

    .batch-form {
      display: flex; flex-direction: column; gap: 6px;
      padding: 8px 10px;
      border: 1px solid var(--border-light, #e0e3e9);
      border-radius: 6px;
      background: rgba(0, 0, 0, 0.015);
    }
    .batch-form__inputs {
      display: flex; align-items: end; gap: 8px;
    }
    .batch-field {
      display: flex; flex-direction: column; gap: 2px;
      flex: 1 1 auto; min-width: 0;
    }
    .batch-field__label { font-size: 10px; color: var(--text-secondary, #666); text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600; }
    .batch-input {
      padding: 4px 6px; border: 1px solid var(--border-light, #e0e3e9);
      border-radius: 3px; font-size: 12px; font-family: monospace;
      box-sizing: border-box; width: 100%;
    }
    .batch-input:focus { outline: none; border-color: #1976d2; }
    .batch-result {
      display: flex; align-items: flex-start; gap: 8px;
      padding: 6px 8px; border-radius: 4px;
      font-size: 11px; line-height: 1.4;
    }
    .batch-result mat-icon { font-size: 16px; width: 16px; height: 16px; flex: 0 0 16px; margin-top: 1px; }
    .batch-result.batch-ok  { background: #e6f4ea; color: #1e7e34; }
    .batch-result.batch-err { background: #fdecea; color: #b71c1c; }
    .batch-result__text { flex: 1 1 auto; }
    .batch-result__err  { font-style: italic; opacity: 0.9; }
    .xr-run-cycler {
      display: flex; align-items: center; gap: 10px;
      padding: 8px 10px;
      border: 1px solid var(--border-light, #e0e3e9);
      border-radius: 6px;
      background: rgba(0, 0, 0, 0.015);
    }
    .xr-cycle-btn {
      font-size: 20px; line-height: 1;
      padding: 10px 16px;
      border: 1px solid #b9d6f6; border-radius: 6px;
      background: #e3f2fd; color: #0d47a1;
      cursor: pointer;
    }
    .xr-cycle-btn:disabled { opacity: 0.35; cursor: default; }
    .xr-run-current {
      flex: 1; display: flex; align-items: center; gap: 8px;
      min-width: 0;
    }
    .xr-run-name {
      font-weight: 600; font-size: 0.9rem;
      overflow-wrap: anywhere;
    }
    .run-option-name { flex: 1; }
    .run-status-pill {
      font-size: 0.62rem;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      padding: 1px 6px;
      border-radius: 3px;
      margin-left: 8px;
      font-weight: 700;
      background: #e3e3e3;
      color: #555;
    }
    .run-status-pill.status-live   { background: #d3eafe; color: #1958a8; }
    .run-status-pill.status-replay { background: #efe3fb; color: #5a2e93; }
    .mode-pill {
      font-size: 0.7rem;
      letter-spacing: 0.08em;
      font-weight: 700;
      padding: 2px 8px;
      border-radius: 3px;
      text-transform: uppercase;
    }
    .mode-pill.mode-live   { background: #2196f3; color: #fff; }
    .mode-pill.mode-replay { background: #7e57c2; color: #fff; }
    .err-pill { background: #fbe6e6; color: #8b1f1f; }
    .run-meta { display: flex; gap: 6px; }
    .meta-pill {
      font-size: 0.7rem; color: #555;
      padding: 2px 6px; background: #f4f6fa; border-radius: 3px;
      font-family: monospace;
    }
    .run-controls {
      display: flex; gap: 8px; align-items: center;
    }
    .binding-list {
      list-style: none; padding: 0; margin: 0;
      display: flex; flex-direction: column; gap: 3px;
    }
    .binding-row {
      display: grid;
      grid-template-columns: 1fr max-content 1fr;
      gap: 6px; align-items: baseline;
      padding: 4px 6px; border-radius: 4px;
      font-size: 0.75rem;
    }
    .binding-row.status-ok    { background: #eaf6ec; }
    .binding-row.status-skip  { background: #fdf3d6; }
    .binding-row.status-err   { background: #fbe6e6; }
    .binding-class { color: #1e2a45; font-weight: 600; }
    .binding-status {
      font-size: 0.68rem; letter-spacing: 0.06em; text-transform: uppercase;
      padding: 1px 6px; border-radius: 3px; font-weight: 700;
    }
    .status-ok .binding-status   { background: #4caf50; color: #fff; }
    .status-skip .binding-status { background: #d4a017; color: #fff; }
    .status-err .binding-status  { background: #c62828; color: #fff; }
    .binding-detail { text-align: right; }
    .warnings { display: flex; flex-direction: column; gap: 2px; }
    .warning-line { color: #8a4b00; }
    .error-banner {
      background: #fbe6e6; color: #8b1f1f;
      border: 1px solid #f2b8b8; border-radius: 4px;
      padding: 6px 8px; font-size: 0.75rem;
    }
    .ok { color: #1f6b27; font-weight: 600; }
    .err { color: #c62828; font-weight: 600; }
    .muted { color: #777; }
    .small { font-size: 0.85em; }
    .mono { font-family: monospace; }
  `]
})
export class SimSpaceSimulationRunPanelComponent implements OnChanges {
  /** Name of the SimulationDefinition that owns the runs we expose.
   *  Resolved by the parent viewer from the SimSpaceDefinition's
   *  participating SimState classes. */
  @Input() simulationDefinitionName: string | null = null;

  /** Sim def's `time_step_seconds` — surfaced as the placeholder for
   *  the IC editor's dt override. The viewer fetches this with the
   *  rest of the snapshot. */
  @Input() defaultDtSeconds: number = 0;

  /** Display unit for batch-run result times (e.g. 'second'). Matches
   *  whatever the scrubber is using. Default 'second'. */
  @Input() timeUnit: TimeUnitId = 'second';

  /** Display mode for batch-run result times. */
  @Input() timeDisplayMode: TimeDisplayMode = 'flexible';

  /** Pixels to lift off the bottom — viewer pushes this up when the
   *  scrubber is showing so the panel doesn't get clipped. */
  @Input() bottomOffsetPx: number = 12;

  /** Emitted when a step lands successfully so the viewer can reload
   *  the snapshot and show the new rows. */
  @Output() stepCommitted = new EventEmitter<SimulationStepResult>();
  /** Emitted whenever the selected run changes — viewer uses this to
   *  pass `?run=<name>` to the snapshot endpoint so it sees only the
   *  selected run's rows. */
  @Output() selectedRunChange = new EventEmitter<string | null>();

  collapsed = false;
  runs: SimulationRunSummary[] = [];
  selectedRunName: string | null = null;
  stepInFlight = false;
  lastResult: SimulationStepResult | null = null;
  runFilterText = '';
  newRunInFlight = false;

  /** Bumped on every commit / selection change so the current-state
   *  display refetches without polling. */
  currentStateRefreshKey = 0;

  /** True once the selected run has at least one persisted row. Drives
   *  the IC lock + the Set Initial Conditions button visibility. */
  get selectedRunInitialized(): boolean {
    const r = this.activeRun;
    if (!r) return false;
    return (r.recordedSteps || 0) > 0 || (r.lastRecordedStep || 0) > 0;
  }

  // Batch-run form state.
  batchFormOpen = false;
  batchSteps = 100;
  batchDtOverride: string = '';
  batchRunInFlight = false;
  lastBatchResult: {
    committedSteps: number;
    finalStep: number | null;
    finalTime: number | null;
    error?: string | null;
  } | null = null;

  /** Cap body height to the viewport minus the scrubber footprint
   *  (`bottomOffsetPx` from the viewer) so the panel scrolls cleanly
   *  instead of being clipped behind the scrubber. XR panels expand
   *  to content size — space is infinite, so no cap at all. */
  get bodyMaxHeight(): string {
    if (this.xrContext) return 'none';
    return `calc(100vh - ${this.bottomOffsetPx + 80}px)`;
  }

  /** Index of the selected run within the filtered list (XR cycler). */
  get selectedRunIndex(): number {
    return this.filteredRuns.findIndex(
      r => r.name === this.selectedRunName);
  }

  /** XR run picker: step through filteredRuns (wraps around). */
  cycleRun(delta: number): void {
    const list = this.filteredRuns;
    if (list.length === 0) return;
    const index = this.selectedRunIndex;
    const next = index < 0
      ? 0 : (index + delta + list.length) % list.length;
    this.selectedRunName = list[next].name;
    this.onSelectionChange();
  }

  /** Mirror the scrubber's number formatter so batch-run readouts read
   *  in the same units the user picked on the scrubber. */
  formatTime(seconds: number | null): string {
    if (seconds == null) return '?';
    return formatTimeValue(seconds, this.timeUnit, this.timeDisplayMode);
  }

  formatDtPlaceholder(): string {
    return this.defaultDtSeconds > 0 ? String(this.defaultDtSeconds) : 'sim default';
  }

  constructor(
    private runService: SimulationRunService,
    /** True when mounted in the off-screen XR panel host — swaps the
     *  overlay-based run picker for the cycler and lifts the
     *  viewport-height cap (see @models/xr/xr-panel-context). */
    @Inject(XR_PANEL_CONTEXT) public xrContext: boolean,
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['simulationDefinitionName']) {
      this.reloadRuns();
    }
  }

  get activeRun(): SimulationRunSummary | null {
    return this.runs.find(r => r.name === this.selectedRunName) ?? null;
  }

  /** Filtered + sorted view of the run list. The mat-select picks from
   *  this; the search box drives the filter. Sort is reverse-time so
   *  the most recent run is on top. */
  get filteredRuns(): SimulationRunSummary[] {
    const q = (this.runFilterText || '').toLowerCase().trim();
    const matches = q
      ? this.runs.filter(r =>
          (r.name || '').toLowerCase().includes(q)
          || (r.label || '').toLowerCase().includes(q)
          || (r.status || '').toLowerCase().includes(q))
      : this.runs;
    return [...matches].sort((a, b) =>
      (b.startedAt || b.name).localeCompare(a.startedAt || a.name));
  }

  /** Two-mode UX:
   *    REPLAY = the selected run is read-only (precomputed, complete,
   *             failed, canceled). Scrubber alone drives it; Step Once
   *             is disabled.
   *    LIVE   = the run is still progressable (pending, running, paused).
   *             Step Once + the future Run / Pause controls apply. */
  get activeMode(): 'LIVE' | 'REPLAY' | null {
    const r = this.activeRun;
    if (!r) return null;
    return this.isLiveStatus(r.status) ? 'LIVE' : 'REPLAY';
  }

  isLiveStatus(status: string): boolean {
    return status === 'pending' || status === 'running' || status === 'paused';
  }

  isReplayStatus(status: string): boolean {
    return !this.isLiveStatus(status);
  }

  onFilterChange(): void { /* tracked via getter — no work needed */ }

  /** Latest state from the inline initial-conditions editor. Drives
   *  the New Run button's disabled state + supplies the per-run
   *  overrides to the create call. */
  icState: RunInitialConditionsState = {
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

  onIcStateChange(state: RunInitialConditionsState): void {
    this.icState = state;
  }

  get newRunDisabledReason(): string {
    if (!this.simulationDefinitionName) return 'No simulation bound to this scene.';
    if (this.icState.validating) return 'Validating initial conditions…';
    if (!this.icState.valid) {
      if (this.icState.reason) return `Initial conditions invalid: ${this.icState.reason}`;
      if (this.icState.error)  return `Validator error: ${this.icState.error}`;
      return 'Initial conditions invalid.';
    }
    return 'Lock these initial conditions into a fresh run by writing the step-0 row.';
  }

  /** Spin up a fresh, uninitialized run (no step 0 yet) and switch the
   *  whole panel to it. Because it has no committed step 0 it reads as
   *  not-initialized → the IC editor unlocks and Set Initial Conditions
   *  appears, scoped to this new run. */
  async onStartNewRun(): Promise<void> {
    if (!this.simulationDefinitionName || this.newRunInFlight) return;
    this.newRunInFlight = true;
    this.lastResult = null;
    this.batchFormOpen = false;
    try {
      const { name } = await this.runService.create(this.simulationDefinitionName);
      await this.reloadRuns();
      this.selectedRunName = name;
      this.currentStateRefreshKey++;
      this.selectedRunChange.emit(name);
    } catch (err: any) {
      this.lastResult = {
        success: false, step: null, time: null,
        rowsByClass: {}, solutionTraces: [], warnings: [],
        error: `Failed to create run: ${err?.message || err}`,
      };
    } finally {
      this.newRunInFlight = false;
    }
  }

  /** Write the editor's initial conditions onto the selected
   *  (uninitialized) run, then commit step 0 so they're locked in. The
   *  run can no longer have its IC changed afterward — start a New Run
   *  to use different values. */
  async onSetInitialConditions(): Promise<void> {
    if (!this.selectedRunName || this.newRunInFlight) return;
    if (!this.icState.valid) return;
    const runName = this.selectedRunName;
    this.newRunInFlight = true;
    try {
      await this.runService.setInitialConditions(
        runName,
        this.icState.overrides,
        this.icState.timeStepSeconds > 0 ? this.icState.timeStepSeconds : undefined,
        this.icState.fieldSaveOverrides,
      );
      // Commit step 0 now so the initial-conditions row exists and the
      // run's IC is effectively locked.
      const result = await this.runService.step(runName, 0);
      this.lastResult = result;
      if (result.success) {
        await this.reloadRuns();
        this.currentStateRefreshKey++;
        this.stepCommitted.emit(result);
      }
    } catch (err: any) {
      this.lastResult = {
        success: false, step: null, time: null,
        rowsByClass: {}, solutionTraces: [], warnings: [],
        error: `Failed to set initial conditions: ${err?.message || err}`,
      };
    } finally {
      this.newRunInFlight = false;
    }
  }

  /** Loop the engine N times in a single backend call. Optional dt
   *  override (sticky — updates the run for subsequent Step Once too). */
  async onRunBatch(): Promise<void> {
    if (!this.selectedRunName || this.batchRunInFlight) return;
    if (this.batchSteps < 1) return;
    this.batchRunInFlight = true;
    this.lastBatchResult = null;
    try {
      const dtNum = Number(this.batchDtOverride);
      const dt = (this.batchDtOverride && Number.isFinite(dtNum) && dtNum > 0) ? dtNum : undefined;
      const result = await this.runService.runBatch(this.selectedRunName, this.batchSteps, dt);
      this.lastBatchResult = {
        committedSteps: result.committedSteps,
        finalStep: result.finalStep,
        finalTime: result.finalTime,
        error: result.error ?? null,
      };
      // Refresh the snapshot + run row counters so the scrubber sees
      // the new rows. We piggy-back on the existing stepCommitted output.
      await this.reloadRuns();
      this.currentStateRefreshKey++;
      this.stepCommitted.emit({
        success: !result.error,
        step: result.finalStep,
        time: result.finalTime,
        rowsByClass: result.lastRowsByClass || {},
        solutionTraces: result.lastSolutionTraces || [],
        warnings: result.warnings || [],
        error: result.error ?? null,
      });
    } catch (err: any) {
      this.lastBatchResult = {
        committedSteps: 0,
        finalStep: null,
        finalTime: null,
        error: err?.message || String(err),
      };
    } finally {
      this.batchRunInFlight = false;
    }
  }

  onSelectionChange(): void {
    this.lastResult = null;
    this.currentStateRefreshKey++;
    this.selectedRunChange.emit(this.selectedRunName);
  }

  async onStepOnce(): Promise<void> {
    if (!this.selectedRunName || this.stepInFlight) return;
    this.stepInFlight = true;
    this.lastResult = null;
    try {
      const result = await this.runService.step(this.selectedRunName);
      this.lastResult = result;
      if (result.success) {
        // Refresh the run summary so lastRecordedStep updates.
        await this.reloadRuns(/* preserve selection */);
        this.currentStateRefreshKey++;
        this.stepCommitted.emit(result);
      }
    } catch (err: any) {
      this.lastResult = {
        success: false, step: null, time: null,
        rowsByClass: {}, solutionTraces: [], warnings: [],
        error: err?.message || String(err),
      };
    } finally {
      this.stepInFlight = false;
    }
  }

  private async reloadRuns(): Promise<void> {
    if (!this.simulationDefinitionName) {
      this.runs = [];
      this.selectedRunName = null;
      return;
    }
    try {
      this.runs = await this.runService.list(this.simulationDefinitionName);
      if (!this.selectedRunName && this.runs.length > 0) {
        this.selectedRunName = this.runs[0].name;
        this.selectedRunChange.emit(this.selectedRunName);
      }
    } catch {
      this.runs = [];
      this.selectedRunName = null;
    }
  }
}
