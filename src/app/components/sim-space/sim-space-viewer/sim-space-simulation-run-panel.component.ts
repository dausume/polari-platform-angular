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
 * each `SimStateStepBinding`'s no-code into a single tick.
 */

import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
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

@Component({
  standalone: true,
  selector: 'sim-space-simulation-run-panel',
  imports: [
    CommonModule, FormsModule, MatIconModule, MatButtonModule,
    MatSelectModule, MatFormFieldModule, MatTooltipModule,
    MatProgressSpinnerModule, MatInputModule,
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

      <div class="run-body" *ngIf="!collapsed">
        <!-- Filter + +New row, always visible. Searches over the
             run name + label so a long list stays manageable. -->
        <div class="run-list-controls">
          <mat-form-field appearance="outline" subscriptSizing="dynamic" class="run-search">
            <mat-icon matPrefix>search</mat-icon>
            <input matInput placeholder="Filter runs…"
                   [(ngModel)]="runFilterText" (ngModelChange)="onFilterChange()">
          </mat-form-field>
          <button mat-stroked-button class="new-run-btn"
                  [disabled]="newRunInFlight || !simulationDefinitionName"
                  matTooltip="Create a fresh live run"
                  (click)="onCreateRun()">
            <mat-icon *ngIf="!newRunInFlight">add</mat-icon>
            <mat-progress-spinner *ngIf="newRunInFlight" diameter="14" mode="indeterminate">
            </mat-progress-spinner>
            New Run
          </button>
        </div>

        <ng-container *ngIf="filteredRuns.length === 0 && !runs.length">
          <div class="empty muted">
            No SimulationRun exists for this scene yet. Click <strong>New Run</strong>
            to spin up a live one and Step Once from t = 0.
          </div>
        </ng-container>

        <ng-container *ngIf="runs.length > 0">
          <mat-form-field appearance="outline" subscriptSizing="dynamic" class="run-select">
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
                    [disabled]="stepInFlight || !selectedRunName || activeMode === 'REPLAY'"
                    [matTooltip]="activeMode === 'REPLAY' ? 'Precomputed / complete runs are read-only — pick or create a live run to advance.' : 'Advance this run by one timestep.'"
                    (click)="onStepOnce()">
              <mat-icon *ngIf="!stepInFlight">play_arrow</mat-icon>
              <mat-progress-spinner *ngIf="stepInFlight" diameter="16" mode="indeterminate">
              </mat-progress-spinner>
              Step Once
            </button>
            <span class="muted small" *ngIf="!stepInFlight && lastResult">
              Last step:
              <span [class.ok]="lastResult.success" [class.err]="!lastResult.success">
                {{ lastResult.success ? 'ok' : 'failed' }}
              </span>
              <span *ngIf="lastResult.success">— step {{ lastResult.step }}, t = {{ lastResult.time }}</span>
            </span>
          </div>

          <!-- Per-binding result rows. Skipped bindings (empty step_solution_ref)
               show up as a yellow "skipped" pill with the reason. -->
          <ul class="binding-list" *ngIf="lastResult">
            <li *ngFor="let b of lastResult.bindingTraces" class="binding-row"
                [class.status-ok]="b.status === 'completed'"
                [class.status-skip]="b.status === 'skipped'"
                [class.status-err]="b.status !== 'completed' && b.status !== 'skipped'">
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
      min-width: 280px;
      max-width: 380px;
      font-size: 0.82rem;
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

  constructor(private runService: SimulationRunService) {}

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

  async onCreateRun(): Promise<void> {
    if (!this.simulationDefinitionName || this.newRunInFlight) return;
    this.newRunInFlight = true;
    try {
      const { name } = await this.runService.create(this.simulationDefinitionName);
      await this.reloadRuns();
      // Auto-select the freshly created run so Step Once targets it.
      this.selectedRunName = name;
      this.selectedRunChange.emit(name);
      this.lastResult = null;
    } catch (err: any) {
      this.lastResult = {
        success: false, step: null, time: null,
        rowsByClass: {}, bindingTraces: [], warnings: [],
        error: `Failed to create run: ${err?.message || err}`,
      };
    } finally {
      this.newRunInFlight = false;
    }
  }

  onSelectionChange(): void {
    this.lastResult = null;
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
        this.stepCommitted.emit(result);
      }
    } catch (err: any) {
      this.lastResult = {
        success: false, step: null, time: null,
        rowsByClass: {}, bindingTraces: [], warnings: [],
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
