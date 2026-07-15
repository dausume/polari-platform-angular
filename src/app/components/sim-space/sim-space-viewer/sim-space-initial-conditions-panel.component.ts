/**
 * @cross-cutting
 * @tags @xc:bindings, @xc:overlay
 * @consumers
 *   - SimSpaceViewer (top-left, sibling of sim-space-simulation-run-
 *     panel — its own View toggle, right sidebar)
 * @impact-on-edit
 *   Separated from sim-space-simulation-run-panel (2026-07-14) so
 *   Initial Conditions can grow its own sub-tabs without crowding the
 *   Run Selection / Step Control surface. Any SimSpaceDefinition can
 *   name configured interfaces (`configuredInterfaces`, see
 *   sim_space_definition.py) — a purpose-built Display component per
 *   tab (e.g. an msim material picker, the aquaponics pot editor) —
 *   independent of whether a SimulationDefinition is bound at all.
 *
 * Tabs: one per configured interface, in declared order, THEN one
 * fixed final "Manual inputs" tab hosting the existing auto-generating
 * run-initial-conditions-editor. Exactly one configured interface (or
 * more) opens as the default active tab; zero configured interfaces
 * opens on Manual (the only content there is).
 */

import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  Type,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { DISPLAY_COMPONENT_REGISTRY } from '@models/dashboards/ComponentRegistry';
import { SimSpaceConfiguredInterface } from '@models/sim-space/sim-space-types';
import {
  RunInitialConditionsEditorComponent,
  RunInitialConditionsState,
} from './run-initial-conditions-editor.component';
import { SimulationRunService } from '@services/sim-space/simulation-run.service';
import {
  SimulationRunSummary,
  SimulationStepResult,
} from '@models/sim-space/sim-space-types';

interface IcTab {
  kind: 'configured' | 'manual';
  label: string;
  configured?: SimSpaceConfiguredInterface;
  /** Resolved ONCE when tabs are (re)computed — NOT a live lookup or
   *  literal in the template. A getter/method/`|| {}` fallback used
   *  directly in a template expression re-evaluates on EVERY change-
   *  detection cycle, returning a NEW reference each time; fed into
   *  *ngFor or *ngComponentOutlet's `inputs`, that reference churn
   *  makes Angular tear down and recreate the hosted component on
   *  every tick — 2026-07-14: this is what pegged the CPU and left
   *  run-initial-conditions-editor stuck permanently on "Loading
   *  class defaults…" (constantly destroyed before its fetch could
   *  ever resolve). Precomputed, stable fields are what OnPush (and
   *  sane change detection generally) requires. */
  component?: Type<any> | null;
  inputs?: Record<string, any>;
}

const EMPTY_INPUTS: Record<string, any> = {};

