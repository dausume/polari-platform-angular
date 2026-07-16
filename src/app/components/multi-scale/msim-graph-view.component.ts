import {
  Component, ElementRef, EventEmitter, Input, NgZone, OnChanges, OnDestroy,
  Output, SimpleChanges, ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import * as d3 from 'd3';

import { MsimAuthoringService } from '@services/multi-scale/msim-authoring.service';
import {
  InitialConditionInterfaceService,
} from '@services/multi-scale/initial-condition-interface.service';
import {
  CouplingConfig, IntentsCatalog, IcInterfaceConfig,
} from '@models/multi-scale/msim-types';
import { SimulationRunService } from '@services/sim-space/simulation-run.service';
import { SimulationRunSummary } from '@models/sim-space/sim-space-types';
import {
  MsimStage, NamedMultiScaleSimConfig,
} from '@models/multi-scale/NamedMultiScaleSimConfig';
// Type-only: the page imports this component, so the reverse import must
// erase at runtime (no circular module evaluation).
import type { StageState } from './multi-scale-sim-page.component';

/** One node of the composition graph — a Simulation or a logic space
 *  (IC-selection interfaces count). */
interface GraphNode {
  id: string;
  type: 'sim' | 'ic';
  label: string;
  intent?: string;
  primary?: boolean;
  /** Referenced by an edge but not a member — drawn dimmed. */
  ghost?: boolean;
  gate?: { complete: boolean | null; reason: string };
  live?: { run: string; step: number | null; time: number | null;
           values: Array<{ k: string; v: string }> };
  x: number; y: number; w: number; h: number; depth: number;
}

interface GraphEdge {
  source: string;
  target: string;
  kind: 'coupling' | 'ic' | 'stage';
  label: string;
  dashed?: boolean;
}

/**
 * The Composition Graph view — the multi-scale simulation drawn as the
 * node graph it actually is, visually kin to the no-code editor's node
 * trees: each member Simulation and each logic space (IC-selection
 * interfaces) is a node; edges are what actually FLOWS between them
 * (coupling samples, derived initial conditions, interface parameter
 * feeds, stage order). Nodes carry LIVE step/time + headline values
 * while the run advances. Click a node for a lightweight drill-in
 * drawer with jumps into Configure or the detailed pages.
 */
@Component({
  standalone: true,
  selector: 'msim-graph-view',
  imports: [CommonModule, MatButtonModule, MatIconModule, MatTooltipModule],
  templateUrl: './msim-graph-view.component.html',
  styleUrls: ['./msim-graph-view.component.scss'],
})
export class MsimGraphViewComponent implements OnChanges, OnDestroy {
  @Input({ required: true }) config!: NamedMultiScaleSimConfig;
  @Input() selectedRunSummary: SimulationRunSummary | null = null;
  @Input() stageStates: Map<string, StageState> | null = null;
  /** True while the page is stepping — enables the 2s live poll. */
  @Input() running = false;

  /** Ask the page to switch to Configure mode at a specific rail part. */
  @Output() configureRequested = new EventEmitter<string>();

  @ViewChild('svgHost', { static: true }) svgHost!: ElementRef<SVGSVGElement>;

  selected: GraphNode | null = null;
  selectedParams: Array<{ k: string; v: string }> = [];
  selectedState: Array<{ k: string; v: string }> = [];
  selectedIc: IcInterfaceConfig | null = null;
  selectedIntentQuestion = '';
  loadError: string | null = null;

  private nodes: GraphNode[] = [];
  private edges: GraphEdge[] = [];
  private couplings: CouplingConfig[] = [];
  private icConfigs = new Map<string, IcInterfaceConfig>();
  private simRows = new Map<string, any>();
  private intentsCatalog: IntentsCatalog | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private buildSeq = 0;

  constructor(
    private authoring: MsimAuthoringService,
    private icService: InitialConditionInterfaceService,
    private runService: SimulationRunService,
    private router: Router,
    private zone: NgZone,
  ) {}

  async ngOnChanges(changes: SimpleChanges): Promise<void> {
    if (changes['config'] || changes['selectedRunSummary']) {
      await this.rebuild();
    }
    if (changes['running']) {
      this.managePoll();
    }
  }

  ngOnDestroy(): void {
    if (this.pollTimer) clearInterval(this.pollTimer);
  }

  /** Page hook — refresh live badges after committed steps. */
  async refresh(): Promise<void> {
    await this.refreshLive();
  }

  private managePoll(): void {
    if (this.running && !this.pollTimer) {
      this.pollTimer = setInterval(() => this.refreshLive(), 2000);
    } else if (!this.running && this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
      this.refreshLive();
    }
  }

  // ------------------------------------------------------------------
  // Graph assembly
  // ------------------------------------------------------------------

  private async rebuild(): Promise<void> {
    if (!this.config) return;
    const seq = ++this.buildSeq;
    this.loadError = null;
    try {
      const [couplings, simDefRows, intents] = await Promise.all([
        this.authoring.listCouplings(),
        this.authoring.crudeList('SimulationDefinition'),
        this.authoring.intents(),
      ]);
      if (seq !== this.buildSeq) return;
      this.couplings = couplings.filter(
        c => this.config.couplings.includes(c.name));
      this.simRows = new Map(simDefRows.map((r: any) => [r.name, r]));
      this.intentsCatalog = intents;
      // IC-selection interfaces referenced by the composition's panels
      // are logic spaces — nodes in their own right.
      for (const ref of this.icPanelRefs()) {
        if (this.icConfigs.has(ref)) continue;
        try {
          const cfg = await new Promise<IcInterfaceConfig>((res, rej) =>
            this.icService.loadByName(ref).subscribe({ next: res, error: rej }));
          this.icConfigs.set(ref, cfg);
        } catch { /* node renders without target edge */ }
      }
      if (seq !== this.buildSeq) return;
      this.assembleGraph();
      this.layout();
      this.render();
      await this.refreshLive();
    } catch (err: any) {
      this.loadError = err?.message || String(err);
    }
  }

  private icPanelRefs(): string[] {
    return (this.config?.panels ?? [])
      .filter(p => p.kind === 'ic' && p.icInterfaceRef)
      .map(p => p.icInterfaceRef!) as string[];
  }

  private stageSim(stage: MsimStage): string {
    return stage.simulationRef || stage.primarySimulationRef || '';
  }

  private assembleGraph(): void {
    const nodes = new Map<string, GraphNode>();
    const simNode = (name: string, ghost = false): GraphNode => {
      let n = nodes.get(name);
      if (!n) {
        n = {
          id: name, type: 'sim', label: name, ghost,
          intent: (this.simRows.get(name)?.intent as string) || 'observe',
          primary: name === this.config.primarySimulationRef,
          x: 0, y: 0, w: 220, h: 84, depth: 0,
        };
        nodes.set(name, n);
      }
      return n;
    };
    for (const m of this.config.members) simNode(m);

    const edges: GraphEdge[] = [];

    // Couplings — what one space samples into another, labeled by the
    // sampled field and the context keys it injects.
    for (const c of this.couplings) {
      if (!c.sourceSimulationRef || !c.targetSimulationRef) continue;
      simNode(c.sourceSimulationRef, !this.config.members.includes(c.sourceSimulationRef));
      simNode(c.targetSimulationRef, !this.config.members.includes(c.targetSimulationRef));
      edges.push({
        source: c.sourceSimulationRef,
        target: c.targetSimulationRef,
        kind: 'coupling',
        label: this.couplingLabel(c),
      });
    }

    // IC-selection interfaces — logic spaces feeding parameters in.
    for (const ref of this.icPanelRefs()) {
      const cfg = this.icConfigs.get(ref);
      const id = `ic:${ref}`;
      nodes.set(id, {
        id, type: 'ic', label: cfg?.label || ref,
        x: 0, y: 0, w: 200, h: 72, depth: 0,
      });
      const target = cfg?.targetSimulationRef;
      if (target) {
        simNode(target, !this.config.members.includes(target));
        const keys = Object.keys(cfg?.choices?.[0]?.setParams ?? {});
        edges.push({
          source: id, target,
          kind: 'ic',
          label: keys.length ? `sets ${keys.join(', ')}` : 'sets initial conditions',
        });
      }
    }

    // Stage order — the multi-scale progression. A gated upstream stage
    // must ACHIEVE before downstream initial conditions are legitimate.
    const stages = this.config.stages;
    for (let i = 0; i < stages.length - 1; i++) {
      const src = this.stageSim(stages[i]);
      const tgt = this.stageSim(stages[i + 1]);
      if (!src || !tgt || src === tgt) continue;
      simNode(src, !this.config.members.includes(src));
      simNode(tgt, !this.config.members.includes(tgt));
      const derived = Object.keys(stages[i].derive?.params ?? {})
        .map(k => k.split('.').pop());
      edges.push({
        source: src, target: tgt,
        kind: 'stage', dashed: true,
        label: derived.length
          ? `derives ${derived.join(', ')}`
          : (stages[i].gate?.solutionRef ? 'must achieve first' : 'then'),
      });
    }

    // Gate badges live on the staged simulation's node.
    for (const stage of stages) {
      if (stage.kind === 'coStep') continue;
      const n = nodes.get(this.stageSim(stage));
      const st = this.stageStates?.get(stage.key);
      if (n && st) n.gate = { complete: st.complete, reason: st.reason };
    }

    this.nodes = [...nodes.values()];
    this.edges = edges;
  }

  private couplingLabel(c: CouplingConfig): string {
    const operands = c.config?.['sampler']?.['operands'] ?? {};
    let field = c.sourceClassName;
    for (const spec of Object.values<any>(operands)) {
      if (spec?.kind === 'source_field_json' || spec?.kind === 'source_field') {
        field = spec.field || field;
        break;
      }
    }
    const inject = c.config?.['inject'] ?? {};
    const keys = Object.entries<any>(inject)
      .filter(([, spec]) => spec?.kind !== 'constant')
      .map(([k]) => k);
    return keys.length ? `${field} → ${keys.join(', ')}` : field;
  }

  // ------------------------------------------------------------------
  // Layout — layered left→right by topological depth (longest path).
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
      n.h = n.type === 'ic' ? 72 : 108;
      if (!columns.has(n.depth)) columns.set(n.depth, []);
      columns.get(n.depth)!.push(n);
    }
    const colGap = 300, rowGap = 150, x0 = 40, y0 = 40;
    const maxRows = Math.max(...[...columns.values()].map(c => c.length));
    for (const [d, col] of columns) {
      // IC/logic spaces above, sims below; primary sim last (bottom
      // right visual weight matches "everything flows into it").
      col.sort((a, b) =>
        (a.type === 'ic' ? 0 : a.primary ? 2 : 1)
        - (b.type === 'ic' ? 0 : b.primary ? 2 : 1));
      const startY = y0 + ((maxRows - col.length) * rowGap) / 2;
      col.forEach((n, i) => {
        n.x = x0 + d * colGap;
        n.y = startY + i * rowGap;
      });
    }
  }

  // ------------------------------------------------------------------
  // Live badges
  // ------------------------------------------------------------------

  /** The run whose state a sim node shows: primary sim → the page's
   *  selected run; coupled sources → that run's coupledRunRefs entry. */
  private runForSim(sim: string): string | null {
    if (!this.selectedRunSummary) return null;
    if (sim === this.config.primarySimulationRef) {
      return this.selectedRunSummary.name;
    }
    return this.selectedRunSummary.coupledRunRefs?.[sim] ?? null;
  }

  private async refreshLive(): Promise<void> {
    const jobs = this.nodes
      .filter(n => n.type === 'sim' && !n.ghost)
      .map(async n => {
        const run = this.runForSim(n.id);
        if (!run) { n.live = undefined; return; }
        try {
          const st = await this.runService.currentStateFor(run);
          n.live = {
            run, step: st.step, time: st.time,
            values: this.headlineValues(st.perClass),
          };
        } catch { /* keep the previous badge */ }
      });
    await Promise.all(jobs);
    this.render();
    if (this.selected) this.refreshDrawerState();
  }

  /** Up to 3 headline numbers: prefer the humanly-interesting scalars,
   *  then anything numeric that isn't a vector component. */
  private headlineValues(perClass: Record<string, Record<string, unknown>>):
      Array<{ k: string; v: string }> {
    const merged: Record<string, number> = {};
    for (const row of Object.values(perClass)) {
      for (const [k, v] of Object.entries(row)) {
        if (typeof v === 'number' && k !== 'step' && k !== 'time') merged[k] = v;
      }
    }
    const preferred = ['energy_total', 'speed', 'ke', 'pe', 'pz', 'py'];
    const picked: string[] = preferred.filter(k => k in merged);
    for (const k of Object.keys(merged)) {
      if (picked.length >= 3) break;
      if (!picked.includes(k) && !/_[xyz]$/.test(k)) picked.push(k);
    }
    return picked.slice(0, 3).map(k => ({ k, v: fmt(merged[k]) }));
  }

  // ------------------------------------------------------------------
  // D3 render
  // ------------------------------------------------------------------

  private render(): void {
    const svg = d3.select(this.svgHost.nativeElement);
    svg.selectAll('*').remove();

    const defs = svg.append('defs');
    for (const [id, color] of [
      ['msim-arrow-coupling', '#00796b'],
      ['msim-arrow-ic', '#7e57c2'],
      ['msim-arrow-stage', '#8d6e63'],
    ] as Array<[string, string]>) {
      defs.append('marker')
        .attr('id', id).attr('viewBox', '0 -5 10 10')
        .attr('refX', 9).attr('refY', 0)
        .attr('markerWidth', 7).attr('markerHeight', 7)
        .attr('orient', 'auto')
        .append('path').attr('d', 'M0,-5L10,0L0,5').attr('fill', color);
    }

    const root = svg.append('g').attr('class', 'zoom-root');
    svg.call(
      d3.zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.4, 2.5])
        .on('zoom', (ev) => root.attr('transform', ev.transform)) as any,
    );

    const byId = new Map(this.nodes.map(n => [n.id, n]));
    const edgeColor = { coupling: '#00796b', ic: '#7e57c2', stage: '#8d6e63' };

    // Edges first (under the nodes).
    const eg = root.append('g').attr('class', 'edges');
    for (const e of this.edges) {
      const s = byId.get(e.source), t = byId.get(e.target);
      if (!s || !t) continue;
      const sx = s.x + s.w, sy = s.y + s.h / 2;
      const tx = t.x, ty = t.y + t.h / 2;
      const dx = Math.max(40, (tx - sx) / 2);
      eg.append('path')
        .attr('d', `M${sx},${sy} C${sx + dx},${sy} ${tx - dx},${ty} ${tx},${ty}`)
        .attr('fill', 'none')
        .attr('stroke', edgeColor[e.kind])
        .attr('stroke-width', 2)
        .attr('stroke-dasharray', e.dashed ? '6,5' : null)
        .attr('marker-end', `url(#msim-arrow-${e.kind})`);
      eg.append('text')
        .attr('class', 'edge-label')
        .attr('x', (sx + tx) / 2).attr('y', (sy + ty) / 2 - 8)
        .attr('text-anchor', 'middle')
        .attr('fill', edgeColor[e.kind])
        .text(e.label);
    }

    // Nodes — rounded cards with a colored header strip, the visual
    // language of the no-code editor's state nodes.
    const ng = root.append('g').attr('class', 'nodes');
    for (const n of this.nodes) {
      const g = ng.append('g')
        .attr('class', `node ${n.type}${n.ghost ? ' ghost' : ''}`)
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
        .attr('fill', n.type === 'ic' ? '#7e57c2'
          : n.primary ? '#00796b' : '#5c6bc0');
      g.append('rect')  // square off the strip's bottom corners
        .attr('y', 16).attr('width', n.w).attr('height', 10)
        .attr('fill', n.type === 'ic' ? '#7e57c2'
          : n.primary ? '#00796b' : '#5c6bc0');
      g.append('text')
        .attr('x', 10).attr('y', 18).attr('class', 'node-kind')
        .text(n.type === 'ic' ? 'SELECTION SPACE'
          : n.primary ? '▶ PRIMARY SIMULATION' : 'SIMULATION');

      g.append('text')
        .attr('x', 10).attr('y', 46).attr('class', 'node-title')
        .text(truncate(n.label, 26));
      if (n.type === 'sim') {
        g.append('text')
          .attr('x', 10).attr('y', 62).attr('class', 'node-intent')
          .text(this.intentsCatalog?.intents?.[n.intent ?? '']?.label
            ?? n.intent ?? '');
        if (n.live) {
          g.append('text')
            .attr('x', 10).attr('y', 80).attr('class', 'node-live')
            .text(`step ${n.live.step ?? '—'}`
              + (n.live.time != null ? ` · t=${fmt(n.live.time)}s` : ''));
          g.append('text')
            .attr('x', 10).attr('y', 96).attr('class', 'node-values')
            .text(n.live.values.map(kv => `${kv.k}=${kv.v}`).join('  '));
        } else {
          g.append('text')
            .attr('x', 10).attr('y', 80).attr('class', 'node-live idle')
            .text('no linked run selected');
        }
      } else {
        g.append('text')
          .attr('x', 10).attr('y', 62).attr('class', 'node-intent')
          .text('initial-condition choices');
      }

      if (n.gate) {
        const ok = n.gate.complete === true;
        const badge = g.append('g')
          .attr('transform', `translate(${n.w - 16},13)`);
        badge.append('circle').attr('r', 9)
          .attr('fill', ok ? '#43a047' : '#fbc02d');
        badge.append('text')
          .attr('text-anchor', 'middle').attr('y', 4)
          .attr('class', 'gate-glyph')
          .text(ok ? '✓' : '…');
        badge.append('title')
          .text(ok ? 'Gate achieved' : (n.gate.reason || 'Gate not achieved yet'));
      }
    }
  }

  // ------------------------------------------------------------------
  // Drill-in drawer
  // ------------------------------------------------------------------

  selectNode(n: GraphNode): void {
    this.selected = n;
    this.selectedIc = null;
    this.selectedParams = [];
    this.selectedState = [];
    this.selectedIntentQuestion = '';
    if (n.type === 'ic') {
      this.selectedIc = this.icConfigs.get(n.id.slice(3)) ?? null;
    } else {
      const row = this.simRows.get(n.id);
      if (row) {
        this.selectedParams = paramsOf(row);
      }
      this.selectedIntentQuestion =
        this.intentsCatalog?.intents?.[n.intent ?? '']?.question ?? '';
      this.refreshDrawerState();
    }
    this.render();
  }

  private async refreshDrawerState(): Promise<void> {
    const n = this.selected;
    if (!n || n.type !== 'sim') return;
    const run = this.runForSim(n.id);
    if (!run) { this.selectedState = []; return; }
    try {
      const st = await this.runService.currentStateFor(run);
      const rows: Array<{ k: string; v: string }> = [];
      for (const [cls, fields] of Object.entries(st.perClass)) {
        for (const [k, v] of Object.entries(fields)) {
          if (typeof v === 'number' && k !== 'step' && rows.length < 10) {
            rows.push({ k: `${shortClass(cls)}.${k}`, v: fmt(v) });
          }
        }
      }
      this.selectedState = rows;
    } catch { /* drawer keeps the last state */ }
  }

  closeDrawer(): void {
    this.selected = null;
    this.render();
  }

  get selectedDt(): string {
    if (!this.selected || this.selected.type !== 'sim') return '';
    const dt = Number(this.simRows.get(this.selected.id)?.time_step_seconds ?? 0);
    return dt ? `${dt}s` : '';
  }

  configureSelected(): void {
    if (!this.selected) return;
    this.configureRequested.emit(
      this.selected.type === 'ic' ? 'ics'
        : this.selected.gate ? 'stages' : 'spaces');
  }

  openSelectedPages(): void {
    if (!this.selected) return;
    if (this.selected.type === 'sim') {
      this.router.navigate(['/class-main-page', 'SimulationDefinition'],
        { queryParams: { highlight: this.selected.id } });
    }
  }
}

// ---------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------

function fmt(v: number): string {
  if (!isFinite(v)) return String(v);
  const a = Math.abs(v);
  if (a !== 0 && (a >= 10000 || a < 0.001)) return v.toExponential(2);
  return Number(v.toPrecision(4)).toString();
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

function shortClass(cls: string): string {
  return cls.replace(/SimState$/, '');
}

function paramsOf(simRow: any): Array<{ k: string; v: string }> {
  try {
    const params = JSON.parse(simRow.parameters_json || '{}');
    return Object.entries(params)
      .filter(([, v]) => typeof v === 'number')
      .slice(0, 12)
      .map(([k, v]) => ({ k, v: fmt(v as number) }));
  } catch {
    return [];
  }
}
