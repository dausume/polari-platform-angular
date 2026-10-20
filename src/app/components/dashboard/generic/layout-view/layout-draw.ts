import * as d3 from 'd3';

import { Anchor, BoardFrame, bounds, breadboardRows, COLS, headerPins, P, railX, RAILS, stripKey, stripX, tieAnchor, wirePath } from './layout-geometry';
import { legPoints, Shape, Sprite, spriteFor, SpriteState } from './layout-sprites';
import { LvPayload, LvPlacement, LvSelection, LvWire } from './layout-view.types';

/**
 * lay-2 - the d3 drawing of the layout view. Imperative on purpose, like the pin view: ONE svg, one zoom group, four layers in this order - boards, parts, wires, highlights.
 * A payload change rebuilds the marks; a selection / step / live-state change only re-applies classes and redraws the (few) part sprites. Colours are never hard-coded:
 * every rule is in the component stylesheet (theme tokens); the only inline colours are DATA - a wire's effective colour (the scheme) and a resistor's bands (the colour code).
 */
export interface LvHandlers {
  hole(board: string, tie: string): void; part(name: string): void; wire(name: string): void; pin(board: string, label: string): void; background(): void;
  /** A press-and-hold on a part's sprite (bench mode): down on pointerdown / Space, up on release. */
  hold(name: string, down: boolean): void;
}

export interface LvDrawState {
  selection: LvSelection; shownParts: Set<string>; shownWires: Set<string>; newParts: Set<string>; newWires: Set<string>; whole: boolean;
  /** per part: how its sprite is drawn now (lit, pressed, turn ...) */
  looks: Map<string, SpriteState>; touchable: Set<string>; selStrip: string; selNet: string;
}

const HOLE_R = 0.3 * P;

export class LayoutCanvas {
  private svg: d3.Selection<SVGSVGElement, unknown, null, undefined>;
  private zoomG: d3.Selection<SVGGElement, unknown, null, undefined>;
  private gBoards!: d3.Selection<SVGGElement, unknown, null, undefined>;
  private gParts!: d3.Selection<SVGGElement, unknown, null, undefined>;
  private gWires!: d3.Selection<SVGGElement, unknown, null, undefined>;
  private gHi!: d3.Selection<SVGGElement, unknown, null, undefined>;
  private zoom: d3.ZoomBehavior<SVGSVGElement, unknown>;
  private frames: BoardFrame[] = [];
  private p: LvPayload | null = null;
  private state: LvDrawState | null = null;
  private fitted = false;
  private holdName = '';
  private onWindowUp = (): void => { if (this.holdName) { const n = this.holdName; this.holdName = ''; this.h.hold(n, false); } };

  constructor(svgEl: SVGSVGElement, private h: LvHandlers) {
    this.svg = d3.select(svgEl);
    this.zoomG = this.svg.append('g').attr('class', 'lv-zoom');
    this.zoom = d3.zoom<SVGSVGElement, unknown>().scaleExtent([0.15, 14]).on('zoom', ev => this.zoomG.attr('transform', ev.transform.toString()));
    this.svg.call(this.zoom).on('dblclick.zoom', null);
    this.svg.on('click', () => this.h.background());
    window.addEventListener('pointerup', this.onWindowUp);
    window.addEventListener('pointercancel', this.onWindowUp);
  }

  destroy(): void {
    window.removeEventListener('pointerup', this.onWindowUp);
    window.removeEventListener('pointercancel', this.onWindowUp);
    this.svg.interrupt(); this.svg.on('.zoom', null).on('click', null); this.svg.selectAll('*').remove();
  }

  get boardFrames(): BoardFrame[] { return this.frames; }

  /** Rebuild boards, wires and the part sprites from a fresh payload. Pan / zoom are kept unless this is the first draw. */
  setData(p: LvPayload, frames: BoardFrame[]): void {
    this.p = p; this.frames = frames;
    this.zoomG.selectAll('*').remove();
    this.gBoards = this.zoomG.append('g').attr('class', 'lv-layer lv-boards');
    this.gParts = this.zoomG.append('g').attr('class', 'lv-layer lv-parts');
    this.gWires = this.zoomG.append('g').attr('class', 'lv-layer lv-wires');
    this.gHi = this.zoomG.append('g').attr('class', 'lv-layer lv-highlights');
    for (const f of frames) { f.board.kind === 'devboard' ? this.drawDevboard(f) : this.drawBreadboard(f); }
    this.drawWires(p.wires);
    this.drawParts();
    if (!this.fitted) { this.fit(false); this.fitted = true; }
    if (this.state) { this.apply(this.state); }
  }

