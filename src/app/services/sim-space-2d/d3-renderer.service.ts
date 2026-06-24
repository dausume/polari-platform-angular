/**
 * @cross-cutting
 * @tags @xc:render-2d
 * @consumers
 *   - SimSpace2DViewer component (primary)
 *   - Per-class Sim Space → 2D binding-tab live preview
 *   - (Phase 1.5+) no-code editor after migration off d3-extensions/
 * @impact-on-edit
 *   This is the only file allowed to `import 'd3'` outside the no-code
 *   editor's existing d3-extensions/ directory. Adding d3 elsewhere
 *   breaks the consumption boundary documented in OVERLAP_MAP.md.
 *
 *   Test impact: SimSpace2D demo (render circles + click), then any
 *   class binding configured to render in a SimSpace2D.
 * @see /OVERLAP_MAP.md
 *
 * D3-backed 2D renderer — lifecycle + reconciliation only. Painters,
 * axes, style resolution, and pure helpers live alongside in:
 *   - d3-shape-painters.ts    SVG primitives per built-in shape
 *   - d3-axes.ts              axes + grid + tick labels
 *   - d3-utils.ts             tiny pure helpers (CSS transforms, etc.)
 *   - style-2d-resolver.ts    Style2DDef ↔ ResolvedStyle2D + fallbacks
 *
 * NOT a singleton — each viewer instantiates its own (a renderer holds
 * mutable DOM state tied to one canvas). The viewer is responsible for
 * destroying it on component teardown.
 */

import { Injectable } from '@angular/core';
import * as d3 from 'd3';

import {
  SimSpaceObject,
  SimSpaceConnection,
  SimSpaceDefinitionPayload,
  SimSpaceScreenPosition,
  SnapshotVector,
} from '@models/sim-space/sim-space-types';
import {
  SimSpaceRenderer,
  SimSpacePickResult,
  SimSpaceTransformPatch,
} from '@services/sim-space/sim-space-renderer.interface';
import {
  CoordTransform,
  ScreenBox,
  buildTransform2D,
} from '@models/sim-space/sim-space-coords';
import { Shape2DLibraryService } from './shape-2d-library.service';
import { Style2DLibraryService } from './style-2d-library.service';
import { paintShape2D, paintShapeLabel } from './d3-shape-painters';
import { paintAxes2D } from './d3-axes';
import {
  cssEscape,
  objectTransformAttr,
  transformForAnchor,
} from './d3-utils';
import {
  resolveStyle2D,
  fallbackShape,
} from './style-2d-resolver';

@Injectable()
export class D3SimSpaceRenderer implements SimSpaceRenderer {
  private host?: HTMLElement;
  private svg?: d3.Selection<SVGSVGElement, unknown, null, undefined>;
  private rootGroup?: d3.Selection<SVGGElement, unknown, null, undefined>;
  private axesGroup?: d3.Selection<SVGGElement, unknown, null, undefined>;
  private objectsGroup?: d3.Selection<SVGGElement, unknown, null, undefined>;
  private connectionsGroup?: d3.Selection<SVGGElement, unknown, null, undefined>;
  private overlaysGroup?: d3.Selection<SVGGElement, unknown, null, undefined>;

  private definition?: SimSpaceDefinitionPayload;
  private currentObjects = new Map<string, SimSpaceObject>();
  private currentConnections = new Map<string, SimSpaceConnection>();
  private transform!: CoordTransform;

  private overlays = new Map<
    string,
    { el: HTMLElement; anchor: 'center' | 'top' | 'right' | 'bottom' | 'left' }
  >();

  private hoveredId: string | null = null;
  private onClick?: (result: SimSpacePickResult) => void;
  private onHoverChange?: (id: string | null) => void;
  private onTransformChange?: (id: string, patch: SimSpaceTransformPatch) => void;
  private onViewChange?: () => void;

  constructor(
    private shapes: Shape2DLibraryService,
    private styles: Style2DLibraryService
  ) {}

  // -------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------

  attach(host: HTMLElement): void {
    if (this.svg) {
      throw new Error('D3SimSpaceRenderer already attached — call destroy() first.');
    }
    this.host = host;
    while (host.firstChild) host.removeChild(host.firstChild);

    this.svg = d3
      .select(host)
      .append('svg')
      .attr('width', '100%')
      .attr('height', '100%')
      .style('display', 'block')
      .style('cursor', 'default')
      // Let tick labels + edge shapes spill outside the SVG bounds.
      // SVG defaults to overflow:hidden which clips axis numbers at the
      // canvas edge.
      .style('overflow', 'visible');

    this.rootGroup = this.svg.append('g').attr('class', 'sim-space-root');
    this.axesGroup = this.rootGroup.append('g').attr('class', 'sim-space-axes');
    this.connectionsGroup = this.rootGroup.append('g').attr('class', 'sim-space-connections');
    this.objectsGroup = this.rootGroup.append('g').attr('class', 'sim-space-objects');
    this.overlaysGroup = this.rootGroup.append('g').attr('class', 'sim-space-overlays');

    this.svg.on('click', (event: MouseEvent) => {
      const result = this.pickAt(this.localScreenPos(event));
      this.onClick?.(result);
    });
    this.svg.on('mousemove', (event: MouseEvent) => {
      const result = this.pickAt(this.localScreenPos(event));
      if (result.id !== this.hoveredId) {
        this.hoveredId = result.id;
        this.onHoverChange?.(result.id);
      }
    });

    this.transform = buildTransform2D('math', undefined, this.hostBox(), 1);
  }

