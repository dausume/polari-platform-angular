import {
  Component, ElementRef, Input, NgZone, OnChanges, SimpleChanges,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import * as d3 from 'd3';

import {
  ModuleAssignment, ModuleDependencyEdge, ModuleGraphReport,
  TopologyConnection, TopologyGraph,
} from '@models/topology/topology-types';
import {
  InstanceNode, ModuleCircle, Scene, buildScene,
} from './topology-graph-layout';

const KIND_COLORS: Record<string, string> = {
  'prf-backend': '#5c6bc0',
  'psc-backend': '#26a69a',
  'shared-infra': '#8d6e63',
  'dask-workers': '#7e57c2',
  'engines': '#ef6c00',
};

const DEP_COLORS: Record<string, string> = {
  resolved: '#2e7d32',
  unresolved: '#c62828',
  degraded: '#f9a825',
};

/** A2 classification palette — circle strokes + legend dots. */
export const CLASSIFICATION_COLORS: Record<string, string> = {
  consumer: '#1e88e5',
  provider: '#43a047',
  hybrid: '#8e24aa',
  independent: '#78909c',
  'data-only': '#f9a825',
};

/** Interconnect connections are thin COLORED lines now — border-dash
 *  belongs to transient dependency copies (A4). */
const CONN_PALETTE = [
  '#26a69a', '#7e57c2', '#ec407a', '#66bb6a', '#29b6f6',
  '#ffa726', '#8d6e63', '#5c6bc0', '#d4e157', '#78909c',
];

/**
 * The revamped topology renderer (tt-2, TECH_TREE_TOPOLOGY_PLAN
 * Part A): modules are CIRCLES (node-logic) nested inside their
 * consumers to a depth cap, Polari containers are rectangles sized
 * around their packed modules, hosts are the outermost rectangles
 * (host ▸ container ▸ modules, toggleable). Dashed borders mean
 * TRANSIENT dependency copies — a dependency shared by N>1 consumers
 * is solid only under its designated primary consumer; duplicates
 * are intentional. Service connections render as thin colored lines
 * (no longer dashed). Dependency edges stay solid, colored by
 * resolution status, anchored to the module circles themselves.
 * Pure presentation: data arrives whole via the graph +
 * module-graph inputs; geometry lives in topology-graph-layout.ts.
 */
@Component({
  standalone: true,
  selector: 'topology-graph-view',
  imports: [CommonModule, MatButtonModule, MatIconModule, MatTooltipModule],
  templateUrl: './topology-graph-view.component.html',
  styleUrls: ['./topology-graph-view.component.scss'],
})
export class TopologyGraphViewComponent implements OnChanges {
  @Input({ required: true }) graph!: TopologyGraph | null;
  @Input() moduleGraph: ModuleGraphReport | null = null;

  @ViewChild('svgHost', { static: true }) svgHost!: ElementRef<SVGSVGElement>;

  selected: InstanceNode | null = null;
  selectedEdges: ModuleDependencyEdge[] = [];
  selectedConnections: TopologyConnection[] = [];
  selectedAssignments: ModuleAssignment[] = [];

  showConnections = true;
  groupByHost = true;
  interconnectKeys: string[] = [];
  hiddenInterconnects = new Set<string>();
  classificationKeys = Object.keys(CLASSIFICATION_COLORS);

  private scene: Scene = { hosts: [], nodes: [], circleIndex: new Map() };

  constructor(private zone: NgZone) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['graph'] || changes['moduleGraph']) {
      this.rebuild();
      if (this.selected) {
        const again = this.scene.nodes.find(
          n => n.id === this.selected!.id);
        if (again) { this.selectNode(again); } else { this.selected = null; }
      }
    }
  }

  toggleInterconnect(key: string): void {
    if (this.hiddenInterconnects.has(key)) {
      this.hiddenInterconnects.delete(key);
    } else {
      this.hiddenInterconnects.add(key);
    }
    this.render();
  }

  toggleConnections(): void {
    this.showConnections = !this.showConnections;
    this.render();
  }

  toggleHosts(): void {
    this.groupByHost = !this.groupByHost;
    this.rebuild();
  }

  classificationColor(key: string): string {
    return CLASSIFICATION_COLORS[key] ?? '#78909c';
  }

  /** Drawer helper — one module's classification from the module
   *  graph ('' when the report hasn't answered). */
  classificationOf(moduleName: string): string {
    return this.moduleGraph?.ok
      ? this.moduleGraph.modules.find(
          m => m.name === moduleName)?.classification ?? ''
      : '';
  }

  connectionColor(key: string): string {
    const index = this.interconnectKeys.indexOf(key);
    return CONN_PALETTE[
      (index < 0 ? 0 : index) % CONN_PALETTE.length];
  }

  private rebuild(): void {
    if (!this.graph?.ok) {
      this.scene = { hosts: [], nodes: [], circleIndex: new Map() };
      this.render();
      return;
    }
    this.interconnectKeys = [...new Set(
      this.graph.connections.map(c => c.interconnectKey))].sort();
    this.scene = buildScene(
      this.graph, this.moduleGraph, this.groupByHost);
    this.render();
  }

  // ------------------------------------------------------------------
  // D3 render
  // ------------------------------------------------------------------

  private render(): void {
    const svg = d3.select(this.svgHost.nativeElement);
    svg.selectAll('*').remove();
    const graph = this.graph;
    if (!graph?.ok) { return; }

    const defs = svg.append('defs');
    for (const [id, color] of [
      ['topo-arrow-resolved', DEP_COLORS['resolved']],
      ['topo-arrow-unresolved', DEP_COLORS['unresolved']],
      ['topo-arrow-degraded', DEP_COLORS['degraded']],
    ] as Array<[string, string]>) {
      defs.append('marker')
        .attr('id', id).attr('viewBox', '0 -5 10 10')
        .attr('refX', 9).attr('refY', 0)
        .attr('markerWidth', 7).attr('markerHeight', 7)
        .attr('orient', 'auto')
        .append('path').attr('d', 'M0,-5L10,0L0,5').attr('fill', color);
    }

    const root = svg.append('g').attr('class', 'zoom-root');
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 2.5])
      .on('zoom', (ev) => root.attr('transform', ev.transform));
    svg.call(zoom as any);
    this.fitToView(svg, zoom);

    this.renderHosts(root);
    this.renderConnections(root, graph);
    this.renderDependencyEdges(root, graph);
    this.renderInstances(root);
  }

  private fitToView(svg: d3.Selection<SVGSVGElement, unknown, null,
      undefined>, zoom: d3.ZoomBehavior<SVGSVGElement, unknown>): void {
    const boxes = [
      ...this.scene.hosts,
      ...this.scene.nodes,
    ];
    if (!boxes.length) { return; }
    const pad = 24;
    const minX = Math.min(...boxes.map(b => b.x)) - pad;
    const minY = Math.min(...boxes.map(b => b.y)) - pad;
    const maxX = Math.max(...boxes.map(b => b.x + b.w)) + pad;
    const maxY = Math.max(...boxes.map(b => b.y + b.h)) + pad;
    const host = this.svgHost.nativeElement as SVGSVGElement;
    const vw = host.clientWidth || 800;
    const vh = host.clientHeight || 520;
    const scale = Math.min(1, vw / (maxX - minX), vh / (maxY - minY));
    const tx = (vw - (maxX - minX) * scale) / 2 - minX * scale;
    const ty = (vh - (maxY - minY) * scale) / 2 - minY * scale;
    svg.call(
      (zoom as any).transform,
      d3.zoomIdentity.translate(tx, ty).scale(scale),
    );
  }

  /** Outermost rectangles: one per PolariNodeMachine in use (A1). */
  private renderHosts(root: d3.Selection<SVGGElement, unknown, null,
      undefined>): void {
    const hg = root.append('g').attr('class', 'hosts');
    for (const host of this.scene.hosts) {
      const g = hg.append('g');
      g.append('rect')
        .attr('class', 'host-box')
        .attr('x', host.x).attr('y', host.y)
        .attr('width', host.w).attr('height', host.h)
        .attr('rx', 14);
      g.append('text')
        .attr('class', 'host-label')
        .attr('x', host.x + 14).attr('y', host.y + 17)
        .text(host.name === 'unplaced'
          ? '⚠ unplaced' : `🖥 ${host.name}`);
      const m = host.machine;
      if (m) {
        g.append('title').text(
          `${m.name} — ${m.sshAlias} · ${m.arch} · ${m.memGb} GB`
          + (m.swarmRole && m.swarmRole !== 'none'
             ? ` · swarm ${m.swarmRole}` : ''));
      }
    }
  }

  /** Interconnects: THIN COLORED lines between containers — the
   *  dash vocabulary now belongs to transient dependency copies. */
  private renderConnections(root: d3.Selection<SVGGElement, unknown,
      null, undefined>, graph: TopologyGraph): void {
    if (!this.showConnections) { return; }
    const byId = new Map(this.scene.nodes.map(n => [n.id, n]));
    const eg = root.append('g').attr('class', 'conn-edges');
    for (const conn of graph.connections) {
      if (this.hiddenInterconnects.has(conn.interconnectKey)) { continue; }
      const s = byId.get(conn.fromInstanceName);
      const t = byId.get(conn.toInstanceName);
      if (!s || !t) { continue; }
      const color = this.connectionColor(conn.interconnectKey);
      const sx = s.x + s.w, sy = s.y + s.h / 2;
      const tx = t.x, ty = t.y + t.h / 2;
      const dx = Math.max(40, (tx - sx) / 2);
      eg.append('path')
        .attr('d', `M${sx},${sy} C${sx + dx},${sy} `
          + `${tx - dx},${ty} ${tx},${ty}`)
        .attr('fill', 'none')
        .attr('stroke', color)
        .attr('stroke-width', 1.2)
        .attr('opacity', 0.55);
      eg.append('text')
        .attr('class', 'edge-label conn')
        .attr('x', (sx + tx) / 2).attr('y', (sy + ty) / 2 - 6)
        .attr('text-anchor', 'middle')
        .attr('fill', color)
        .text(conn.interconnectKey);
    }
  }

  /** Module dependency edges anchored to the module CIRCLES:
   *  provider's circle → consumer's circle, solid, status-colored. */
  private renderDependencyEdges(root: d3.Selection<SVGGElement,
      unknown, null, undefined>, graph: TopologyGraph): void {
    const byId = new Map(this.scene.nodes.map(n => [n.id, n]));
    const eg = root.append('g').attr('class', 'dep-edges');
    for (const edge of graph.edges) {
      const s = this.scene.circleIndex.get(
        `${edge.providerInstanceName}|${edge.dependsOnModule}`)
        ?? this.rectAnchor(byId.get(edge.providerInstanceName));
      const t = this.scene.circleIndex.get(
        `${edge.consumerInstanceName}|${edge.moduleName}`)
        ?? this.rectAnchor(byId.get(edge.consumerInstanceName));
      if (!s || !t) { continue; }
      const dx = t.x - s.x, dy = t.y - s.y;
      const len = Math.hypot(dx, dy) || 1;
      const sx = s.x + (dx / len) * s.r, sy = s.y + (dy / len) * s.r;
      const tx = t.x - (dx / len) * (t.r + 4);
      const ty = t.y - (dy / len) * (t.r + 4);
      const bend = Math.max(40, Math.abs(tx - sx) / 2);
      const color = DEP_COLORS[edge.status] ?? '#90a4ae';
      eg.append('path')
        .attr('d', `M${sx},${sy} C${sx + bend},${sy} `
          + `${tx - bend},${ty} ${tx},${ty}`)
        .attr('fill', 'none')
        .attr('stroke', color)
        .attr('stroke-width', 2)
        .attr('marker-end', `url(#topo-arrow-${edge.status})`);
      eg.append('text')
        .attr('class', 'edge-label')
        .attr('x', (sx + tx) / 2).attr('y', (sy + ty) / 2 - 8)
        .attr('text-anchor', 'middle')
        .attr('fill', color)
        .text(edge.dependsOnModule);
    }
  }

  private rectAnchor(node: InstanceNode | undefined):
      { x: number; y: number; r: number } | null {
    return node
      ? { x: node.x + node.w / 2, y: node.y + node.h / 2, r: 0 }
      : null;
  }

  /** Container rectangles with their packed module circles. */
  private renderInstances(root: d3.Selection<SVGGElement, unknown,
      null, undefined>): void {
    const ng = root.append('g').attr('class', 'nodes');
    for (const n of this.scene.nodes) {
      const strip = KIND_COLORS[n.instance.kind] ?? '#546e7a';
      const g = ng.append('g')
        .attr('class', 'node')
        .attr('transform', `translate(${n.x},${n.y})`)
        .style('cursor', 'pointer')
        .on('click', () => this.zone.run(() => this.selectNode(n)));

      g.append('rect')
        .attr('width', n.w).attr('height', n.h)
        .attr('rx', 10)
        .attr('class', 'node-body')
        .classed('selected', this.selected?.id === n.id);
      g.append('rect')
        .attr('width', n.w).attr('height', 26)
        .attr('rx', 10)
        .attr('fill', strip);
      g.append('rect')  // square off the strip's bottom corners
        .attr('y', 16).attr('width', n.w).attr('height', 10)
        .attr('fill', strip);
      g.append('text')
        .attr('x', 10).attr('y', 18).attr('class', 'node-kind')
        .text(truncate(n.instance.kind.toUpperCase(), 24));

      g.append('text')
        .attr('x', 10).attr('y', 44).attr('class', 'node-title')
        .text(truncate(n.instance.name, 26));
      g.append('text')
        .attr('x', 10).attr('y', 58).attr('class', 'node-meta')
        .text(truncate(
          `${n.instance.dbBackend || 'no db'} · ${n.instance.envTier}`
          + ` · x${n.instance.replicas}`, 40));
      g.append('text')
        .attr('x', 10).attr('y', 71).attr('class', 'node-meta')
        .text(truncate(
          `${n.instance.machineName || 'unplaced'}`
          + ` → ${n.instance.orchestrationTarget}`, 40));

      if (!n.modules.length) {
        g.append('text')
          .attr('x', 10).attr('y', n.h - 12)
          .attr('class', 'node-modules')
          .text('no modules assigned');
      }
      for (const circle of n.modules) {
        this.renderModuleCircle(g, circle, circle.cx, circle.cy);
      }
    }
  }

  /** One module circle + its nested dependency copies (A3/A4). */
  private renderModuleCircle(g: d3.Selection<SVGGElement, unknown,
      null, undefined>, circle: ModuleCircle, cx: number,
      cy: number): void {
    const color = CLASSIFICATION_COLORS[circle.classification]
      ?? '#78909c';
    const disabled = circle.state === 'disabled';
    const node = g.append('g')
      .attr('transform', `translate(${cx},${cy})`)
      .attr('opacity', disabled ? 0.4 : 1);
    node.append('circle')
      .attr('r', circle.r)
      .attr('class', 'module-circle')
      .attr('stroke', color)
      .attr('stroke-width', circle.depth === 0 ? 2 : 1.4)
      // Border-dash = TRANSIENT COPY (was: service connections).
      .attr('stroke-dasharray', circle.transient ? '5,4' : null)
      .attr('fill', color)
      .attr('fill-opacity', circle.depth === 0 ? 0.10 : 0.14);
    node.append('title').text(
      `${circle.module} — ${circle.classification}`
      + (circle.transient
         ? ` (transient copy; primary under ${circle.primaryConsumer})`
         : '')
      + (disabled ? ' · disabled' : ''));
    if (circle.depth === 0) {
      node.append('text')
        .attr('class', 'module-label')
        .attr('y', circle.r + 12)
        .attr('text-anchor', 'middle')
        .text(truncate(circle.module, 22));
    } else if (circle.r >= 14 && !circle.children.length) {
      node.append('text')
        .attr('class', 'module-label nested')
        .attr('y', 3)
        .attr('text-anchor', 'middle')
        .text(truncate(shortName(circle.module),
          Math.max(4, Math.floor(circle.r / 3.2))));
    }
    for (const child of circle.children) {
      this.renderModuleCircle(
        node as unknown as d3.Selection<SVGGElement, unknown, null,
          undefined>,
        child, child.cx, child.cy);
    }
  }

  // ------------------------------------------------------------------
  // Drill-in drawer
  // ------------------------------------------------------------------

  selectNode(n: InstanceNode): void {
    this.selected = n;
    const g = this.graph;
    if (!g?.ok) { return; }
    this.selectedAssignments = g.assignments
      .filter(a => a.instanceName === n.id);
    this.selectedEdges = g.edges.filter(
      e => e.consumerInstanceName === n.id
        || e.providerInstanceName === n.id);
    this.selectedConnections = g.connections.filter(
      c => c.fromInstanceName === n.id || c.toInstanceName === n.id);
    this.render();
  }

  closeDrawer(): void {
    this.selected = null;
    this.render();
  }

  edgeDirection(edge: ModuleDependencyEdge): string {
    return edge.consumerInstanceName === this.selected?.id
      ? `needs ${edge.dependsOnModule} from `
        + `${edge.providerInstanceName || '(no provider)'}`
      : `provides ${edge.dependsOnModule} to `
        + `${edge.consumerInstanceName}`;
  }

  connDirection(conn: TopologyConnection): string {
    return conn.fromInstanceName === this.selected?.id
      ? `→ ${conn.toInstanceName} (${conn.toKind})`
      : `← ${conn.fromInstanceName} (${conn.fromKind})`;
  }
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

function shortName(module: string): string {
  const parts = module.split('.');
  return parts[parts.length - 1];
}
