import * as d3 from 'd3';

import { DIRECTION_WORDS, LANE_WORDS, LaneArrow, LaneField, LaneHop, STATUS_WORDS, StructLane, UPDATER_WORDS } from './pin-view-struct';

/**
 * hsp-3b — draws the struct lane (pin-view-struct.ts) into the pin view's zoom group: arrows under the pins, the field column and the hop chain beside
 * the board. Text is in model units (the lane's font, like a part's labels). Colours come from the theme tokens only: each arrow carries
 * `--lane` = var(--lane-<lane>), the stylesheet paints from it. A field is the one clickable thing here (the click-toggle rule is the component's).
 */
export interface LaneState { field: string; pinName: string; }

let seq = 0;

export class StructLaneLayer {
  private g: d3.Selection<SVGGElement, unknown, null, undefined> | null = null;
  private top: d3.Selection<SVGGElement, unknown, null, undefined> | null = null;
  private lane: StructLane | null = null;
  private readonly id = `pv-lane-${++seq}`;

  constructor(private onField: (key: string) => void) {}

  /** (Re)draws the lane into a freshly built zoom group: arrows before the pins layer, boxes after it. */
  draw(zoomG: d3.Selection<SVGGElement, unknown, null, undefined>, lane: StructLane | null): void {
    this.lane = lane;
    zoomG.selectAll('.pv-lane-under, .pv-lane-over').remove();
    this.g = this.top = null;
    if (!lane) { return; }
    const f = lane.font;
    this.g = zoomG.insert('g', '.pv-pins').attr('class', 'pv-lane-under');
    const defs = this.g.append('defs');
    for (const name of [...new Set(lane.arrows.map(a => a.lane))]) {
      defs.append('marker').attr('id', `${this.id}-${name}`).attr('class', `pv-lane-head lane-${name}`).attr('viewBox', '0 0 10 10').attr('refX', 9).attr('refY', 5)
        .attr('markerWidth', 5).attr('markerHeight', 5).attr('orient', 'auto-start-reverse')
        .append('path').attr('d', 'M0,0L10,5L0,10Z');
    }
    defs.append('marker').attr('id', `${this.id}-hop`).attr('class', 'pv-lane-head hop').attr('viewBox', '0 0 10 10').attr('refX', 9).attr('refY', 5)
      .attr('markerWidth', 5).attr('markerHeight', 5).attr('orient', 'auto').append('path').attr('d', 'M0,0L10,5L0,10Z');
    this.g.selectAll('path.pv-hop-link').data(lane.hopLinks).enter().append('path').attr('class', 'pv-hop-link').attr('data-pin-id', l => l.pinId).attr('d', l => l.d)
      ;
    const arrows = this.g.selectAll<SVGGElement, LaneArrow>('g.pv-lane-arrow').data(lane.arrows, a => a.key).enter().append('g')
      .attr('class', a => `pv-lane-arrow lane-${a.lane} dir-${a.direction} status-${a.status}`)
      .attr('data-field', a => a.field).attr('data-pin-id', a => a.pinId).style('--lane', a => `var(--lane-${a.lane}, #90a4ae)`);
    arrows.append('path').attr('class', 'pv-lane-line').attr('d', a => a.d).attr('marker-end', a => `url(#${this.id}-${a.lane})`);
    arrows.filter(a => !!a.updater).append('text').attr('class', 'pv-lane-stamp').attr('x', a => a.sx).attr('y', a => a.sy).attr('dy', '-0.3em').attr('text-anchor', 'end')
      .style('font-size', `${f * 0.75}px`).text(a => a.updater);
    arrows.append('title').text(a => this.arrowTip(a));

    this.top = zoomG.append('g').attr('class', 'pv-lane-over');
    this.top.selectAll('text.pv-lane-struct').data(lane.structs).enter().append('text').attr('class', 'pv-lane-struct')
      .attr('x', s => s.x).attr('y', s => s.y).style('font-size', `${f}px`).text(s => s.name);
    const fields = this.top.selectAll<SVGGElement, LaneField>('g.pv-lane-field').data(lane.fields, x => x.key).enter().append('g')
      .attr('class', x => `pv-lane-field${x.bridged ? ' bridged' : ''}`).attr('data-field', x => x.key)
      .on('click', (ev: MouseEvent, x) => { ev.stopPropagation(); this.onField(x.key); });
    fields.append('rect').attr('x', x => x.x).attr('y', x => x.y).attr('width', x => x.w).attr('height', x => x.h).attr('rx', f * 0.3);
    fields.append('text').attr('x', x => x.x + f).attr('y', x => x.y + x.h / 2).attr('dy', '0.35em').style('font-size', `${f}px`).text(x => x.label);
    fields.append('title').text(x => `${x.key}: ${x.pins.length} pin(s)${x.bridged ? ', crosses the bridge' : ''}; ${x.statuses.map(s => STATUS_WORDS[s] || s).join('; ')}`);
    if (lane.hops.length) {
      this.top.selectAll('path.pv-hop-edge').data(lane.hopEdges).enter().append('path').attr('class', 'pv-hop-edge').attr('d', d => d)
        .attr('marker-end', `url(#${this.id}-hop)`);
      const hops = this.top.selectAll<SVGGElement, LaneHop>('g.pv-hop').data(lane.hops, x => String(x.n)).enter().append('g')
        .attr('class', x => `pv-hop kind-${x.kind}${x.last ? ' last' : ''}`).attr('data-hop', x => x.n);
      hops.append('rect').attr('x', x => x.x).attr('y', x => x.y).attr('width', x => x.w).attr('height', x => x.h).attr('rx', f * 0.3);
      hops.append('text').attr('x', x => x.x + f).attr('y', x => x.y + x.h * 0.36).attr('dy', '0.35em').style('font-size', `${f}px`).text(x => `${x.n}. ${x.kind}`);
      hops.append('text').attr('class', 'pv-hop-level').attr('x', x => x.x + f).attr('y', x => x.y + x.h * 0.72).attr('dy', '0.35em').style('font-size', `${f * 0.8}px`).text(x => x.level);
      hops.append('title').text(x => `${x.what}\n${x.basis}`);
    }
  }