  destroy(): void {
    if (!this.host) return;
    this.svg?.on('click', null).on('mousemove', null);
    this.svg?.remove();
    this.svg = undefined;
    this.rootGroup = this.objectsGroup = this.connectionsGroup = undefined;
    this.overlaysGroup = this.axesGroup = undefined;
    this.host = undefined;
    this.currentObjects.clear();
    this.currentConnections.clear();
    this.overlays.clear();
    this.hoveredId = null;
  }

  loadDefinition(def: SimSpaceDefinitionPayload): void {
    this.definition = def;
    this.transform = buildTransform2D(
      def.coordinateSystem, def.viewport, this.hostBox(), def.unitScale ?? 1
    );
    this.repaintAll();
    this.onViewChange?.();
  }

  onHostResize(): void {
    if (!this.definition) return;
    this.transform = buildTransform2D(
      this.definition.coordinateSystem,
      this.definition.viewport,
      this.hostBox(),
      this.definition.unitScale ?? 1
    );
    this.repaintAll();
    this.onViewChange?.();
  }

  // -------------------------------------------------------------------
  // Object lifecycle (reconciler)
  // -------------------------------------------------------------------

  setObjects(objects: SimSpaceObject[]): void {
    this.currentObjects = new Map(objects.map(o => [o.id, o]));
    this.repaintObjects();
  }

  updateObjectTransform(id: string, patch: SimSpaceTransformPatch): void {
    const obj = this.currentObjects.get(id);
    if (!obj) return;
    const updated: SimSpaceObject = {
      ...obj,
      position: patch.position ?? obj.position,
      rotation: patch.rotation ?? obj.rotation,
      scale: patch.scale ?? obj.scale,
    };
    this.currentObjects.set(id, updated);
    const node = this.objectsGroup?.select<SVGGElement>(`g[data-id="${cssEscape(id)}"]`);
    if (node && !node.empty()) {
      node.attr('transform', objectTransformAttr(updated, this.transform));
    }
    this.repositionOverlay(id);
  }

  setConnections(connections: SimSpaceConnection[]): void {
    this.currentConnections = new Map(connections.map(c => [c.id, c]));
    this.repaintConnections();
  }

  /**
   * State-Projection vectors. 2D arrow parity (a <line> + SVG marker-end
   * triangle, design §5b) is deferred — no-op for now so the shared
   * interface stays satisfied without changing 2D behavior.
   */
  setVectors(_vectors: SnapshotVector[]): void {
    // intentional no-op until 2D arrow rendering lands (design §5b)
  }

  // -------------------------------------------------------------------
  // Interaction
  // -------------------------------------------------------------------

  pickAt(screenPos: SimSpaceScreenPosition): SimSpacePickResult {
    if (!this.host || !this.objectsGroup) return { id: null, screenPos };
    const rect = this.host.getBoundingClientRect();
    const doc = this.host.ownerDocument ?? document;
    const target = doc.elementFromPoint(
      rect.left + screenPos.x, rect.top + screenPos.y
    ) as Element | null;
    let cursor: Element | null = target;
    while (cursor && cursor !== this.host) {
      const id = cursor.getAttribute?.('data-id');
      if (id) return { id, screenPos };
      cursor = cursor.parentElement;
    }
    return { id: null, screenPos };
  }

  setHighlight(id: string | null): void {
    this.objectsGroup
      ?.selectAll<SVGGElement, unknown>('g.sim-space-object')
      .classed('sim-space-highlighted', (_, __, nodes) => {
        const dataId = (nodes[0] as SVGElement | null)?.getAttribute('data-id');
        return dataId !== null && dataId === id;
      });
  }

  setSelection(ids: string[]): void {
    const set = new Set(ids);
    this.objectsGroup
      ?.selectAll<SVGGElement, SimSpaceObject>('g.sim-space-object')
      .classed('sim-space-selected', (d) => set.has(d.id));
  }

  zoomToFit(): void {
    if (this.definition) this.loadDefinition(this.definition);
  }

  // -------------------------------------------------------------------
  // Overlays
  // -------------------------------------------------------------------

  attachOverlay(
    objectId: string,
    anchor: 'center' | 'top' | 'right' | 'bottom' | 'left',
    el: HTMLElement
  ): void {
    if (!this.host) return;
    el.style.position = 'absolute';
    el.style.transform = transformForAnchor(anchor);
    if (!el.style.pointerEvents) el.style.pointerEvents = 'auto';
    if (el.parentNode !== this.host) this.host.appendChild(el);
    this.overlays.set(objectId, { el, anchor });
    this.repositionOverlay(objectId);
  }

