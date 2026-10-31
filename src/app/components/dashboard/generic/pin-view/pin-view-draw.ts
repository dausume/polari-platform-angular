import * as d3 from 'd3';

import {
  connectionFamilies, connRelevantIn, DRIVE_GLYPHS, driveColour, driveFilterOn, driveHatched, driveSymbol, familyOf, isRailLink, fillOf, GLYPHS, isHollow, isInternal, isLocked, matchesDrive,
  NO_FILTERS, PvFill, PvModeFilters, PvRole, relevantIn, roleOf, signalFamily, signalRole,
} from './pin-view-encode';
import { breadboardRows, breadboardW, COLS, P, RAILS, railX, stripX } from '../layout-view/layout-geometry';
import { LvBoard } from '../layout-view/layout-view.types';
import { linePath, PlacedPin, PlacedSurface, Scene } from './pin-view-layout';
import { PvIndex } from './pin-view-panel';
import { StructLane } from './pin-view-struct';
import { LaneState, StructLaneLayer } from './pin-view-struct-draw';
import { drawThermal } from './pin-view-thermal';
import { PvConnection, PvMode, PvPayload, PvPin, PvSelection } from './pin-view.types';

/**
 * pv-1 — the d3 drawing of the pin view. Imperative on purpose: one SVG, four layers
 * (surfaces, lines, pins, titles) inside one zoom group. A payload change rebuilds the marks;
 * a selection / filter change only toggles classes and redraws the selection's lines.
 * Colours are never set here: each pin carries `--fam` / `--fam-text` pointing at the theme tokens
 * (`--pin-<family>`, with the server's fallback hex), and the component stylesheet paints from those.
 */
export interface DrawHandlers { surface(id: string): void; pin(id: string): void; connection(id: string): void; background(): void; field?(key: string): void; }
/** `anchor` is the surface or pin whose connections are drawn when a connection is the selection (its siblings stay on screen). */
/** `eventPins`: the pins a chosen configuration event changed (pv-4) - they are highlighted and every other pin and surface is dimmed. */
export interface DrawState { selection: PvSelection; anchor: PvSelection; protocol: string; showUnassigned: boolean; mode?: PvMode; filters?: PvModeFilters; eventPins?: ReadonlySet<string> | null; }

interface PinMark { placed: PlacedPin; family: string; role: PvRole; fill: PvFill; }

/** Label text widths are estimated (the screen-sized pin labels are 9 px, titles 11 px): an average glyph is about 0.58 em wide. */
const CHAR_EM = 0.58;
const PIN_LABEL_PX = 9, TITLE_PX = 11, TITLE_LIFT_PX = 16;
const isPart = (level: string): boolean => level === 'part' || level === 'bench';

const OTHER_HEX = '#90a4ae';

export class PinViewCanvas {
  private svg: d3.Selection<SVGSVGElement, unknown, null, undefined>;
  private zoomG: d3.Selection<SVGGElement, unknown, null, undefined>;
  private zoom: d3.ZoomBehavior<SVGSVGElement, unknown>;
  private k = 1;
  private marks: PinMark[] = [];
  private scene: Scene | null = null;
  private payload: PvPayload | null = null;
  private ix: PvIndex | null = null;
  private fitted = false;
  private mode: PvMode = 'all';
  private selKey = '';
  /** hsp-3b: the struct lane beside the board (null = not shown); its marks live in their own layer. */
  private lane: StructLane | null = null;
  private laneLayer: StructLaneLayer;

  constructor(svgEl: SVGSVGElement, private h: DrawHandlers) {
    this.svg = d3.select(svgEl);
    this.zoomG = this.svg.append('g').attr('class', 'pv-zoom');
    this.zoom = d3.zoom<SVGSVGElement, unknown>().scaleExtent([0.2, 120]).on('zoom', ev => this.applyZoom(ev.transform));
    this.svg.call(this.zoom).on('dblclick.zoom', null);
    this.svg.on('click', () => this.h.background());
    this.laneLayer = new StructLaneLayer(key => this.h.field?.(key));
  }

  destroy(): void { this.svg.interrupt(); this.svg.on('.zoom', null).on('click', null); this.svg.selectAll('*').remove(); }

  /** Rebuilds every mark from a fresh payload. The view keeps its pan / zoom unless this is the first draw. */
  setData(payload: PvPayload, ix: PvIndex, scene: Scene): void {
    this.payload = payload; this.ix = ix; this.scene = scene;
    const fams = connectionFamilies(payload);
    this.marks = [...scene.pins.values()].sort((a, b) => b.r - a.r).map(placed => {
      const family = familyOf(placed.pin, fams) || 'other';
      return { placed, family, role: roleOf(placed.pin, family), fill: fillOf(placed.pin) };
    });
    this.zoomG.selectAll('*').remove();
    this.drawSurfaces(scene);
    this.zoomG.append('g').attr('class', 'pv-lines');
    this.zoomG.append('g').attr('class', 'pv-stubs');
    this.drawPins();
    this.drawTitles(scene);
    this.lane = null;   // the lane is placed on the scene: the component hands the new scene's lane over (setStruct)
    this.applyZoom(d3.zoomTransform(this.svg.node()!));
    if (!this.fitted) { this.fit(false); this.fitted = true; }
  }

