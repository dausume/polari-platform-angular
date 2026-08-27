import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, ElementRef, Input, OnDestroy, OnInit,
         ViewChild } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import * as d3 from 'd3';

import { PolariService } from '@services/polari-service';
import { Bit, CellLogicPayload, GateDag, GateNode, LogicStep, SequentialSpace,
         Vector, attachZoom, evalDag, gateBodyPath, gateHasBubble, resetZoom,
         sameVector, xorExtraArc } from './cell-diagram-shapes';

const GATE_W = 56, GATE_H = 40, COL_W = 130, ROW_H = 64, PAD = 30;

/**
 * fp-5 — gate-level boolean diagram of one CELL_LIBRARY cell with an
 * interactive proof: toggle inputs (client-side DAG evaluation, wires
 * coloured by value, truth-table row highlighted) or step/play through
 * the backend's switch-level state space and compare boolean vs switch
 * output per vector. Sequential cells render their state graph.
 */
@Component({
  standalone: true,
  selector: 'cell-logic-diagram',
  imports: [CommonModule, MatProgressSpinnerModule],
  templateUrl: './cell-logic-diagram.component.html',
  styleUrls: ['./cell-logic-diagram.component.scss'],
})
export class CellLogicDiagramComponent implements OnInit, AfterViewInit, OnDestroy {
  @Input() cell = 'cinv';
  @Input() drive = 1;
  /** Override for the endpoint path; defaults from cell + drive. */
  @Input() path = '';

  @ViewChild('svg') svgRef?: ElementRef<SVGSVGElement>;
  @ViewChild('canvas') canvasRef?: ElementRef<SVGGElement>;

  loading = true;
  error: string | null = null;
  data: CellLogicPayload | null = null;

  vector: Vector = {};
  values: Record<string, Bit> = {};
  stepIndex = -1;
  playing = false;
  private timer: any = null;
  private zoom?: d3.ZoomBehavior<SVGSVGElement, unknown>;
  private viewReady = false;

  constructor(private http: HttpClient, private polariService: PolariService) {}

  ngOnInit(): void {
    const path = this.path || `/api/cntfet/cell/${this.cell}/logic?drive=${this.drive}`;
    const url = this.polariService.getBackendBaseUrl() + path;
    this.http.get<any>(url, this.polariService.backendRequestOptions).subscribe({
      next: (payload: CellLogicPayload) => {
        this.loading = false;
        if (!payload || payload.ok === false) {
          this.error = payload?.error || `GET ${path}: not ok`;
          return;
        }
        this.data = payload;
        for (const i of payload.inputs || []) { this.vector[i] = 0; }
        this.recompute();
        this.draw();
      },
      error: (err: any) => {
        this.loading = false;
        this.error = err?.error?.error || `GET ${path} failed: ${err?.message || 'request failed'}`;
      },
    });
  }

  ngAfterViewInit(): void { this.viewReady = true; this.draw(); }
  ngOnDestroy(): void { this.stop(); }

  // ---- interaction ---------------------------------------------------------

  get sequential(): SequentialSpace | null {
    const s = this.data?.stateSpace;
    return s && s.kind === 'sequential' ? s : null;
  }
  get steps(): LogicStep[] {
    const s = this.data?.stateSpace;
    return s && s.kind === 'combinational' ? s.steps : [];
  }
  get stepCount(): number { return this.sequential ? this.sequential.transitions.length : this.steps.length; }
  get currentStep(): LogicStep | null { return this.steps[this.stepIndex] || null; }
  get currentTransition() { return this.sequential?.transitions[this.stepIndex] || null; }
  get booleanOutput(): Bit { return this.data ? this.values[this.outputId()] ?? 0 : 0; }
  get stepVerdict(): 'proven' | 'mismatch' | null {
    const s = this.currentStep;
    if (!s) { return null; }
    return s.output === this.booleanOutput ? 'proven' : 'mismatch';
  }

  toggle(input: string): void {
    this.stop();
    this.vector[input] = this.vector[input] === 1 ? 0 : 1;
    this.stepIndex = this.steps.findIndex(s => sameVector(s.vector, this.vector));
    this.recompute();
    this.draw();
  }

  step(delta: number): void {
    const n = this.stepCount;
    if (!n) { return; }
    this.stepIndex = ((this.stepIndex + delta) % n + n) % n;
    const s = this.currentStep;
    if (s) { this.vector = { ...this.vector, ...s.vector }; this.recompute(); }
    this.draw();
  }

  play(): void {
    if (this.playing) { this.stop(); return; }
    this.playing = true;
    this.step(1);
    this.timer = setInterval(() => this.step(1), 800);
  }
  stop(): void { this.playing = false; if (this.timer) { clearInterval(this.timer); this.timer = null; } }

  rowActive(row: { vector: Vector }): boolean { return sameVector(row.vector, this.vector); }
  vectorText(v: Vector | Record<string, any> | undefined): string {
    return Object.entries(v || {}).map(([k, x]) => `${k}=${x}`).join(' ');
  }
  resetView(): void { if (this.svgRef && this.zoom) { resetZoom(this.svgRef.nativeElement, this.zoom); } }

  private outputId(): string {
    const dag = this.data?.gateDag;
    return dag?.nodes.find(n => n.kind === 'output')?.id || this.data?.output || '';
  }
  private recompute(): void {
    if (this.data?.gateDag) { this.values = evalDag(this.data.gateDag, this.vector); }
  }

  // ---- drawing -------------------------------------------------------------

  private draw(): void {
    if (!this.viewReady || !this.data || !this.svgRef || !this.canvasRef) { return; }
    const svg = this.svgRef.nativeElement;
    const g = d3.select(this.canvasRef.nativeElement);
    g.selectAll('*').remove();
    if (!this.zoom) { this.zoom = attachZoom(svg, this.canvasRef.nativeElement); }
    if (this.sequential) { this.drawStateGraph(g, this.sequential); }
    else if (this.data.gateDag) { this.drawDag(g, this.data.gateDag); }
  }

