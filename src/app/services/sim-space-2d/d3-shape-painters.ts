/**
 * @cross-cutting
 * @tags @xc:render-2d
 * @consumers
 *   - D3SimSpaceRenderer (sole runtime consumer)
 *   - (Future) any other d3-backed SimSpace renderer variant
 * @impact-on-edit
 *   Each painter takes a d3 selection + the resolved style and appends
 *   the right SVG primitives. Adding a new built-in shape: add a case
 *   to BUILTIN_PAINTERS plus a matching Shape2DDefinition seed entry.
 * @see /OVERLAP_MAP.md
 *
 * SVG primitive painters — one per built-in shape. Pulled out of
 * d3-renderer so the renderer file stays focused on lifecycle +
 * reconciliation. Pure functions; no renderer state.
 */

import * as d3 from 'd3';

import { Shape2DDef } from './shape-2d-library.service';
import { ResolvedStyle2D } from './style-2d-resolver';

type ShapeSelection = d3.Selection<SVGGElement, unknown, null, undefined>;

/** Painter contract — takes the host group + resolved style. */
export type ShapePainter = (g: ShapeSelection, style: ResolvedStyle2D) => void;

/**
 * Built-in painters keyed by Shape2DDef.builtin_name. Each appends the
 * appropriate SVG primitives to the supplied group, anchored at (0, 0).
 * The renderer translates the group itself to the object's screen
 * position before invoking — painters never touch transforms.
 */
export const BUILTIN_PAINTERS: Record<string, ShapePainter> = {
  circle: (g, s) => {
    g.append('circle')
      .attr('r', Math.min(s.width, s.height) / 2)
      .attr('fill', s.fill_color)
      .attr('stroke', s.stroke_color)
      .attr('stroke-width', s.stroke_width)
      .attr('opacity', s.opacity);
  },

  rectangle: (g, s) => {
    g.append('rect')
      .attr('x', -s.width / 2).attr('y', -s.height / 2)
      .attr('width', s.width).attr('height', s.height)
      .attr('fill', s.fill_color)
      .attr('stroke', s.stroke_color)
      .attr('stroke-width', s.stroke_width)
      .attr('opacity', s.opacity);
  },

  diamond: (g, s) => {
    g.append('polygon')
      .attr('points', `0,${-s.height / 2} ${s.width / 2},0 0,${s.height / 2} ${-s.width / 2},0`)
      .attr('fill', s.fill_color)
      .attr('stroke', s.stroke_color)
      .attr('stroke-width', s.stroke_width)
      .attr('opacity', s.opacity);
  },

  triangle: (g, s) => {
    g.append('polygon')
      .attr('points', `0,${-s.height / 2} ${s.width / 2},${s.height / 2} ${-s.width / 2},${s.height / 2}`)
      .attr('fill', s.fill_color)
      .attr('stroke', s.stroke_color)
      .attr('stroke-width', s.stroke_width)
      .attr('opacity', s.opacity);
  },

  star: (g, s) => {
    g.append('polygon')
      .attr('points', starPoints(0, 0, s.width / 2, s.width / 4, 5))
      .attr('fill', s.fill_color)
      .attr('stroke', s.stroke_color)
      .attr('stroke-width', s.stroke_width)
      .attr('opacity', s.opacity);
  },

  pin: (g, s) => {
    g.append('path')
      .attr('d', pinPath(s.width, s.height))
      .attr('fill', s.fill_color)
      .attr('stroke', s.stroke_color)
      .attr('stroke-width', s.stroke_width)
      .attr('opacity', s.opacity);
  },
};

/**
 * Paint a Shape2DDef into the given group, dispatching by builtin name
 * or rendering the raw svg_string when source === 'svg'.
 * Unknown shapes get a small magenta debug marker so failures are
 * visible rather than silent.
 */
export function paintShape2D(
  g: ShapeSelection,
  shape: Shape2DDef,
  style: ResolvedStyle2D
): void {
  if (shape.source === 'svg') {
    g.append('g').html(shape.svg_string || '');
    return;
  }
  const painter = BUILTIN_PAINTERS[shape.builtin_name];
  if (painter) {
    painter(g, style);
    return;
  }
  // Magenta debug marker — broken refs should be obvious.
  g.append('circle').attr('r', 4).attr('fill', 'magenta');
}

/**
 * Paint a label below or above the shape per the style's anchor.
 * Returns true if a label was painted.
 */
export function paintShapeLabel(
  g: ShapeSelection,
  style: ResolvedStyle2D,
  objectLabel: string | undefined
): boolean {
  const text = style.label_text || objectLabel;
  if (!text) return false;
  g.append('text')
    .attr('text-anchor', 'middle')
    .attr('font-size', style.label_text ? style.label_font_size : 11)
    .attr('y', style.anchor === 'bottom' ? -style.height - 4 : -style.height / 2 - 4)
    .attr('fill', style.label_text ? style.label_color : '#1a1a1a')
    .text(text);
  return true;
}

// --- geometry helpers (used by painters above) ---

function starPoints(cx: number, cy: number, outer: number, inner: number, points: number): string {
  const out: string[] = [];
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (Math.PI / points) * i - Math.PI / 2;
    out.push(`${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`);
  }
  return out.join(' ');
}

function pinPath(w: number, h: number): string {
  // Teardrop pin — anchor at the bottom point (0, 0).
  const r = w / 2;
  return `M 0,0 L ${-r * 0.7},${-h * 0.5} A ${r} ${r} 0 1 1 ${r * 0.7},${-h * 0.5} Z`;
}