  private famStyle(family: string): [string, string] {
    const f = this.payload?.vocabulary.families.find(x => x.family === family);
    if (!f) { return [`var(--pin-${family}, ${OTHER_HEX})`, `var(--pin-${family}-text, #ffffff)`]; }
    return [`var(${f.token}, ${f.fallback_hex})`, `var(${f.text_token}, #ffffff)`];
  }

  private drawSurfaces(scene: Scene): void {
    const g = this.zoomG.append('g').attr('class', 'pv-surfaces');
    g.selectAll('path').data(scene.order).enter().append('path')
      .attr('class', d => `pv-surface kind-${d.surface.kind}`)
      .attr('data-surface-id', d => d.surface.id)
      .attr('d', d => 'M' + d.points.map(p => p.join(',')).join('L') + 'Z')
      .on('click', (ev: MouseEvent, d) => { ev.stopPropagation(); this.h.surface(d.surface.id); })
      .append('title').text(d => `${d.surface.title}${d.shrunk ? ' (silicon drawn smaller than its true size so it fits inside the package)' : ''}`);
    // mounting holes of the board outline, when the shape row cites them
    for (const ps of scene.order) {
      const holes = this.payload?.shapes?.[ps.surface.shape]?.parameters?.holes;
      if (!holes) { continue; }
      g.selectAll(`circle.pv-hole-${ps.depth}`).data(holes).enter().append('circle')
        .attr('class', hl => (hl.cited === false ? 'pv-hole knob' : 'pv-hole')).attr('cx', hl => ps.ox + hl.x).attr('cy', hl => ps.oy + hl.y).attr('r', hl => hl.d / 2);
    }
    // bob-3f: a PCB's cut-outs (its Edge.Cuts holes) and its temperature-rise field, under the pads
    for (const ps of scene.order) {
      const cut = this.payload?.shapes?.[ps.surface.shape]?.parameters?.cutouts as [number, number][][] | undefined;
      for (const loop of cut || []) {
        g.append('path').attr('class', 'pv-cutout').attr('d', 'M' + loop.map(([x, y]) => [ps.ox + ps.k * (ps.c * x - ps.sn * y), ps.oy + ps.k * (ps.sn * x + ps.c * y)].join(',')).join('L') + 'Z');
      }
      const t = this.payload?.thermal;
      if (t && t.surface === ps.surface.id) { drawThermal(g, ps, t, `pv-thermal-clip-${ps.depth}`); }
    }
        // pv-6: the breadboard of the bench layout; the parts that sit on it are raised above its holes
    let drew = false;
    for (const ps of scene.order) {
      const p = this.payload?.shapes?.[ps.surface.shape]?.parameters as { generator?: string; rows?: number; rail_holes?: number; pitch?: number } | undefined;
      if (ps.surface.kind !== 'bench-board' || p?.generator !== 'breadboard' || !p.rows || !p.rail_holes) { continue; }
      this.drawBreadboard(g, ps, p.rows, p.rail_holes, p.pitch || 2.54);
      drew = true;
    }
    if (drew) { g.selectAll('path.pv-surface.kind-bench-part').raise(); }
  }

  /** pv-6: the breadboard drawn with the LAYOUT VIEW's own geometry (layout-geometry.ts: there one hole pitch is P picture units; the shape row says the pitch in mm, so the group is scaled by
   *  pitch / P and every hole lands where the server's `hole_xy` puts the parts' legs). Holes take no clicks here: the picture of what sits where is the layout page's job. */
  private drawBreadboard(g: d3.Selection<SVGGElement, unknown, null, undefined>, ps: PlacedSurface, rows: number, railHoles: number, pitch: number): void {
    const board = { rows, rail_holes: railHoles, holes_per_side: 5 } as LvBoard;
    const geo = breadboardRows(), w = breadboardW(board), k = pitch / P, r = 0.3 * P;
    const x = Math.min(...ps.points.map(q => q[0])), y = Math.min(...ps.points.map(q => q[1]));
    const bb = g.append('g').attr('class', 'pv-breadboard').attr('data-surface-id', ps.surface.id).attr('transform', `translate(${x} ${y}) scale(${k})`);
    bb.append('rect').attr('class', 'pv-bb-trench').attr('x', P * 0.8).attr('y', geo.colY['e'] + P * 0.75).attr('width', w - P * 1.6).attr('height', P * 1.5).attr('rx', P * 0.3);
    for (const [pos, pol] of RAILS) {
      const ry = geo.railY[pos + pol];
      bb.append('line').attr('class', `pv-bb-rail ${pol === '+' ? 'plus' : 'minus'}`).attr('x1', P * 0.9).attr('x2', w - P * 0.9).attr('y1', ry - P * 0.55).attr('y2', ry - P * 0.55);
      bb.append('text').attr('class', 'pv-bb-text').attr('x', P * 0.5).attr('y', ry + P * 0.2).attr('text-anchor', 'middle').text(pol === '+' ? '+' : '−');
      for (let n = 1; n <= railHoles; n++) { bb.append('circle').attr('class', 'pv-bb-hole').attr('cx', railX(board, n)).attr('cy', ry).attr('r', r).attr('data-hole', `rail:${pos}:${pol}:${n}`); }
    }
    for (let n = 1; n <= rows; n++) {
      if (n === 1 || n % 5 === 0) { bb.append('text').attr('class', 'pv-bb-text').attr('x', stripX(n)).attr('y', geo.colY['a'] - P * 0.9).attr('text-anchor', 'middle').text(n); }
      for (const c of COLS) { bb.append('circle').attr('class', 'pv-bb-hole').attr('cx', stripX(n)).attr('cy', geo.colY[c]).attr('r', r).attr('data-hole', `r${n}${c}`); }
    }
    for (const c of COLS) { bb.append('text').attr('class', 'pv-bb-text').attr('x', P * 0.2).attr('y', geo.colY[c] + P * 0.2).text(c); }
  }

