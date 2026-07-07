import {
  Component, ElementRef, OnDestroy, OnInit, QueryList, ViewChild, ViewChildren,
} from '@angular/core';
import { Subscription } from 'rxjs';
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
import { MsimGraphViewComponent } from '@components/multi-scale/msim-graph-view.component';
import {
  MsimConfigureComponent, RailPart,
} from '@components/multi-scale/configure/msim-configure.component';
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
import { DisplayRendererComponent } from '@components/dashboard/dashboard-renderer/dashboard-renderer';
import { Display } from '@models/dashboards/Display';
import { DisplayRow } from '@models/dashboards/DisplayRow';
import { DisplayColumn } from '@models/dashboards/DisplayColumn';
import { MsimLayoutService } from '@services/multi-scale/msim-layout.service';
import { MsimPanelBusService } from '@services/multi-scale/msim-panel-bus.service';
import { MsimProofService } from '@services/multi-scale/msim-proof.service';
import { MsimStageRunService } from '@services/multi-scale/msim-stage-run.service';
import { MsimMemberInfoService } from '@services/multi-scale/msim-member-info.service';
import { MsimMemberInfoComponent } from './msim-member-info.component';
import { MsimExplainerPanelComponent } from './msim-explainer-panel.component';
import { MsimFamilyGraphPanelComponent } from './msim-family-graph-panel.component';
import { SimSpaceSelectorComponent } from '@components/sim-space/sim-space-selector/sim-space-selector.component';
import { registerMsimDisplayComponents } from './msim-display-components';

/** One button on the layout-edit palette. */
interface PaletteOption {
  label: string;
  icon: string;
  componentName: string;
  inputs: Record<string, any>;
}

export interface StageState {
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
    MsimStageSearchComponent, MsimConfigureComponent, MsimGraphViewComponent,
    MsimMemberInfoComponent, MsimExplainerPanelComponent,
    MsimFamilyGraphPanelComponent, SimSpaceSelectorComponent,
    DisplayRendererComponent,
  ],
  templateUrl: './multi-scale-sim-page.component.html',
  styleUrls: ['./multi-scale-sim-page.component.scss'],
})
export class MultiScaleSimPageComponent implements OnInit, OnDestroy {
  config: NamedMultiScaleSimConfig | null = null;
  errorMessage: string | null = null;

  /** Milestone B: proof states from the material picker — the stage
   *  chip reflects the CURRENTLY SELECTED substance's proof (the picker
   *  knows better than the generic newest-run gate check). Keyed by
   *  stage key. */
  private proofStates = new Map<string, { complete: boolean; reason: string }>();
  private proofSub: Subscription | null = null;
  private stageRunSub: Subscription | null = null;

  /** Concrete run per stage key — the sync lookup behind the
   *  'stage:<key>' run token in scene panels (graph panels resolve
   *  their own tokens). */
  private stageRunByKey = new Map<string, string>();

  /** Run mode plays it; Graph mode draws the composition as the node
   *  graph it is; Configure mode is the authoring rail. */
  mode: 'run' | 'graph' | 'configure' = 'run';
  /** Rail part Configure mode should open on (set by graph drill-ins). */
  configureInitialPart: RailPart | null = null;

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

  // --- Custom layout (the Display grid as THE layout system) ---------
  /** The composition's layout Display when display_ref is set. */
  customDisplay: Display | null = null;
  customDisplayError: string | null = null;
  /** Live layout editing (dashboard-renderer edit mode) on this page,
   *  so modification happens while looking at the WORKING components. */
  layoutEditMode = false;
  layoutSaving = false;
  layoutDirty = false;
  private selectedCell: { row: DisplayRow, startSegment: number,
    spanSegments: number, availableWidth: number } | null = null;
  private selectedColumnCell: { column: DisplayColumn, startSegment: number,
    spanSegments: number, availableHeight: number } | null = null;

  @ViewChild(DisplayRendererComponent)
  layoutRenderer?: DisplayRendererComponent;

  @ViewChildren(SimSpaceViewerComponent)
  viewers!: QueryList<SimSpaceViewerComponent>;

  @ViewChild('runControls')
  runControlsRef?: ElementRef<HTMLDivElement>;

  @ViewChildren(MsimGraphPanelComponent)
  graphPanelCmps!: QueryList<MsimGraphPanelComponent>;

