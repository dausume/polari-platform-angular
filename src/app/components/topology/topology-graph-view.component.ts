import {
  Component, ElementRef, EventEmitter, Input, NgZone, OnChanges,
  Output, SimpleChanges, ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import * as d3 from 'd3';

import { FormsModule } from '@angular/forms';
import { TopologyService } from '@services/topology/topology.service';
import {
  IntegrationLink, ModuleAssignment, ModuleDependencyEdge,
  ModuleGraphReport, MoveRequest, MoveResult, TopologyConnection,
  TopologyGraph, TopologyTestingReport,
} from '@models/topology/topology-types';
import {
  InstanceNode, ModuleCircle, Scene, buildScene,
} from './topology-graph-layout';

/** tt-14 CATEGORY colors — the header strip says what KIND of
 *  container this is: Polari (adaptive), integrated app
 *  (non-adaptive, PSC/Odoo-style), auth (Keycloak), pure
 *  infrastructure (databases/storage/proxy). */
const APP_KIND_COLORS: Record<string, string> = {
  'polari': '#3949ab',
  'integrated-app': '#00897b',
  'auth': '#6a1b9a',
  'infrastructure': '#8d6e63',
  'unknown': '#546e7a',
};

const KIND_COLORS: Record<string, string> = {
  'prf': '#3949ab',
  'prf-backend': '#3949ab',
  'worker': '#ef6c00',
  'engines': '#ef6c00',
  'psc': '#00897b',
  'psc-backend': '#00897b',
  'infra': '#8d6e63',
  'shared-infra': '#8d6e63',
  'auth': '#6a1b9a',
};

/** tt-14 service-kind categories — dots on each container naming
 *  its frontends / backends / DATABASES / AUTH / storage / proxy
 *  services (keycloak + mariadb/keydb become visible + colored). */
export function serviceCategory(kind: string):
    { category: string; color: string } {
  const k = kind.toLowerCase();
  if (k.includes('keycloak') || k.includes('auth')) {
    return { category: 'auth', color: '#6a1b9a' };
  }
  if (k.includes('mariadb') || k.includes('keydb')
      || k.includes('redis') || k.includes('sqlite')
      || k.includes('db')) {
    return { category: 'database', color: '#ff8f00' };
  }
  if (k.includes('frontend')) {
    return { category: 'frontend', color: '#29b6f6' };
  }
  if (k.includes('backend') || k.includes('engines')
      || k.includes('dask')) {
    return { category: 'backend', color: '#3949ab' };
  }
  if (k.includes('file-store') || k.includes('minio')) {
    return { category: 'storage', color: '#795548' };
  }
  if (k.includes('proxy')) {
    return { category: 'proxy', color: '#78909c' };
  }
  return { category: 'service', color: '#90a4ae' };
}

const DEP_COLORS: Record<string, string> = {
  resolved: '#2e7d32',
  unresolved: '#c62828',
  degraded: '#f9a825',
};

/** tt-11 test-progress palette: red failing / green all-pass;
 *  anything else keeps its normal look (honesty over paint). */
const TEST_COLORS: Record<string, string> = {
  pass: '#2e7d32',
  fail: '#c62828',
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
  imports: [CommonModule, FormsModule, RouterModule, MatButtonModule,
            MatIconModule, MatTooltipModule],
  templateUrl: './topology-graph-view.component.html',
  styleUrls: ['./topology-graph-view.component.scss'],
})
export class TopologyGraphViewComponent implements OnChanges {
  @Input({ required: true }) graph!: TopologyGraph | null;
  @Input() moduleGraph: ModuleGraphReport | null = null;
  /** tt-11: when set, the graph paints TEST PROGRESS — modules and
   *  hosts red on failing tests / green when everything passes,
   *  edges green on successful pings with protocol + security
   *  notated. */
  @Input() testing: TopologyTestingReport | null = null;
  /** tt-15: the move EXECUTED here (the drawer works on every page
   *  that embeds this view) — hosts listen to refetch their data.
   *  tt-13's moveRequest stays for hosts that want to intercept. */
  @Output() moved = new EventEmitter<MoveResult>();
  @Output() moveRequest = new EventEmitter<MoveRequest>();

