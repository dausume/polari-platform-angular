/**
 * @cross-cutting
 * @tags @xc:render-2d
 * @consumers
 *   - D3SimSpaceRenderer
 *   - d3-shape-painters
 * @see /OVERLAP_MAP.md
 *
 * Style resolution + fallbacks for the 2D renderer. Pulled out of
 * d3-renderer so the painters can import a tight `ResolvedStyle2D`
 * surface without dragging the full renderer + d3 along.
 */

import { Shape2DDef } from './shape-2d-library.service';
import { Style2DDef } from './style-2d-library.service';

/** Flattened style — painters consume this, no further parsing required. */
export interface ResolvedStyle2D {
  name: string;
  width: number;
  height: number;
  fill_color: string;
  stroke_color: string;
  stroke_width: number;
  opacity: number;
  anchor: 'center' | 'bottom';
  label_text: string;
  label_color: string;
  label_font_size: number;
}

/** Build a ResolvedStyle2D from a library entry, falling back to safe defaults. */
export function resolveStyle2D(style: Style2DDef | undefined, name: string): ResolvedStyle2D {
  if (!style) return fallbackStyle(name);
  return {
    name: style.name,
    width: style.width,
    height: style.height,
    fill_color: style.fill_color,
    stroke_color: style.stroke_color,
    stroke_width: style.stroke_width,
    opacity: style.opacity,
    anchor: style.anchor,
    label_text: style.label_text,
    label_color: style.label_color,
    label_font_size: style.label_font_size,
  };
}

/** Fallback used when a styleRef can't be resolved — magenta makes it visible. */
export function fallbackStyle(name: string): ResolvedStyle2D {
  return {
    name,
    width: 16, height: 16,
    fill_color: 'magenta',
    stroke_color: '#000',
    stroke_width: 1.5,
    opacity: 1,
    anchor: 'center',
    label_text: '',
    label_color: '#1a1a1a',
    label_font_size: 11,
  };
}

/** Fallback used when a shapeRef can't be resolved. */
export function fallbackShape(name: string): Shape2DDef {
  return {
    name,
    description: '',
    source: 'builtin',
    builtin_name: 'circle',
    default_width: 16,
    default_height: 16,
    anchor: 'center',
    category: 'general',
  };
}