  private drawPins(): void {
    const sel = this.zoomG.append('g').attr('class', 'pv-pins')
      .selectAll('g').data(this.marks).enter().append('g')
      .attr('class', 'pv-pin')
      .attr('data-pin-id', m => m.placed.pin.id)
      .attr('data-fill', m => m.fill).attr('data-role', m => m.role).attr('data-family', m => m.family)
      .attr('transform', m => `translate(${m.placed.x},${m.placed.y})`)
      .each((m, i, nodes) => {
        const [fam, text] = this.famStyle(m.family);
        const el = d3.select(nodes[i]);
        el.style('--fam', fam).style('--fam-text', text);
      })
      .on('click', (ev: MouseEvent, m) => { ev.stopPropagation(); this.h.pin(m.placed.pin.id); });
    sel.append('circle').attr('class', 'pv-hit').attr('r', m => Math.max(m.placed.r * 1.25, 0.15));
    sel.append('circle').attr('class', 'pv-halo').attr('r', m => m.placed.r * 1.9);
    sel.filter(m => isInternal(m.placed.pin)).append('circle').attr('class', 'pv-internal').attr('r', m => m.placed.r * 1.45);
    sel.append('circle').attr('class', 'pv-mark').attr('r', m => m.placed.r);
    sel.append('path').attr('class', 'pv-hatch').attr('d', 'M-0.7,0.7L0.7,-0.7M-0.7,0L0,-0.7M0,0.7L0.7,0')
      .attr('transform', m => `scale(${m.placed.r})`).style('display', m => (m.fill === 'hatched' ? null : 'none'));
    sel.append('path').attr('class', 'pv-glyph').attr('d', m => (m.role === 'none' ? '' : GLYPHS[m.role as Exclude<PvRole, 'none'>])).attr('transform', m => `scale(${m.placed.r * 0.72})`);
    sel.append('path').attr('class', 'pv-lock').attr('d', GLYPHS.reserved).attr('transform', m => `translate(${m.placed.r * 0.95},${-m.placed.r * 0.95}) scale(${m.placed.r * 0.5})`).style('display', 'none');
    sel.append('text').attr('class', 'pv-label').each((m, i, nodes) => this.placeLabel(d3.select(nodes[i] as SVGTextElement), m))
      .text(m => (isPart(m.placed.pin.level) ? (m.placed.pin.short_label || m.placed.pin.label) : (m.placed.pin.canonical || m.placed.pin.label)));
    sel.append('text').attr('class', 'pv-badge').each((m, i, nodes) => this.placeBadge(d3.select(nodes[i] as SVGTextElement), m)).style('display', 'none');
    sel.append('title');
  }

  /** Labels sit outward of their edge; board header rows (no side) read vertically inside the outline. */
  private placeLabel(t: d3.Selection<SVGTextElement, unknown, null, undefined>, m: PinMark): void {
    const r = m.placed.r, side = m.placed.pin.side, s = this.scene?.surfaces.get(m.placed.surface);
    if (isPart(m.placed.pin.level)) {   // pv-2: a part's labels are drawn in MODEL units where the server's label boxes put them (left pins to the left, right and lone pins to the right)
      const gap = this.payload?.layout?.gap ?? 0.4, edge = (s?.surface.w || 1) / 2;
      if (side === 'top' || side === 'bottom') {   // pv-6: a breadboard part's labels go outward by column half, centred on the pin (the strips are one pitch apart)
        t.attr('x', 0).attr('text-anchor', 'middle');
        if (side === 'top') { t.attr('y', -gap); } else { t.attr('y', gap).attr('dy', '0.8em'); }
        return;
      }
      t.attr('x', side === 'left' ? -gap : (side === 'right' ? gap : edge + gap)).attr('text-anchor', side === 'left' ? 'end' : 'start').attr('dy', '0.35em');
      return;
    }
    const dx = r * 1.7;
    if (side === 'left') { t.attr('x', -dx).attr('text-anchor', 'end').attr('dy', '0.35em'); }
    else if (side === 'top') { t.attr('y', -dx).attr('text-anchor', 'middle'); }
    else if (side === 'bottom') { t.attr('y', dx).attr('text-anchor', 'middle').attr('dy', '0.8em'); }
    else if (!side && s) {
      const top = m.placed.y < s.oy + (s.surface.h || 0) / 2;
      t.attr('transform', `rotate(${top ? 90 : -90})`).attr('x', dx).attr('text-anchor', 'start').attr('dy', '0.35em');
    } else { t.attr('x', dx).attr('text-anchor', 'start').attr('dy', '0.35em'); }
  }