  detachOverlay(objectId: string): void {
    const entry = this.overlays.get(objectId);
    if (!entry) return;
    entry.el.parentNode?.removeChild(entry.el);
    this.overlays.delete(objectId);
  }

  // -------------------------------------------------------------------
  // Event subscriptions
  // -------------------------------------------------------------------

  setOnClick(handler: (result: SimSpacePickResult) => void): void { this.onClick = handler; }
  setOnHoverChange(handler: (id: string | null) => void): void { this.onHoverChange = handler; }
  setOnTransformChange(handler: (id: string, patch: SimSpaceTransformPatch) => void): void {
    this.onTransformChange = handler;
  }
  setOnViewChange(handler: () => void): void { this.onViewChange = handler; }

  // -------------------------------------------------------------------
  // Internals — paint coordination
  // -------------------------------------------------------------------

  private repaintAll(): void {
    if (!this.axesGroup || !this.definition) return;
    paintAxes2D(
      this.axesGroup,
      this.definition.coordinateSystem,
      this.definition.viewport,
      this.transform,
      this.hostBox(),
    );
    this.repaintObjects();
    this.repaintConnections();
    this.repositionOverlays();
  }

  private repaintObjects(): void {
    if (!this.objectsGroup) return;
    const data = Array.from(this.currentObjects.values());
    const join = this.objectsGroup
      .selectAll<SVGGElement, SimSpaceObject>('g.sim-space-object')
      .data(data, d => d.id);

    join.exit().remove();

    const entered = join.enter()
      .append('g')
      .attr('class', 'sim-space-object')
      .attr('data-id', d => d.id);

    entered.each((d, i, nodes) => this.paintOne(d3.select(nodes[i] as SVGGElement), d));
    join.each((d, i, nodes) => {
      const sel = d3.select(nodes[i] as SVGGElement);
      sel.selectAll('*').remove();
      this.paintOne(sel, d);
    });

    this.objectsGroup
      .selectAll<SVGGElement, SimSpaceObject>('g.sim-space-object')
      .attr('transform', d => objectTransformAttr(d, this.transform));

    this.repositionOverlays();
  }

  private paintOne(
    g: d3.Selection<SVGGElement, SimSpaceObject, null, undefined>,
    obj: SimSpaceObject
  ): void {
    const shape = this.shapes.get(obj.shapeRef) ?? fallbackShape(obj.shapeRef);
    const style = resolveStyle2D(this.styles.get(obj.styleRef), obj.styleRef);
    paintShape2D(g, shape, style);
    paintShapeLabel(g, style, obj.label);
  }

  private repaintConnections(): void {
    if (!this.connectionsGroup) return;
    const data = Array.from(this.currentConnections.values());
    const join = this.connectionsGroup
      .selectAll<SVGLineElement, SimSpaceConnection>('line.sim-space-connection')
      .data(data, d => d.id);
    join.exit().remove();
    join.enter()
      .append('line')
      .attr('class', 'sim-space-connection')
      .attr('stroke', '#888')
      .attr('stroke-width', 1.5);

    this.connectionsGroup
      .selectAll<SVGLineElement, SimSpaceConnection>('line.sim-space-connection')
      .each((d, i, nodes) => {
        const srcPos = d.sourcePosition
          ?? (d.sourceId ? this.currentObjects.get(d.sourceId)?.position : undefined);
        const tgtPos = d.targetPosition
          ?? (d.targetId ? this.currentObjects.get(d.targetId)?.position : undefined);
        if (!srcPos || !tgtPos) {
          d3.select(nodes[i]).attr('display', 'none');
          return;
        }
        const [x1, y1] = this.transform.spaceToScreen(srcPos);
        const [x2, y2] = this.transform.spaceToScreen(tgtPos);
        d3.select(nodes[i])
          .attr('display', null)
          .attr('x1', x1).attr('y1', y1).attr('x2', x2).attr('y2', y2);
      });
  }

  private repositionOverlays(): void {
    this.overlays.forEach((_, id) => this.repositionOverlay(id));
  }

  private repositionOverlay(objectId: string): void {
    const entry = this.overlays.get(objectId);
    if (!entry || !this.host) return;
    const obj = this.currentObjects.get(objectId);
    if (!obj) return;
    const [sx, sy] = this.transform.spaceToScreen(obj.position);
    entry.el.style.left = `${sx}px`;
    entry.el.style.top = `${sy}px`;
  }

  private hostBox(): ScreenBox {
    if (!this.host) return { width: 800, height: 600 };
    const rect = this.host.getBoundingClientRect();
    return { width: rect.width || 800, height: rect.height || 600 };
  }

  private localScreenPos(event: MouseEvent): SimSpaceScreenPosition {
    if (!this.host) return { x: event.clientX, y: event.clientY };
    const rect = this.host.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }
}