  fit(animate = true): void {
    const node = this.svg.node();
    if (!node) { return; }
    const b = bounds(this.frames);
    const w = node.clientWidth || 600, hgt = node.clientHeight || 450;
    const pad = 2 * P, k = Math.min(w / (b.w + 2 * pad), hgt / (b.h + 2 * pad), 8);
    const t = d3.zoomIdentity.translate(w / 2 - (b.x + b.w / 2) * k, hgt / 2 - (b.y + b.h / 2) * k).scale(k);
    animate ? this.svg.transition().duration(250).call(this.zoom.transform, t) : this.svg.call(this.zoom.transform, t);
  }

  zoomBy(f: number): void { this.svg.transition().duration(150).call(this.zoom.scaleBy, f); }

  // ---------------------------------------------------------------------------------------------------------------- boards
  private drawBreadboard(f: BoardFrame): void {
    const b = f.board, g = this.gBoards.append('g').attr('class', 'lv-board lv-breadboard').attr('data-board', b.name).attr('transform', `translate(${f.x} ${f.y})`);
    const rows = breadboardRows();
    g.append('rect').attr('class', 'lv-board-body').attr('x', 0).attr('y', 0).attr('width', f.w).attr('height', f.h).attr('rx', P * 0.8);
    g.append('rect').attr('class', 'lv-trench').attr('x', P * 0.8).attr('y', rows.colY['e'] + P * 0.75).attr('width', f.w - P * 1.6).attr('height', P * 1.5).attr('rx', P * 0.3);
    for (const [pos, pol] of RAILS) {
      const y = rows.railY[pos + pol];
      g.append('line').attr('class', `lv-rail-line ${pol === '+' ? 'plus' : 'minus'}`).attr('x1', P * 0.9).attr('x2', f.w - P * 0.9).attr('y1', y - P * 0.55).attr('y2', y - P * 0.55);
      g.append('text').attr('class', 'lv-tiny').attr('x', P * 0.5).attr('y', y + 3).attr('text-anchor', 'middle').text(pol === '+' ? '+' : '−');
    }
    for (let n = 1; n <= b.rows; n++) {
      if (n === 1 || n % 5 === 0) { g.append('text').attr('class', 'lv-tiny').attr('x', stripX(n)).attr('y', rows.colY['a'] - P * 0.9).attr('text-anchor', 'middle').text(n); }
      for (const c of COLS) { this.hole(g, b.name, `r${n}${c}`, stripX(n), rows.colY[c], stripKey(b.name, `r${n}${c}`) || ''); }
    }
    for (const c of COLS) { g.append('text').attr('class', 'lv-tiny').attr('x', P * 0.2).attr('y', rows.colY[c] + 3).text(c); }
    for (const [pos, pol] of RAILS) {
      for (let n = 1; n <= b.rail_holes; n++) { this.hole(g, b.name, `rail:${pos}:${pol}:${n}`, railX(b, n), rows.railY[pos + pol], stripKey(b.name, `rail:${pos}:${pol}:${n}`) || ''); }
    }
    g.append('text').attr('class', 'lv-board-title').attr('x', f.w).attr('y', -P * 0.6).attr('text-anchor', 'end').text(`${b.label || b.model} (${b.model}, ${b.rows} strips)`);
  }

  private hole(g: d3.Selection<SVGGElement, unknown, null, undefined>, board: string, tie: string, x: number, y: number, strip: string): void {
    g.append('circle').attr('class', 'lv-hole').attr('cx', x).attr('cy', y).attr('r', HOLE_R).attr('data-board', board).attr('data-hole', tie).attr('data-strip', strip)
      .on('click', (ev: MouseEvent) => { ev.stopPropagation(); this.h.hole(board, tie); });
  }