  /** The badge of the ACTIVATED function (signal mode): on the inward side of the pin, away from its label. */
  private placeBadge(t: d3.Selection<SVGTextElement, unknown, null, undefined>, m: PinMark): void {
    const r = m.placed.r, side = m.placed.pin.side, dx = r * 1.7;
    if (side === 'left') { t.attr('x', dx).attr('text-anchor', 'start').attr('dy', '0.35em'); }
    else if (side === 'right') { t.attr('x', -dx).attr('text-anchor', 'end').attr('dy', '0.35em'); }
    else if (side === 'top') { t.attr('y', dx).attr('text-anchor', 'middle').attr('dy', '0.8em'); }
    else if (side === 'bottom') { t.attr('y', -dx).attr('text-anchor', 'middle'); }
    else { t.attr('x', dx).attr('text-anchor', 'start').attr('dy', '0.35em'); }
  }

  /** Titles: a part's sits under its box in model units (abbreviated, the full name on hover); a die's inside the die; the others above their top-left corner, lifted clear of the leg labels. */
  private drawTitles(scene: Scene): void {
    const font = this.payload?.layout?.font ?? 1;
    const g = this.zoomG.append('g').attr('class', 'pv-titles');
    g.selectAll('text').data(scene.order).enter().append('text')
      .attr('class', d => `pv-title kind-${d.surface.kind}`)
      .attr('data-surface-id', d => d.surface.id)
      .attr('x', d => (d.surface.title_pos ? d.ox + d.surface.title_pos.x : (d.surface.kind === 'soc' ? d.ox : Math.min(...d.points.map(p => p[0])))))
      .attr('y', d => (d.surface.title_pos ? d.oy + d.surface.title_pos.y + font * 0.85 : (d.surface.kind === 'soc' ? d.oy : Math.min(...d.points.map(p => p[1])) - 0.4)))
      .attr('text-anchor', d => (d.surface.title_pos || d.surface.kind === 'soc' ? 'middle' : 'start'))
      .attr('dy', d => (d.surface.kind === 'soc' ? '0.35em' : null))
      .text(d => this.titleText(d.surface))
      .append('title').text(d => `${d.surface.title}${d.shrunk ? ' (silicon drawn smaller than its true size so it fits inside the package)' : ''}`);
  }

  private titleText(s: { kind: string; title: string; short_title?: string; component?: string }): string {
    if (s.short_title) { return s.short_title; }
    if (s.kind === 'soc') { return `${s.component || ''} die`.trim(); }
    return s.title;
  }

  /** hsp-3b: shows (or, with null, removes) the struct lane; the fit then takes the lane in. */
  setStruct(lane: StructLane | null): void {
    this.lane = lane;
    this.laneLayer.draw(this.zoomG, lane);
  }

  paintStruct(st: LaneState): void { this.laneLayer.paint(st); }

  /** The scene's bounds, grown by the struct lane while it is shown. */
  private contentBounds(): { x0: number; y0: number; x1: number; y1: number } {
    const b = this.scene!.bounds, l = this.lane?.bounds;
    return l ? { x0: Math.min(b.x0, l.x0), y0: Math.min(b.y0, l.y0), x1: Math.max(b.x1, l.x1), y1: Math.max(b.y1, l.y1) } : { ...b };
  }

