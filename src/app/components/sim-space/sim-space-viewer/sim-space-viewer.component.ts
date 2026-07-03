/**
 * @cross-cutting
 * @tags @xc:render-shared
 * @consumers
 *   - SimSpaceDetailPage (full-page viewer)
 *   - Per-class binding-tab live preview (small embed)
 * @impact-on-edit
 *   This component is the dispatcher — it instantiates the right
 *   renderer for the loaded definition. Adding a new dimensionality
 *   means updating the factory, not this component.
 * @see /OVERLAP_MAP.md
 */

import {
  AfterViewInit,
  Component,
  ElementRef,
  Input,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

import { SimSpaceRendererFactory } from '@services/sim-space/sim-space-renderer-factory.service';
import { SimSpaceRenderer } from '@services/sim-space/sim-space-renderer.interface';
import { SimSpaceService } from '@services/sim-space/sim-space.service';
import { Shape2DLibraryService } from '@services/sim-space-2d/shape-2d-library.service';
import { Style2DLibraryService } from '@services/sim-space-2d/style-2d-library.service';
import { Mesh3DLibraryService } from '@services/sim-space-3d/mesh-3d-library.service';
import { Material3DLibraryService } from '@services/sim-space-3d/material-3d-library.service';
import {
  SimSpaceSnapshot,
  SimSpaceObject,
  SimSpaceConnection,
  SimSpaceDimensionality,
  SnapshotVector,
} from '@models/sim-space/sim-space-types';
import { formatTimeValue, TimeUnitId } from '@models/sim-space/time-units';
import { createTooltipElement, renderTooltipForObject } from './viewer-tooltip';
import { SimSpaceLegendComponent } from './sim-space-legend.component';
import { SimSpaceAxisLegendComponent } from './sim-space-axis-legend.component';
import { SimSpaceScrubberComponent, ScrubberKind } from './sim-space-scrubber.component';
import { SimSpaceEvaluationOverlayComponent } from './sim-space-evaluation-overlay.component';
import { SimSpaceEvaluationSelectorComponent } from './sim-space-evaluation-selector.component';
import { SimSpaceSimulationRunPanelComponent } from './sim-space-simulation-run-panel.component';
import {
  OverlayKey,
  OverlayVisibility,
  SimSpaceEditorSidebarComponent,
} from './sim-space-editor-sidebar.component';
import {
  SimSpaceEvaluationSnapshot,
  SimSpaceEvaluationStep,
} from '@models/sim-space/sim-space-types';

@Component({
  standalone: true,
  selector: 'sim-space-viewer',
  imports: [
    CommonModule,
    SimSpaceLegendComponent,
    SimSpaceAxisLegendComponent,
    SimSpaceScrubberComponent,
    SimSpaceEvaluationOverlayComponent,
    SimSpaceEvaluationSelectorComponent,
    SimSpaceSimulationRunPanelComponent,
    SimSpaceEditorSidebarComponent,
  ],
  template: `
    <div class="viewer-shell">
    <div class="canvas-region">
    <div class="viewer-host" #host></div>

    <div *ngIf="errorMessage" class="error-banner">{{ errorMessage }}</div>

    <div *ngIf="snapshot?.warnings?.length" class="warning-banner">
      <strong>Warnings:</strong>
      <ul>
        <li *ngFor="let w of snapshot?.warnings">{{ w }}</li>
      </ul>
    </div>

    <sim-space-axis-legend *ngIf="snapshot && overlayVisible.axes"
      [dimensionality]="snapshot.definition.dimensionality"
      [coordinateSystem]="snapshot.definition.coordinateSystem"
      [resolvedBindings]="snapshot.resolvedBindings || []"
      [viewport]="snapshot.definition.viewport || null"
      [axisLabels]="snapshot.definition.axisLabels || {}">
    </sim-space-axis-legend>

    <!-- Simulation run controller — top-left, below the axis legend.
         Visible only when the scene's bound *SimState classes
         participate in a SimulationDefinition. -->
    <div class="run-panel-anchor" *ngIf="simulationDefinitionName && !hideRunPanel">
      <sim-space-simulation-run-panel
        [simulationDefinitionName]="simulationDefinitionName"
        [defaultDtSeconds]="simulationDefaultDtSeconds"
        [bottomOffsetPx]="legendBottomOffsetPx"
        [timeUnit]="temporalUnit"
        (stepCommitted)="onSimulationStepCommitted()"
        (selectedRunChange)="onSelectedRunChange($event)">
      </sim-space-simulation-run-panel>
    </div>

    <sim-space-legend *ngIf="overlayVisible.legend"
      [resolvedBindings]="snapshot?.resolvedBindings || []"
      [objects]="snapshot?.objects || []"
      [bottomOffsetPx]="legendBottomOffsetPx">
    </sim-space-legend>

    <!-- Scrubber — needs a temporal binding AND at least two distinct
         recorded time points (a single step-0 row has no range to scrub). -->
    <sim-space-scrubber *ngIf="hasTemporal && temporalSampleCount >= 2"
      [minTime]="temporalRange.min"
      [maxTime]="temporalRange.max"
      [kind]="temporalKind"
      [unit]="temporalUnit"
      [currentTime]="currentTime"
      (currentTimeChange)="onScrubberChange($event)"
      (collapsedChange)="scrubberCollapsed = $event">
    </sim-space-scrubber>

    <!-- Not enough recorded steps to build a timeline yet. Only nudge when a
         simulation is actually bound to the scene (static scenes stay quiet). -->
    <div class="scrub-hint" *ngIf="simulationDefinitionName && !(hasTemporal && temporalSampleCount >= 2)">
      Record at least 2 steps to enable the timeline — use the
      <strong>Live simulation</strong> panel to Step Once or Run the simulation.
    </div>

    <!-- Live-evaluation HUD — one always-visible selector pinned to
         the top-right; at most ONE overlay rendered to its immediate
         left. Toggling the active selection is the only way to make a
         readout appear, so multiple readouts never overlap. -->
    <div class="hud-stack" *ngIf="evaluations.length > 0 && overlayVisible.evaluations">
      <sim-space-evaluation-overlay *ngIf="activeEvaluation"
        [evaluation]="activeEvaluation"
        [currentStep]="evaluationValueFor(activeEvaluation)">
      </sim-space-evaluation-overlay>
      <sim-space-evaluation-selector
        [evaluations]="evaluations"
        [activeName]="activeEvaluationName"
        (toggle)="onEvaluationToggle($event)">
      </sim-space-evaluation-selector>
    </div>
    </div><!-- /.canvas-region -->

    <!-- Right-side editor sidebar — push pattern (resizes the canvas
         region via the inner flex row, not an overlay). Always rendered
         so users can expand even on scenes without a simulation; the
         sidebar handles the empty-simulation case internally. -->
    <sim-space-editor-sidebar
      [simulationDefinitionName]="simulationDefinitionName"
      [definition]="snapshot?.definition || null"
      [overlayVisible]="overlayVisible"
      (overlayToggle)="onOverlayToggle($event)">
    </sim-space-editor-sidebar>
    </div><!-- /.viewer-shell -->
  `,
  styles: [`
    /* Host stays a plain block so it doesn't fight whatever the
       embedding page already declared for the sim-space-viewer tag
       (sim-space-detail-page sets display: block on the selector,
       which would otherwise override a host-level display: flex).
       The flex row layout lives one level deeper, in .viewer-shell. */
    :host {
      display: block;
      position: relative;
      width: 100%;
      height: 100%;
      min-height: 400px;
    }
    .viewer-shell {
      display: flex;
      flex-direction: row;
      width: 100%;
      height: 100%;
      overflow: hidden;
    }
    .canvas-region {
      position: relative;
      flex: 1;
      min-width: 0;
      height: 100%;
    }
    /* The d3/three renderer mounts inside .viewer-host. Constraining
       it to .canvas-region (instead of the host) is what makes the
       sidebar genuinely live outside the renderer — no overlap, no
       z-index gymnastics. When the sidebar expands the canvas region
       shrinks, the ResizeObserver fires, and the renderer reflows. */
    .viewer-host { position: absolute; inset: 0; }
    .error-banner, .warning-banner {
      position: absolute;
      top: 8px;
      left: 8px;
      right: 8px;
      padding: 8px 12px;
      border-radius: 4px;
      font-size: 0.85rem;
    }
    .error-banner { background: rgba(198, 40, 40, 0.92); color: white; }
    .scrub-hint {
      position: absolute;
      bottom: 12px;
      left: 50%;
      transform: translateX(-50%);
      max-width: 520px;
      padding: 8px 14px;
      border-radius: 6px;
      background: rgba(33, 33, 33, 0.82);
      color: #f0f0f0;
      font-size: 0.8rem;
      line-height: 1.35;
      text-align: center;
      pointer-events: none;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.25);
    }
    .scrub-hint strong { color: #fff; }
    .warning-banner {
      background: rgba(237, 108, 2, 0.12);
      color: #6a3c00;
      border-left: 3px solid #ed6c02;
    }
    .warning-banner ul { margin: 4px 0 0 0; padding-left: 18px; }

    /* HUD container — anchored top-right, lays the active overlay to
       the LEFT of the selector via a row-direction flex. Selector stays
       at the right edge regardless of whether an overlay is open. */
    .hud-stack {
      position: absolute;
      top: 12px;
      right: 12px;
      z-index: 2;
      display: flex;
      flex-direction: row;
      align-items: flex-start;
      gap: 8px;
      pointer-events: none; /* children re-enable as needed */
    }
    .hud-stack > * { pointer-events: auto; }

    /* Simulation run panel — top-left, parked under the axis legend
       (which sits at top: 12px). 320px clearance lets the legend stay
       readable when the run panel is open; the panel itself is
       collapsible so it stays small at rest. */
    .run-panel-anchor {
      position: absolute;
      top: 12px;
      left: 340px;
      z-index: 2;
      pointer-events: auto;
    }
  `]
})
export class SimSpaceViewerComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() simSpaceName?: string;
  @Input() clickNavigates = true;
  /** Pin the viewer to one SimulationRun (embedding pages set this so
   *  several viewers can show different runs side by side). When set it
   *  seeds/overrides `selectedRunName`; unset keeps the run panel's
   *  own selection behavior. */
  @Input() run?: string;
  /** Hide the embedded Live-simulation run panel — read-only embeds
   *  (e.g. the Multi-Scale Simulation Page, which owns its own run
   *  controls) don't want a second set of play buttons. */
  @Input() hideRunPanel = false;

  /** Which on-canvas overlays (axes / legend / evaluations HUD) are
   *  showing. Managed from the right sidebar's View toggles — the
   *  overlays crowd the canvas at embed sizes, so embedded viewers
   *  (hideRunPanel) default them OFF and the full page defaults ON.
   *  Choices persist per scene for the session. The run panel is NOT
   *  part of this — the menu that runs the simulation stays visible. */
  overlayVisible: OverlayVisibility =
    { axes: true, legend: true, evaluations: true };
  private overlaysInitializedFor: string | null = null;

  @ViewChild('host', { static: true }) hostRef!: ElementRef<HTMLDivElement>;

  snapshot: SimSpaceSnapshot | null = null;
  errorMessage: string | null = null;

  // Temporal state — driven by the scrubber when present.
  hasTemporal = false;
  /** Distinct recorded time points in the current run. The scrubber needs
   *  ≥2 to have a range; below that we show a "record more steps" hint. */
  temporalSampleCount = 0;
  temporalKind: ScrubberKind = 'time';
  temporalUnit: TimeUnitId = 'second';
  temporalRange = { min: 0, max: 1 };
  /** Cumulative mode draws every object up-to-current-time as a trail. */
  temporalCumulative = false;
  currentTime = 0;

  private renderer: SimSpaceRenderer | null = null;
  /** In-flight renderer creation, shared across concurrent load() calls.
   *  rendererFactory.create() is async (it dynamic-imports `three`), so a
   *  plain `if (!this.renderer)` guard is NOT atomic across the await — two
   *  load() calls (e.g. ngAfterViewInit racing an input change) both saw
   *  `renderer` null and each attached a canvas, leaving an orphan renderer
   *  frozen at t=0 visibly on top while the scrubber drove the hidden one.
   *  Sharing one creation promise guarantees a single renderer/canvas. */
  private rendererInit?: Promise<SimSpaceRenderer>;
  private resizeObserver?: ResizeObserver;
  private tooltipEl?: HTMLElement;
  private tooltipAttachedTo: string | null = null;

  /** Latest evaluated value per overlay, keyed by evaluation name.
   *  Populated on each debounced scrubber stop via the /evaluations/at
   *  endpoint; transient (never persisted, never in the snapshot). */
  evaluationValues = new Map<string, SimSpaceEvaluationStep>();

  /** Name of the evaluation overlay the user has opened, or null when
   *  no overlay is active. Owned here so the selector stays stateless. */
  activeEvaluationName: string | null = null;

  /** Mirrors the scrubber's collapse state so we can push the scene-
   *  contents legend clear of whichever scrubber footprint is showing. */
  scrubberCollapsed = false;

  /** The first SimulationDefinition whose `*SimState` classes are bound
   *  to this scene. Read from the snapshot's top-level
   *  `participatingSimulations` so it stays stable regardless of run
   *  filter / instance count — a fresh empty live run still resolves
   *  the simulation membership and keeps the run panel visible. */
  get simulationDefinitionName(): string | null {
    const sims = this.snapshot?.participatingSimulations ?? [];
    return sims[0] ?? null;
  }

  /** Default dt in seconds for the active sim def, surfaced as the
   *  IC editor's dt-override placeholder. 0 = unknown (fallback to
   *  generic "sim default" placeholder text in the editor). */
  get simulationDefaultDtSeconds(): number {
    const name = this.simulationDefinitionName;
    if (!name) return 0;
    return this.snapshot?.simulationDefaultsByName?.[name]?.timeStepSeconds ?? 0;
  }

  /** The run the viewer is currently scoped to. Snapshot fetches pass
   *  this through as `?run=<name>` so multi-run scenes don't render
   *  overlapping data. */
  selectedRunName: string | null = null;

  /** When the run panel commits a new step, refresh the snapshot so the
   *  new *SimState rows appear in the scene + scrubber range expands. */
  async onSimulationStepCommitted(): Promise<void> {
    if (!this.simSpaceName) return;
    await this.load(this.simSpaceName);
  }

  /** Run panel emitted a selection change — re-fetch the snapshot
   *  filtered to that run so the viewer shows ONLY this run's rows. */
  async onSelectedRunChange(runName: string | null): Promise<void> {
    if (this.selectedRunName === runName) return;
    this.selectedRunName = runName;
    if (this.simSpaceName) {
      await this.load(this.simSpaceName);
    }
  }

  /** Bottom offset (px) for the scene-contents legend. Without temporal
   *  bindings the scrubber doesn't render at all, so we sit at the
   *  bottom corner. With a compact scrubber, lift ~60px; with the full
   *  scrubber, lift ~76px. Eliminates the collision the user hit. */
  get legendBottomOffsetPx(): number {
    if (!this.hasTemporal) return 12;
    return this.scrubberCollapsed ? 60 : 76;
  }

  /** Debounce timer for the on-stop evaluation fetch. */
  private evalDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  /** Debounce window (ms) — long enough that scrubber dragging doesn't
   *  spam the server, short enough that a pause feels responsive. */
  private readonly EVAL_DEBOUNCE_MS = 250;
  /** Monotonic request token so an in-flight reply from a stale step
   *  doesn't clobber a more recent answer. */
  private evalRequestSeq = 0;

  /** Convenience getter so the template doesn't deal with the optional
   *  + ordering each time. */
  get evaluations(): SimSpaceEvaluationSnapshot[] {
    const evs = this.snapshot?.evaluations ?? [];
    return [...evs].sort(
      (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)
        || a.name.localeCompare(b.name)
    );
  }

  /** The currently-open evaluation, or null if none. */
  get activeEvaluation(): SimSpaceEvaluationSnapshot | null {
    if (!this.activeEvaluationName) return null;
    return this.evaluations.find(e => e.name === this.activeEvaluationName) ?? null;
  }

  /** Selector click handler — same name twice closes; different name
   *  switches; first click opens. Triggers an immediate fetch so the
   *  newly-opened overlay paints with the right value (the debounce
   *  isn't needed since this is an explicit user action). */
  onEvaluationToggle(name: string): void {
    if (this.activeEvaluationName === name) {
      this.activeEvaluationName = null;
      return;
    }
    this.activeEvaluationName = name;
    this.fetchEvaluationsAtCurrent();
  }

  trackEvaluation(_: number, ev: SimSpaceEvaluationSnapshot): string {
    return ev.id;
  }

  constructor(
    private simSpaceService: SimSpaceService,
    private rendererFactory: SimSpaceRendererFactory,
    private shapes: Shape2DLibraryService,
    private styles: Style2DLibraryService,
    private meshes3D: Mesh3DLibraryService,
    private materials3D: Material3DLibraryService,
    private router: Router
  ) {}

  async ngAfterViewInit(): Promise<void> {
    this.initOverlayVisibility();
    await Promise.all([
      this.shapes.load(),
      this.styles.load(),
      this.meshes3D.load(),
      this.materials3D.load(),
    ]);
    if (this.simSpaceName) await this.load(this.simSpaceName);
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.renderer?.onHostResize());
      this.resizeObserver.observe(this.hostRef.nativeElement);
    }
  }

  async ngOnChanges(changes: SimpleChanges): Promise<void> {
    // Pinned run: seed the selection BEFORE any load so even the first
    // snapshot fetch is scoped to it (initial ngOnChanges fires before
    // ngAfterViewInit's load).
    if (changes['run']) {
      this.selectedRunName = this.run ?? this.selectedRunName;
    }
    const runChanged = changes['run'] && !changes['run'].firstChange;
    const nameChanged =
      changes['simSpaceName'] && !changes['simSpaceName'].firstChange;
    if (nameChanged) this.initOverlayVisibility();
    if (nameChanged || runChanged) {
      await this.load(this.simSpaceName);
    }
  }

  /** Defaults + per-scene session persistence for the overlay toggles.
   *  Embedded viewers (the page owns the run controls → hideRunPanel)
   *  start clean; the full-page viewer keeps everything on. */
  private initOverlayVisibility(): void {
    const key = this.overlayStorageKey();
    if (this.overlaysInitializedFor === key) return;
    this.overlaysInitializedFor = key;
    const base = this.hideRunPanel ? false : true;
    let stored: Partial<OverlayVisibility> = {};
    try {
      stored = JSON.parse(sessionStorage.getItem(key) ?? '{}');
    } catch { /* corrupt entry — fall back to defaults */ }
    this.overlayVisible = {
      axes: stored.axes ?? base,
      legend: stored.legend ?? base,
      evaluations: stored.evaluations ?? base,
    };
  }

  onOverlayToggle(overlay: OverlayKey): void {
    this.overlayVisible = {
      ...this.overlayVisible,
      [overlay]: !this.overlayVisible[overlay],
    };
    try {
      sessionStorage.setItem(
        this.overlayStorageKey(), JSON.stringify(this.overlayVisible));
    } catch { /* storage unavailable — toggles still work this page-life */ }
  }

  private overlayStorageKey(): string {
    return `simspace-overlays:${this.simSpaceName ?? ''}:`
      + `${this.hideRunPanel ? 'embed' : 'full'}`;
  }

  /** Re-fetch the current snapshot. Public so embedding pages that own
   *  their own run controls (panel hidden) can refresh viewers after
   *  committing steps. */
  async refresh(): Promise<void> {
    await this.load(this.simSpaceName);
  }

  ngOnDestroy(): void {
    if (this.evalDebounceTimer !== null) {
      clearTimeout(this.evalDebounceTimer);
      this.evalDebounceTimer = null;
    }
    this.resizeObserver?.disconnect();
    this.renderer?.destroy();
    this.renderer = null;
    this.rendererInit = undefined;
    this.tooltipEl = undefined;
    this.tooltipAttachedTo = null;
  }

  // -------------------------------------------------------------------
  // Snapshot loading + scrubber initialization
  // -------------------------------------------------------------------

  private async load(name: string | undefined): Promise<void> {
    if (!name) return;
    this.errorMessage = null;
    try {
      const snap = await this.simSpaceService.snapshot(name, {
        run: this.selectedRunName,
      });
      this.snapshot = snap;
      this.computeTemporalState(snap);

      const renderer = await this.ensureRenderer(snap.definition.dimensionality);
      renderer.loadDefinition(snap.definition);
      renderer.setObjects(this.visibleObjects());
      renderer.setConnections(this.visibleConnections());
      renderer.setVectors(this.visibleVectors());

      // No overlay auto-opens on load — the user picks via the
      // selector. So no initial evaluation fetch here; the first
      // overlay click triggers its own fetch.
      this.evaluationValues.clear();
      this.activeEvaluationName = null;
    } catch (err: any) {
      this.errorMessage = err?.message || String(err);
      this.snapshot = null;
    }
  }

  /** Create + attach the renderer exactly once, even when load() is called
   *  concurrently. The first caller kicks off creation and stores the promise;
   *  every caller (including the first) awaits that same promise, so there is
   *  ever only one renderer and one canvas. See `rendererInit`. */
  private ensureRenderer(dim: SimSpaceDimensionality): Promise<SimSpaceRenderer> {
    if (this.renderer) return Promise.resolve(this.renderer);
    if (!this.rendererInit) {
      this.rendererInit = (async () => {
        const r = await this.rendererFactory.create(dim);
        r.attach(this.hostRef.nativeElement);
        this.renderer = r;
        this.wireRendererEvents();
        return r;
      })();
    }
    return this.rendererInit;
  }

  /** Schedule a debounced fetch of evaluation values for the current
   *  scrubber position. Subsequent calls within the debounce window
   *  reset the timer — so a continuous drag fires zero requests until
   *  the user finally settles on a value. Skips entirely when no
   *  overlay is open; nothing would display the result anyway. */
  private scheduleEvaluationFetch(): void {
    if (!this.simSpaceName) return;
    if (!this.activeEvaluationName) return;
    if (this.evalDebounceTimer !== null) {
      clearTimeout(this.evalDebounceTimer);
    }
    this.evalDebounceTimer = setTimeout(() => {
      this.evalDebounceTimer = null;
      this.fetchEvaluationsAtCurrent();
    }, this.EVAL_DEBOUNCE_MS);
  }

  /** Fetch evaluation values at the current scrubber time. Tagged with
   *  a monotonic request token so an out-of-order reply from a stale
   *  step doesn't overwrite a fresher answer. */
  private async fetchEvaluationsAtCurrent(): Promise<void> {
    const name = this.simSpaceName;
    if (!name) return;
    const seq = ++this.evalRequestSeq;
    const time = this.currentTime;
    try {
      const { evaluations } = await this.simSpaceService.evaluationsAt(
        name, { time, run: this.selectedRunName },
      );
      // Stale-reply guard.
      if (seq !== this.evalRequestSeq || this.simSpaceName !== name) return;
      const next = new Map<string, SimSpaceEvaluationStep>();
      for (const ev of evaluations) {
        const first = ev.perStep?.[0];
        if (first) next.set(ev.name, first);
      }
      this.evaluationValues = next;
    } catch {
      // Silent — the overlay just shows "—" until a future stop succeeds.
      // No persistent state on the server to corrupt; the user can pause
      // again to retry.
    }
  }

  /** Resolves the transient value to feed the overlay component. Returns
   *  null when we haven't yet fetched a value for this overlay — the
   *  overlay then renders a placeholder. */
  evaluationValueFor(ev: SimSpaceEvaluationSnapshot): SimSpaceEvaluationStep | null {
    return this.evaluationValues.get(ev.name) ?? null;
  }

  /**
   * Inspect snapshot to set up scrubber state. Picks the first temporal
   * binding it finds — multiple bindings with different temporal fields
   * would scrub independently; merging that into one scrubber is a
   * judgment call we defer until users hit it.
   */
  private computeTemporalState(snap: SimSpaceSnapshot): void {
    const bindings = snap.resolvedBindings || [];
    const temporalBinding = bindings.find(b => b.temporal)?.temporal;
    if (!temporalBinding) {
      this.hasTemporal = false;
      this.temporalSampleCount = 0;
      return;
    }
    this.hasTemporal = true;
    this.temporalKind = temporalBinding.kind;
    this.temporalUnit = (temporalBinding.unit as TimeUnitId) || 'second';
    this.temporalCumulative = !!temporalBinding.cumulative;

    // Derive range from objects' temporalValue.
    const values = snap.objects
      .map(o => o.temporalValue)
      .filter((v): v is number => v !== undefined);
    this.temporalSampleCount = new Set(values).size;
    if (values.length === 0) {
      this.temporalRange = { min: 0, max: 1 };
    } else {
      this.temporalRange = {
        min: Math.min(...values),
        max: Math.max(...values),
      };
    }
    // Default scrubber to t=0 (or min) on every load.
    this.currentTime = this.temporalRange.min;
  }

  onScrubberChange(t: number): void {
    this.currentTime = t;
    if (this.renderer) {
      this.renderer.setObjects(this.visibleObjects());
      this.renderer.setConnections(this.visibleConnections());
      this.renderer.setVectors(this.visibleVectors());
    }
    // Equation values are recomputed only after the scrubber has been
    // stationary for the debounce window — so live dragging doesn't
    // hammer the server, but a deliberate stop refreshes promptly.
    this.scheduleEvaluationFetch();
  }

  /**
   * Filter the snapshot's objects to the set visible at currentTime.
   *
   *   - Objects WITHOUT a temporalValue (freestanding shapes, untemporal
   *     class bindings) are always visible.
   *   - Objects WITH a temporalValue render under two rules:
   *       cumulative=true  → visible when temporalValue ≤ currentTime
   *       cumulative=false → visible only when this is the row whose
   *                          temporalValue is the latest ≤ currentTime
   *                          per (className, classRef.instanceId-prefix).
   *         A pendulum thus shows one bob at a time.
   */
  /**
   * Stamp the stable render-track key the renderer binds a persistent mesh
   * to (see SimSpaceObject.trackKey). The rule mirrors visibleObjects'
   * collapse:
   *   - snapshot mode (one row on screen per class) → key by class/track, so
   *     the renderer keeps ONE mesh and just repositions it as the scrubber
   *     advances (no per-frame destroy + rebuild).
   *   - cumulative/trail mode + untemporal objects → key by `id`, so every
   *     row gets its own persistent mesh (the trail) / stable pivot etc.
   * Mutating the transient render record in place is fine — these are not
   * tree-objects, they're rebuilt from the snapshot each load.
   */
  private trackKeyFor(o: SimSpaceObject | SimSpaceConnection): string {
    const snapshotMode = o.temporalValue !== undefined && !this.temporalCumulative;
    return snapshotMode ? (o.classRef?.className ?? o.id) : o.id;
  }

  private visibleObjects(): SimSpaceObject[] {
    if (!this.snapshot) return [];
    if (!this.hasTemporal) {
      return this.snapshot.objects.map(o => (o.trackKey = this.trackKeyFor(o), o));
    }

    const cumulative = this.temporalCumulative;
    const result: SimSpaceObject[] = [];
    // Untemporal objects always show.
    const temporal: SimSpaceObject[] = [];
    for (const obj of this.snapshot.objects) {
      if (obj.temporalValue === undefined) {
        result.push(obj);
      } else {
        temporal.push(obj);
      }
    }
    if (cumulative) {
      for (const obj of temporal) {
        if (obj.temporalValue! <= this.currentTime) result.push(obj);
      }
      return result.map(o => (o.trackKey = this.trackKeyFor(o), o));
    }
    // Snapshot mode: pick the most-recent-but-not-exceeding object per
    // class. Two pendulums in the same scene would each show one bob.
    const latestByClass = new Map<string, SimSpaceObject>();
    for (const obj of temporal) {
      if (obj.temporalValue! > this.currentTime) continue;
      const key = obj.classRef?.className ?? obj.id;
      const prior = latestByClass.get(key);
      if (!prior || obj.temporalValue! > prior.temporalValue!) {
        latestByClass.set(key, obj);
      }
    }
    return result.concat(Array.from(latestByClass.values()))
      .map(o => (o.trackKey = this.trackKeyFor(o), o));
  }

  /**
   * Connection-side analogue of visibleObjects(). Connection-mode
   * bindings (e.g. a pendulum string) emit one SimSpaceConnection per
   * row with a temporalValue; the same cumulative / snapshot rules apply
   * here so the line stays in sync with the bob as the scrubber advances.
   *
   * Connections without a temporalValue (e.g. no-code editor transitions)
   * always render.
   */
  private visibleConnections(): SimSpaceConnection[] {
    if (!this.snapshot) return [];
    const conns = this.snapshot.connections || [];
    if (!this.hasTemporal) {
      return conns.map(c => (c.trackKey = this.trackKeyFor(c), c));
    }

    const cumulative = this.temporalCumulative;
    const result: SimSpaceConnection[] = [];
    const temporal: SimSpaceConnection[] = [];
    for (const c of conns) {
      if (c.temporalValue === undefined) {
        result.push(c);
      } else {
        temporal.push(c);
      }
    }
    if (cumulative) {
      for (const c of temporal) {
        if (c.temporalValue! <= this.currentTime) result.push(c);
      }
      return result.map(c => (c.trackKey = this.trackKeyFor(c), c));
    }
    const latestByClass = new Map<string, SimSpaceConnection>();
    for (const c of temporal) {
      if (c.temporalValue! > this.currentTime) continue;
      const key = c.classRef?.className ?? c.id;
      const prior = latestByClass.get(key);
      if (!prior || c.temporalValue! > prior.temporalValue!) {
        latestByClass.set(key, c);
      }
    }
    return result.concat(Array.from(latestByClass.values()))
      .map(c => (c.trackKey = this.trackKeyFor(c), c));
  }

  /**
   * State-Projection analogue of visibleObjects()/visibleConnections().
   * `vector` bindings emit one SnapshotVector per row with a temporalValue
   * (origin + vec read off the bob's row at that step); the same cumulative
   * / snapshot rules apply so the arrow stays pinned to the bob as the
   * scrubber advances. Vectors without a temporalValue always render.
   *
   * Unlike objects/connections there is no trackKey to stamp — the renderer
   * reuses arrows by SnapshotVector.key, which the 3D compiler emits as
   * `bindingName:className` (stable across timesteps for one logical
   * projection). Keying on the per-step instanceId instead would mint a fresh
   * key every step, so collapse-by-key below would keep them all → a trail.
   */
  private visibleVectors(): SnapshotVector[] {
    if (!this.snapshot) return [];
    const vectors = this.snapshot.vectors || [];
    if (!this.hasTemporal) return vectors;

    const cumulative = this.temporalCumulative;
    const result: SnapshotVector[] = [];
    const temporal: SnapshotVector[] = [];
    for (const v of vectors) {
      if (v.temporalValue === undefined) {
        result.push(v);
      } else {
        temporal.push(v);
      }
    }
    if (cumulative) {
      for (const v of temporal) {
        if (v.temporalValue! <= this.currentTime) result.push(v);
      }
      return result;
    }
    // Snapshot mode: most-recent-but-not-exceeding per projection. Keyed by
    // SnapshotVector.key (bindingName:className → one arrow per projection),
    // so two force arrows on the same bob (gravity vs net) each keep their own
    // current row while every step of a single projection collapses to one.
    const latestByKey = new Map<string, SnapshotVector>();
    for (const v of temporal) {
      if (v.temporalValue! > this.currentTime) continue;
      const prior = latestByKey.get(v.key);
      if (!prior || v.temporalValue! > prior.temporalValue!) {
        latestByKey.set(v.key, v);
      }
    }
    return result.concat(Array.from(latestByKey.values()));
  }

  // -------------------------------------------------------------------
  // Renderer events — click + hover
  // -------------------------------------------------------------------

  private wireRendererEvents(): void {
    if (!this.renderer) return;
    this.renderer.setOnClick(({ id }) => {
      if (!id || !this.clickNavigates) return;
      // Same colliding-id hazard as the hover path: prefer the visible row so
      // navigation targets the instance actually on screen, not the t=0 row.
      const obj = this.visibleObjects().find(o => o.id === id)
        ?? this.snapshot?.objects.find(o => o.id === id);
      if (obj?.classRef) {
        this.router.navigate(['/class-main-page', obj.classRef.className, obj.classRef.instanceId]);
      }
    });
    this.renderer.setOnHoverChange((id) => {
      this.renderer?.setHighlight(id);
      this.updateHoverTooltip(id);
    });
  }

  private updateHoverTooltip(id: string | null): void {
    if (!this.renderer) return;
    if (this.tooltipAttachedTo && this.tooltipAttachedTo !== id) {
      this.renderer.detachOverlay(this.tooltipAttachedTo);
      this.tooltipAttachedTo = null;
    }
    if (!id) return;
    // Resolve the hovered id against the currently-VISIBLE set first: the full
    // snapshot.objects list holds one row PER TIMESTEP, so a plain .find() over
    // it returns the first (t=0) row on any id collision. Fall back to the full
    // list only if the visible set has no match.
    const obj = this.visibleObjects().find(o => o.id === id)
      ?? this.snapshot?.objects.find(o => o.id === id);
    if (!obj) return;
    if (!this.tooltipEl) this.tooltipEl = createTooltipElement();
    renderTooltipForObject(this.tooltipEl, obj, this.formatTemporalLabel(obj));
    this.renderer.attachOverlay(id, 'top', this.tooltipEl);
    this.tooltipAttachedTo = id;
  }

  /** Pre-formatted temporal-value string for the tooltip (e.g. "t = 1.24 s"
   * or "step 30"). Returns undefined when the object has no temporalValue. */
  private formatTemporalLabel(obj: SimSpaceObject): string | undefined {
    if (obj.temporalValue === undefined) return undefined;
    if (this.temporalKind === 'step') {
      const stepNum = Math.round(obj.temporalValue);
      return `step ${stepNum}`;
    }
    return `t = ${formatTimeValue(obj.temporalValue, this.temporalUnit)}`;
  }
}
