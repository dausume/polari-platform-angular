import * as d3 from 'd3';

import { connectionFamilies, familyOf, fillOf, GLYPHS, isHollow, isInternal, PvFill, PvRole, roleOf } from './pin-view-encode';
import { linePath, PlacedPin, Scene } from './pin-view-layout';
import { PvIndex } from './pin-view-panel';
import { PvPayload, PvPin, PvSelection } from './pin-view.types';

/**
 * pv-1 — the d3 drawing of the pin view. Imperative on purpose: one SVG, four layers
 * (surfaces, lines, pins, titles) inside one zoom group. A payload change rebuilds the marks;
 * a selection / filter change only toggles classes and redraws the selection's lines.
 * Colours are never set here: each pin carries `--fam` / `--fam-text` pointing at the theme tokens
 * (`--pin-<family>`, with the server's fallback hex), and the component stylesheet paints from those.
 */
export interface DrawHandlers { surface(id: string): void; pin(id: string): void; connection(id: string): void; background(): void; }
/** `anchor` is the surface or pin whose connections are drawn when a connection is the selection (its siblings stay on screen). */
export interface DrawState { selection: PvSelection; anchor: PvSelection; protocol: string; showUnassigned: boolean; }

interface PinMark { placed: PlacedPin; family: string; role: PvRole; fill: PvFill; }

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

  constructor(svgEl: SVGSVGElement, private h: DrawHandlers) {
    this.svg = d3.select(svgEl);
    this.zoomG = this.svg.append('g').attr('class', 'pv-zoom');
    this.zoom = d3.zoom<SVGSVGElement, unknown>().scaleExtent([0.2, 120]).on('zoom', ev => this.applyZoom(ev.transform));
    this.svg.call(this.zoom).on('dblclick.zoom', null);
    this.svg.on('click', () => this.h.background());
  }

  destroy(): void { this.svg.on('.zoom', null).on('click', null); this.svg.selectAll('*').remove(); }

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
    this.drawPins();
    this.drawTitles(scene);
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
    sel.filter(m => m.role !== 'none').append('path').attr('class', 'pv-glyph')
      .attr('d', m => GLYPHS[m.role as Exclude<PvRole, 'none'>]).attr('transform', m => `scale(${m.placed.r * 0.72})`);
    sel.append('text').attr('class', 'pv-label').each((m, i, nodes) => this.placeLabel(d3.select(nodes[i] as SVGTextElement), m))
      .text(m => m.placed.pin.canonical || m.placed.pin.label);
    sel.append('title');
  }

  /** Labels sit outward of their edge; board header rows (no side) read vertically inside the outline. */
  private placeLabel(t: d3.Selection<SVGTextElement, unknown, null, undefined>, m: PinMark): void {
    const r = m.placed.r, side = m.placed.pin.side, s = this.scene?.surfaces.get(m.placed.surface);
    const dx = r * 1.7;
    if (side === 'left') { t.attr('x', -dx).attr('text-anchor', 'end').attr('dy', '0.35em'); }
    else if (side === 'top') { t.attr('y', -dx).attr('text-anchor', 'middle'); }
    else if (side === 'bottom') { t.attr('y', dx).attr('text-anchor', 'middle').attr('dy', '0.8em'); }
    else if (!side && s) {
      const top = m.placed.y < s.oy + (s.surface.h || 0) / 2;
      t.attr('transform', `rotate(${top ? 90 : -90})`).attr('x', dx).attr('text-anchor', 'start').attr('dy', '0.35em');
    } else { t.attr('x', dx).attr('text-anchor', 'start').attr('dy', '0.35em'); }
  }

  private drawTitles(scene: Scene): void {
    this.zoomG.append('g').attr('class', 'pv-titles').selectAll('text').data(scene.order).enter().append('text')
      .attr('class', 'pv-title')
      .attr('x', d => Math.min(...d.points.map(p => p[0]))).attr('y', d => Math.min(...d.points.map(p => p[1])) - 0.4)
      .text(d => d.surface.title);
  }

  fit(animate = true): void {
    if (!this.scene) { return; }
    const node = this.svg.node()!;
    const w = node.clientWidth || 800, hgt = node.clientHeight || 520, b = this.scene.bounds, pad = 18;
    const k = Math.min((w - 2 * pad) / Math.max(b.x1 - b.x0, 1), (hgt - 2 * pad) / Math.max(b.y1 - b.y0, 1));
    const t = d3.zoomIdentity.translate(w / 2 - (k * (b.x0 + b.x1)) / 2, hgt / 2 - (k * (b.y0 + b.y1)) / 2).scale(k);
    if (animate) { this.svg.transition().duration(250).call(this.zoom.transform, t); } else { this.svg.call(this.zoom.transform, t); }
  }

  private applyZoom(t: d3.ZoomTransform): void {
    this.k = t.k;
    this.zoomG.attr('transform', t.toString());
    const k = t.k;
    this.zoomG.selectAll<SVGTextElement, any>('.pv-title').style('font-size', `${11 / k}px`)
      .style('display', d => ((d.points && this.screenSize(d) < 26) ? 'none' : null));
    this.zoomG.selectAll<SVGGElement, PinMark>('.pv-pin').each((m, i, nodes) => {
      const px = m.placed.r * k, el = d3.select(nodes[i]);
      el.select<SVGTextElement>('.pv-label').style('display', px >= 6 ? null : 'none').style('font-size', `${9 / k}px`);
      el.select('.pv-glyph').style('display', px >= 3.2 ? null : 'none');
    });
  }

  private screenSize(d: { points: [number, number][] }): number {
    const xs = d.points.map(p => p[0]), ys = d.points.map(p => p[1]);
    return Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) * this.k;
  }

  /** Protocol dimming: server verdict when the payload answers this protocol, a family match while it is still being asked. */
  private litOf(p: PvPin, protocol: string): boolean | null {
    if (!protocol) { return null; }
    if (this.payload?.protocol?.protocol === protocol) { return !!p.lit; }
    return p.families.includes(protocol);
  }

  /** Classes for the current selection and filters, then the selection's lines. */
  setState(st: DrawState): void {
    if (!this.ix || !this.scene) { return; }
    const ix = this.ix, sel = st.selection;
    const base = sel?.kind === 'connection' ? st.anchor : sel;   // what the lines belong to
    const focus = ix.focusPins(base), drawn = [...ix.drawn(base)];
    const selConn = sel?.kind === 'connection' ? ix.conns.get(sel.id) : undefined;
    if (selConn && !drawn.includes(selConn)) { drawn.push(selConn); }
    if (selConn) { const f = focus ?? new Set<string>(); f.add(selConn.a); f.add(selConn.b); }
    const focusSet = focus ?? (selConn ? new Set([selConn.a, selConn.b]) : null);
    const linked = new Set<string>();
    drawn.forEach(c => { linked.add(c.a); linked.add(c.b); });
    const surfaceHasFocus = new Set<string>();
    if (focusSet) { focusSet.forEach(id => { const p = ix.pins.get(id); if (p) { surfaceHasFocus.add(p.surface); } }); }
    const selPin = sel?.kind === 'pin' ? sel.id : (base?.kind === 'pin' ? base.id : '');
    const selSurface = sel?.kind === 'surface' ? sel.id : (base?.kind === 'surface' ? base.id : '');
    this.zoomG.selectAll<SVGPathElement, any>('.pv-surface')
      .classed('sel', d => selSurface === d.surface.id)
      .classed('dim', d => !!sel && selSurface !== d.surface.id && !surfaceHasFocus.has(d.surface.id));
    this.zoomG.selectAll<SVGGElement, PinMark>('.pv-pin').each((m, i, nodes) => {
      const p = m.placed.pin, lit = this.litOf(p, st.protocol), hollow = isHollow(p);
      const inFocus = !focusSet || focusSet.has(p.id);
      const el = d3.select(nodes[i]);
      el.classed('sel', selPin === p.id)
        .classed('linked', linked.has(p.id) && selPin !== p.id)
        .classed('lit', lit === true)
        .classed('dim', !inFocus || lit === false)
        .classed('soft', st.showUnassigned && !hollow)
        .classed('unassigned-hi', st.showUnassigned && hollow);
      el.select('title').text(this.tip(m, st.protocol, lit));
    });
    this.drawLines(drawn.map(c => c.id), sel);
  }

  private tip(m: PinMark, protocol: string, lit: boolean | null): string {
    const p = m.placed.pin;
    const parts = [`${p.label}${p.canonical ? ' (' + p.canonical + ')' : ''} — ${p.surface_title ?? ''}`, `stage: ${p.stage}${p.stage_why ? ' — ' + p.stage_why : ''}`];
    if (p.families.length) { parts.push('can carry: ' + p.families.join(', ')); }
    if (protocol && lit && p.lit) { p.lit.children.forEach(c => parts.push(`${c.child}: ${c.headline}`)); }
    if (protocol && lit === false) { parts.push(`cannot carry ${protocol} here`); }
    return parts.join('\n');
  }

  private drawLines(ids: string[], sel: PvSelection): void {
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
      const [fam] = this.famStyle(c.signal?.family || 'other');
      const d = linePath(a, b, (i % 2 ? 1 : -1) * (c.kind === 'pad-to-leg' ? 0 : 1));
      const el = d3.select(nodes[i]).style('--fam', fam).classed('sel', !!sel && sel.kind === 'connection' && sel.id === c.id);
      el.select('.pv-line-hit').attr('d', d);
      el.select('.pv-line').attr('d', d);
    });
  }
}