  /** The scene bounds plus every label's estimated box at zoom `k` (labels are screen-sized, so their share of the model shrinks as k grows). */
  private boundsWithLabels(k: number): { x0: number; y0: number; x1: number; y1: number } {
    const b = { ...this.contentBounds() };
    const grow = (x0: number, y0: number, x1: number, y1: number) => { b.x0 = Math.min(b.x0, x0); b.y0 = Math.min(b.y0, y0); b.x1 = Math.max(b.x1, x1); b.y1 = Math.max(b.y1, y1); };
    const font = this.payload?.layout?.font ?? 1;
    for (const m of this.marks) {
      const p = m.placed.pin;
      if (!relevantIn(p, this.mode)) { continue; }
      const part = isPart(p.level);
      const text = part ? (p.short_label || p.label) : (p.canonical || p.label);
      const w = part ? text.length * font * CHAR_EM : (text.length * PIN_LABEL_PX * CHAR_EM) / k, hgt = part ? font : PIN_LABEL_PX / k, dx = part ? (this.payload?.layout?.gap ?? 0.4) : m.placed.r * 1.7;
      const { x, y } = m.placed;
      if (p.side === 'left') { grow(x - dx - w, y - hgt / 2, x, y + hgt / 2); }
      else if (p.side === 'top') { grow(x - w / 2, y - dx - hgt, x + w / 2, y); }
      else if (p.side === 'bottom') { grow(x - w / 2, y, x + w / 2, y + dx + hgt); }
      else if (p.side === 'right' || p.side === 'center') { grow(x, y - hgt / 2, x + dx + w, y + hgt / 2); }
    }
    for (const ps of this.scene!.order) {   // the titles that sit above their surface
      if (ps.surface.title_pos || ps.surface.kind === 'soc') { continue; }
      const x = Math.min(...ps.points.map(p => p[0])), y = Math.min(...ps.points.map(p => p[1]));
      const lift = ps.surface.kind === 'enclosure' ? TITLE_LIFT_PX / k : 0.4;
      grow(x, y - lift - TITLE_PX / k, x + (this.titleText(ps.surface).length * TITLE_PX * CHAR_EM) / k, y);
    }
    return b;
  }

  /** The fit-all transform: content (scene bounds + label boxes) scaled to the viewport, centred across, and hung from the TOP edge (a wide board in a tall viewport leaves its slack below, not as a blank band above). */
  fitTransform(w: number, hgt: number, pad = 18): { k: number; tx: number; ty: number; bounds: { x0: number; y0: number; x1: number; y1: number } } {
    let b = this.contentBounds();
    let k = Math.min((w - 2 * pad) / Math.max(b.x1 - b.x0, 1), (hgt - 2 * pad) / Math.max(b.y1 - b.y0, 1));
    for (let i = 0; i < 3; i++) {   // the labels' share depends on the zoom: settle it
      b = this.boundsWithLabels(k);
      k = Math.min((w - 2 * pad) / Math.max(b.x1 - b.x0, 1), (hgt - 2 * pad) / Math.max(b.y1 - b.y0, 1));
    }
    return { k, tx: w / 2 - (k * (b.x0 + b.x1)) / 2, ty: pad - k * b.y0, bounds: b };
  }

  fit(animate = true): void {
    if (!this.scene) { return; }
    const node = this.svg.node()!;
    const f = this.fitTransform(node.clientWidth || 800, node.clientHeight || 520);
    const t = d3.zoomIdentity.translate(f.tx, f.ty).scale(f.k);
    if (animate) { this.svg.transition().duration(250).call(this.zoom.transform, t); } else { this.svg.call(this.zoom.transform, t); }
  }

  /** Animates the zoom to a model-space rectangle (a margin of 40 px all round); the selection's own view. */
  private zoomToBounds(b: { x0: number; y0: number; x1: number; y1: number }): void {
    const node = this.svg.node()!;
    const w = node.clientWidth || 800, hgt = node.clientHeight || 520, pad = 40;
    const k = Math.min((w - 2 * pad) / Math.max(b.x1 - b.x0, 1e-6), (hgt - 2 * pad) / Math.max(b.y1 - b.y0, 1e-6), 120);
    const t = d3.zoomIdentity.translate(w / 2 - (k * (b.x0 + b.x1)) / 2, hgt / 2 - (k * (b.y0 + b.y1)) / 2).scale(k);
    this.svg.transition().duration(300).call(this.zoom.transform, t);
  }

  /** The selected surface (or pin) plus the far ends of the connections drawn from it. */
  private selectionBounds(base: PvSelection, ends: string[]): { x0: number; y0: number; x1: number; y1: number } | null {
    const sc = this.scene!;
    const b = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
    const add = (x: number, y: number, r = 0) => { b.x0 = Math.min(b.x0, x - r); b.y0 = Math.min(b.y0, y - r); b.x1 = Math.max(b.x1, x + r); b.y1 = Math.max(b.y1, y + r); };
    if (base?.kind === 'surface') {
      const ps = sc.surfaces.get(base.id);
      if (!ps) { return null; }
      ps.points.forEach(([x, y]) => add(x, y));
      for (const p of sc.pins.values()) { if (p.surface === base.id) { add(p.x, p.y, p.r); } }
    } else if (base?.kind === 'pin') {
      const p = sc.pins.get(base.id);
      if (!p) { return null; }
      add(p.x, p.y, p.r * 3);
    } else { return null; }
    for (const id of ends) { const p = sc.pins.get(id); if (p) { add(p.x, p.y, p.r); } }
    return isFinite(b.x0) ? b : null;
  }