  private drawDevboard(f: BoardFrame): void {
    const b = f.board, g = this.gBoards.append('g').attr('class', 'lv-board lv-devboard').attr('data-board', b.name).attr('transform', `translate(${f.x} ${f.y})`);
    g.append('rect').attr('class', 'lv-board-body lv-dev-body').attr('x', 0).attr('y', 0).attr('width', f.w).attr('height', f.h).attr('rx', P * 0.8);
    g.append('text').attr('class', 'lv-board-title').attr('x', 1.5 * P).attr('y', f.h / 2 - 2).text(b.label || b.model);
    g.append('text').attr('class', 'lv-tiny').attr('x', 1.5 * P).attr('y', f.h / 2 + 6).text('header pins, schematic proportions');
    const pins = headerPins(b);
    for (const p of pins) {
      const pg = g.append('g').attr('class', 'lv-pin').attr('data-board', b.name).attr('data-pin', p.label).attr('data-connector', p.connector).attr('transform', `translate(${p.x} ${p.y})`)
        .on('click', (ev: MouseEvent) => { ev.stopPropagation(); this.h.pin(b.name, p.label); });
      pg.append('rect').attr('class', 'lv-pin-sq').attr('x', -HOLE_R * 1.1).attr('y', -HOLE_R * 1.1).attr('width', HOLE_R * 2.2).attr('height', HOLE_R * 2.2);
      const top = p.y < f.h / 2;
      if (p.connector === 'ICSP') { pg.append('title').text(`ICSP ${p.label}`); continue; }   // the ICSP block is not wired by any layout: squares only, labelled once
      pg.append('text').attr('class', 'lv-pin-label').attr('transform', `translate(0 ${top ? P * 1.05 : -P * 0.8}) rotate(-90)`).attr('text-anchor', top ? 'end' : 'start').attr('dy', 3).text(p.label);
    }
    const icsp = pins.filter(p => p.connector === 'ICSP');
    if (icsp.length) { g.append('text').attr('class', 'lv-tiny').attr('x', Math.min(...icsp.map(p => p.x)) + P * 0.5).attr('y', Math.max(...icsp.map(p => p.y)) + P * 1.8).attr('text-anchor', 'middle').text('ICSP'); }
  }

  // ---------------------------------------------------------------------------------------------------------------- wires and parts
  private anchorOf(end: LvWire['from']): Anchor | null { return tieAnchor(this.frames, end); }

  private drawWires(wires: LvWire[]): void {
    for (const w of wires) {
      const a = this.anchorOf(w.from), b = this.anchorOf(w.to);
      if (!a || !b) { continue; }
      const d = wirePath(a, b);
      const g = this.gWires.append('g').attr('class', 'lv-wire').attr('data-wire', w.name).attr('data-net', w.net);
      g.append('path').attr('class', 'lv-wire-hit').attr('d', d).on('click', (ev: MouseEvent) => { ev.stopPropagation(); this.h.wire(w.name); });
      g.append('path').attr('class', 'lv-wire-line').attr('d', d).style('stroke', w.hex || 'currentColor');
      for (const e of [a, b]) { g.append('circle').attr('class', 'lv-wire-end').attr('cx', e.x).attr('cy', e.y).attr('r', HOLE_R * 1.1).style('fill', w.hex || 'currentColor'); }
      g.append('title').text(`${w.name}: ${w.note || w.from.tie + ' to ' + w.to.tie} (${w.colour_effective}${w.colour_override ? ', set by a person' : ''})`);
    }
  }

  private spritesNow(): Sprite[] {
    const p = this.p;
    if (!p) { return []; }
    const bench = this.frames.find(f => f.board.name === p.board.name);
    return p.placements.map((pl: LvPlacement) => {
      const { first, all } = legPoints(pl.legs, hole => {
        const a = bench ? tieAnchor(this.frames, { board: bench.board.name, tie: hole }) : null;
        return a ? { x: a.x, y: a.y } : null;
      }, pl.terminal_ids);
      return spriteFor(pl.name, pl.kind, pl.part, pl.params, first, all, this.state?.looks.get(pl.name) || {});
    });
  }