@Component({
  standalone: true,
  selector: 'sim-space-initial-conditions-panel',
  imports: [
    CommonModule, MatIconModule, MatButtonModule, MatTooltipModule,
    MatProgressSpinnerModule, RunInitialConditionsEditorComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ic-panel" [class.collapsed]="collapsed">
      <button type="button" class="ic-header" (click)="collapsed = !collapsed"
              [attr.aria-expanded]="!collapsed">
        <mat-icon>tune</mat-icon>
        <span class="ic-title">Initial conditions</span>
        <mat-icon class="collapse-chevron">{{ collapsed ? 'expand_more' : 'expand_less' }}</mat-icon>
      </button>

      <div class="ic-body" *ngIf="!collapsed">
        <div class="ic-tabs" *ngIf="tabs.length > 1">
          <button type="button" class="ic-tab" *ngFor="let t of tabs; let i = index"
                  [class.active]="i === activeIndex"
                  (click)="activeIndex = i">
            {{ t.label }}
          </button>
        </div>

        <ng-container *ngFor="let t of tabs; let i = index">
          <div class="tab-body" [hidden]="i !== activeIndex">
            <ng-container *ngIf="t.kind === 'configured'">
              <ng-container *ngIf="t.component; else missingComponent">
                <ng-container *ngComponentOutlet="t.component; inputs: t.inputs">
                </ng-container>
              </ng-container>
              <ng-template #missingComponent>
                <p class="error-note">
                  "{{ t.configured!.componentName }}" isn't registered in the
                  Display component registry — nothing to render.
                </p>
              </ng-template>
            </ng-container>

            <ng-container *ngIf="t.kind === 'manual'">
              <p class="muted small" *ngIf="!simulationDefinitionName">
                No SimulationDefinition is bound to this scene — nothing to
                set initial conditions on.
              </p>
              <ng-container *ngIf="simulationDefinitionName">
                <run-initial-conditions-editor
                  [simulationDefinitionName]="simulationDefinitionName"
                  [defaultDtSeconds]="defaultDtSeconds"
                  [locked]="selectedRunInitialized"
                  [runName]="runName"
                  (stateChange)="onIcStateChange($event)">
                </run-initial-conditions-editor>
                <p class="muted small" *ngIf="!runName">
                  Select or start a run (Run Selection panel) to configure its
                  initial conditions.
                </p>
                <button mat-flat-button color="primary" *ngIf="runName && !selectedRunInitialized"
                        [disabled]="commitInFlight || !icState.valid"
                        [matTooltip]="setIcDisabledReason"
                        (click)="onSetInitialConditions()">
                  <mat-progress-spinner *ngIf="commitInFlight" diameter="14" mode="indeterminate">
                  </mat-progress-spinner>
                  <span *ngIf="!commitInFlight">Set Initial Conditions</span>
                </button>
                <div class="error-banner" *ngIf="commitError">{{ commitError }}</div>
              </ng-container>
            </ng-container>
          </div>
        </ng-container>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; pointer-events: auto; }
    .ic-panel {
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
    .ic-header {
      display: flex; align-items: center; gap: 6px;
      width: 100%; padding: 4px;
      background: transparent; border: none; cursor: pointer;
      color: inherit; font: inherit; text-align: left;
    }
    .ic-header:hover { background: rgba(0, 0, 0, 0.03); border-radius: 4px; }
    .ic-panel:not(.collapsed) .ic-header {
      border-bottom: 1px solid #eee;
      margin-bottom: 6px;
    }
    .ic-title { font-weight: 600; flex: 1; }
    .collapse-chevron { color: #888; }
    .ic-body {
      display: flex; flex-direction: column; gap: 8px;
      max-height: calc(100vh - 120px);
      overflow-y: auto;
      padding-right: 2px;
    }
    .ic-tabs {
      display: flex;
      gap: 2px;
      background: rgba(0, 0, 0, 0.03);
      border-radius: 6px;
      padding: 3px;
    }
    .ic-tab {
      flex: 1;
      padding: 5px 8px;
      border: none;
      border-radius: 4px;
      background: transparent;
      color: #555;
      font-size: 0.75rem;
      font-weight: 600;
      cursor: pointer;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .ic-tab:hover { background: rgba(0, 0, 0, 0.05); }
    .ic-tab.active { background: #e3f2fd; color: #0d47a1; }
    .tab-body { display: flex; flex-direction: column; gap: 8px; }
    .error-note { color: #b71c1c; font-size: 0.78rem; }
    .error-banner {
      background: #fbe6e6; color: #8b1f1f;
      border: 1px solid #f2b8b8; border-radius: 4px;
      padding: 6px 8px; font-size: 0.75rem;
    }
    .muted { color: #777; }
    .small { font-size: 0.85em; }
  `],
})
export class SimSpaceInitialConditionsPanelComponent implements OnChanges {
  /** Ordered configured interfaces from the scene's SimSpaceDefinition
   *  (empty = no configured tabs; Manual is the only content). */
  @Input() configuredInterfaces: SimSpaceConfiguredInterface[] = [];
  /** Name of the SimulationDefinition bound to this scene, if any —
   *  drives whether the Manual tab has anything to configure. */
  @Input() simulationDefinitionName: string | null = null;
  @Input() defaultDtSeconds = 0;
  /** The run currently selected in the sibling Run panel — this panel
   *  scopes the Manual tab's editor + Set Initial Conditions action to
   *  it (same selectedRunName the viewer already threads to both). */
  @Input() runName: string | null = null;

  /** Emitted once Set Initial Conditions commits step 0, so the viewer
   *  reloads the scene AND bumps the sibling run panel's refresh key. */
  @Output() stepCommitted = new EventEmitter<SimulationStepResult>();

  collapsed = false;
  activeIndex = 0;
  /** Computed ONCE per actual configuredInterfaces change in
   *  ngOnChanges — see the IcTab.component doc comment for why this
   *  must NOT be a live getter/method evaluated from the template. */
  tabs: IcTab[] = [];

  runs: SimulationRunSummary[] = [];
  icState: RunInitialConditionsState = {
    overrides: {}, timeStepSeconds: 0, fieldSaveOverrides: {},
    storageEstimate: null, valid: true, hasValidator: false,
    reason: '', error: null, validating: false,
  };
  commitInFlight = false;
  commitError: string | null = null;

  constructor(
    private runService: SimulationRunService,
    private cdr: ChangeDetectorRef,
  ) {}

  private computeTabs(): void {
    this.tabs = [
      ...this.configuredInterfaces.map((ci): IcTab => ({
        kind: 'configured',
        label: ci.label || ci.componentName,
        configured: ci,
        component: DISPLAY_COMPONENT_REGISTRY.getComponent(ci.componentName)?.component ?? null,
        inputs: ci.inputs || EMPTY_INPUTS,
      })),
      { kind: 'manual', label: 'Manual inputs' },
    ];
  }

  /** True once the run currently in scope has at least one persisted
   *  step — same rule sim-space-simulation-run-panel uses, duplicated
   *  here (this panel independently tracks run status for the ONE run
   *  it's scoped to rather than sharing the sibling panel's full list;
   *  same sibling-fetch pattern run-current-state-display already
   *  uses elsewhere in this viewer). */
  get selectedRunInitialized(): boolean {
    const r = this.runs.find(x => x.name === this.runName);
    if (!r) return false;
    return (r.recordedSteps || 0) > 0 || (r.lastRecordedStep || 0) > 0;
  }

  get setIcDisabledReason(): string {
    if (this.icState.validating) return 'Validating initial conditions…';
    if (!this.icState.valid) {
      if (this.icState.reason) return `Initial conditions invalid: ${this.icState.reason}`;
      if (this.icState.error) return `Validator error: ${this.icState.error}`;
      return 'Initial conditions invalid.';
    }
    return 'Lock these initial conditions into a fresh run by writing the step-0 row.';
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['configuredInterfaces'] || changes['simulationDefinitionName']) {
      this.computeTabs();
      this.activeIndex = this.configuredInterfaces.length > 0 ? 0 : this.tabs.length - 1;
    }
    if (changes['simulationDefinitionName'] || changes['runName']) {
      this.reloadRuns();
    }
  }

  private async reloadRuns(): Promise<void> {
    if (!this.simulationDefinitionName) {
      this.runs = [];
      this.cdr.markForCheck();
      return;
    }
    try {
      this.runs = await this.runService.list(this.simulationDefinitionName);
    } catch {
      this.runs = [];
    } finally {
      // OnPush: this fetch is driven by ngOnChanges (not a template
      // event from this component), so nothing else marks it dirty
      // once the async gap passes — without this, selectedRunInitialized
      // (and therefore the Set Initial Conditions button/lock state)
      // could stay stale until an unrelated event happens to re-check.
      this.cdr.markForCheck();
    }
  }

  onIcStateChange(state: RunInitialConditionsState): void {
    this.icState = state;
    this.cdr.markForCheck();
  }

  /** Write the editor's initial conditions onto the selected
   *  (uninitialized) run, then commit step 0 so they're locked in. */
  async onSetInitialConditions(): Promise<void> {
    if (!this.runName || this.commitInFlight || !this.icState.valid) return;
    const runName = this.runName;
    this.commitInFlight = true;
    this.commitError = null;
    try {
      await this.runService.setInitialConditions(
        runName,
        this.icState.overrides,
        this.icState.timeStepSeconds > 0 ? this.icState.timeStepSeconds : undefined,
        this.icState.fieldSaveOverrides,
      );
      const result = await this.runService.step(runName, 0);
      if (result.success) {
        await this.reloadRuns();
        this.stepCommitted.emit(result);
      } else {
        this.commitError = result.error || 'Failed to commit step 0.';
      }
    } catch (err: any) {
      this.commitError = `Failed to set initial conditions: ${err?.message || err}`;
    } finally {
      this.commitInFlight = false;
      this.cdr.markForCheck();
    }
  }
}