  private drawDag(g: d3.Selection<SVGGElement, unknown, null, undefined>, dag: GateDag): void {
    const levels = new Map<number, GateNode[]>();
    for (const n of dag.nodes) { levels.set(n.level, [...(levels.get(n.level) || []), n]); }
    const maxRows = Math.max(...[...levels.values()].map(l => l.length), 1);
    const pos = new Map<string, { x: number; y: number }>();
    for (const [level, nodes] of levels) {
      const offset = (maxRows - nodes.length) * ROW_H / 2;
      nodes.forEach((n, i) => pos.set(n.id, { x: PAD + level * COL_W, y: PAD + offset + i * ROW_H }));
    }
    const on = (id: string) => this.values[id] === 1;
    const inPin = (n: GateNode, k: number) => {
      const p = pos.get(n.id)!;
      const count = Math.max(n.inputs.length, 1);
      return { x: p.x, y: p.y + GATE_H * (k + 1) / (count + 1) };
    };
    // edges: orthogonal, coloured by source value
    for (const n of dag.nodes) {
      n.inputs.forEach((src, k) => {
        const s = pos.get(src); if (!s) { return; }
        const srcNode = dag.nodes.find(x => x.id === src)!;
        const sx = s.x + (srcNode.kind === 'input' ? 16 : GATE_W + (gateHasBubble(srcNode.gate!) ? 8 : 0));
        const sy = s.y + GATE_H / 2;
        const t = n.kind === 'output' ? { x: pos.get(n.id)!.x, y: pos.get(n.id)!.y + GATE_H / 2 } : inPin(n, k);
        const mx = (sx + t.x) / 2;
        g.append('path').attr('class', `wire ${on(src) ? 'hi' : 'lo'}`)
          .attr('d', `M${sx},${sy} H${mx} V${t.y} H${t.x}`);
      });
    }
    for (const n of dag.nodes) {
      const p = pos.get(n.id)!;
      const node = g.append('g').attr('class', `node ${n.kind} ${on(n.id) ? 'hi' : 'lo'}`)
        .attr('transform', `translate(${p.x},${p.y})`);
      if (n.kind === 'input') {
        node.style('cursor', 'pointer').on('click', () => this.toggle(n.label));
        node.append('rect').attr('x', -32).attr('y', 8).attr('width', 48).attr('height', 24).attr('rx', 6);
        node.append('text').attr('x', -8).attr('y', GATE_H / 2 + 4).attr('text-anchor', 'middle')
          .text(`${n.label}=${on(n.id) ? 1 : 0}`);
      } else if (n.kind === 'output') {
        node.append('rect').attr('x', 0).attr('y', 8).attr('width', 48).attr('height', 24).attr('rx', 6);
        node.append('text').attr('x', 24).attr('y', GATE_H / 2 + 4).attr('text-anchor', 'middle')
          .text(`${n.label}=${on(n.id) ? 1 : 0}`);
      } else if (n.gate) {
        if (n.gate === 'XOR') { node.append('path').attr('class', 'body').attr('d', xorExtraArc(GATE_W, GATE_H)); }
        node.append('path').attr('class', 'body').attr('d', gateBodyPath(n.gate, GATE_W, GATE_H));
        if (gateHasBubble(n.gate)) { node.append('circle').attr('class', 'bubble').attr('cx', GATE_W + 4).attr('cy', GATE_H / 2).attr('r', 4); }
        node.append('text').attr('x', GATE_W * 0.4).attr('y', GATE_H / 2 + 4).attr('text-anchor', 'middle')
          .attr('class', 'gate-label').text(n.gate);
      }
    }
  }

  private drawStateGraph(g: d3.Selection<SVGGElement, unknown, null, undefined>, sp: SequentialSpace): void {
    const r = 28, gap = 220;
    const pos = new Map(sp.states.map((s, i) => [s, { x: PAD + r + i * gap, y: PAD + 80 }]));
    const cur = this.currentTransition;
    const curState = cur ? cur.to : sp.states[0];
    sp.transitions.forEach((t, i) => {
      const a = pos.get(t.from)!, b = pos.get(t.to)!;
      const active = i === this.stepIndex;
      const label = this.vectorText(t.input);
      let d: string, lx: number, ly: number;
      if (t.from === t.to) {
        d = `M${a.x - 10},${a.y - r} C${a.x - 50},${a.y - r - 70} ${a.x + 50},${a.y - r - 70} ${a.x + 10},${a.y - r}`;
        lx = a.x; ly = a.y - r - 58;
      } else {
        const up = a.x < b.x ? -1 : 1;
        const my = a.y + up * 60;
        d = `M${a.x},${a.y + up * r} Q${(a.x + b.x) / 2},${my} ${b.x},${b.y + up * r}`;
        lx = (a.x + b.x) / 2; ly = my - up * 8 + (up < 0 ? -2 : 6);
      }
      g.append('path').attr('class', `arc ${active ? 'hi' : 'lo'}`).attr('d', d).attr('marker-end', 'url(#cld-arrow)');
      g.append('text').attr('class', 'arc-label').attr('x', lx).attr('y', ly).attr('text-anchor', 'middle').text(label);
    });
    for (const [s, p] of pos) {
      const node = g.append('g').attr('class', `state ${s === curState ? 'hi' : 'lo'}`).attr('transform', `translate(${p.x},${p.y})`);
      node.append('circle').attr('r', r);
      node.append('text').attr('y', 4).attr('text-anchor', 'middle').text(s);
    }
  }
}