  /** One short stub from each of the selection's own rail pins to a small rail tag ("5V", "GND"): the rail's other pins are listed in the side panel, not wired. */
  private drawStubs(pinIds: string[]): void {
    const sc = this.scene!, layer = this.zoomG.select<SVGGElement>('.pv-stubs');
    const data = pinIds.map(id => sc.pins.get(id)).filter((p): p is PlacedPin => !!p);
    const join = layer.selectAll<SVGGElement, PlacedPin>('g.pv-stub').data(data, (p: any) => p.pin.id);
    join.exit().remove();
    const enter = join.enter().append('g').attr('class', 'pv-stub');
    enter.append('line');
    enter.append('text').attr('class', 'pv-stub-tag');
    enter.merge(join).each((p, i, nodes) => {
      const ps = sc.surfaces.get(p.surface)!;
      let dx = p.x - ps.ox, dy = p.y - ps.oy;
      const n = Math.hypot(dx, dy) || 1;
      dx = dx / n; dy = dy / n;
      if (n < 1e-6) { dx = 0; dy = -1; }
      const len = Math.max(p.r * 3.2, 14 / this.k), ex = p.x + dx * len, ey = p.y + dy * len;
      const [fam] = this.driveVars(driveColour(p.pin, false).token);
      const el = d3.select(nodes[i]).attr('data-pin-id', p.pin.id).attr('data-rail', p.pin.rail).style('--fam', fam);
      el.select('line').attr('x1', p.x).attr('y1', p.y).attr('x2', ex).attr('y2', ey);
      el.select('text').attr('x', ex + dx * 2 / this.k).attr('y', ey + dy * 2 / this.k).attr('text-anchor', dx > 0.3 ? 'start' : (dx < -0.3 ? 'end' : 'middle'))
        .attr('dy', dy > 0.3 ? '0.9em' : (dy < -0.3 ? '0' : '0.35em')).style('font-size', `${9 / this.k}px`).text(p.pin.rail && p.pin.rail !== 'undetermined' ? p.pin.rail : 'rail');
    });
  }

  private applyZoom(t: d3.ZoomTransform): void {
    this.k = t.k;
    this.zoomG.attr('transform', t.toString());
    const k = t.k, font = this.payload?.layout?.font ?? 1;
    this.zoomG.selectAll<SVGTextElement, any>('.pv-stub-tag').style('font-size', `${9 / k}px`);
    this.zoomG.selectAll<SVGTextElement, any>('.pv-title').each((d, i, nodes) => {
      const el = d3.select(nodes[i]);
      if (!d || !d.surface) { return; }
      if (d.surface.title_pos) {   // a part's title: model units, shown while it is legible
        el.style('font-size', `${font}px`).style('display', font * k < 5.5 ? 'none' : null);
        return;
      }
      const soc = d.surface.kind === 'soc', lift = d.surface.kind === 'enclosure' ? TITLE_LIFT_PX / k : 0.4;
      el.style('font-size', `${TITLE_PX / k}px`);
      if (!soc) { el.attr('y', Math.min(...d.points.map((p: [number, number]) => p[1])) - lift); }
      el.style('display', this.screenSize(d) < (soc ? 90 : 26) ? 'none' : null);
    });
    this.zoomG.selectAll<SVGGElement, PinMark>('.pv-pin').each((m, i, nodes) => {
      const px = m.placed.r * k, el = d3.select(nodes[i]), part = isPart(m.placed.pin.level);
      el.select<SVGTextElement>('.pv-label').style('display', (part ? font * k >= 5.5 : px >= 6) ? null : 'none').style('font-size', part ? `${font}px` : `${PIN_LABEL_PX / k}px`);
      el.select('.pv-glyph').style('display', px >= 3.2 ? null : 'none');
      el.select<SVGTextElement>('.pv-badge').style('font-size', `${(PIN_LABEL_PX - 1) / k}px`).style('stroke-width', `${2.2 / k}px`);
      el.select('.pv-lock').style('display', px >= 3.2 && el.classed('locked') ? null : 'none');
    });
  }