  private drawParts(): void {
    const active = document.activeElement as Element | null;
    const focused = active && this.svg.node()?.contains(active) ? active.getAttribute('data-part') : null;   // a held Space must keep its key-up target across the redraw
    this.gParts.selectAll('*').remove();
    for (const s of this.spritesNow()) {
      const touch = !!this.state?.touchable.has(s.name);
      const g = this.gParts.append('g').attr('class', 'lv-part' + (touch ? ' touchable' : '')).attr('data-part', s.name).attr('data-kind', s.kind).attr('transform', s.transform || null)
        .on('click', (ev: MouseEvent) => { ev.stopPropagation(); if (!touch) { this.h.part(s.name); } });
      const look = this.state?.looks.get(s.name) || {};
      if (look.lit) { g.classed('lit', true).style('--lv-duty', String(look.dim ?? 1)); }
      if (look.pressed) { g.classed('pressed', true); }
      if (look.tone) { g.classed('tone', true); }
      for (const sh of s.shapes) { this.shape(g, sh); }
      g.append('rect').attr('class', 'lv-part-hit').attr('x', s.box.x - 2).attr('y', s.box.y - 2).attr('width', s.box.w + 4).attr('height', s.box.h + 4);
      if (touch) {
        g.attr('tabindex', 0).attr('role', 'button').attr('aria-label', `${s.name}: press and hold`)
          .on('mousedown.hold touchstart.hold', (ev: Event) => ev.stopPropagation())
          .on('pointerdown', (ev: PointerEvent) => { ev.stopPropagation(); this.holdName = s.name; this.h.hold(s.name, true); })
          .on('keydown', (ev: KeyboardEvent) => { if (ev.key === ' ' && !ev.repeat) { ev.preventDefault(); this.h.hold(s.name, true); } })
          .on('keyup', (ev: KeyboardEvent) => { if (ev.key === ' ') { ev.preventDefault(); this.h.hold(s.name, false); } });
      }
      if (look.tone) { g.append('text').attr('class', 'lv-tone-mark').attr('x', s.box.x + s.box.w + P * 0.6).attr('y', s.box.y + P * 0.6).text('♪'); }
    }
    if (focused) { (this.gParts.select(`[data-part="${focused}"]`).node() as SVGGElement | null)?.focus(); }
  }

  private shape(g: d3.Selection<SVGGElement, unknown, null, undefined>, s: Shape): void {
    switch (s.k) {
      case 'line': g.append('line').attr('class', s.cls).attr('x1', s.x1).attr('y1', s.y1).attr('x2', s.x2).attr('y2', s.y2); break;
      case 'rect': g.append('rect').attr('class', s.cls).attr('x', s.x).attr('y', s.y).attr('width', s.w).attr('height', s.h).attr('rx', s.r ?? 0).style('fill', s.fill || null); break;
      case 'circle': g.append('circle').attr('class', s.cls).attr('cx', s.cx).attr('cy', s.cy).attr('r', s.r).style('fill', s.fill || null); break;
      case 'path': g.append('path').attr('class', s.cls).attr('d', s.d).style('fill', s.fill || null); break;
      case 'text': g.append('text').attr('class', s.cls).attr('x', s.x).attr('y', s.y).attr('text-anchor', 'middle').text(s.t); break;
    }
  }

  // ---------------------------------------------------------------------------------------------------------------- state (selection, steps, live)
  /** Re-apply selection, step visibility and the live look of the parts. */
  apply(st: LvDrawState): void {
    this.state = st;
    if (!this.p) { return; }
    this.drawParts();
    const sel = st.selection;
    this.zoomG.selectAll<SVGElement, unknown>('.lv-hole').classed('strip-hl', function (this: SVGElement) { return !!st.selStrip && this.getAttribute('data-strip') === st.selStrip; })
      .classed('sel', function (this: SVGElement) { return sel?.kind === 'hole' && this.getAttribute('data-hole') === sel.id && this.getAttribute('data-board') === sel.board; });
    this.zoomG.selectAll<SVGElement, unknown>('.lv-pin').classed('sel', function (this: SVGElement) { return sel?.kind === 'pin' && this.getAttribute('data-pin') === sel.id; });
    const dimmed = !st.whole;
    this.zoomG.selectAll<SVGElement, unknown>('.lv-part').each(function (this: SVGElement) {
      const n = this.getAttribute('data-part') || '';
      const shown = st.shownParts.has(n);
      const el = d3.select(this);
      el.classed('hidden', !shown).classed('new', shown && st.newParts.has(n)).classed('dimmed', shown && dimmed && !st.newParts.has(n)).classed('sel', sel?.kind === 'part' && sel.id === n);
    });
    this.zoomG.selectAll<SVGElement, unknown>('.lv-wire').each(function (this: SVGElement) {
      const n = this.getAttribute('data-wire') || '';
      const shown = st.shownWires.has(n);
      const el = d3.select(this);
      el.classed('hidden', !shown).classed('new', shown && st.newWires.has(n)).classed('dimmed', shown && dimmed && !st.newWires.has(n))
        .classed('sel', sel?.kind === 'wire' && sel.id === n).classed('net-hl', !!st.selNet && this.getAttribute('data-net') === st.selNet);
    });
  }

  /** Test / host hook: the number of marks per layer (the spec counts what the payload should have drawn). */
  counts(): { boards: number; parts: number; wires: number; holes: number; pins: number } {
    const c = (sel: string): number => this.zoomG.selectAll(sel).size();
    return { boards: c('.lv-board'), parts: c('.lv-part'), wires: c('.lv-wire'), holes: c('.lv-hole'), pins: c('.lv-pin') };
  }
}
