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

@Component({
  standalone: true,
  selector: 'sim-space-viewer',
  imports: [
    CommonModule,
    SimSpaceLegendComponent,
    SimSpaceAxisLegendComponent,
    SimSpaceScrubberComponent,
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
      [resolvedBindings]="snapshot.resolvedBindings || []">
    </sim-space-axis-legend>

    <sim-space-legend
      [resolvedBindings]="snapshot?.resolvedBindings || []"
      [objects]="snapshot?.objects || []">
    </sim-space-legend>

    <!-- Scrubber — only rendered when the snapshot has temporal bindings.
         hasTemporal() reads resolvedBindings + emits objects' temporalValue. -->
    <sim-space-scrubber *ngIf="hasTemporal"
      [minTime]="temporalRange.min"
      [maxTime]="temporalRange.max"
      [kind]="temporalKind"
      [unit]="temporalUnit"
      [currentTime]="currentTime"
      (currentTimeChange)="onScrubberChange($event)">
    </sim-space-scrubber>
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
    } catch (err: any) {
      this.errorMessage = err?.message || String(err);
      this.snapshot = null;
    }
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
