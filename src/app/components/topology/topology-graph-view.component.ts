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
  ModuleAssignment, ModuleDependencyEdge, TopologyConnection,
  TopologyGraph, TopologyInstance,
} from '@models/topology/topology-types';

/** One node of the topology graph — a PolariInstance card. */
interface GraphNode {
  id: string;
  instance: TopologyInstance;
  modules: string[];
  x: number; y: number; w: number; h: number; depth: number;
}

interface GraphEdgeView {
  source: string;
  target: string;
  kind: 'dep' | 'conn';
  status?: string;
  label: string;
}

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

const CONN_COLOR = '#90a4ae';

/**
 * The topology drawn as the node graph it is (visually kin to the
 * multi-scale composition graph): each PolariInstance is a card node;
 * solid edges are module dependency edges colored by resolution
 * status; lighter dashed edges are interconnect connections,
 * toggleable per interconnect kind. Click a node for a drill-in
 * drawer with the instance's rows — assignments, edges, connections.
 * Pure presentation: the data arrives whole via the graph input.
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

  @ViewChild('svgHost', { static: true }) svgHost!: ElementRef<SVGSVGElement>;

  selected: GraphNode | null = null;
  selectedEdges: ModuleDependencyEdge[] = [];
  selectedConnections: TopologyConnection[] = [];
  selectedAssignments: ModuleAssignment[] = [];

  showConnections = true;
  interconnectKeys: string[] = [];
  hiddenInterconnects = new Set<string>();

  private nodes: GraphNode[] = [];
  private edges: GraphEdgeView[] = [];

  constructor(private zone: NgZone) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['graph']) {
      this.assembleGraph();
      this.layout();
      this.render();
      // Keep the drawer on the same instance across reloads.
      if (this.selected) {
        const again = this.nodes.find(n => n.id === this.selected!.id);
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
    this.assembleGraph();
    this.layout();
    this.render();
  }

  toggleConnections(): void {
    this.showConnections = !this.showConnections;
    this.assembleGraph();
    this.layout();
    this.render();
  }

  // ------------------------------------------------------------------
  // Graph assembly
  // ------------------------------------------------------------------

  private assembleGraph(): void {
    this.nodes = [];
    this.edges = [];
    if (!this.graph?.ok) { return; }
    const byInstance = new Map<string, GraphNode>();
    for (const instance of this.graph.instances) {
      const modules = this.graph.assignments
        .filter(a => a.instanceName === instance.name)
        .map(a => a.moduleName);
      const node: GraphNode = {
        id: instance.name, instance, modules,
        x: 0, y: 0, w: 230, h: 112, depth: 0,
      };
      byInstance.set(instance.name, node);
      this.nodes.push(node);
    }

    // Dependency edges: the module flows provider → consumer. An edge
    // without both endpoints placed (e.g. unresolved, no provider yet)
    // has nothing to draw — the validation panel names it instead.
    for (const edge of this.graph.edges) {
      if (!byInstance.has(edge.providerInstanceName)
          || !byInstance.has(edge.consumerInstanceName)) { continue; }
      this.edges.push({
        source: edge.providerInstanceName,
        target: edge.consumerInstanceName,
        kind: 'dep',
        status: edge.status,
        label: edge.dependsOnModule,
      });
    }

    this.interconnectKeys = [...new Set(
      this.graph.connections.map(c => c.interconnectKey))].sort();
    if (this.showConnections) {
      for (const conn of this.graph.connections) {
        if (this.hiddenInterconnects.has(conn.interconnectKey)) { continue; }
        if (!byInstance.has(conn.fromInstanceName)
            || !byInstance.has(conn.toInstanceName)) { continue; }
        this.edges.push({
          source: conn.fromInstanceName,
          target: conn.toInstanceName,
          kind: 'conn',
          label: conn.interconnectKey,
        });
      }
    }
  }

  // ------------------------------------------------------------------
  // Layout — layered left→right by longest path over the drawn edges.
  // ------------------------------------------------------------------

  private layout(): void {
    const depth = new Map<string, number>(this.nodes.map(n => [n.id, 0]));
    for (let pass = 0; pass < this.nodes.length + 1; pass++) {
      let changed = false;
      for (const e of this.edges) {
        const d = (depth.get(e.source) ?? 0) + 1;
        if (d > (depth.get(e.target) ?? 0)) {
          depth.set(e.target, d);
          changed = true;
        }
      }
      if (!changed) break;
    }
    const columns = new Map<number, GraphNode[]>();
    for (const n of this.nodes) {
      n.depth = depth.get(n.id) ?? 0;
      if (!columns.has(n.depth)) columns.set(n.depth, []);
      columns.get(n.depth)!.push(n);
    }
    // compact autoplacement: cards are 230x112, so ~40px gutters keep
    // the whole graph in one eyeful (the fit-to-view pass below
    // guarantees it regardless of node count)
    const colGap = 270, rowGap = 136, x0 = 40, y0 = 40;
    const maxRows = Math.max(1,
      ...[...columns.values()].map(c => c.length));
    for (const [d, col] of columns) {
      col.sort((a, b) => a.id.localeCompare(b.id));
      const startY = y0 + ((maxRows - col.length) * rowGap) / 2;
      col.forEach((n, i) => {
        n.x = x0 + d * colGap;
        n.y = startY + i * rowGap;
      });
    }
  }

  // ------------------------------------------------------------------
  // D3 render
  // ------------------------------------------------------------------

  private render(): void {
    const svg = d3.select(this.svgHost.nativeElement);
    svg.selectAll('*').remove();

    const defs = svg.append('defs');
    for (const [id, color] of [
      ['topo-arrow-resolved', DEP_COLORS['resolved']],
      ['topo-arrow-unresolved', DEP_COLORS['unresolved']],
      ['topo-arrow-degraded', DEP_COLORS['degraded']],
      ['topo-arrow-conn', CONN_COLOR],
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

    // fit-to-view: start with the whole graph centered and visible
    // (never zoomed IN past 1:1 — small graphs stay life-size)
    if (this.nodes.length) {
      const pad = 24;
      const minX = Math.min(...this.nodes.map(n => n.x)) - pad;
      const minY = Math.min(...this.nodes.map(n => n.y)) - pad;
      const maxX = Math.max(...this.nodes.map(n => n.x + n.w)) + pad;
      const maxY = Math.max(...this.nodes.map(n => n.y + n.h)) + pad;
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

    const byId = new Map(this.nodes.map(n => [n.id, n]));

    // Edges first (under the nodes). Connections lighter + dashed.
    const eg = root.append('g').attr('class', 'edges');
    for (const e of this.edges) {
      const s = byId.get(e.source), t = byId.get(e.target);
      if (!s || !t) continue;
      const sx = s.x + s.w, sy = s.y + s.h / 2;
      const tx = t.x, ty = t.y + t.h / 2;
      const dx = Math.max(40, (tx - sx) / 2);
      const color = e.kind === 'conn'
        ? CONN_COLOR : (DEP_COLORS[e.status ?? ''] ?? CONN_COLOR);
      const marker = e.kind === 'conn' ? 'conn' : (e.status ?? 'conn');
      eg.append('path')
        .attr('d', `M${sx},${sy} C${sx + dx},${sy} ${tx - dx},${ty} ${tx},${ty}`)
        .attr('fill', 'none')
        .attr('stroke', color)
        .attr('stroke-width', e.kind === 'conn' ? 1.2 : 2)
        .attr('stroke-dasharray', e.kind === 'conn' ? '4,4' : null)
        .attr('opacity', e.kind === 'conn' ? 0.65 : 1)
        .attr('marker-end', `url(#topo-arrow-${marker})`);
      eg.append('text')
        .attr('class', `edge-label${e.kind === 'conn' ? ' conn' : ''}`)
        .attr('x', (sx + tx) / 2).attr('y', (sy + ty) / 2 - 8)
        .attr('text-anchor', 'middle')
        .attr('fill', color)
        .text(e.label);
    }

    // Nodes — rounded cards with a colored header strip.
    const ng = root.append('g').attr('class', 'nodes');
    for (const n of this.nodes) {
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
        .attr('x', 10).attr('y', 46).attr('class', 'node-title')
        .text(truncate(n.instance.name, 26));
      g.append('text')
        .attr('x', 10).attr('y', 62).attr('class', 'node-meta')
        .text(truncate(
          `${n.instance.dbBackend || 'no db'} · ${n.instance.envTier}`
          + ` · x${n.instance.replicas}`, 34));
      g.append('text')
        .attr('x', 10).attr('y', 78).attr('class', 'node-meta')
        .text(truncate(
          `${n.instance.machineName || 'unplaced'}`
          + ` → ${n.instance.orchestrationTarget}`, 34));
      g.append('text')
        .attr('x', 10).attr('y', 98).attr('class', 'node-modules')
        .text(n.modules.length
          ? truncate(n.modules.join('  '), 36)
          : 'no modules assigned');
      if (n.modules.length) {
        g.append('title').text(`modules: ${n.modules.join(', ')}`);
      }
    }
  }

  // ------------------------------------------------------------------
  // Drill-in drawer
  // ------------------------------------------------------------------

  selectNode(n: GraphNode): void {
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
