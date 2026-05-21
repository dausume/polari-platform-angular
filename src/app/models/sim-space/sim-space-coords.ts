/**
 * @cross-cutting
 * @tags @xc:render-shared
 * @consumers
 *   - D3SimSpaceRenderer (sim-space-2d)
 *   - ThreeSimSpaceRenderer (sim-space-3d, Phase 2+)
 *   - Binding-tab live preview (sim-space)
 * @impact-on-edit
 *   Coordinate-conversion bugs are silent — a pick goes to the wrong
 *   object, a render goes to the wrong place. Test both math + screen
 *   coordinate spaces on edits.
 * @see /OVERLAP_MAP.md
 *
 * Pure math — no DOM, no d3, no three. Defines the math-style ↔ screen
 * coordinate conversions used by both renderers.
 *
 * Math style:  origin center, Y up, real-valued.   x left→right, y bottom→top
 * Screen style: origin top-left, Y down, pixel.    x left→right, y top→bottom
 */

import {
  SimSpaceCoordinateSystem,
  SimSpacePosition,
  SimSpaceViewport,
} from './sim-space-types';

export interface ScreenBox {
  width: number;
  height: number;
}

export interface CoordTransform {
  /** Convert a position in the space's coords to screen pixels. */
  spaceToScreen(pos: SimSpacePosition): [number, number];
  /** Convert a screen pixel position back to space coords. */
  screenToSpace(screen: [number, number]): SimSpacePosition;
  /** Per-axis scale factor (units per pixel). */
  pixelsPerUnit(): { x: number; y: number };
}

/**
 * Build the active coordinate transform for a 2D SimSpace.
 *
 * For math-style: the viewport's center maps to the screen center; the
 * viewport's extent maps to half the screen dimension. The y axis flips.
 *
 * For screen-style: pass-through — space units ARE screen pixels. The
 * viewport center maps to the top-left if no offset is set.
 *
 * Both styles preserve aspect ratio by using min(scaleX, scaleY).
 */
export function buildTransform2D(
  system: SimSpaceCoordinateSystem,
  viewport: SimSpaceViewport | undefined,
  screen: ScreenBox,
  unitScale: number = 1
): CoordTransform {
  if (system === 'screen') {
    return passThroughTransform(unitScale);
  }
  // math-style — viewport is required for proper fit; if absent, default to
  // ±10 in each axis so users always see *something*.
  const vp: SimSpaceViewport = viewport ?? {
    center: [0, 0],
    extent: [10, 10],
  };
  const cx = vp.center[0] ?? 0;
  const cy = vp.center[1] ?? 0;
  const ex = (vp.extent[0] ?? 10) * unitScale;
  const ey = (vp.extent[1] ?? 10) * unitScale;
  // Preserve aspect ratio — use the smaller scale to ensure full viewport fits.
  const scaleX = (screen.width / 2) / ex;
  const scaleY = (screen.height / 2) / ey;
  const scale = Math.min(scaleX, scaleY);

  const screenCx = screen.width / 2;
  const screenCy = screen.height / 2;

  return {
    spaceToScreen(pos: SimSpacePosition): [number, number] {
      const x = (pos[0] ?? 0) - cx;
      const y = (pos[1] ?? 0) - cy;
      return [
        screenCx + x * scale,
        // Y-flip — math coords are Y-up, screen is Y-down.
        screenCy - y * scale,
      ];
    },
    screenToSpace(screen: [number, number]): SimSpacePosition {
      const sx = screen[0] - screenCx;
      const sy = screenCy - screen[1]; // unflip
      return [cx + sx / scale, cy + sy / scale];
    },
    pixelsPerUnit() {
      return { x: scale, y: scale };
    },
  };
}

function passThroughTransform(unitScale: number): CoordTransform {
  const s = unitScale;
  return {
    spaceToScreen(pos: SimSpacePosition): [number, number] {
      return [(pos[0] ?? 0) * s, (pos[1] ?? 0) * s];
    },
    screenToSpace(screen: [number, number]): SimSpacePosition {
      return [screen[0] / s, screen[1] / s];
    },
    pixelsPerUnit() {
      return { x: s, y: s };
    },
  };
}
