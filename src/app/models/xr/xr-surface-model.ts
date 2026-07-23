/**
 * @module models/xr/xr-surface-model
 *
 * XrSurfaceModel (xr-3-min): menus and panels as DATA — the house
 * config-driven-rendering idiom. Each row declares one piece of
 * SimSpace-adjacent chrome once; the XR renderer consumes the model
 * (flat mode already renders these surfaces as the run panel / IC
 * accordion / scrubber). xr-3-min ships a HARDCODED seed shaped as
 * rows so the full xr-3 registry decoration is a data move, not a
 * rewrite.
 *
 * Three-free by design: rides the main bundle. The (lazy-chunk) XR
 * panel system is the only consumer that touches three.
 */

/** Where a surface renders in XR: a wrist-ring menu item that toggles
 *  a spawnable content quad. Ring 0 is the fixed EXIT/RE-CENTER/HELP
 *  seed and is never declared here. */
export interface XrSurfacePlacement {
  ring: number;
  /** Slot order within the ring (fan layout, left to right). */
  slot: number;
}

export interface XrSurfaceModelRow {
  kind: 'menu-item';
  id: string;
  /** Wrist-button text — legibility is the binding constraint. */
  label: string;
  xrPlacement: XrSurfacePlacement;
  /** What the item toggles: 'panel:<panel id>' spawns the HTMLMesh
   *  quad of that registered panel surface; 'scrub-rail' toggles the
   *  world-anchored canvas rail. */
  panelContentRef: string;
}

/** The xr-3-min seed: RUN / CONDITIONS / SCRUB on ring 1
 *  (WEBXR_PLAN.md, Dustin's scope 2026-07-13). EQUATIONS / LEGEND
 *  added in the 2026-07-12 debug-pass session — the remaining flat-
 *  only menus growing onto the same ring (row order = fan order;
 *  `slot` is descriptive only, see XrWristUi.buildRing1). */
export const XR_SURFACE_SEED: XrSurfaceModelRow[] = [
  {
    kind: 'menu-item', id: 'run', label: 'RUN',
    xrPlacement: { ring: 1, slot: 0 }, panelContentRef: 'panel:run',
  },
  {
    kind: 'menu-item', id: 'conditions', label: 'CONDITIONS',
    xrPlacement: { ring: 1, slot: 1 },
    panelContentRef: 'panel:conditions',
  },
  {
    kind: 'menu-item', id: 'scrub', label: 'SCRUB',
    xrPlacement: { ring: 1, slot: 2 }, panelContentRef: 'scrub-rail',
  },
  {
    kind: 'menu-item', id: 'equations', label: 'EQUATIONS',
    xrPlacement: { ring: 1, slot: 3 },
    panelContentRef: 'panel:equations',
  },
  {
    kind: 'menu-item', id: 'legend', label: 'LEGEND',
    xrPlacement: { ring: 1, slot: 4 },
    panelContentRef: 'panel:legend',
  },
  {
    kind: 'menu-item', id: 'solutions', label: 'NO-CODE',
    xrPlacement: { ring: 1, slot: 5 },
    panelContentRef: 'panel:solutions',
  },
  {
    kind: 'menu-item', id: 'assistant', label: 'ASSISTANT',
    xrPlacement: { ring: 1, slot: 6 },
    panelContentRef: 'panel:assistant',
  },
];

// ---------------------------------------------------------------------
// The surface PROVIDER seam: the flat page that owns the live Angular
// panels registers one of these with the XR engine; the session
// runtime consumes it. DOM elements + plain callbacks only — the
// firewall between the main bundle and three holds.
// ---------------------------------------------------------------------

export interface XrPanelSurfaceDef {
  /** Matches a seed row's 'panel:<id>' content ref. */
  id: string;
  /** Floating-page header title. */
  label: string;
  /** The LIVE component's host element (mounted off-screen under
   *  .xr-panel-context); null while (re)mounting. */
  getElement(): HTMLElement | null;
}

/** Snapshot of the viewer's temporal seams the scrub rail draws from
 *  (hasTemporal / temporalSampleCount / range / currentTime). */
export interface XrScrubState {
  min: number;
  max: number;
  current: number;
  kind: 'time' | 'step';
  /** Pre-formatted "current / max" readout (the flat scrubber's own
   *  formatter — units stay identical across modes). */
  formatted: string;
  sampleCount: number;
}

export interface XrSurfaceProvider {
  panels: XrPanelSurfaceDef[];
  /** null = no temporal binding / fewer than 2 recorded points — the
   *  rail then renders an honest "record steps first" message. */
  getScrubState(): XrScrubState | null;
  /** Drive the viewer's temporal index (the rail's puck drag). The
   *  provider is responsible for zone re-entry + clamping. */
  setScrubCurrent(value: number): void;
}

/** One persisted panel/rail placement (world space — placements
 *  survive exit/re-enter byte-exactly regardless of entry scale). */
export interface XrPanelPlacement {
  position: [number, number, number];
  yaw: number;
  scale: number;
}