  @ViewChild('svgHost', { static: true }) svgHost!: ElementRef<SVGSVGElement>;

  selected: InstanceNode | null = null;
  selectedEdges: ModuleDependencyEdge[] = [];
  selectedConnections: TopologyConnection[] = [];
  selectedAssignments: ModuleAssignment[] = [];
  /** tt-13 module drawer: the clicked module + its placements. */
  selectedModule: string | null = null;
  selectedModulePlacements:
    Array<{ instance: string; machine: string; state: string }> = [];
  moveTargetInstance = '';
  moveTargetMachine = '';

  showConnections = true;
  groupByHost = true;
  interconnectKeys: string[] = [];
  hiddenInterconnects = new Set<string>();
  classificationKeys = Object.keys(CLASSIFICATION_COLORS);

  private scene: Scene = { hosts: [], nodes: [], circleIndex: new Map() };
  private zoomBehavior: d3.ZoomBehavior<SVGSVGElement, unknown>
    | null = null;

  constructor(private zone: NgZone,
              private topologyService: TopologyService) {}

  /** tt-10: the module-details drill-in id for a module chip. */
  moduleDetailsId(moduleName: string): string {
    return moduleName.split('.')[0];
  }

  /** tt-11: one module's derived test state ('' outside testing
   *  mode or when the module has no report). */
  testStateOf(moduleName: string): string {
    return this.moduleTestState.get(
      moduleName.split('.')[0]) ?? '';
  }

  /** tt-13: click a module circle → drawer shows exactly where it
   *  lives (container + host) and offers the move. */
  selectModule(moduleName: string): void {
    if (this.selectedModule !== moduleName) {
      this.moveResult = null;
      this.moveFailure = '';
    }
    this.selectedModule = moduleName;
    this.moveTargetInstance = '';
    this.moveTargetMachine = '';
    const machineOf = new Map(
      (this.graph?.ok ? this.graph.instances : [])
        .map(i => [i.name, i.machineName || 'unplaced']));
    this.selectedModulePlacements =
      (this.graph?.ok ? this.graph.assignments : [])
        .filter(a => a.moduleName === moduleName)
        .map(a => ({
          instance: a.instanceName,
          machine: machineOf.get(a.instanceName) ?? '',
          state: a.state,
        }));
  }

  closeModuleDrawer(): void {
    this.selectedModule = null;
  }

  /** tt-14: only COHERENT move targets are offered. Engine
   *  capabilities go to engine/worker instances only; everything
   *  else goes to Polari instances (never psc/infra/auth). */
  private isEngineModule(moduleName: string): boolean {
    return this.moduleGraph?.ok
      ? this.moduleGraph.modules.find(
          m => m.name === moduleName)?.engineCapability ?? false
      : false;
  }

  moduleIsEngine(): boolean {
    return this.selectedModule
      ? this.isEngineModule(this.selectedModule) : false;
  }

  instanceNames(): string[] {
    const engine = this.moduleIsEngine();
    return (this.graph?.ok ? this.graph.instances : [])
      .filter(i => i.isPolari)
      .filter(i => !engine
        || i.kind === 'worker' || i.kind === 'engines')
      .map(i => i.name).sort();
  }

  /** Device moves relocate whole engine instances — only offered
   *  for engine capabilities, and only real machines qualify. */
  machineNames(): string[] {
    if (!this.moduleIsEngine()) { return []; }
    return (this.graph?.ok ? this.graph.machines : [])
      .filter(m => m.isReal)
      .map(m => m.name).sort();
  }

  /** tt-15 inline move state — the drawer shows the outcome right
   *  where the button was clicked, on every embedding page. */
  moving = false;
  moveResult: MoveResult | null = null;
  moveFailure = '';

