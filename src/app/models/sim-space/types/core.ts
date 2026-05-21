/**
 * @cross-cutting
 * @tags @xc:render-shared
 * @see /OVERLAP_MAP.md
 *
 * Core SimSpace primitives — dimensionality flag, position/rotation/scale,
 * viewport, screen position. Dimension-agnostic — both 2D and 3D
 * consumers read these.
 */

/** Dimensionality flag — drives renderer dispatch + binding tab variant. */
export type SimSpaceDimensionality = '2d' | '3d';

/**
 * Coordinate system convention. Math-style matches scientific intuition
 * (origin center, Y up, real-valued) and is the default for new spaces.
 * Screen-style (origin top-left, Y down) exists for the no-code editor's
 * canvas and any case where pixel-positioned objects are desired.
 */
export type SimSpaceCoordinateSystem = 'math' | 'screen';

/**
 * Variable-dimensionality position vector.
 *   2D: [x, y]
 *   3D: [x, y, z]
 * Renderers read only the dimensions they care about; the field is shared.
 */
export type SimSpacePosition = number[];

/**
 * Optional Euler rotation triple (radians). 2D effectively ignores X and Y
 * components and uses Z as rotation-about-screen-normal; most 2D bindings
 * leave rotation undefined.
 */
export type SimSpaceRotation = [number, number, number];

/**
 * Scale — either uniform (single number) or per-axis (triple).
 * 2D ignores the third component when per-axis.
 */
export type SimSpaceScale = number | [number, number, number];

/**
 * Optional viewport bounds for math-style coordinates. Renderers use this
 * to set the initial zoom-to-fit. For 3D this maps to camera distance +
 * orbit target; for 2D this maps to SVG viewBox.
 */
export interface SimSpaceViewport {
  /** Center of the viewport in space coords. */
  center: SimSpacePosition;
  /**
   * Half-extent in each axis. `extent: [10, 10]` in 2D math-style means
   * x in [-10, 10], y in [-10, 10]. In 3D add a z component.
   */
  extent: number[];
}

/** Position of a screen-space pick request. */
export interface SimSpaceScreenPosition {
  x: number;
  y: number;
}
