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
  TechEdgeReport, TechNodeReport, TechTreePayload,
} from '@models/techtree/techtree-types';

/** One placed technology rectangle. */
interface TechBox {
  node: TechNodeReport;
  x: number;
  y: number;
  w: number;
  h: number;
  depth: number;
}

const NODE_W = 250;
const HEADER_H = 30;
const BAND_H = 64;
const CHIP_ROW_H = 26;
const EDGE_COLOR = '#607d8b';

/**
 * The tech-tree render mode (tt-4, TECH_TREE_TOPOLOGY_PLAN B1):
 * rectangular containers are TECHNOLOGIES. Each node's body is
 * split into up-to-four colored segment bands — theory blue, real
 * red, business yellow, politics purple — a band exists ONLY when
 * its segment is populated, band width follows segment weight, and
 * the band fills bottom-up with its completion fraction. A
 * completion ring on the header shows the node's derived rollup.
 * Dependencies reuse the Part-A vocabulary: dep chips nested inside
 * the node (dashed = transient copy, duplicates intentional) and
 * edges between nodes (dashed = transient). Everything drawn here
 * is DERIVED backend state — this component computes nothing.
 */
@Component({
  standalone: true,
  selector: 'tech-tree-view',
  imports: [CommonModule, MatButtonModule, MatIconModule, MatTooltipModule],
  templateUrl: './tech-tree-view.component.html',
  styleUrls: ['./tech-tree-view.component.scss'],
})
export class TechTreeViewComponent implements OnChanges {
  @Input({ required: true }) payload!: TechTreePayload | null;

  @ViewChild('svgHost', { static: true }) svgHost!: ElementRef<SVGSVGElement>;

  selected: TechNodeReport | null = null;

  private boxes: TechBox[] = [];