  @ViewChildren(MsimGraphViewComponent)
  graphViews!: QueryList<MsimGraphViewComponent>;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private msimService: MultiScaleSimDefinitionService,
    private icService: InitialConditionInterfaceService,
    private runService: SimulationRunService,
    private layoutService: MsimLayoutService,
    private panelBus: MsimPanelBusService,
    private proofService: MsimProofService,
    private stageRunService: MsimStageRunService,
    private memberInfoService: MsimMemberInfoService,
  ) {
    // Make the msim panels placeable inside Display layouts (idempotent).
    registerMsimDisplayComponents();
  }

  ngOnInit(): void {
    // IC panels inside a custom Display layout report new runs via the
    // panel bus (the renderer instantiates them dynamically).
    this.panelBus.runCreated$.subscribe(name => this.onRunCreated(name));
    this.route.paramMap.subscribe(params => {
      const name = params.get('name');
      if (name) this.loadAll(name);
    });
    // The wizard lands new compositions straight in Configure mode.
    this.route.queryParamMap.subscribe(q => {
      if (q.get('mode') === 'configure') this.mode = 'configure';
    });
    // Milestone B: a material picker's proof result speaks for its
    // stage — the chip shows the selected substance's verdict rather
    // than the generic newest-run gate check.
    // A landed/cleared proof re-pins scene panels using 'stage:<key>'.
    this.stageRunSub = this.stageRunService.stageRunChanged$.subscribe(ev => {
      if (!this.config || ev.msim !== this.config.name) return;
      void this.resolveStagePanelRuns().then(() => this.refreshViewers());
    });
    this.proofSub = this.proofService.proofChanged$.subscribe(ev => {
      if (!this.config || ev.msim !== this.config.name) return;
      if (ev.report === null) {
        this.proofStates.delete(ev.stageKey);
      } else {
        this.proofStates.set(ev.stageKey, {
          complete: ev.report.achieved,
          reason: ev.report.achieved
            ? `Proven with ${ev.substanceLabel}.`
            : (ev.report.attempts?.[0]?.reason
               || `No valid solution for ${ev.substanceLabel}.`),
        });
      }
      const stage = this.stages.find(s => s.key === ev.stageKey);
      if (stage) {
        const st = this.stageState(stage);
        const proof = this.proofStates.get(ev.stageKey);
        if (proof) {
          st.complete = proof.complete;
          st.reason = proof.reason;
          st.error = null;
        } else {
          void this.checkGate(stage);
        }
      }
    });
  }

  ngOnDestroy(): void {
    this.proofSub?.unsubscribe();
    this.stageRunSub?.unsubscribe();
  }

  toggleMode(): void {
    this.mode = this.mode === 'run' ? 'configure' : 'run';
  }

  /** A graph-view drill-in asked to configure something specific. */
  onConfigureRequested(part: string): void {
    this.configureInitialPart = part as RailPart;
    this.mode = 'configure';
  }

  /** Configure mode saved the definition — reload everything. */
  onConfigSaved(): void {
    this.memberInfoService.invalidate();
    if (this.config) this.loadAll(this.config.name);
  }

  stageHasSearch(stage: MsimStage): boolean {
    // formulationSearch stages carry their candidate space in the
    // referenced FormulationSearchDefinition — the same search UI
    // drives them (the backend reshapes into the same contract).
    return !!stage.search?.candidates
      || stage.kind === 'formulationSearch';
  }

  stageKindLabel(stage: MsimStage): string {
    if (stage.kind === 'coStep') return 'live coupled stepping';
    if (stage.kind === 'formulationSearch') {
      return 'formulation search over the configured definition';
    }
    return 'runs to completion, then unlocks';
  }

  private loadAll(name: string): void {
    this.errorMessage = null;
    this.msimService.loadByName(name).subscribe({
      next: async (cfg) => {
        this.config = cfg;
        await this.loadRuns();
        await this.resolveStagePanelRuns();
        this.loadIcPreviews();
        this.evaluateGates();
        this.loadCustomLayout();
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
      // Keep whatever list we already had — a transient refresh failure
      // must never empty the run picker (the controls would look broken).
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

  /** A run created by an IC-interface panel: select + follow it. A
   *  refresh hiccup must never break the page state — the run exists;
   *  worst case the panels catch up on the next step. */
  async onRunCreated(runName: string): Promise<void> {
    this.statusMessage = `Following new run ${runName} — press Play to step it.`;
    try {
      await this.loadRuns();
    } catch { /* keep previous list */ }
    this.selectedRun = runName;
    try {
      this.evaluateGates();
      await this.refreshViewers();
      await this.refreshGraphs();
    } catch { /* panels catch up on the next committed step */ }
    // Bring the (sticky) run controls into view so the user SEES the
    // page now following their new run.
    this.runControlsRef?.nativeElement?.scrollIntoView(
      { behavior: 'smooth', block: 'start' });
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
    // A substance proof from the material picker outranks the generic
    // newest-run check (which may land on an arbitrary search attempt).
    const proof = this.proofStates.get(stage.key);
    if (proof) {
      st.complete = proof.complete;
      st.reason = proof.reason;
      st.error = null;
      st.checking = false;
      return;
    }
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

  /** The member sim's role in THIS composition (for its info popover). */
  memberRole(sim: string): string {
    if (!this.config) return '';
    if (sim === this.config.primarySimulationRef) {
      return 'Primary — the simulation you drive with Play/Step.';
    }
    const stage = this.stages.find(
      s => s.kind !== 'coStep' && s.simulationRef === sim);
    if (stage) {
      return `Precondition stage "${this.stageLabel(stage)}" — runs to `
        + 'completion and must pass its gate before the pendulum swings.';
    }
    return 'Coupled source — advances itself; the primary simulation '
      + 'samples it while stepping.';
  }

  /** Resolve every 'stage:<key>' scene-panel run token to a concrete
   *  run (sync-readable by resolvePanelRun). */
  private async resolveStagePanelRuns(): Promise<void> {
    if (!this.config) return;
    const tokens = (this.config.panels ?? [])
      .map(p => p.run)
      .filter((r): r is string => this.stageRunService.isStageToken(r));
    for (const token of new Set(tokens)) {
      const stageKey = this.stageRunService.stageKeyOf(token);
      const run = await this.stageRunService.resolve(this.config.name, stageKey);
      if (run) this.stageRunByKey.set(stageKey, run);
      else this.stageRunByKey.delete(stageKey);
    }
  }

  // ---------------------------------------------------------------
  // Run controls — one set of controls for the whole page.
  // ---------------------------------------------------------------

  async onRunSelected(): Promise<void> {
    this.evaluateGates();
    await this.refreshViewers();
    this.panelBus.refresh$.next();
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
    // Panels living inside a custom Display layout refresh via the bus
    // (the renderer instantiates them, so @ViewChildren can't see them).
    this.panelBus.refresh$.next();
    // Graph-view live badges follow committed steps too.
    if (this.graphViews) {
      await Promise.all(this.graphViews.map(g => g.refresh()));
    }
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
    return (this.config?.panels ?? [])
      .filter(p => p.kind === 'graph' && p.graphRef && !p.family);
  }

  /** Graph panels pivoted across a material family (tabs + combined). */
  get familyGraphPanels(): MsimPanel[] {
    return (this.config?.panels ?? [])
      .filter(p => p.kind === 'graph' && p.graphRef && !!p.family);
  }

  get explainerPanels(): MsimPanel[] {
    return (this.config?.panels ?? [])
      .filter(p => p.kind === 'explainer' && p.stageKey);
  }

  /** 3D selection spaces (the solid-material selector). */
  get selectorPanels(): MsimPanel[] {
    return (this.config?.panels ?? [])
      .filter(p => p.kind === 'selector' && p.simSpaceRef);
  }

  get deferredPanelCount(): number {
    const shownKinds = ['scene', 'ic', 'graph', 'explainer', 'selector'];
    return (this.config?.panels ?? [])
      .filter(p => !shownKinds.includes(p.kind)).length;
  }

  // ---------------------------------------------------------------
  // Custom layout — the Display grid as THE layout system
  // ---------------------------------------------------------------

  /** Live context the dashboard renderer merges into every msim panel
   *  it instantiates (item inputs carry the refs; this carries the
   *  page's current run-following state). */
  get displayContext(): Record<string, any> {
    return {
      msimName: this.config?.name ?? '',
      primaryRun: this.selectedRun,
      comparisonRun: this.comparisonRun,
      running: this.busy,
      coupledRunRefs: this.selectedRunSummary?.coupledRunRefs ?? {},
    };
  }

  private loadCustomLayout(): void {
    this.customDisplay = null;
    this.customDisplayError = null;
    this.layoutEditMode = false;
    this.layoutDirty = false;
    const ref = this.config?.displayRef;
    if (!ref) return;
    this.layoutService.loadLayout(ref).subscribe({
      next: (display) => (this.customDisplay = display),
      error: () => {
        this.customDisplayError =
          'The saved custom layout could not be loaded — showing the '
          + 'default layout instead.';
      },
    });
  }

  /** Build a real Display from the current panels and switch to it. */
  async convertLayout(): Promise<void> {
    if (!this.config || this.busy) return;
    this.statusMessage = 'Creating your custom layout…';
    try {
      await this.layoutService.convertToCustomLayout(
        this.config, !!this.comparisonRun);
      this.loadCustomLayout();
      this.statusMessage =
        'Custom layout created — use "Edit layout live" to rearrange it.';
    } catch (err: any) {
      this.statusMessage = `Could not create the layout: ${err?.message || err}`;
    }
  }

  toggleLayoutEdit(): void {
    if (this.layoutEditMode && this.layoutDirty) {
      // Leaving edit mode without saving discards draft changes.
      this.loadCustomLayout();
      this.statusMessage = 'Layout changes discarded.';
      return;
    }
    this.layoutEditMode = !this.layoutEditMode;
  }

  async saveLayout(): Promise<void> {
    if (!this.customDisplay || this.layoutSaving) return;
    this.layoutSaving = true;
    try {
      await new Promise<void>((resolve, reject) =>
        this.layoutService.saveLayout(this.customDisplay!).subscribe({
          next: () => resolve(), error: reject,
        }));
      this.layoutDirty = false;
      this.layoutEditMode = false;
      this.statusMessage = 'Layout saved.';
    } catch (err: any) {
      this.statusMessage = `Could not save the layout: ${err?.message || err}`;
    } finally {
      this.layoutSaving = false;
    }
  }

  async revertLayout(): Promise<void> {
    if (!this.config) return;
    try {
      await this.layoutService.revertToDefault(this.config);
      this.customDisplay = null;
      this.layoutEditMode = false;
      this.statusMessage =
        'Back to the default layout (the custom layout is kept and can '
        + 'be re-created).';
    } catch (err: any) {
      this.statusMessage = `Could not revert: ${err?.message || err}`;
    }
  }

  /** What can be placed into a selected empty cell. */
  get paletteOptions(): PaletteOption[] {
    const opts: PaletteOption[] = [];
    for (const p of this.scenePanels) {
      opts.push({
        label: `Scene: ${p.simSpaceRef}`, icon: 'view_in_ar',
        componentName: 'msim-scene-panel',
        inputs: { simSpaceRef: p.simSpaceRef, run: p.run || 'primary' },
      });
    }
    if (this.scenePanels[0] && this.comparisonRun) {
      opts.push({
        label: 'Scenario-comparison scene', icon: 'compare',
        componentName: 'msim-scene-panel',
        inputs: { simSpaceRef: this.scenePanels[0].simSpaceRef, run: 'compare' },
      });
    }
    for (const p of this.graphPanels) {
      opts.push({
        label: `Graph: ${p.graphRef}`, icon: 'show_chart',
        componentName: 'msim-graph-panel',
        inputs: { graphRef: p.graphRef, sourceClass: p.sourceClass || '',
                  runs: p.runs || ['primary'] },
      });
    }
    for (const p of this.icPanels) {
      opts.push({
        label: `Picker: ${p.icInterfaceRef}`, icon: 'tune',
        componentName: 'msim-ic-panel',
        inputs: { icInterfaceRef: p.icInterfaceRef },
      });
    }
    for (const p of this.explainerPanels) {
      opts.push({
        label: `Explainer: ${p.stageKey}`, icon: 'psychology',
        componentName: 'msim-explainer-panel',
        inputs: {
          stageKey: p.stageKey, title: p.title ?? '', body: p.body ?? '',
          showSearchSpace: p.showSearchSpace !== false,
          showGate: p.showGate !== false,
          showDerive: p.showDerive !== false,
          showConditionMap: p.showConditionMap !== false,
          showMeltLine: p.showMeltLine !== false,
        },
      });
    }
    return opts;
  }

  onLayoutCellSelected(ev: { row: DisplayRow, startSegment: number,
      spanSegments: number, availableWidth: number } | null): void {
    this.selectedCell = ev;
    if (ev) this.selectedColumnCell = null;
  }

  onLayoutColumnCellSelected(ev: { column: DisplayColumn, startSegment: number,
      spanSegments: number, availableHeight: number } | null): void {
    this.selectedColumnCell = ev;
    if (ev) this.selectedCell = null;
  }

  onLayoutItemRemoved(ev: { row: DisplayRow, itemIndex: number }): void {
    ev.row.removeItem(ev.itemIndex);
    this.layoutDirty = true;
    this.layoutRenderer?.clearSelection();
  }

  onLayoutColumnItemRemoved(ev: { column: DisplayColumn, itemIndex: number }): void {
    ev.column.removeItem(ev.itemIndex);
    this.layoutDirty = true;
    this.layoutRenderer?.clearColumnSelection();
  }

  /** Rail action: convert, then land in Run mode looking at the layout. */
  async onConvertLayoutFromRail(): Promise<void> {
    await this.convertLayout();
    this.mode = 'run';
  }

  /** Rail action: jump to Run mode with live layout editing on. */
  onEditLayoutFromRail(): void {
    this.mode = 'run';
    if (this.customDisplay) {
      this.layoutEditMode = true;
    } else if (this.config?.displayRef) {
      // Layout exists but wasn't loaded yet (e.g. entered straight into
      // Configure mode) — load it, then enter edit mode.
      this.layoutService.loadLayout(this.config.displayRef).subscribe({
        next: (d) => { this.customDisplay = d; this.layoutEditMode = true; },
        error: () => (this.customDisplayError =
          'The saved custom layout could not be loaded.'),
      });
    }
  }

  placeFromPalette(opt: PaletteOption): void {
    if (this.selectedCell) {
      const { row, startSegment, spanSegments } = this.selectedCell;
      this.layoutService.placeItem(
        row, startSegment, spanSegments, opt.componentName, opt.inputs,
        opt.label);
      this.selectedCell = null;
      this.layoutRenderer?.clearSelection();
      this.layoutDirty = true;
      return;
    }
    if (this.selectedColumnCell) {
      const { column, startSegment, spanSegments } = this.selectedColumnCell;
      column.addItem(this.layoutService.buildItem(
        startSegment, spanSegments, opt.componentName, opt.inputs, opt.label));
      this.selectedColumnCell = null;
      this.layoutRenderer?.clearColumnSelection();
      this.layoutDirty = true;
      return;
    }
    this.statusMessage =
      'Click an empty cell in the grid first, then pick what goes there.';
  }

  resolvePanelRun(panel: MsimPanel): string | undefined {
    if (!panel.run || panel.run === 'primary') return this.selectedRun ?? undefined;
    if (this.stageRunService.isStageToken(panel.run)) {
      return this.stageRunByKey.get(
        this.stageRunService.stageKeyOf(panel.run));
    }
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

  // ---------------------------------------------------------------
  // Panel reveal gating — a panel with a `reveal` config renders
  // collapsed behind a labeled disclosure until its condition holds
  // (stageActivity: the named stage has a resolved run). The user can
  // always expand it by hand; nothing is ever silently hidden.
  // ---------------------------------------------------------------

  /** Panels the user expanded despite an unmet reveal condition. */
  private revealOverrides = new Set<string>();

  panelRevealPending(panel: MsimPanel): boolean {
    const reveal = panel.reveal;
    if (!reveal || reveal.when !== 'stageActivity') return false;
    if (this.revealOverrides.has(this.trackPanel(0, panel))) return false;
    return !this.stageRunByKey.has(reveal.stageKey);
  }

  revealLabel(panel: MsimPanel): string {
    return panel.reveal?.label
      || `${panel.simSpaceRef ?? panel.kind} (waits for stage "${panel.reveal?.stageKey}")`;
  }

  expandRevealAnyway(panel: MsimPanel): void {
    this.revealOverrides.add(this.trackPanel(0, panel));
  }
}