  /** The selection read both ways: a field lights its arrows, its pins and (if it crosses the bridge) the chain; a pin lights its arrows and their fields. */
  paint(st: LaneState): void {
    if (!this.g || !this.top || !this.lane) { return; }
    const on = !!st.field || !!st.pinName;
    const hit = (a: LaneArrow) => (st.field ? a.field === st.field : a.pinName === st.pinName);
    const fieldsHit = new Set(this.lane.arrows.filter(a => on && hit(a)).map(a => a.field));
    if (st.field) { fieldsHit.add(st.field); }
    const chainOn = on && (st.field ? !!this.lane.fields.find(x => x.key === st.field)?.bridged : this.lane.hopLinks.some(l => l.pinName === st.pinName));
    this.g.selectAll<SVGGElement, LaneArrow>('g.pv-lane-arrow').classed('hi', a => on && hit(a)).classed('dim', a => on && !hit(a));
    this.g.selectAll<SVGPathElement, { pinId: string }>('path.pv-hop-link').classed('hi', chainOn).classed('dim', on && !chainOn);
    this.top.selectAll<SVGGElement, LaneField>('g.pv-lane-field').classed('sel', x => x.key === st.field).classed('linked', x => on && x.key !== st.field && fieldsHit.has(x.key))
      .classed('dim', x => on && !fieldsHit.has(x.key));
    this.top.selectAll('g.pv-hop, path.pv-hop-edge').classed('hi', chainOn).classed('dim', on && !chainOn);
  }

  private arrowTip(a: LaneArrow): string {
    return [`${a.pinName} ${a.direction === 'in' || a.direction === 'from-bridge' ? '→' : '←'} ${a.field}`, DIRECTION_WORDS[a.direction] || a.direction,
      `lane: ${LANE_WORDS[a.lane] || a.lane}${a.event ? ', event ' + a.event : ''}`, `updater: ${UPDATER_WORDS[a.updater] || a.updater || 'none named'}`,
      `atom: ${a.atom}`, `status: ${STATUS_WORDS[a.status] || a.status}`].join('\n');
  }
}
