/**
 * @cross-cutting
 * @tags @xc:render-shared, @xc:bindings
 * @see /OVERLAP_MAP.md
 *
 * SimSpace binding model — how class instances become SimSpaceObjects.
 * Phase 3 will lift this into a Channel-based abstraction shared with
 * graphs (Plot consolidation); current shape is the minimum viable
 * binding spec for 2D + 3D scenes.
 */

import { SimSpaceDimensionality } from './core';
import { TimeUnitId } from '../time-units';

/**
 * Optional temporal binding — declares a field that carries either a
 * time value (with a unit) or a discrete simulation-step index.
 *
 * When present, the SimSpace becomes "scrubbable" — the viewer adds a
 * timeline UI (Phase 3+) and the rendered object set filters/animates by
 * the current time/step value. When absent, the binding is treated as
 * a static placement (all instances render at once, as today).
 *
 * Phase 2.5 scope: type only. UI scrubber + animated playback come later.
 */
export interface SimSpaceTemporalBinding {
  /** 'time' = continuous; 'step' = discrete simulation tick. */
  kind: 'time' | 'step';
  /** Name of the numeric field on the class instance. */
  field: string;
  /**
   * Unit of the field's value. Required for kind='time' (otherwise the
   * scrubber can't label tick marks meaningfully). Optional for
   * kind='step' (steps are dimensionless by default).
   */
  unit?: TimeUnitId;
  /**
   * For kind='step' with a meaningful seconds-per-step mapping. Lets
   * the UI convert step → seconds when desired (e.g. molecular-dynamics
   * runs where 1 step = 2 fs).
   */
  secondsPerStep?: number;
  /**
   * If true, instances are *cumulative* — past instances stay rendered
   * as the scrubber advances. If false, only instances matching the
   * current time/step show. Default: false.
   */
  cumulative?: boolean;
}

/**
 * Position spec used by both object-mode bindings (the placement of the
 * emitted SimSpaceObject) and connection-mode bindings (each endpoint
 * of the emitted SimSpaceConnection).
 *
 *   { kind: 'fields',   fields: { x, y, z? } }  — per-row numeric fields
 *   { kind: 'vec3',     vec3Field }             — single vec field
 *   { kind: 'constant', value: [x, y, z?] }     — fixed coordinate (only
 *                                                  meaningful as an endpoint
 *                                                  of a connection — there's
 *                                                  no reason to bind an object
 *                                                  to a constant since that's
 *                                                  what freestanding shapes
 *                                                  are for).
 */
export type SimSpacePositionSpec =
  | { kind: 'fields'; fields: { x: string; y: string; z?: string } }
  | { kind: 'vec3'; vec3Field: string }
  | { kind: 'constant'; value: number[] };

/**
 * A class-binding spec: how to derive SimSpace placements from instances
 * of a class. Lives on a class's ClassConfig (one per dimension).
 *
 * Two emission modes:
 *   kind: 'object'     — one SimSpaceObject per instance (default).
 *   kind: 'connection' — one SimSpaceConnection per instance. Used when
 *                        the row represents a *relationship* between two
 *                        coordinates (e.g. a pendulum string from the
 *                        pivot at (0,0) to the bob at (bob_x, bob_y)).
 *                        Requires `source` + `target` instead of `position`.
 */
export interface SimSpaceBinding {
  enabled: boolean;
  dimensionality: SimSpaceDimensionality;

  /** Emission mode — defaults to 'object' when absent. */
  kind?: 'object' | 'connection';

  /**
   * Position binding — required for kind='object', ignored for
   * kind='connection'. Constant kind is not allowed here (use a
   * freestanding shape instead).
   */
  position?:
    | { kind: 'fields'; fields: { x: string; y: string; z?: string } }
    | { kind: 'vec3'; vec3Field: string };

  /** Source endpoint — required for kind='connection'. */
  source?: SimSpacePositionSpec;
  /** Target endpoint — required for kind='connection'. */
  target?: SimSpacePositionSpec;

  /** Optional rotation binding (3D mostly; 2D rarely uses). */
  rotation?:
    | { kind: 'euler'; fields: { x: string; y: string; z: string }; units: 'radians' | 'degrees' }
    | { kind: 'quaternion'; quatField: string };

  /** Optional scale binding. */
  scale?:
    | { kind: 'uniform'; field: string }
    | { kind: 'per-axis'; fields: { x: string; y: string; z?: string } };

  /**
   * Mesh/shape reference — either a fixed library name or a field on the
   * class instance that holds the name (per-instance variation).
   */
  visual: {
    shapeRef: string | { fromField: string };
    styleRef: string | { fromField: string };
  };

  /**
   * Optional temporal binding — when present, the SimSpace becomes
   * scrubbable in time (Phase 3+ scrubber). See SimSpaceTemporalBinding.
   */
  temporal?: SimSpaceTemporalBinding;

  /** Optional filter expression — only render instances matching it. */
  filterExpression?: string;

  /** Click behavior when a rendered instance is picked. */
  clickAction?: 'navigate-to-instance' | 'show-overlay' | 'none';

  /**
   * Default visibility of this binding when a SimSpace doesn't explicitly
   * include or exclude the class. `true` = renders in any SimSpace that
   * allows this dimension; `false` = only renders in SimSpaces that
   * explicitly list this class.
   */
  defaultVisible?: boolean;
}