  constructor(private zone: NgZone) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['payload']) {
      this.layout();
      this.render();
      if (this.selected) {
        this.selected = this.payload?.ok
          ? this.payload.nodes.find(
              n => n.name === this.selected!.name) ?? null
          : null;
      }
    }
  }

  segmentLabel(kind: string): string {
    return kind.charAt(0).toUpperCase() + kind.slice(1);
  }

  percent(level: number | undefined | null): string {
    return `${Math.round((level ?? 0) * 100)}%`;
  }

  // ------------------------------------------------------------------
  // Layout — foundations left, dependents right (longest path).
  // ------------------------------------------------------------------

  private layout(): void {
    this.boxes = [];
    if (!this.payload?.ok) { return; }
    const nodes = this.payload.nodes;
    const depth = new Map<string, number>(nodes.map(n => [n.name, 0]));
    for (let pass = 0; pass < nodes.length + 1; pass++) {
      let changed = false;
      for (const n of nodes) {
        for (const dep of n.dependsOn) {
          const d = (depth.get(dep) ?? 0) + 1;
          if (d > (depth.get(n.name) ?? 0)) {
            depth.set(n.name, d);
            changed = true;
          }
        }
      }
      if (!changed) { break; }
    }
    const columns = new Map<number, TechBox[]>();
    for (const n of nodes) {
      const box: TechBox = {
        node: n, x: 0, y: 0, w: NODE_W,
        h: HEADER_H + (n.segments?.length ? BAND_H : 18)
          + (n.dependsOn.length ? CHIP_ROW_H : 0) + 12,
        depth: depth.get(n.name) ?? 0,
      };
      if (!columns.has(box.depth)) { columns.set(box.depth, []); }
      columns.get(box.depth)!.push(box);
      this.boxes.push(box);
    }
    const colGap = NODE_W + 70, x0 = 40, y0 = 40, rowGap = 26;
    const maxColH = Math.max(1, ...[...columns.values()].map(col =>
      col.reduce((s, b) => s + b.h + rowGap, 0)));
    for (const [d, col] of [...columns.entries()]
        .sort((a, b) => a[0] - b[0])) {
      col.sort((a, b) => a.node.name.localeCompare(b.node.name));
      const colH = col.reduce((s, b) => s + b.h + rowGap, 0);
      let y = y0 + (maxColH - colH) / 2;
      for (const box of col) {
        box.x = x0 + d * colGap;
        box.y = y;
        y += box.h + rowGap;
      }
    }
  }

  // ------------------------------------------------------------------
  // D3 render
  // ------------------------------------------------------------------

  private render(): void {
    const svg = d3.select(this.svgHost.nativeElement);
    svg.selectAll('*').remove();
    const payload = this.payload;
    if (!payload?.ok) { return; }

    svg.append('defs').append('marker')
      .attr('id', 'tech-arrow').attr('viewBox', '0 -5 10 10')
      .attr('refX', 9).attr('refY', 0)
      .attr('markerWidth', 7).attr('markerHeight', 7)
      .attr('orient', 'auto')
      .append('path').attr('d', 'M0,-5L10,0L0,5')
      .attr('fill', EDGE_COLOR);

    const root = svg.append('g').attr('class', 'zoom-root');
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 2.5])
      .on('zoom', (ev) => root.attr('transform', ev.transform));
    svg.call(zoom as any);
    this.fitToView(svg, zoom);

    this.renderEdges(root, payload.edges);
    for (const box of this.boxes) {
      this.renderNode(root, box, payload);
    }
  }

  private fitToView(svg: d3.Selection<SVGSVGElement, unknown, null,
      undefined>, zoom: d3.ZoomBehavior<SVGSVGElement, unknown>): void {
    if (!this.boxes.length) { return; }
    const pad = 24;
    const minX = Math.min(...this.boxes.map(b => b.x)) - pad;
    const minY = Math.min(...this.boxes.map(b => b.y)) - pad;
    const maxX = Math.max(...this.boxes.map(b => b.x + b.w)) + pad;
    const maxY = Math.max(...this.boxes.map(b => b.y + b.h)) + pad;
    const host = this.svgHost.nativeElement as SVGSVGElement;
    const vw = host.clientWidth || 800;
    const vh = host.clientHeight || 520;
    const scale = Math.min(1, vw / (maxX - minX), vh / (maxY - minY));
    const tx = (vw - (maxX - minX) * scale) / 2 - minX * scale;
    const ty = (vh - (maxY - minY) * scale) / 2 - minY * scale;
    svg.call((zoom as any).transform,
      d3.zoomIdentity.translate(tx, ty).scale(scale));
  }

  /** Tech→tech edges: dependency flows dep → dependent; dashed =
   *  transient (this dependent holds a reference copy). */
  private renderEdges(root: d3.Selection<SVGGElement, unknown, null,
      undefined>, edges: TechEdgeReport[]): void {
    const byName = new Map(this.boxes.map(b => [b.node.name, b]));
    const eg = root.append('g').attr('class', 'tech-edges');
    for (const edge of edges) {
      const s = byName.get(edge.dependsOnTech);
      const t = byName.get(edge.techNode);
      if (!s || !t) { continue; }
      const sx = s.x + s.w, sy = s.y + s.h / 2;
      const tx = t.x, ty = t.y + t.h / 2;
      const dx = Math.max(40, (tx - sx) / 2);
      eg.append('path')
        .attr('d', `M${sx},${sy} C${sx + dx},${sy} `
          + `${tx - dx},${ty} ${tx},${ty}`)
        .attr('fill', 'none')
        .attr('stroke', EDGE_COLOR)
        .attr('stroke-width', edge.isTransient ? 1.3 : 2)
        .attr('stroke-dasharray', edge.isTransient ? '5,4' : null)
        .attr('opacity', edge.isTransient ? 0.6 : 0.9)
        .attr('marker-end', 'url(#tech-arrow)');
    }
  }

  private renderNode(root: d3.Selection<SVGGElement, unknown, null,
      undefined>, box: TechBox, payload: TechTreePayload): void {
    const n = box.node;
    const g = root.append('g')
      .attr('class', 'tech-node')
      .attr('transform', `translate(${box.x},${box.y})`)
      .style('cursor', 'pointer')
      .on('click', () => this.zone.run(() => this.selectNode(n)));

    g.append('rect')
      .attr('width', box.w).attr('height', box.h)
      .attr('rx', 10)
      .attr('class', 'tech-body')
      .classed('selected', this.selected?.name === n.name);

    g.append('text')
      .attr('x', 12).attr('y', 20).attr('class', 'tech-title')
      .text(truncate(n.title, 24));
    this.renderCompletionRing(
      g, box.w - 20, 15, n.completionLevel ?? 0);

    // Segment bands (B1): only PRESENT segments take space; width
    // follows weight; the band fills bottom-up with completion.
    const segments = n.segments ?? [];
    let bx = 10;
    const bandsW = box.w - 20;
    const totalWeight = segments.reduce(
      (s, seg) => s + (seg.weight || 1), 0) || 1;
    for (const seg of segments) {
      const bw = bandsW * ((seg.weight || 1) / totalWeight);
      const band = g.append('g');
      band.append('rect')
        .attr('x', bx).attr('y', HEADER_H)
        .attr('width', bw - 3).attr('height', BAND_H)
        .attr('rx', 5)
        .attr('fill', seg.color)
        .attr('fill-opacity', 0.16)
        .attr('stroke', seg.color)
        .attr('stroke-width', 1.2);
      const fillH = BAND_H * seg.completion;
      if (fillH > 0) {
        band.append('rect')
          .attr('x', bx).attr('y', HEADER_H + BAND_H - fillH)
          .attr('width', bw - 3).attr('height', fillH)
          .attr('rx', 5)
          .attr('fill', seg.color)
          .attr('fill-opacity', 0.5);
      }
      band.append('text')
        .attr('x', bx + (bw - 3) / 2).attr('y', HEADER_H + 16)
        .attr('text-anchor', 'middle')
        .attr('class', 'band-label')
        .attr('fill', seg.color)
        .text(truncate(this.segmentLabel(seg.kind),
          Math.max(3, Math.floor(bw / 8))));
      band.append('text')
        .attr('x', bx + (bw - 3) / 2).attr('y', HEADER_H + 32)
        .attr('text-anchor', 'middle')
        .attr('class', 'band-count')
        .attr('fill', seg.color)
        .text(`${seg.done}/${seg.total}`);
      band.append('title').text(
        `${this.segmentLabel(seg.kind)} — `
        + `${Math.round(seg.completion * 100)}% `
        + `(${seg.done}/${seg.total} done, weight ${seg.weight})\n`
        + seg.assignments.map(
            a => `${a.done ? '✓' : '✗'} ${a.refName}`).join('\n'));
      bx += bw;
    }
    if (!segments.length) {
      g.append('text')
        .attr('x', 12).attr('y', HEADER_H + 13)
        .attr('class', 'tech-empty')
        .text('no segments populated');
    }

    // Dep chips nested inside the node (A3/A4 vocabulary in the
    // rectangle world): dashed chip = transient copy of a shared
    // technology; the solid copy lives under the primary dependent.
    if (n.dependsOn.length) {
      const chipY = box.h - CHIP_ROW_H + 3;
      let cx = 10;
      const transientOf = new Map(payload.edges
        .filter(e => e.techNode === n.name)
        .map(e => [e.dependsOnTech, e.isTransient]));
      for (const dep of n.dependsOn.slice(0, 3)) {
        const label = truncate(dep, 12);
        const cw = label.length * 6.4 + 14;
        if (cx + cw > box.w - 10) { break; }
        const transient = transientOf.get(dep) ?? false;
        const chip = g.append('g');
        chip.append('rect')
          .attr('x', cx).attr('y', chipY)
          .attr('width', cw).attr('height', 17)
          .attr('rx', 8)
          .attr('class', 'dep-chip')
          .attr('stroke-dasharray', transient ? '4,3' : null);
        chip.append('text')
          .attr('x', cx + cw / 2).attr('y', chipY + 12)
          .attr('text-anchor', 'middle')
          .attr('class', 'dep-chip-label')
          .text(label);
        chip.append('title').text(
          `depends on ${dep}`
          + (transient ? ' (transient copy — primary elsewhere)'
                       : ' (primary)'));
        cx += cw + 6;
      }
      if (n.dependsOn.length > 3) {
        g.append('text')
          .attr('x', cx + 2).attr('y', chipY + 12)
          .attr('class', 'dep-chip-label muted')
          .text(`+${n.dependsOn.length - 3}`);
      }
    }
  }

  /** Small header arc showing the node's derived completion. */
  private renderCompletionRing(g: d3.Selection<SVGGElement, unknown,
      null, undefined>, cx: number, cy: number,
      level: number): void {
    const ring = g.append('g')
      .attr('transform', `translate(${cx},${cy})`);
    ring.append('circle')
      .attr('r', 10).attr('class', 'ring-track');
    if (level > 0) {
      const arc = d3.arc()
        .innerRadius(7.5).outerRadius(10.5)
        .startAngle(0).endAngle(2 * Math.PI * Math.min(1, level));
      ring.append('path')
        .attr('d', arc as unknown as string)
        .attr('class', level >= 1 ? 'ring-fill complete' : 'ring-fill');
    }
    ring.append('title')
      .text(`completion ${Math.round(level * 100)}%`);
  }

  selectNode(n: TechNodeReport): void {
    this.selected = n;
    this.render();
  }

  closeDrawer(): void {
    this.selected = null;
    this.render();
  }
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}
