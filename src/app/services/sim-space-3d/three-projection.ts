/**
 * @cross-cutting
 * @tags @xc:render-3d
 * @consumers
 *   - ThreeSimSpaceRenderer.getObjectScreenRect (sole consumer — keeps
 *     `three` imports inside the sim-space-3d firewall)
 * @see /OVERLAP_MAP.md
 *
 * World → screen "SHELL SHAPE" projection: a 3D object's bounding box
 * projected through the camera into a host-local 2D rect. This is the
 * 3D analogue of the 2D no-code canvas's SVG state-group rects — the
 * anchor the SAME overlay-component machinery positions itself on
 * (StateOverlayManager's rect-based entry points), so 3D objects carry
 * tiered overlays + popups exactly like 2D states do.
 */

import * as THREE from 'three';

export interface ProjectedRect {
  /** Host-local CSS pixels (top-left origin). */
  x: number;
  y: number;
  width: number;
  height: number;
}

const box = new THREE.Box3();
const corner = new THREE.Vector3();

/**
 * Project `object`'s world-space bounding box through `camera` into a
 * host-local rect. Returns null when the object is fully behind the
 * camera (no meaningful anchor). All 8 box corners are projected — a
 * box's screen extent is NOT the projection of its min/max alone.
 */
export function projectObjectRect(
  object: THREE.Object3D,
  camera: THREE.PerspectiveCamera | THREE.OrthographicCamera,
  hostSize: { width: number; height: number },
): ProjectedRect | null {
  box.setFromObject(object);
  if (box.isEmpty()) return null;

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  let anyInFront = false;
  for (let i = 0; i < 8; i++) {
    corner.set(
      (i & 1) ? box.max.x : box.min.x,
      (i & 2) ? box.max.y : box.min.y,
      (i & 4) ? box.max.z : box.min.z,
    );
    corner.project(camera);
    if (corner.z <= 1) anyInFront = true;
    const sx = (corner.x + 1) * 0.5 * hostSize.width;
    const sy = (1 - (corner.y + 1) * 0.5) * hostSize.height;
    if (sx < minX) minX = sx;
    if (sy < minY) minY = sy;
    if (sx > maxX) maxX = sx;
    if (sy > maxY) maxY = sy;
  }
  if (!anyInFront) return null;
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}