  async requestMove(): Promise<void> {
    if (!this.selectedModule || this.moving) { return; }
    const request: MoveRequest = { module: this.selectedModule };
    if (this.moveTargetInstance) {
      request.toInstance = this.moveTargetInstance;
    } else if (this.moveTargetMachine) {
      request.toMachine = this.moveTargetMachine;
    } else {
      return;
    }
    this.moveRequest.emit(request);
    this.moving = true;
    this.moveResult = null;
    this.moveFailure = '';
    const result = await this.topologyService.move(request);
    this.moving = false;
    if (result?.ok) {
      this.moveResult = result;
      // Refresh our own inputs so the graph + drawer move NOW,
      // even when the host page doesn't listen.
      const [graph, modules] = await Promise.all([
        this.topologyService.graph(),
        this.topologyService.moduleGraph(),
      ]);
      if (graph?.ok) { this.graph = graph; }
      if (modules?.ok) { this.moduleGraph = modules; }
      this.rebuild();
      this.selectModule(request.module);
      this.moveResult = result;
      this.moved.emit(result);
    } else {
      this.moveFailure = result?.error
        || `move of ${request.module} did not land — rows unchanged`;
    }
  }

  /** tt-9 parity with the tech tree: center the viewport on the
   *  instance holding a module's PRIMARY copy and open its drawer. */
  zoomToModule(moduleName: string): void {
    const holder = this.graph?.ok
      ? this.graph.assignments.find(
          a => a.moduleName === moduleName && a.state !== 'disabled')
      : null;
    const node = holder
      ? this.scene.nodes.find(n => n.id === holder.instanceName)
      : null;
    if (!node || !this.zoomBehavior) { return; }
    const host = this.svgHost.nativeElement as SVGSVGElement;
    const vw = host.clientWidth || 800;
    const vh = host.clientHeight || 520;
    const tx = vw / 2 - (node.x + node.w / 2);
    const ty = vh / 2 - (node.y + node.h / 2);
    d3.select(host).transition().duration(450).call(
      (this.zoomBehavior as any).transform,
      d3.zoomIdentity.translate(tx, ty));
    this.selectNode(node);
  }

