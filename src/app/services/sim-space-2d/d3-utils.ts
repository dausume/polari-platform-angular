/**
 * @cross-cutting
 * @tags @xc:render-2d
 * @consumers
 *   - D3SimSpaceRenderer
 *   - d3-shape-painters
 * @see /OVERLAP_MAP.md
 *
 * Tiny pure helpers shared by the d3-renderer + its sub-modules. Pulled
 * out so each module's file stays focused on a single concern.
 */

import type { SimSpaceObject } from '@models/sim-space/sim-space-types';
import type { CoordTransform } from '@models/sim-space/sim-space-coords';

/**
 * CSS transform that maps the overlay's natural top-left origin to the
 * point the renderer reports for the tracked object. Anchor names
 * describe which side of the overlay sits over the tracked point.
 *
 * Shared with three-renderer (3D uses the same anchor vocabulary even
 * though the absolute positioning lands via different math).
 */
export function transformForAnchor(
  anchor: 'center' | 'top' | 'right' | 'bottom' | 'left'
): string {
  switch (anchor) {
    case 'top':    return 'translate(-50%, -100%)';
    case 'bottom': return 'translate(-50%, 0%)';
    case 'left':   return 'translate(-100%, -50%)';
    case 'right':  return 'translate(0%, -50%)';
    case 'center':
    default:       return 'translate(-50%, -50%)';
  }
}

/** Minimal CSS escape for attribute-selector usage — backslashes + quotes. */
export function cssEscape(s: string): string {
  return s.replace(/[\\"]/g, '\\$&');
}

/**
 * Build the SVG `transform` attribute string for a SimSpaceObject under
 * a given coord transform. Reads position/rotation/scale; z-component of
 * rotation maps to SVG rotate, scale is uniform (single value or first
 * component of a triple).
 */
export function objectTransformAttr(obj: SimSpaceObject, transform: CoordTransform): string {
  const [sx, sy] = transform.spaceToScreen(obj.position);
  const scale = typeof obj.scale === 'number'
    ? obj.scale
    : Array.isArray(obj.scale) ? (obj.scale[0] ?? 1) : 1;
  const rotZDeg = Array.isArray(obj.rotation) ? ((obj.rotation[2] ?? 0) * 180) / Math.PI : 0;
  return `translate(${sx},${sy}) rotate(${rotZDeg}) scale(${scale})`;
}
