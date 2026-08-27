import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, ElementRef, Input, OnChanges, OnInit,
         SimpleChanges, ViewChild } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import * as d3 from 'd3';

import { PolariService } from '@services/polari-service';
import { CellLogicPayload, Conduction, Netlist, NetlistDevice, Vector,
         attachZoom, evalNetlist, resetZoom } from './cell-diagram-shapes';

const PAD = 40, DX = 90, RAIL_Y = 24, DEV_H = 44;
type Sel = d3.Selection<SVGGElement, unknown, null, undefined>;

/**
 * fp-5 — transistor-level schematic of one cell from the backend
 * netlist: VDD rail top, GND rail bottom, p devices above the output
 * node, n devices below, nets as horizontal buses with dot junctions.
 * A highlight vector (input or toggle strip) colours the conducting
 * devices and the Y→VDD / Y→GND path — the schematic side of the proof.
 */
@Component({
  standalone: true,
  selector: 'cell-schematic',
  imports: [CommonModule, MatProgressSpinnerModule],
  templateUrl: './cell-schematic.component.html',
  styleUrls: ['./cell-schematic.component.scss'],
})
export class CellSchematicComponent implements OnInit, OnChanges, AfterViewInit {
  @Input() cell = 'cinv';
  @Input() drive = 1;
  @Input() path = '';
  /** Optional {A:0,B:1}: colours conducting devices + the Y path. */
  @Input() highlightVector: Vector | null = null;

  @ViewChild('svg') svgRef?: ElementRef<SVGSVGElement>;
  @ViewChild('canvas') canvasRef?: ElementRef<SVGGElement>;

  loading = true;
  error: string | null = null;
  data: CellLogicPayload | null = null;
  vector: Vector = {};
  inputNets: string[] = [];
  conduction: Conduction | null = null;
  private zoom?: d3.ZoomBehavior<SVGSVGElement, unknown>;
  private viewReady = false;

  constructor(private http: HttpClient, private polariService: PolariService) {}

