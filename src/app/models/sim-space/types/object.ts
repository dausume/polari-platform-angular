/**
 * @cross-cutting
 * @tags @xc:render-shared
 * @see /OVERLAP_MAP.md
 *
 * Transient render records — SimSpaceObject + SimSpaceConnection. NOT
 * tree-objects; derived from class instances by the snapshot compiler
 * (or baked into a SimSpaceDefinition as a freestanding shape).
 */

import {
  SimSpacePosition,
  SimSpaceRotation,
  SimSpaceScale,
} from './core';

/**
 * A single placement record produced by the snapshot endpoint for rendering.
 * NOT a tree-object — these are transient render records derived from class
 * instances (via SimSpaceBinding) or from freestanding decorative objects
 * baked into the SimSpaceDefinition.
 */
export interface SimSpaceObject {
  /**
   * Stable identity. For class-derived objects: `<className>:<instanceId>`.
   * For freestanding objects: a generated UUID. Used as the picking key.
   */
  id: string;
  /** Human label — rendered as a tooltip / overlay title. */
  label?: string;
  /** Origin position in the space's coordinate system. */
  position: SimSpacePosition;
  /** Optional rotation (radians). */
  rotation?: SimSpaceRotation;
  /** Optional scale. */
  scale?: SimSpaceScale;
  /**
   * Reference to a shape (2D) or mesh (3D) by name. Renderers resolve via
   * their library service (Shape2DLibraryService or Mesh3DLibraryService).
   */
  shapeRef: string;
  /**
   * Reference to a style (2D) or material (3D) by name.
   */
  styleRef: string;
  /**
   * Backlink to the source class instance, if any. Drives the click action
   * (e.g. "navigate to /class-main-page/<className>/<instanceId>").
   */
  classRef?: {
    className: string;
    instanceId: string;
  };
  /**
   * Free-form per-object metadata for renderer-specific use. Renderers MUST
   * tolerate unknown keys and SHOULD only read keys they understand.
   */
  userData?: Record<string, unknown>;
  /**
   * Temporal value of the source instance — populated when the class's
   * SimSpaceBinding declares a `temporal` field. Drives the viewer's
   * scrubber; not consumed by renderers directly. Units match the
   * binding's declared unit (see SimSpaceTemporalBinding.unit).
   */
  temporalValue?: number;
}

/**
 * A connection between two endpoints. Each endpoint is either a reference
 * to another SimSpaceObject (sourceId/targetId — the original mode, used
 * by the no-code editor's transitions) or a literal position
 * (sourcePosition/targetPosition — used by connection-mode bindings where
 * the endpoint comes directly from a row's fields or a binding constant,
 * e.g. a pendulum string anchored at the origin with the bob at (bob_x, bob_y)).
 *
 * Renderers prefer literal positions when supplied; otherwise fall back
 * to the id lookup. Exactly one mode must be set per endpoint.
 */
export interface SimSpaceConnection {
  id: string;
  sourceId?: string;
  targetId?: string;
  sourcePosition?: SimSpacePosition;
  targetPosition?: SimSpacePosition;
  /** Optional style name from the same library as object styles. */
  styleRef?: string;
  /** Optional label rendered mid-path. */
  label?: string;
  /**
   * When the connection was produced by a temporally-bound class instance,
   * its value flows through here so the viewer's scrubber can filter
   * connections the same way it filters objects.
   */
  temporalValue?: number;
  /**
   * Backlink to the source class instance, if any — populated by
   * connection-mode bindings so click/hover on the line can still route
   * to the underlying class instance.
   */
  classRef?: {
    className: string;
    instanceId: string;
  };
  userData?: Record<string, unknown>;
}
