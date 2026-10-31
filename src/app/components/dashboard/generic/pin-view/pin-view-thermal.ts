import * as d3 from 'd3';

import { PlacedSurface } from './pin-view-layout';
import { PvThermal } from './pin-view.types';

/**
 * bob-3f — a PCB's temperature-rise field shaded on its surface (the server's plate FEM, pcb.custom.thermal_spread). One rectangle per map point, centred
 * on it, in the surface's own frame (the same translate / turn / scale the outline was placed with) and clipped to the outline, so nothing is drawn off
 * the board. Colour is ONE theme token (--heat-hot); the opacity scales linearly from 0 at ambient to MAX_OPACITY at the field's own peak, so the
 * hottest point is always the most saturated and the numbers stay in the pads' notes and the Thermal tab (the map is for seeing where, not for reading
 * values). Takes no clicks: the board under it keeps its click.
 */
export const MAX_OPACITY = 0.85;

export function drawThermal(g: d3.Selection<SVGGElement, unknown, null, undefined>, ps: PlacedSurface, t: PvThermal, clipId: string): void {
  if (t.why || !t.xs?.length || !t.ys?.length || !t.rise || !t.max || t.max <= 0) { return; }
  const xs = t.xs, ys = t.ys, peak = t.max;
  const dx = xs.length > 1 ? xs[1] - xs[0] : 1, dy = ys.length > 1 ? ys[1] - ys[0] : 1;
  const deg = (Math.atan2(ps.sn, ps.c) * 180) / Math.PI;
  const frame = `translate(${ps.ox} ${ps.oy}) rotate(${deg}) scale(${ps.k})`;
  const local = ps.points.map(([x, y]) => {   // the outline back in the surface's frame, for the clip
    const u = (x - ps.ox) / ps.k, v = (y - ps.oy) / ps.k;
    return [ps.c * u + ps.sn * v, -ps.sn * u + ps.c * v];
  });
  g.append('clipPath').attr('id', clipId).append('path').attr('d', 'M' + local.map(p => p.join(',')).join('L') + 'Z');
  const cells: { x: number; y: number; o: number }[] = [];
  t.rise.forEach((row, j) => row.forEach((r, i) => { if (r !== null && r > 0) { cells.push({ x: xs[i] - dx / 2, y: ys[j] - dy / 2, o: (MAX_OPACITY * r) / peak }); } }));
  const heat = g.append('g').attr('class', 'pv-thermal').attr('data-surface-id', t.surface).attr('transform', frame).attr('clip-path', `url(#${clipId})`);
  heat.selectAll('rect').data(cells).enter().append('rect')
    .attr('x', c => c.x).attr('y', c => c.y).attr('width', dx).attr('height', dy).attr('fill-opacity', c => c.o);
}
