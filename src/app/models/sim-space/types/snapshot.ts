/**
 * @cross-cutting
 * @tags @xc:render-shared
 * @see /OVERLAP_MAP.md
 *
 * Snapshot endpoint response shapes — what the frontend deserializes
 * from `GET /api/simspace/{name}/snapshot`. Backend builds these in
 * simSpace.compilers.compile_2d / compile_3d; UI consumes them via
 * SimSpaceViewer.
 */

import {
  SimSpaceCoordinateSystem,
  SimSpaceDimensionality,
  SimSpaceViewport,
} from './core';
import { SimSpaceObject, SimSpaceConnection } from './object';

/**
 * The persisted scene definition. Mirrors how GeoJsonDefinition stores its
 * config: a small metadata header + a `definition` JSON blob that's
 * dimension-specific. Coordinate system + viewport live on the header so
 * the snapshot endpoint can dispatch without parsing the blob.
 */
export interface SimSpaceDefinitionPayload {
  id: string;
  name: string;
  description?: string;
  dimensionality: SimSpaceDimensionality;
  coordinateSystem: SimSpaceCoordinateSystem;
  /** Per-axis unit scale (1.0 unless the user wants e.g. "1 unit = 1 mm"). */
  unitScale?: number;
  viewport?: SimSpaceViewport;
  /**
   * Which classes this scene renders. Order matters for paint order. If a
   * class is not in the list but has `defaultVisible: true` on its binding,
   * it still renders (Phase 1: defaultVisible is honored; per-scene
   * filtering is the user's override).
   */
  boundClasses?: Array<{
    className: string;
    overrideShapeRef?: string;
    overrideStyleRef?: string;
  }>;
  /**
   * Dimension-specific blob — opaque to the shared layer. 2D viewers
   * parse it through the 2D-specific type; 3D through theirs.
   */
  definition: string;
}

/**
 * Resolved binding info surfaced in the snapshot so the viewer can render
 * a legend explaining what's plotted from where. One entry per class
 * actually contributing instances to the snapshot.
 */
export interface SimSpaceResolvedBinding {
  className: string;
  /** Number of instances of this class emitted into the snapshot. */
  instanceCount: number;
  /**
   * Emission mode the binding ran in. 'object' (default) means the class
   * contributes SimSpaceObjects to the snapshot; 'connection' means it
   * contributes SimSpaceConnections (lines between two endpoints).
   */
  kind?: 'object' | 'connection';
  /** Field names mapped to each axis (when position.kind === 'fields'). */
  positionFields?: { x?: string; y?: string; z?: string };
  /** When position.kind === 'vec3'. */
  vec3Field?: string;
  /**
   * For kind='connection': human-readable summary of endpoints (e.g.
   * "(0, 0) → (bob_x, bob_y)") for the legend.
   */
  endpoints?: { source: string; target: string };
  /** Resolved shape/style references (post-override). */
  shapeRef: string;
  styleRef: string;
  /**
   * Temporal config from the binding, when present. Presence on any
   * resolvedBinding tells the viewer to enable a scrubber; the field +
   * unit determine slider labels.
   */
  temporal?: {
    kind: 'time' | 'step';
    field: string;
    unit?: string;
    secondsPerStep?: number;
    cumulative?: boolean;
  };
}

/** Response shape of GET /api/simspace/{id}/snapshot. */
export interface SimSpaceSnapshot {
  definition: SimSpaceDefinitionPayload;
  objects: SimSpaceObject[];
  connections: SimSpaceConnection[];
  /**
   * Bound classes that actually emitted at least one object. Powers the
   * legend panel in the viewer (what's plotted, from which fields).
   */
  resolvedBindings?: SimSpaceResolvedBinding[];
  /**
   * Optional warnings — e.g. "class X is bound but has no instances",
   * "shape Y referenced but missing from library". UI shows these in a
   * non-blocking banner.
   */
  warnings?: string[];
}