  /** tt-11 lookups (rebuilt on input change). */
  private moduleTestState = new Map<string, string>();
  private pingBySubject = new Map<string, IntegrationLink>();

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['testing']) {
      this.moduleTestState = new Map(
        (this.testing?.ok ? this.testing.modules : [])
          .map(m => [m.module, m.state]));
      this.pingBySubject = new Map(
        (this.testing?.ok ? this.testing.links : [])
          .map(l => [l.subject, l]));
    }
    if (changes['graph'] || changes['moduleGraph']
        || changes['testing']) {
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
    this.zoomBehavior = zoom;
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
      const hostState = this.testing?.ok
        ? this.testing.hosts[host.name] ?? '' : '';
      const hostPing = this.pingBySubject.get(host.name);
      g.append('rect')
        .attr('class', 'host-box')
        .attr('x', host.x).attr('y', host.y)
        .attr('width', host.w).attr('height', host.h)
        .attr('rx', 14)
        .classed('test-pass', hostState === 'pass')
        .classed('test-fail', hostState === 'fail');
      if (this.testing?.ok && hostPing) {
        g.append('text')
          .attr('class', 'host-ping')
          .attr('x', host.x + host.w - 12)
          .attr('y', host.y + 17)
          .attr('text-anchor', 'end')
          .attr('fill', hostPing.status === 'ok'
            ? '#2e7d32' : hostPing.status === 'failed'
            ? '#c62828' : '#90a4ae')
          .text(hostPing.status === 'ok'
            ? `● ${hostPing.protocol}`
              + `${hostPing.secured ? ' 🔒' : ' ⚠'}`
            : `● ${hostPing.status}`)
          .append('title').text(
            `${hostPing.securityNote || hostPing.evidence} `
            + `(${hostPing.evidence})`);
      }
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
      // The LINE carries the interconnect's color identity; the label
      // is text on the canvas, so it takes the theme's text color.
      // Painting the label in the line color left pale kinds (yellow,
      // light green) barely legible on the light canvas.
      eg.append('text')
        .attr('class', 'edge-label conn')
        .attr('x', (sx + tx) / 2).attr('y', (sy + ty) / 2 - 6)
        .attr('text-anchor', 'middle')
        .attr('fill', 'var(--chart-text)')
        .text(conn.interconnectKey);
    }
  }

  /** Module dependency edges: modules stay PHYSICALLY inside their
   *  container, so the connector runs circle → own container BORDER
   *  → partner container border → partner circle. Only the border-
   *  to-border run is outside the containers; the layout compaction
   *  (barycenter alignment + gutter cap at 2× the largest module
   *  circle's diameter) keeps that external run short. */
  private renderDependencyEdges(root: d3.Selection<SVGGElement,
      unknown, null, undefined>, graph: TopologyGraph): void {
    const byId = new Map(this.scene.nodes.map(n => [n.id, n]));
    const eg = root.append('g').attr('class', 'dep-edges');
    for (const edge of graph.edges) {
      const sNode = byId.get(edge.providerInstanceName);
      const tNode = byId.get(edge.consumerInstanceName);
      if (!sNode || !tNode) { continue; }
      const s = this.scene.circleIndex.get(
        `${edge.providerInstanceName}|${edge.dependsOnModule}`)
        ?? this.rectAnchor(sNode)!;
      const t = this.scene.circleIndex.get(
        `${edge.consumerInstanceName}|${edge.moduleName}`)
        ?? this.rectAnchor(tNode)!;
      // tt-11: a pinged edge paints its FOUNDATIONAL connectivity
      // result (green/red) and notates protocol + security.
      const ping = this.testing?.ok
        ? this.pingBySubject.get(edge.name) : undefined;
      const color = ping
        ? (ping.status === 'ok' ? '#2e7d32' : '#c62828')
        : DEP_COLORS[edge.status] ?? '#90a4ae';
      const marker = ping
        ? (ping.status === 'ok' ? 'resolved' : 'unresolved')
        : edge.status;

      if (sNode === tNode) {
        // Same container: a short interior arc between the circles.
        const dx = t.x - s.x, dy = t.y - s.y;
        const len = Math.hypot(dx, dy) || 1;
        const sx = s.x + (dx / len) * s.r;
        const sy = s.y + (dy / len) * s.r;
        const tx = t.x - (dx / len) * (t.r + 4);
        const ty = t.y - (dy / len) * (t.r + 4);
        eg.append('path')
          .attr('d', `M${sx},${sy} L${tx},${ty}`)
          .attr('fill', 'none').attr('stroke', color)
          .attr('stroke-width', 2)
          .attr('marker-end', `url(#topo-arrow-${marker})`);
        continue;
      }

      const exit = borderPoint(sNode, s, tNode);
      const entry = borderPoint(tNode, t, sNode);
      // Interior stubs trimmed at the circle boundary.
      const sd = Math.hypot(exit.x - s.x, exit.y - s.y) || 1;
      const sx = s.x + ((exit.x - s.x) / sd) * s.r;
      const sy = s.y + ((exit.y - s.y) / sd) * s.r;
      const td = Math.hypot(entry.x - t.x, entry.y - t.y) || 1;
      const tx = t.x + ((entry.x - t.x) / td) * (t.r + 4);
      const ty = t.y + ((entry.y - t.y) / td) * (t.r + 4);
      const bend = Math.max(
        18, Math.abs(entry.x - exit.x) / 2);
      eg.append('path')
        .attr('d', `M${sx},${sy} L${exit.x},${exit.y} `
          + `C${exit.x + bend},${exit.y} `
          + `${entry.x - bend},${entry.y} ${entry.x},${entry.y} `
          + `L${tx},${ty}`)
        .attr('fill', 'none')
        .attr('stroke', color)
        .attr('stroke-width', 2)
        .attr('marker-end', `url(#topo-arrow-${marker})`);
      eg.append('text')
        .attr('class', 'edge-label')
        .attr('x', (exit.x + entry.x) / 2)
        .attr('y', (exit.y + entry.y) / 2 - 8)
        .attr('text-anchor', 'middle')
        .attr('fill', 'var(--chart-text)')
        .text(edge.dependsOnModule
          + (ping && ping.status === 'ok' && ping.protocol
             ? ` · ${ping.protocol}${ping.secured ? ' 🔒' : ' ⚠'}`
             : ''));
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
      const strip = APP_KIND_COLORS[n.instance.appKind]
        ?? KIND_COLORS[n.instance.kind] ?? '#546e7a';
      const g = ng.append('g')
        .attr('class', 'node')
        .attr('transform', `translate(${n.x},${n.y})`)
        .style('cursor', 'pointer')
        .on('click', () => this.zone.run(() => this.selectNode(n)));

      const instanceState = this.testing?.ok
        ? this.testing.instances[n.id] ?? '' : '';
      g.append('rect')
        .attr('width', n.w).attr('height', n.h)
        .attr('rx', 10)
        .attr('class', 'node-body')
        .classed('selected', this.selected?.id === n.id)
        .classed('test-pass', instanceState === 'pass')
        .classed('test-fail', instanceState === 'fail');
      g.append('rect')
        .attr('width', n.w).attr('height', 26)
        .attr('rx', 10)
        .attr('fill', strip);
      g.append('rect')  // square off the strip's bottom corners
        .attr('y', 16).attr('width', n.w).attr('height', 10)
        .attr('fill', strip);
      const kindLabel = n.instance.appKind === 'polari'
        ? n.instance.kind.toUpperCase()
        : n.instance.appKind === 'integrated-app'
        ? `${n.instance.kind.toUpperCase()} · INTEGRATED APP`
        : n.instance.appKind === 'auth'
        ? `${n.instance.kind.toUpperCase()} · AUTH`
        : n.instance.appKind === 'infrastructure'
        ? `${n.instance.kind.toUpperCase()} · INFRA`
        : n.instance.kind.toUpperCase();
      g.append('text')
        .attr('x', 10).attr('y', 18).attr('class', 'node-kind')
        .text(truncate(kindLabel, 30));

      g.append('text')
        .attr('x', 10).attr('y', 44).attr('class', 'node-title')
        .text(truncate(n.instance.name, 26));
      // tt-14: the NAMED storage identity — sqlite ownership vs
      // the shared mariadb becomes visible per container.
      g.append('text')
        .attr('x', 10).attr('y', 58).attr('class', 'node-meta')
        .text(truncate(
          (n.instance.storage
            ? `${n.instance.storage.name}`
              + `${n.instance.storage.shared ? '' : ' (owned)'}`
            : n.instance.appKind === 'polari'
              ? 'no object db' : 'no object tree')
          + ` · ${n.instance.envTier} · x${n.instance.replicas}`,
          42));
      g.append('text')
        .attr('x', 10).attr('y', 71).attr('class', 'node-meta')
        .text(truncate(
          `${n.instance.machineName || 'unplaced'}`
          + ` → ${n.instance.orchestrationTarget}`, 40));
      // tt-14 service dots: frontends / backends / DATABASES /
      // AUTH / storage / proxy per container (keycloak + mariadb
      // + keydb become visible, each category its own color).
      let dotX = 12;
      for (const kind of n.instance.serviceKinds ?? []) {
        const cat = serviceCategory(kind);
        const dot = g.append('circle')
          .attr('cx', dotX).attr('cy', 82).attr('r', 4)
          .attr('fill', cat.color)
          .attr('stroke', 'rgba(0,0,0,0.25)')
          .attr('stroke-width', 0.6);
        dot.append('title').text(`${kind} (${cat.category})`);
        dotX += 12;
        if (dotX > n.w - 12) { break; }
      }

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
    // tt-11 testing mode: red/green wins over the classification
    // palette; unknown states keep their normal look.
    const testState = this.testing?.ok
      ? this.testStateOf(circle.module) : '';
    const color = TEST_COLORS[testState]
      ?? CLASSIFICATION_COLORS[circle.classification]
      ?? '#78909c';
    const disabled = circle.state === 'disabled';
    // tt-13: a 'transient' ASSIGNMENT is a ghost at the module's
    // former location — dashed, faded, inert, one click to return.
    const ghost = circle.state === 'transient';
    const node = g.append('g')
      .attr('transform', `translate(${cx},${cy})`)
      .attr('opacity', disabled ? 0.4 : ghost ? 0.45 : 1);
    if (circle.depth === 0) {
      node.style('cursor', 'pointer')
        .on('click', (ev: Event) => {
          ev.stopPropagation();
          this.zone.run(() => this.selectModule(circle.module));
        });
    }
    if (circle.transient && circle.primaryConsumer) {
      // tt-9 parity: a dashed transient copy zooms to wherever the
      // primary consumer actually lives (same as tech-tree chips).
      node.style('cursor', 'zoom-in')
        .on('click', (ev: Event) => {
          ev.stopPropagation();
          this.zone.run(
            () => this.zoomToModule(circle.primaryConsumer));
        });
    }
    node.append('circle')
      .attr('r', circle.r)
      .attr('class', 'module-circle')
      .attr('stroke', color)
      .attr('stroke-width', circle.depth === 0 ? 2 : 1.4)
      // Border-dash = TRANSIENT (shared-dep copy OR tt-13 moved-
      // away ghost); was: service connections.
      .attr('stroke-dasharray',
        circle.transient || ghost ? '5,4' : null)
      .attr('fill', color)
      .attr('fill-opacity', circle.depth === 0 ? 0.10 : 0.14);
    node.append('title').text(
      `${circle.module} — ${circle.classification}`
      + (testState ? ` · tests: ${testState}` : '')
      + (circle.transient
         ? ` (transient copy; primary under ${circle.primaryConsumer}`
           + ' — click to zoom there)'
         : '')
      + (ghost ? ' · TRANSIENT GHOST — moved away; click to move '
                 + 'it back' : '')
      + (disabled ? ' · disabled' : ''));
    if (circle.depth === 0) {
      // tt-11: word-wrapped label lines (packing pads for them).
      const label = node.append('text')
        .attr('class', 'module-label')
        .attr('text-anchor', 'middle');
      circle.labelLines.forEach((line, i) => {
        label.append('tspan')
          .attr('x', 0)
          .attr('y', circle.r + 12 + i * 11)
          .text(line);
      });
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

/** Where a connector crosses a container's border: the side facing
 *  the partner container, level with the module circle when the
 *  run is horizontal. */
function borderPoint(node: InstanceNode,
                     anchor: { x: number; y: number },
                     toward: InstanceNode): { x: number; y: number } {
  const cx = node.x + node.w / 2, cy = node.y + node.h / 2;
  const dx = (toward.x + toward.w / 2) - cx;
  const dy = (toward.y + toward.h / 2) - cy;
  if (Math.abs(dx) >= Math.abs(dy)) {
    return {
      x: dx > 0 ? node.x + node.w : node.x,
      y: clamp(anchor.y, node.y + 32, node.y + node.h - 10),
    };
  }
  return {
    x: clamp(anchor.x, node.x + 10, node.x + node.w - 10),
    y: dy > 0 ? node.y + node.h : node.y,
  };
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function shortName(module: string): string {
  const parts = module.split('.');
  return parts[parts.length - 1];
}
