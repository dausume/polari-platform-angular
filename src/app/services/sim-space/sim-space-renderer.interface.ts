/**
 * @cross-cutting
 * @tags @xc:render-shared
 * @consumers
 *   - sim-space-2d/d3-renderer.service (the 2D impl)
 *   - sim-space-3d/three-renderer.service (Phase 2+ impl)
 *   - sim-space SimSpaceViewer component
 *   - per-class binding-tab live preview
 *   - (eventual) no-code editor when migrated off d3-extensions/ directly
 * @impact-on-edit
 *   Adding a method to this interface forces both 2D and 3D renderers to
 *   implement it. Before adding, consider whether the consumer can do
 *   without — the smaller the interface, the cleaner the abstraction.
 *
 *   If 3D needs a method 2D doesn't, ask: does 2D also conceptually need
 *   it? (Usually yes — e.g. picking exists in both.) If not, it probably
 *   belongs on a 3D-specific sub-interface, not the shared one.
 * @see /OVERLAP_MAP.md
 *
 * The firewall. Components that show a SimSpace only see this interface;
 * they never import d3 or three directly. The renderer-factory picks the
 * concrete impl based on `definition.dimensionality`.
 */

import {
  SimSpaceObject,
  SimSpaceConnection,
  SimSpaceDefinitionPayload,
  SimSpaceScreenPosition,
  SnapshotVector,
} from '@models/sim-space/sim-space-types';

/**
 * Subset of SimSpaceObject used by updateObjectTransform — small enough
 * to use on hot paths (drag, animation) without copying the full object.
 */
export interface SimSpaceTransformPatch {
  position?: number[];
  rotation?: [number, number, number];
  scale?: number | [number, number, number];
}

/**
 * Picking result. `id` matches a SimSpaceObject.id (or null when nothing
 * was hit). `screenPos` echoes the input for convenience.
 */
export interface SimSpacePickResult {
  id: string | null;
  screenPos: SimSpaceScreenPosition;
}

export interface SimSpaceRenderer {
  // -------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------

  /**
   * Mount the renderer into a host element. Idempotent — calling twice is
   * an error; call destroy() first if you need to re-mount.
   */
  attach(host: HTMLElement): void;

  /** Tear down DOM + GPU resources. Safe to call multiple times. */
  destroy(): void;

  /**
   * Apply (or re-apply) the SimSpaceDefinition. Sets coordinate system,
   * viewport, background. Does NOT load objects — those come via
   * setObjects below. Calling with a new definition is a hot-swap.
   */
  loadDefinition(def: SimSpaceDefinitionPayload): void;

  /**
   * Resize hook — call when the host element's bounding rect changes.
   * Renderers re-fit the viewport accordingly. (For Three.js this also
   * updates aspect ratio and renderer pixel size; for d3 SVG this updates
   * viewBox.)
   */
  onHostResize(): void;

  // -------------------------------------------------------------------
  // Object lifecycle (reconciler — diff against current state internally)
  // -------------------------------------------------------------------

  /**
   * Set the full object list. Implementations diff against current state:
   *   - new ids → enter
   *   - existing ids with changed fields → update in place
   *   - removed ids → exit + dispose
   * Idempotent: calling with the same list twice is a no-op.
   */
  setObjects(objects: SimSpaceObject[]): void;

  /**
   * Hot path: patch one object's transform without re-running the full
   * setObjects diff. Used by drag handlers + animation loops.
   * Returns silently if the id is unknown (renderer trusts its caller).
   */
  updateObjectTransform(id: string, patch: SimSpaceTransformPatch): void;

  /** Set the full connection list. Same reconciler semantics. */
  setConnections(connections: SimSpaceConnection[]): void;

  /**
   * Set the full State-Projection vector list (kind='vector' arrows). Same
   * reconciler semantics as setObjects/setConnections — keyed by
   * SnapshotVector.key, reused across scrubber steps. The 2D renderer may
   * no-op until arrow parity lands (design §5b).
   */
  setVectors(vectors: SnapshotVector[]): void;

  // -------------------------------------------------------------------
  // Interaction
  // -------------------------------------------------------------------

  /**
   * Synchronous picking — given a screen-space pixel position relative to
   * the host element, return the topmost object at that point (or null).
   *
   * 2D impl: element-from-point on the SVG.
   * 3D impl: Raycaster against the scene.
   *
   * The signature is intentionally the same — proves the abstraction holds.
   */
  pickAt(screenPos: SimSpaceScreenPosition): SimSpacePickResult;

  /**
   * Highlight an object visually (typically used for hover / selection
   * feedback). Pass null to clear. Implementations decide the visual
   * (stroke change in 2D, emissive boost in 3D).
   */
  setHighlight(id: string | null): void;

  /**
   * Selection state — multi-select aware. Implementations decide visual
   * (heavier stroke, outline pass, etc.). Empty array clears.
   */
  setSelection(ids: string[]): void;

  /** Fit the viewport to all rendered objects. */
  zoomToFit(): void;

  // -------------------------------------------------------------------
  // Overlays — Angular components anchored to a rendered object
  // -------------------------------------------------------------------

  /**
   * Attach an HTML element (typically the host of a rendered Angular
   * component) as an overlay on a specific object. The renderer tracks
   * the object's screen position and keeps the overlay aligned, including
   * during pan/zoom (2D) or camera motion (3D).
   */
  attachOverlay(
    objectId: string,
    anchor: 'center' | 'top' | 'right' | 'bottom' | 'left',
    el: HTMLElement
  ): void;

  /** Detach the overlay for one object. */
  detachOverlay(objectId: string): void;

  /**
   * The object's projected screen-space bounding rect in host-local CSS
   * pixels — the "shell shape" the shared overlay machinery anchors
   * tiered overlay components on (3D: bounding box through the camera;
   * 2D may implement from the SVG node box). Optional: consumers must
   * tolerate absence; null = unknown id or not currently projectable.
   */
  getObjectScreenRect?(id: string):
      { x: number; y: number; width: number; height: number } | null;

  // -------------------------------------------------------------------
  // Event subscriptions — simple callback registration, not Observables.
  // Keeps the interface library-agnostic (no rxjs dep on shared layer).
  // Each setter replaces the previous callback.
  // -------------------------------------------------------------------

  /** Fired when the user clicks the surface. */
  setOnClick(handler: (result: SimSpacePickResult) => void): void;

  /** Fired when the user hovers a different object (incl. exiting to null). */
  setOnHoverChange(handler: (id: string | null) => void): void;

  /**
   * Fired when an object's transform is changed by user interaction
   * (drag in 2D, TransformControls in 3D — when wired in Phase 2+).
   */
  setOnTransformChange(handler: (id: string, patch: SimSpaceTransformPatch) => void): void;

  /**
   * Fired when the renderer's internal view (pan/zoom in 2D, camera in 3D)
   * changes. UI uses this to keep overlays synchronized if they need
   * data-coords rather than screen-coords (rare).
   */
  setOnViewChange(handler: () => void): void;
}
