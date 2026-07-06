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
import { SimSpaceEvaluationSnapshot } from './evaluation';

/**
 * A State Projection of kind `vector` — a visualization-only arrow drawn
 * FROM `origin` along `vec`, scaled by `scale`. Owns no physics; the
 * backend reads the fields off a real `*SimState` row at snapshot time and
 * emits these alongside `objects` / `connections`. Renderers draw it with
 * a single arrow primitive (THREE.ArrowHelper in 3D); the viewer scrubs it
 * by `temporalValue` the same way it does objects.
 */
export interface SnapshotVector {
  kind: 'vector';
  /** Stable id = `<bindingName>:<instanceName>`. Used for stable-key reuse. */
  key: string;
  /** Arrow tail in world coordinates. */
  origin: [number, number, number];
  /** The vector to draw FROM origin (pre-scale). */
  vec: [number, number, number];
  /** World units per unit-magnitude. */
  scale: number;
  /** Arrowhead length as a fraction of the shaft. */
  headScale: number;
  /** Material name → color (same library as connection styleRefs). */
  styleRef: string;
  /** Backlink to the source class (for parity with objects/connections). */
  classRef?: { className: string; instanceId?: string };
  /** Scrubber filter value — same semantics as objects' temporalValue. */
  temporalValue?: number;
}

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
  /**
   * Optional per-axis label overrides. When absent or with `kind:default`
   * the axis legend (and future in-canvas axis ticks) fall back to the
   * dimensionality letters. `kind:text` renders the value as plain text;
   * `kind:latex` renders via KaTeX so phase-space axes can carry
   * symbolic notation (e.g. "\\omega" or "p_x / \\hbar").
   */
  axisLabels?: {
    x?: SimSpaceAxisLabel;
    y?: SimSpaceAxisLabel;
    z?: SimSpaceAxisLabel;
  };
  /**
   * Optional camera config (3D). Absent → orbit controls + initial
   * framing from `viewport` (today's behavior). mode:'fixed' locks the
   * camera at the configured pose — selection spaces use this so their
   * framing (and projected overlay anchors) stay stable.
   */
  camera?: SimSpaceCameraConfig | null;
}

export interface SimSpaceCameraConfig {
  mode?: 'fixed' | 'orbit';
  position?: [number, number, number];
  target?: [number, number, number];
  up?: [number, number, number];
  projection?: 'perspective' | 'orthographic';
  fov?: number;
  /** Fixed cameras auto-fit the scene extent to the live host aspect
   *  by default (the authored pose is the desktop baseline; phones zoom
   *  out along the same view direction). 'off' pins the exact pose. */
  fit?: 'auto' | 'off';
  /** Auto-fit breathing room (default 1.15). */
  fitMargin?: number;
}

export interface SimSpaceAxisLabel {
  kind: 'default' | 'text' | 'latex';
  value?: string;
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
   * Class-level metadata: when the bound class is a `*SimState`
   * (declares a `simulation_definition_name` class attribute), this is
   * its value. Lets the frontend's simulation-run panel pick the right
   * SimulationDefinition without a separate discovery roundtrip.
   */
  simulationDefinitionName?: string;
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
   * State Projections of kind `vector` — viz-only arrows derived from real
   * `*SimState` rows. Defaults to `[]` when absent (older snapshots predate
   * the field). See SnapshotVector.
   */
  vectors: SnapshotVector[];
  /**
   * Bound classes that actually emitted at least one object. Powers the
   * legend panel in the viewer (what's plotted, from which fields).
   */
  resolvedBindings?: SimSpaceResolvedBinding[];
  /**
   * Live equation readouts pre-computed at every recorded step. The
   * viewer renders these as overlays (HTML + KaTeX above the canvas)
   * and looks up the current-step value on every scrubber tick.
   */
  evaluations?: SimSpaceEvaluationSnapshot[];
  /**
   * Optional warnings — e.g. "class X is bound but has no instances",
   * "shape Y referenced but missing from library". UI shows these in a
   * non-blocking banner.
   */
  warnings?: string[];
  /**
   * Which SimulationRun the rendered `*SimState` rows are filtered to,
   * or null when no filter was applied (every run's rows present).
   * Echoes back the `?run=<name>` query the viewer sent so the run
   * panel can confirm which dataset is on screen.
   */
  activeRunRef?: string | null;
  /**
   * Names of every SimulationDefinition whose `*SimState` classes are
   * bound to this scene. Derived from class-level metadata, not from
   * instance count — so a brand-new empty live run still tells the
   * viewer "this scene participates in pendulum-2d," keeping the run
   * panel visible.
   */
  participatingSimulations?: string[];
  /**
   * Per-sim defaults (dt, time unit) keyed by SimulationDefinition
   * name. Drives the run panel's dt-override placeholder + result-
   * time formatting without a separate round trip. Empty / missing
   * keys = use the sim def's hard-coded fallback (0.01 s).
   */
  simulationDefaultsByName?: Record<string, {
    timeStepSeconds: number;
    timeUnit: string;
  }>;
}
