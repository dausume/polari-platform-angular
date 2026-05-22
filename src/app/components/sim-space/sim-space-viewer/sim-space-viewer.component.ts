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
} from '@models/sim-space/sim-space-types';
import { formatTimeValue, TimeUnitId } from '@models/sim-space/time-units';
import { createTooltipElement, renderTooltipForObject } from './viewer-tooltip';
import { SimSpaceLegendComponent } from './sim-space-legend.component';
import { SimSpaceAxisLegendComponent } from './sim-space-axis-legend.component';
import { SimSpaceScrubberComponent, ScrubberKind } from './sim-space-scrubber.component';
import { SimSpaceEvaluationOverlayComponent } from './sim-space-evaluation-overlay.component';
import { SimSpaceEvaluationSelectorComponent } from './sim-space-evaluation-selector.component';
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
  ],
  template: `
    <div class="viewer-host" #host></div>

    <div *ngIf="errorMessage" class="error-banner">{{ errorMessage }}</div>

    <div *ngIf="snapshot?.warnings?.length" class="warning-banner">
      <strong>Warnings:</strong>
      <ul>
        <li *ngFor="let w of snapshot?.warnings">{{ w }}</li>
      </ul>
    </div>

    <sim-space-axis-legend *ngIf="snapshot"
      [dimensionality]="snapshot.definition.dimensionality"
      [coordinateSystem]="snapshot.definition.coordinateSystem"
      [resolvedBindings]="snapshot.resolvedBindings || []"
      [viewport]="snapshot.definition.viewport || null"
      [axisLabels]="snapshot.definition.axisLabels || {}">
    </sim-space-axis-legend>

    <sim-space-legend
      [resolvedBindings]="snapshot?.resolvedBindings || []"
      [objects]="snapshot?.objects || []"
      [bottomOffsetPx]="legendBottomOffsetPx">
    </sim-space-legend>

    <!-- Scrubber — only rendered when the snapshot has temporal bindings.
         hasTemporal() reads resolvedBindings + emits objects' temporalValue. -->
    <sim-space-scrubber *ngIf="hasTemporal"
      [minTime]="temporalRange.min"
      [maxTime]="temporalRange.max"
      [kind]="temporalKind"
      [unit]="temporalUnit"
      [currentTime]="currentTime"
      (currentTimeChange)="onScrubberChange($event)"
      (collapsedChange)="scrubberCollapsed = $event">
    </sim-space-scrubber>

    <!-- Live-evaluation HUD — one always-visible selector pinned to
         the top-right; at most ONE overlay rendered to its immediate
         left. Toggling the active selection is the only way to make a
         readout appear, so multiple readouts never overlap. -->
    <div class="hud-stack" *ngIf="evaluations.length > 0">
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
  `,
  styles: [`
    :host { display: block; position: relative; width: 100%; height: 100%; min-height: 400px; }
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
  `]
})
export class SimSpaceViewerComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() simSpaceName?: string;
  @Input() clickNavigates = true;

  @ViewChild('host', { static: true }) hostRef!: ElementRef<HTMLDivElement>;

  snapshot: SimSpaceSnapshot | null = null;
  errorMessage: string | null = null;

  // Temporal state — driven by the scrubber when present.
  hasTemporal = false;
  temporalKind: ScrubberKind = 'time';
  temporalUnit: TimeUnitId = 'second';
  temporalRange = { min: 0, max: 1 };
  /** Cumulative mode draws every object up-to-current-time as a trail. */
  temporalCumulative = false;
  currentTime = 0;

  private renderer: SimSpaceRenderer | null = null;
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
    if (changes['simSpaceName'] && !changes['simSpaceName'].firstChange) {
      await this.load(this.simSpaceName);
    }
  }

  ngOnDestroy(): void {
    if (this.evalDebounceTimer !== null) {
      clearTimeout(this.evalDebounceTimer);
      this.evalDebounceTimer = null;
    }
    this.resizeObserver?.disconnect();
    this.renderer?.destroy();
    this.renderer = null;
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
      const snap = await this.simSpaceService.snapshot(name);
      this.snapshot = snap;
      this.computeTemporalState(snap);

      const dim = snap.definition.dimensionality;
      if (!this.renderer) {
        this.renderer = await this.rendererFactory.create(dim);
        this.renderer.attach(this.hostRef.nativeElement);
        this.wireRendererEvents();
      }
      this.renderer.loadDefinition(snap.definition);
      this.renderer.setObjects(this.visibleObjects());
      this.renderer.setConnections(this.visibleConnections());

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
        name, { time },
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
  private visibleObjects(): SimSpaceObject[] {
    if (!this.snapshot) return [];
    if (!this.hasTemporal) return this.snapshot.objects;

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
      return result;
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
    return result.concat(Array.from(latestByClass.values()));
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
    if (!this.hasTemporal) return conns;

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
      return result;
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
    return result.concat(Array.from(latestByClass.values()));
  }

  // -------------------------------------------------------------------
  // Renderer events — click + hover
  // -------------------------------------------------------------------

  private wireRendererEvents(): void {
    if (!this.renderer) return;
    this.renderer.setOnClick(({ id }) => {
      if (!id || !this.clickNavigates) return;
      const obj = this.snapshot?.objects.find(o => o.id === id);
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
    const obj = this.snapshot?.objects.find(o => o.id === id);
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