  ngOnInit(): void {
    const path = this.path || `/api/cntfet/cell/${this.cell}/logic?drive=${this.drive}`;
    const url = this.polariService.getBackendBaseUrl() + path;
    this.http.get<any>(url, this.polariService.backendRequestOptions).subscribe({
      next: (payload: CellLogicPayload) => {
        this.loading = false;
        if (!payload || payload.ok === false) { this.error = payload?.error || `GET ${path}: not ok`; return; }
        if (!payload.netlist) { this.error = `GET ${path}: payload has no netlist`; return; }
        this.data = payload;
        this.inputNets = payload.netlist.nets.filter(n => n.kind === 'input').map(n => n.id);
        for (const i of this.inputNets) { this.vector[i] = 0; }
        if (this.highlightVector) { Object.assign(this.vector, this.highlightVector); }
        this.recompute();
        this.draw();
      },
      error: (err: any) => {
        this.loading = false;
        this.error = err?.error?.error || `GET ${path} failed: ${err?.message || 'request failed'}`;
      },
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['highlightVector'] && this.data) {
      for (const i of this.inputNets) { this.vector[i] = 0; }
      Object.assign(this.vector, this.highlightVector || {});
      this.recompute(); this.draw();
    }
  }
  ngAfterViewInit(): void { this.viewReady = true; this.draw(); }

  toggle(net: string): void {
    this.vector[net] = this.vector[net] === 1 ? 0 : 1;
    this.recompute(); this.draw();
  }
  resetView(): void { if (this.svgRef && this.zoom) { resetZoom(this.svgRef.nativeElement, this.zoom); } }

  get outputNet(): string {
    return this.data?.netlist?.nets.find(n => n.kind === 'output')?.id || this.data?.output || '';
  }
  get outputText(): string {
    const c = this.conduction;
    if (!c) { return '–'; }
    if (c.contention) { return 'X (contention)'; }
    return c.output === null ? 'Z (floating)' : String(c.output);
  }
  get conductingText(): string {
    return this.conduction ? [...this.conduction.conductingDevices].join(', ') : '';
  }
  private recompute(): void {
    if (this.data?.netlist) { this.conduction = evalNetlist(this.data.netlist, this.vector, this.outputNet); }
  }

  // ---- drawing -------------------------------------------------------------

  private draw(): void {
    if (!this.viewReady || !this.data?.netlist || !this.svgRef || !this.canvasRef) { return; }
    const svgEl = this.svgRef.nativeElement;
    const g = d3.select(this.canvasRef.nativeElement);
    g.selectAll('*').remove();
    if (!this.zoom) { this.zoom = attachZoom(svgEl, this.canvasRef.nativeElement); }
    this.drawNetlist(g, this.data.netlist);
  }

  private drawNetlist(g: Sel, nl: Netlist): void {
    const pDevs = nl.devices.filter(d => d.type === 'p');
    const nDevs = nl.devices.filter(d => d.type === 'n');
    const rows = (devs: NetlistDevice[]) => Math.max(1, ...devs.map(d => (d.y_hint ?? 0) + 1));
    const pRows = rows(pDevs), nRows = rows(nDevs);
    const cols = Math.max(1, ...nl.devices.map(d => (d.x_hint ?? 0) + 1));
    const midY = RAIL_Y + 30 + pRows * DEV_H + 10;
    const gndY = midY + 10 + nRows * DEV_H + 30;
    const width = PAD * 2 + cols * DX;
    const c = this.conduction;
    const netClass = (net: string) => c?.vddNets.has(net) && c?.gndNets.has(net) ? 'x'
      : c?.vddNets.has(net) ? 'vdd' : c?.gndNets.has(net) ? 'gnd' : '';

    // rails
    g.append('line').attr('class', 'rail vdd').attr('x1', PAD - 20).attr('x2', width).attr('y1', RAIL_Y).attr('y2', RAIL_Y);
    g.append('text').attr('class', 'net-label').attr('x', PAD - 20).attr('y', RAIL_Y - 6).text('VDD');
    g.append('line').attr('class', 'rail gnd').attr('x1', PAD - 20).attr('x2', width).attr('y1', gndY).attr('y2', gndY);
    g.append('text').attr('class', 'net-label').attr('x', PAD - 20).attr('y', gndY + 14).text('GND');

    // device placement + terminal points per net
    const terminals = new Map<string, Array<{ x: number; y: number }>>();
    const addT = (net: string, x: number, y: number) => terminals.set(net, [...(terminals.get(net) || []), { x, y }]);
    const place = (d: NetlistDevice, i: number) => {
      const x = PAD + ((d.x_hint ?? i) + 0.5) * DX;
      const y = d.type === 'p' ? RAIL_Y + 30 + ((d.y_hint ?? 0) + 0.5) * DEV_H
                               : midY + 10 + ((d.y_hint ?? 0) + 0.5) * DEV_H;
      return { x, y };
    };
    for (const d of nl.devices) {
      const i = (d.type === 'p' ? pDevs : nDevs).indexOf(d);
      const { x, y } = place(d, i);
      const on = c?.conductingDevices.has(d.id);
      const dev = g.append('g').attr('class', `dev ${d.type} ${on ? 'on' : 'off'}`).attr('transform', `translate(${x},${y})`);
      dev.append('line').attr('class', 'chan').attr('x1', 0).attr('x2', 0).attr('y1', -12).attr('y2', 12);
      dev.append('line').attr('class', 'gate').attr('x1', -6).attr('x2', -6).attr('y1', -12).attr('y2', 12);
      dev.append('line').attr('class', 'lead').attr('x1', d.type === 'p' ? -14 : -6).attr('x2', -22).attr('y1', 0).attr('y2', 0);
      if (d.type === 'p') { dev.append('circle').attr('class', 'bubble').attr('cx', -10).attr('cy', 0).attr('r', 3.5); }
      dev.append('line').attr('class', 'stub').attr('x1', 0).attr('x2', 0).attr('y1', -12).attr('y2', -20);
      dev.append('line').attr('class', 'stub').attr('x1', 0).attr('x2', 0).attr('y1', 12).attr('y2', 20);
      dev.append('text').attr('class', 'dev-label').attr('x', 8).attr('y', 4).text(d.id);
      const gateVal = this.vector[d.gate];
      dev.append('text').attr('class', `gate-label ${netClass(d.gate)}`).attr('x', -26).attr('y', 4)
        .attr('text-anchor', 'end').text(gateVal === undefined ? d.gate : `${d.gate}=${gateVal}`);
      // p: source up (VDD side), drain down; n: drain up (Y side), source down
      const top = d.type === 'p' ? d.source : d.drain;
      const bottom = d.type === 'p' ? d.drain : d.source;
      addT(top, x, y - 20); addT(bottom, x, y + 20);
    }

    // nets: rails get drops; the rest become buses
    for (const net of nl.nets) {
      const pts = terminals.get(net.id) || [];
      if (!pts.length) { continue; }
      const cls = `wire ${netClass(net.id)}`;
      if (net.kind === 'vdd' || net.kind === 'gnd') {
        const ry = net.kind === 'vdd' ? RAIL_Y : gndY;
        for (const p of pts) { g.append('line').attr('class', cls).attr('x1', p.x).attr('x2', p.x).attr('y1', p.y).attr('y2', ry); }
        continue;
      }
      const busY = net.kind === 'output' ? midY : d3.mean(pts, p => p.y) ?? midY;
      const xs = pts.map(p => p.x);
      const x0 = Math.min(...xs), x1 = Math.max(...xs);
      for (const p of pts) { g.append('line').attr('class', cls).attr('x1', p.x).attr('x2', p.x).attr('y1', p.y).attr('y2', busY); }
      g.append('line').attr('class', cls).attr('x1', x0).attr('x2', net.kind === 'output' ? width : x1).attr('y1', busY).attr('y2', busY);
      if (pts.length > 1) { for (const p of pts) { g.append('circle').attr('class', `dot ${netClass(net.id)}`).attr('cx', p.x).attr('cy', busY).attr('r', 3); } }
      const label = net.kind === 'output' ? `${net.id} = ${this.outputText}` : net.id;
      g.append('text').attr('class', `net-label ${netClass(net.id)}`)
        .attr('x', net.kind === 'output' ? width + 4 : x0 - 6).attr('y', busY + 4)
        .attr('text-anchor', net.kind === 'output' ? 'start' : 'end').text(label);
    }
    for (const comp of nl.composed || []) {
      g.append('text').attr('class', 'composed').attr('x', PAD - 20).attr('y', gndY + 32 + 14 * (nl.composed!.indexOf(comp)))
        .text(`${comp.instance}: ${comp.sub_cell} ${Object.entries(comp.ports || {}).map(([k, v]) => `${k}→${v}`).join(' ')}`);
    }
  }
}
