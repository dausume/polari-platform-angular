/**
 * @xr
 * @module services/sim-space-3d/xr/xr-2d-scene-builder
 *
 * 2D SimSpaces (2026-07-12, Dustin: "instead of mixing the two...
 * standardize the entire XR experience to be more XR native"): a 2D
 * space is fundamentally a DOM element already (the D3 renderer draws
 * straight to an SVG host, no three.js involved) — so entering XR
 * means rasterizing that SAME live element as ONE big HTMLMesh quad,
 * not fabricating a fake 3D scene around it. The quad itself is built
 * by XrPanelSystem.spawnMain() (reusing the exact HTMLMesh + hover/
 * click-forwarding machinery every other panel already uses); this
 * module only builds the empty scene shell + the one fixed-radius
 * measurement XrSessionRuntime.bind() needs before the panel system
 * (and therefore the real quad) exists yet.
 *
 * Dynamically imported ONLY from SimSpaceViewerComponent's 2D XR
 * path — the firewall holds: `three` never enters the main bundle for
 * flat-2D-only users, exactly like every other file in this xr/
 * directory.
 */

import * as THREE from 'three';

import type { XrSceneHandle } from '@services/xr/xr-scene-registry.service';

/** Matches HTMLMesh's own convention (three/examples/jsm/interactive/
 *  HTMLMesh.js): PlaneGeometry(px * 0.001, px * 0.001). Kept here as
 *  the one place that owns "how do px map to world units for XR 2D
 *  content" — spawnMain()'s real quad will end up this same size. */
const PX_TO_WORLD = 0.001;

/** Builds the (initially empty) XR scene handle for a 2D SimSpace.
 *  `hostElement` is the SAME live div the D3 renderer already draws
 *  into (SimSpaceViewerComponent.getViewerHost()) — capturing it
 *  directly is what gives XR interaction automatic behavior parity
 *  with the flat view; there is only ever one renderer instance. */
export function buildXr2dSceneHandle(hostElement: HTMLElement):
    XrSceneHandle {
  const scene = new THREE.Scene();
  const w = Math.max(hostElement.offsetWidth, 1) * PX_TO_WORLD;
  const h = Math.max(hostElement.offsetHeight, 1) * PX_TO_WORLD;
  // A flat quad's "radius" for entry-scale purposes: half the
  // diagonal, matching how a bounding sphere would size a plane.
  const fixedRadius = Math.max(Math.hypot(w, h) / 2, 1e-3);
  return {
    scene,
    camera: null,
    mainSurfaceElement: hostElement,
    forcedFraming: 'exhibit',
    fixedRadius,
  };
}
