import { Component, OnInit, QueryList, ViewChildren } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';

import { SimSpaceViewerComponent } from '@components/sim-space/sim-space-viewer/sim-space-viewer.component';
import { MsimGraphPanelComponent } from '@components/multi-scale/msim-graph-panel.component';
import { MsimIcPanelComponent } from '@components/multi-scale/msim-ic-panel.component';
import { MsimStageSearchComponent } from '@components/multi-scale/msim-stage-search.component';
import { MsimConfigureComponent } from '@components/multi-scale/configure/msim-configure.component';
import {
  MultiScaleSimDefinitionService,
  StageGateVerdict,
} from '@services/multi-scale/multi-scale-sim-definition.service';
import {
  InitialConditionInterfaceService,
  IcInterfaceConfig,
} from '@services/multi-scale/initial-condition-interface.service';
import {
  SimulationRunService,
  SimulationRunSummary,
} from '@services/sim-space/simulation-run.service';
import {
  MsimPanel,
  MsimStage,
  NamedMultiScaleSimConfig,
} from '@models/multi-scale/NamedMultiScaleSimConfig';

interface StageState {
  checking: boolean;
  complete: boolean | null; // null = not evaluated yet
  reason: string;
  error: string | null;
}

/**
 * /multi-scale-sim/:name — THE Multi-Scale Simulation Page (Phase 2:
 * run mode). Owns the run-set controls (play/step drives the PRIMARY
 * run; coupled sources advance via the backend's lazy pull; comparison
 * runs get the same steps fanned out so everything stays in tune) and
 * renders the definition's panels: scene panels as embedded run-pinned
 * viewers, IC interfaces as read-only preview cards (interactive in
 * Phase 4). Per-simulation configuration deliberately NAVIGATES OUT to
 * the existing config surfaces (reuse-first).
 */
@Component({
  standalone: true,
  selector: 'multi-scale-sim-page',
  imports: [
    CommonModule, FormsModule, RouterModule,
    MatButtonModule, MatIconModule, MatProgressSpinnerModule, MatTooltipModule,
    SimSpaceViewerComponent, MsimGraphPanelComponent, MsimIcPanelComponent,
    MsimStageSearchComponent, MsimConfigureComponent,
  ],
  templateUrl: './multi-scale-sim-page.component.html',
  styleUrls: ['./multi-scale-sim-page.component.scss'],
})
export class MultiScaleSimPageComponent implements OnInit {
  config: NamedMultiScaleSimConfig | null = null;
  errorMessage: string | null = null;

  /** Run mode plays it; Configure mode is the authoring rail. */
  mode: 'run' | 'configure' = 'run';

  runs: SimulationRunSummary[] = [];
  selectedRun: string | null = null;
  /** Comparison runs (from compare_run_policy) that actually exist. */
  comparisonRuns: string[] = [];
  /** The first comparison run — rendered side-by-side with the primary
   *  scene (design decision: coupled set shares ONE scene; comparisons
   *  get their own viewer). */
  get comparisonRun(): string | null {
    return this.comparisonRuns[0] ?? null;
  }

  stepsToRun = 100;
  busy = false;
  statusMessage: string | null = null;

  stageStates = new Map<string, StageState>();
  icPreviews = new Map<string, IcInterfaceConfig>();

  @ViewChildren(SimSpaceViewerComponent)
  viewers!: QueryList<SimSpaceViewerComponent>;

