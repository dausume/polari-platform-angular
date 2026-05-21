/**
 * @cross-cutting
 * @tags @xc:render-2d
 * @consumers
 *   - D3SimSpaceRenderer (sole consumer)
 * @impact-on-edit
 *   Axis math (tick spacing, format) is shared mental model with future
 *   Plot consolidation. Keep niceStep/formatTick generic — when Phase 3
 *   lifts BoundDimension, these should move alongside.
 * @see /OVERLAP_MAP.md
 *
 * Axes + grid + tick labels for math-style 2D spaces. Pulled out of
 * d3-renderer because it's a self-contained concern.
 */

import * as d3 from 'd3';

import { CoordTransform, ScreenBox } from '@models/sim-space/sim-space-coords';
import { SimSpaceCoordinateSystem, SimSpaceViewport } from '@models/sim-space/sim-space-types';

type AxesGroup = d3.Selection<SVGGElement, unknown, null, undefined>;

const GRID_STROKE = '#e0e0e0';
const GRID_WIDTH = 0.5;
const AXIS_STROKE = '#bdbdbd';
const AXIS_WIDTH = 1.25;
const LABEL_FILL = '#757575';
const LABEL_SIZE = 10;
const LABEL_FONT = 'monospace';

/**
 * Paint axes + grid + tick labels into the provided group. Clears the
 * group's previous contents first. No-op for screen-style coords
 * (no meaningful origin to anchor to).
 */
export function paintAxes2D(
  group: AxesGroup,
  system: SimSpaceCoordinateSystem,
  viewport: SimSpaceViewport | undefined,
  transform: CoordTransform,
  screen: ScreenBox
): void {
  group.selectAll('*').remove();
  if (system !== 'math') return;

  const vp = viewport ?? { center: [0, 0], extent: [10, 10] };
  const cx = vp.center[0] ?? 0;
  const cy = vp.center[1] ?? 0;
  const ex = vp.extent[0] ?? 10;
  const ey = vp.extent[1] ?? 10;
  const stepX = niceStep((ex * 2) / 8);
  const stepY = niceStep((ey * 2) / 8);

  // Grid lines.
  for (let x = Math.ceil((cx - ex) / stepX) * stepX; x <= cx + ex + 1e-9; x += stepX) {
    const [sx] = transform.spaceToScreen([x, cy]);
    group.append('line')
      .attr('x1', sx).attr('x2', sx)
      .attr('y1', 0).attr('y2', screen.height)
      .attr('stroke', GRID_STROKE).attr('stroke-width', GRID_WIDTH);
  }
  for (let y = Math.ceil((cy - ey) / stepY) * stepY; y <= cy + ey + 1e-9; y += stepY) {
    const [, sy] = transform.spaceToScreen([cx, y]);
    group.append('line')
      .attr('x1', 0).attr('x2', screen.width)
      .attr('y1', sy).attr('y2', sy)
      .attr('stroke', GRID_STROKE).attr('stroke-width', GRID_WIDTH);
  }

  // Origin axes — heavier than grid lines.
  const [originX] = transform.spaceToScreen([0, cy]);
  const [, originY] = transform.spaceToScreen([cx, 0]);
  if (originX >= 0 && originX <= screen.width) {
    group.append('line')
      .attr('x1', originX).attr('x2', originX)
      .attr('y1', 0).attr('y2', screen.height)
      .attr('stroke', AXIS_STROKE).attr('stroke-width', AXIS_WIDTH);
  }
  if (originY >= 0 && originY <= screen.height) {
    group.append('line')
      .attr('x1', 0).attr('x2', screen.width)
      .attr('y1', originY).attr('y2', originY)
      .attr('stroke', AXIS_STROKE).attr('stroke-width', AXIS_WIDTH);
  }

  // Tick labels — drawn only along the visible portion of the axis.
  for (let x = Math.ceil((cx - ex) / stepX) * stepX; x <= cx + ex + 1e-9; x += stepX) {
    if (Math.abs(x) < 1e-9) continue;
    const [sx] = transform.spaceToScreen([x, 0]);
    const labelY = (originY >= 0 && originY <= screen.height) ? originY + 12 : screen.height - 4;
    appendTickText(group, sx, labelY, 'middle', formatTick(x));
  }
  for (let y = Math.ceil((cy - ey) / stepY) * stepY; y <= cy + ey + 1e-9; y += stepY) {
    if (Math.abs(y) < 1e-9) continue;
    const [, sy] = transform.spaceToScreen([0, y]);
    const labelX = (originX >= 0 && originX <= screen.width) ? originX - 6 : 4;
    const anchor: 'end' | 'start' = (originX >= 0 && originX <= screen.width) ? 'end' : 'start';
    appendTickText(group, labelX, sy + 3, anchor, formatTick(y));
  }

  // Origin label.
  if (originX >= 0 && originX <= screen.width && originY >= 0 && originY <= screen.height) {
    appendTickText(group, originX - 4, originY + 12, 'end', '0');
  }
}

function appendTickText(
  group: AxesGroup,
  x: number,
  y: number,
  anchor: 'start' | 'middle' | 'end',
  text: string
): void {
  group.append('text')
    .attr('x', x).attr('y', y)
    .attr('text-anchor', anchor)
    .attr('font-size', LABEL_SIZE)
    .attr('font-family', LABEL_FONT)
    .attr('fill', LABEL_FILL)
    .text(text);
}

/** Snap a raw step to a "nice" 1/2/5 × 10ⁿ tick spacing. */
export function niceStep(raw: number): number {
  if (raw <= 0 || !isFinite(raw)) return 1;
  const exp = Math.floor(Math.log10(raw));
  const base = Math.pow(10, exp);
  const norm = raw / base;
  if (norm < 1.5) return 1 * base;
  if (norm < 3.5) return 2 * base;
  if (norm < 7.5) return 5 * base;
  return 10 * base;
}

/** Compact tick label — drops trailing zeros + decimal where unneeded. */
export function formatTick(v: number): string {
  if (Math.abs(v) < 1e-12) return '0';
  if (Math.abs(v) >= 10000 || Math.abs(v) < 0.01) return v.toExponential(1);
  return parseFloat(v.toPrecision(4)).toString();
}