  private screenSize(d: { points: [number, number][] }): number {
    const xs = d.points.map(p => p[0]), ys = d.points.map(p => p[1]);
    return Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) * this.k;
  }

  /** Protocol dimming: the server's verdict when the payload answers this protocol list, a family match while it is still being asked. */
  private litOf(p: PvPin, protocol: string): boolean | null {
    if (!protocol) { return null; }
    if (this.payload?.protocol?.protocol === protocol) { return !!p.lit; }
    const asked = protocol.split(',').filter(Boolean);
    return asked.some(a => p.families.includes(a));
  }

  private famVars(family: string): [string, string] { return this.famStyle(family); }
  private driveVars(token: string): [string, string] { return [`var(${token}, #90a4ae)`, `var(${token}-text, #000000)`]; }

  /** Paints one pin for the mode: colour, symbol, fill and visibility. All = signal family + signal direction (pv-1); Drive = rail + power-flow symbol; Signal = activated family + its direction. */
  private paint(el: d3.Selection<SVGGElement, PinMark, null, undefined>, m: PinMark, mode: PvMode, byLimit: boolean): void {
    const p = m.placed.pin;
    el.style('display', relevantIn(p, mode) ? null : 'none');
    let fam: [string, string], role: string, fill: PvFill, glyph: string | null, family: string;
    if (mode === 'drive') {
      const c = driveColour(p, byLimit), sym = driveSymbol(p);
      fam = this.driveVars(c.token); role = sym; family = byLimit ? p.limit_class : p.rail; glyph = DRIVE_GLYPHS[sym];
      fill = driveHatched(p) ? 'hatched' : (p.stage === 'committed' ? 'committed' : (p.stage === 'proposed' ? 'proposed' : 'hollow'));
    } else if (mode === 'signal') {
      family = signalFamily(p, m.family); fam = this.famVars(family);
      const r = signalRole(p); role = r; glyph = r === 'none' ? null : GLYPHS[r as Exclude<PvRole, 'none'>];
      fill = p.activated ? (p.stage === 'committed' ? 'committed' : 'proposed') : 'hollow';
    } else {
      family = m.family; fam = this.famVars(family); role = m.role; fill = m.fill; glyph = m.role === 'none' ? null : GLYPHS[m.role as Exclude<PvRole, 'none'>];
    }
    el.attr('data-mode', mode).attr('data-family', family).attr('data-role', role).attr('data-fill', fill).style('--fam', fam[0]).style('--fam-text', fam[1]);
    el.classed('locked', mode !== 'drive' && isLocked(p));
    const g = el.select<SVGPathElement>('.pv-glyph');
    g.style('visibility', glyph ? null : 'hidden');
    if (glyph) { g.attr('d', glyph); }
    el.select('.pv-hatch').style('display', fill === 'hatched' ? null : 'none');
    const badge = el.select<SVGTextElement>('.pv-badge');
    badge.text(mode === 'signal' && p.activated ? p.activated.function : '').style('display', mode === 'signal' && p.activated ? null : 'none');
  }

  /** Classes for the current selection, mode and filters, then the selection's lines. */
  setState(st: DrawState): void {
    if (!this.ix || !this.scene) { return; }
    const ix = this.ix, sel = st.selection, mode = st.mode ?? 'all', filters = st.filters ?? NO_FILTERS;
    const modeChanged = mode !== this.mode;
    this.mode = mode;
    const base = sel?.kind === 'connection' ? st.anchor : sel;   // what the lines belong to
    const railDropped = (c: PvConnection) => mode !== 'drive' && isRailLink(c);   // rail links are the point of Drive mode; elsewhere they collapse to a stub + tag
    const focus = ix.focusPins(base), all = [...ix.drawn(base)].filter(c => connRelevantIn(c, mode));
    const drawn = all.filter(c => !railDropped(c));
    const own = (id: string) => { const p = ix.pins.get(id); return !!p && !!base && ((base.kind === 'surface' && p.surface === base.id) || (base.kind === 'pin' && p.id === base.id)); };
    const stubPins = [...new Set(all.filter(railDropped).flatMap(c => [c.a, c.b]).filter(own))];
    const selConn = sel?.kind === 'connection' ? ix.conns.get(sel.id) : undefined;
    if (selConn && !drawn.includes(selConn)) { drawn.push(selConn); }
    if (selConn) { const f = focus ?? new Set<string>(); f.add(selConn.a); f.add(selConn.b); }
    const focusSet = focus ?? (selConn ? new Set([selConn.a, selConn.b]) : null);
    const linked = new Set<string>();
    drawn.forEach(c => { linked.add(c.a); linked.add(c.b); });
    const ev = st.eventPins && st.eventPins.size ? st.eventPins : null;
    const surfaceHasFocus = new Set<string>();
    const evSurfaces = new Set<string>();
    if (ev) { ev.forEach(id => { const p = ix.pins.get(id); if (p) { evSurfaces.add(p.surface); } }); }
    if (focusSet) { focusSet.forEach(id => { const p = ix.pins.get(id); if (p) { surfaceHasFocus.add(p.surface); } }); }
    const selPin = sel?.kind === 'pin' ? sel.id : (base?.kind === 'pin' ? base.id : '');
    const selSurface = sel?.kind === 'surface' ? sel.id : (base?.kind === 'surface' ? base.id : '');
    this.zoomG.selectAll<SVGPathElement, any>('.pv-surface')
      .classed('sel', d => selSurface === d.surface.id)
      .classed('dim', d => (!!sel && selSurface !== d.surface.id && !surfaceHasFocus.has(d.surface.id)) || (!!ev && !evSurfaces.has(d.surface.id)))
      .classed('event-hi', d => !!ev && evSurfaces.has(d.surface.id));
    const byLimit = filters.limits.size > 0, driveOn = driveFilterOn(filters);
    this.zoomG.selectAll<SVGGElement, PinMark>('.pv-pin').each((m, i, nodes) => {
      const p = m.placed.pin, lit = this.litOf(p, st.protocol), hollow = isHollow(p);
      const inFocus = (!focusSet || focusSet.has(p.id)) && (!ev || ev.has(p.id));
      const grey = lit === false || (driveOn && !matchesDrive(p, filters));   // a filter is on and this pin does not match: greyed, not hidden
      const el = d3.select(nodes[i]);
      this.paint(el as d3.Selection<SVGGElement, PinMark, null, undefined>, m, mode, byLimit);
      el.classed('sel', selPin === p.id)
        .classed('linked', linked.has(p.id) && selPin !== p.id)
        .classed('lit', lit === true && !(driveOn && !matchesDrive(p, filters)))
        .classed('match', driveOn && matchesDrive(p, filters))
        .classed('event-hi', !!ev && ev.has(p.id))
        .classed('dim', !inFocus || grey)
        .classed('soft', st.showUnassigned && !hollow)
        .classed('unassigned-hi', st.showUnassigned && hollow);
      el.select('title').text(this.tip(m, st.protocol, lit, mode));
    });
    if (modeChanged) { this.applyZoom(d3.zoomTransform(this.svg.node()!)); }
    this.drawLines(drawn.map(c => c.id), sel, mode, byLimit);
    this.drawStubs(stubPins);
    const key = base ? `${base.kind}:${base.id}` : '';
    if (key !== this.selKey) {   // a new selection zooms to it; clearing returns to the fit-all view
      this.selKey = key;
      const b = key ? this.selectionBounds(base, drawn.flatMap(c => [c.a, c.b])) : null;
      if (b) { this.zoomToBounds(b); } else if (!key) { this.fit(true); }
    }
  }

  private tip(m: PinMark, protocol: string, lit: boolean | null, mode: PvMode): string {
    const p = m.placed.pin;
    const parts = [`${p.label}${p.canonical ? ' (' + p.canonical + ')' : ''} — ${p.surface_title ?? ''}`, `stage: ${p.stage}${p.stage_why ? ' — ' + p.stage_why : ''}`];
    if (mode === 'drive') {
      parts.push(`drive: ${p.drive_status}${p.rail && p.rail !== 'undetermined' ? ' on ' + p.rail : ''}`, `pull: ${p.pull}`, `limit: ${p.limit_class}${p.limit_basis ? ' (' + p.limit_basis + ')' : ''}`);
      if (p.group_budget?.length) { parts.push('counts toward: ' + p.group_budget.join(', ')); }
    } else {
      if (mode === 'signal') { parts.push(p.activated ? `activated: ${p.activated.function} (${p.activated.family})` : 'nothing activated at this stage'); }
      if (p.families.length) { parts.push('can carry: ' + p.families.join(', ')); }
      if (p.lifecycle?.length) { parts.push('lifecycle: ' + p.lifecycle.map(l => `${l.policy}${l.condition ? ' if ' + l.condition : ''}`).join('; ')); }
    }
    if (protocol && lit && p.lit) { p.lit.children.forEach(c => parts.push(`${c.child}: ${c.headline}`)); }
    if (protocol && lit === false) { parts.push(`cannot carry ${protocol.split(',').join(' / ')} here`); }
    return parts.join('\n');
  }

  private drawLines(ids: string[], sel: PvSelection, mode: PvMode, byLimit: boolean): void {
    const ix = this.ix!, scene = this.scene!;
    const layer = this.zoomG.select<SVGGElement>('.pv-lines');
    const data = ids.map(id => ix.conns.get(id)!).filter(c => c && scene.pins.has(c.a) && scene.pins.has(c.b));
    const join = layer.selectAll<SVGGElement, any>('g.pv-conn').data(data, (c: any) => c.id);
    join.exit().remove();
    const enter = join.enter().append('g').attr('class', 'pv-conn')
      .attr('data-conn-id', c => c.id)
      .on('click', (ev: MouseEvent, c) => { ev.stopPropagation(); this.h.connection(c.id); });
    enter.append('path').attr('class', 'pv-line-hit');
    enter.append('path').attr('class', 'pv-line');
    const all = enter.merge(join);
    all.each((c, i, nodes) => {
      const a = scene.pins.get(c.a)!, b = scene.pins.get(c.b)!;
      let fam: string;
      if (mode === 'drive') {   // in drive mode a line wears the rail (or the limit class) of its end that says one
        const pa = a.pin, pb = b.pin, src = (byLimit ? pa.limit_class !== 'unchecked' : pa.rail !== 'undetermined') ? pa : pb;
        fam = this.driveVars(driveColour(src, byLimit).token)[0];
      } else { [fam] = this.famStyle(c.signal?.family || 'other'); }
      const d = linePath(a, b, (i % 2 ? 1 : -1) * (c.kind === 'pad-to-leg' ? 0 : 1));
      const el = d3.select(nodes[i]).style('--fam', fam).classed('sel', !!sel && sel.kind === 'connection' && sel.id === c.id);
      el.select('.pv-line-hit').attr('d', d);
      el.select('.pv-line').attr('d', d);
    });
  }
}