  @ViewChildren(MsimGraphPanelComponent)
  graphPanelCmps!: QueryList<MsimGraphPanelComponent>;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private msimService: MultiScaleSimDefinitionService,
    private icService: InitialConditionInterfaceService,
    private runService: SimulationRunService,
  ) {}

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      const name = params.get('name');
      if (name) this.loadAll(name);
    });
    // The wizard lands new compositions straight in Configure mode.
    this.route.queryParamMap.subscribe(q => {
      if (q.get('mode') === 'configure') this.mode = 'configure';
    });
  }

  toggleMode(): void {
    this.mode = this.mode === 'run' ? 'configure' : 'run';
  }

  /** Configure mode saved the definition — reload everything. */
  onConfigSaved(): void {
    if (this.config) this.loadAll(this.config.name);
  }

  stageHasSearch(stage: MsimStage): boolean {
    return !!stage.search?.candidates;
  }

  private loadAll(name: string): void {
    this.errorMessage = null;
    this.msimService.loadByName(name).subscribe({
      next: async (cfg) => {
        this.config = cfg;
        await this.loadRuns();
        this.loadIcPreviews();
        this.evaluateGates();
      },
      error: (err) => {
        this.errorMessage = err?.message || String(err);
        this.config = null;
      },
    });
  }

  private async loadRuns(): Promise<void> {
    if (!this.config?.primarySimulationRef) return;
    try {
      this.runs = await this.runService.list(this.config.primarySimulationRef);
    } catch {
      this.runs = [];
    }
    const names = new Set(this.runs.map(r => r.name));
    this.comparisonRuns = this.config.compareRuns.filter(r => names.has(r));
    // Default to a COUPLED (multi-scale) run — the runs endpoint now
    // carries coupledRunRefs, so prefer one directly; fall back to any
    // non-comparison run.
    if (!this.selectedRun || !names.has(this.selectedRun)) {
      const coupled = this.runs.find(
        r => Object.keys(r.coupledRunRefs ?? {}).length > 0);
      const primary = coupled
        ?? this.runs.find(r => !this.comparisonRuns.includes(r.name));
      this.selectedRun = primary?.name ?? this.runs[0]?.name ?? null;
    }
  }

  /** The selected run's summary (for its coupledRunRefs etc.). */
  get selectedRunSummary(): SimulationRunSummary | null {
    return this.runs.find(r => r.name === this.selectedRun) ?? null;
  }

  /** A run created by an IC-interface panel: select + follow it. */
  async onRunCreated(runName: string): Promise<void> {
    await this.loadRuns();
    this.selectedRun = runName;
    this.evaluateGates();
    await this.refreshViewers();
    await this.refreshGraphs();
  }

  private loadIcPreviews(): void {
    for (const panel of this.icPanels) {
      const ref = panel.icInterfaceRef;
      if (!ref || this.icPreviews.has(ref)) continue;
      this.icService.loadByName(ref).subscribe({
        next: (cfg) => this.icPreviews.set(ref, cfg),
        error: () => { /* preview card shows a fallback note */ },
      });
    }
  }

  // ---------------------------------------------------------------
  // Stages
  // ---------------------------------------------------------------

  get stages(): MsimStage[] {
    return this.config?.stages ?? [];
  }

  stageState(stage: MsimStage): StageState {
    let st = this.stageStates.get(stage.key);
    if (!st) {
      st = { checking: false, complete: null, reason: '', error: null };
      this.stageStates.set(stage.key, st);
    }
    return st;
  }

  /** coStep stages count as "live" once the selected primary run has
   *  recorded steps; runToCompletion stages ask the backend gate. */
  private evaluateGates(): void {
    for (const stage of this.stages) {
      if (stage.kind === 'coStep') {
        const st = this.stageState(stage);
        const run = this.runs.find(r => r.name === this.selectedRun);
        st.complete = (run?.lastRecordedStep ?? 0) > 0;
        st.reason = st.complete ? '' : 'Press Play to start stepping.';
      } else {
        this.checkGate(stage);
      }
    }
  }

  async checkGate(stage: MsimStage): Promise<void> {
    if (!this.config) return;
    const st = this.stageState(stage);
    st.checking = true;
    try {
      // A runToCompletion stage evaluates against ITS OWN sim's run.
      const simRef = stage.simulationRef || this.config.primarySimulationRef;
      const stageRuns = await this.runService.list(simRef);
      const runName = stageRuns[0]?.name;
      if (!runName) {
        st.complete = false;
        st.reason = 'No run exists for this stage yet.';
        return;
      }
      const verdict: StageGateVerdict =
        await this.msimService.evaluateStageGate(this.config.name, stage.key, runName);
      st.complete = verdict.complete;
      st.reason = verdict.reason;
      st.error = verdict.error;
    } catch (err: any) {
      st.error = err?.message || String(err);
      st.complete = false;
    } finally {
      st.checking = false;
    }
  }

  stageLabel(stage: MsimStage): string {
    return stage.label || stage.key;
  }

  // ---------------------------------------------------------------
  // Run controls — one set of controls for the whole page.
  // ---------------------------------------------------------------

  async onRunSelected(): Promise<void> {
    this.evaluateGates();
    await this.refreshViewers();
  }

  async play(): Promise<void> {
    if (!this.selectedRun || this.busy) return;
    const steps = Math.max(1, Math.floor(this.stepsToRun || 1));
    this.busy = true;
    this.statusMessage = `Running ${steps} steps…`;
    try {
      const result = await this.runService.runBatch(this.selectedRun, steps);
      let msg = `Committed ${result.committedSteps} step(s)`
        + (result.finalTime != null ? ` to t=${result.finalTime}s` : '');
      // Fan the SAME step count out to comparison runs so they stay in
      // tune with the primary (coupled sources need nothing — the
      // backend lazy pull already advanced them).
      for (const cmp of this.comparisonRuns) {
        const r = await this.runService.runBatch(cmp, steps);
        msg += ` · ${cmp}: ${r.committedSteps}`;
      }
      if (result.error) msg += ` — stopped: ${result.error}`;
      this.statusMessage = msg;
    } catch (err: any) {
      this.statusMessage = `Run failed: ${err?.message || err}`;
    } finally {
      this.busy = false;
      await this.afterStepsCommitted();
    }
  }

  async stepOnce(): Promise<void> {
    if (!this.selectedRun || this.busy) return;
    this.busy = true;
    this.statusMessage = 'Stepping…';
    try {
      const result = await this.runService.step(this.selectedRun);
      for (const cmp of this.comparisonRuns) {
        await this.runService.step(cmp);
      }
      this.statusMessage = result?.success === false
        ? `Step failed: ${result?.error ?? 'unknown error'}`
        : 'Step committed.';
    } catch (err: any) {
      this.statusMessage = `Step failed: ${err?.message || err}`;
    } finally {
      this.busy = false;
      await this.afterStepsCommitted();
    }
  }

  private async afterStepsCommitted(): Promise<void> {
    await this.loadRuns();
    this.evaluateGates();
    await this.refreshViewers();
    await this.refreshGraphs();
  }

  private async refreshViewers(): Promise<void> {
    if (!this.viewers) return;
    await Promise.all(this.viewers.map(v => v.refresh()));
  }

  private async refreshGraphs(): Promise<void> {
    if (!this.graphPanelCmps) return;
    await Promise.all(this.graphPanelCmps.map(g => g.refresh()));
  }

  // ---------------------------------------------------------------
  // Panels
  // ---------------------------------------------------------------

  get scenePanels(): MsimPanel[] {
    return (this.config?.panels ?? []).filter(p => p.kind === 'scene' && p.simSpaceRef);
  }

  get icPanels(): MsimPanel[] {
    return (this.config?.panels ?? []).filter(p => p.kind === 'ic' && p.icInterfaceRef);
  }

  get graphPanels(): MsimPanel[] {
    return (this.config?.panels ?? []).filter(p => p.kind === 'graph' && p.graphRef);
  }

  get deferredPanelCount(): number {
    return (this.config?.panels ?? [])
      .filter(p => p.kind !== 'scene' && p.kind !== 'ic' && p.kind !== 'graph').length;
  }

  resolvePanelRun(panel: MsimPanel): string | undefined {
    if (!panel.run || panel.run === 'primary') return this.selectedRun ?? undefined;
    return panel.run;
  }

  icPreview(panel: MsimPanel): IcInterfaceConfig | null {
    return panel.icInterfaceRef
      ? this.icPreviews.get(panel.icInterfaceRef) ?? null
      : null;
  }

  // ---------------------------------------------------------------
  // Reuse-first navigation
  // ---------------------------------------------------------------

  openSimConfig(simName: string): void {
    // The sim's existing configuration surface (definition rows +
    // solutions live under the class main page).
    this.router.navigate(['/class-main-page', 'SimulationDefinition'],
      { queryParams: { highlight: simName } });
  }

  openScenesPage(): void {
    this.router.navigate(['/sim-spaces']);
  }

  trackPanel(index: number, panel: MsimPanel): string {
    return `${panel.kind}:${panel.simSpaceRef ?? panel.icInterfaceRef ?? index}`;
  }
}
