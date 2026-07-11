/**
 * @xr
 * @module services/sim-space-3d/xr/xr-entry-placement
 *
 * Scale-relative entry (xr-2): the initial rig scale + pose derive
 * from the SPACE'S EXTENT × its resolved xr_framing, so a molecule
 * space and a room space both feel right on entry. The derived scale
 * is a starting point — it is persisted into XrInterfaceVariant on
 * first entry and editable there (knob over magic); the world-grab
 * moves freely afterward.
 *
 * Rig convention (shared by navigation): world = P + s·RotY(yaw)·local,
 * where local is the reference-space pose. Yaw-only rotation — the
 * horizon never tilts.
 */

import * as THREE from 'three';

import type { XrFramingValue, XrRigPose } from '@models/xr/xr-types';

/** Apparent (user-perceived) radius targets, in user-space meters. */
const INSIDE_APPARENT_RADIUS_M = 2.5;   // "you are in it" — room feel
const EXHIBIT_APPARENT_RADIUS_M = 0.45; // pedestal-scale model

/** Hard sanity bounds on any rig scale (degenerate spaces). */
const SCALE_FLOOR = 1e-6;
const SCALE_CEIL = 1e6;

export interface XrEntryPlacement {
  scale: number;
  position: THREE.Vector3;
}

/** Bounding sphere of the space BEFORE the rig joins the scene. */
export function sceneBoundingSphere(scene: THREE.Scene): THREE.Sphere {
  const bounds = new THREE.Box3().setFromObject(scene);
  if (bounds.isEmpty()) {
    return new THREE.Sphere(new THREE.Vector3(0, 0, 0), 1);
  }
  const sphere = bounds.getBoundingSphere(new THREE.Sphere());
  if (!(sphere.radius > 0)) sphere.radius = 1;
  return sphere;
}

/** The auto-derived entry scale for a space of radius r (world units)
 *  under a framing. Larger scale = larger user = world appears
 *  smaller. */
export function deriveEntryScale(
    radius: number, framing: Exclude<XrFramingValue, 'unset'>): number {
  const apparent = framing === 'inside'
    ? INSIDE_APPARENT_RADIUS_M
    : EXHIBIT_APPARENT_RADIUS_M;
  const s = Math.max(radius, 1e-9) / apparent;
  return Math.min(Math.max(s, SCALE_FLOOR), SCALE_CEIL);
}

/** Initial rig placement for a framing at a given scale.
 *  'inside': the wearer's head starts at the space center.
 *  'exhibit': the space center sits ~1m in front, just below eye
 *  level — a model on a stand. Head is assumed at local (0, 1.6, 0)
 *  (local-floor; the 'local' fallback just reads as a seated view). */
export function placeRigForFraming(
    center: THREE.Vector3,
    scale: number,
    framing: Exclude<XrFramingValue, 'unset'>): XrEntryPlacement {
  // Where the space center should appear in reference space (-Z is
  // forward): 'inside' puts it at the head; 'exhibit' 0.9m in front,
  // just below eye level.
  const centerLocal = framing === 'inside'
    ? new THREE.Vector3(0, 1.6, 0)
    : new THREE.Vector3(0, 1.2, -0.9);
  // P = center − s·centerLocal (yaw 0 at entry).
  const position = center.clone()
    .sub(centerLocal.multiplyScalar(scale));
  return { scale, position };
}

// ---------------------------------------------------------------------
// Rig-pose helpers (navigation + bookmarks share these)
// ---------------------------------------------------------------------

export function poseFromRig(rig: THREE.Group): XrRigPose {
  const e = new THREE.Euler().setFromQuaternion(rig.quaternion, 'YXZ');
  return {
    position: [rig.position.x, rig.position.y, rig.position.z],
    yaw: e.y,
    scale: rig.scale.x,
  };
}

export function applyPoseToRig(rig: THREE.Group, pose: XrRigPose): void {
  rig.position.set(pose.position[0], pose.position[1], pose.position[2]);
  rig.quaternion.setFromEuler(new THREE.Euler(0, pose.yaw, 0));
  rig.scale.setScalar(pose.scale);
}

/** Yaw the rig by dYaw about a WORLD-space point (the wearer's feet,
 *  a grab midpoint …) so the user pivots in place instead of
 *  orbiting the rig origin. */
export function rotateRigAboutPoint(
    rig: THREE.Group, worldPoint: THREE.Vector3, dYaw: number): void {
  const rot = new THREE.Quaternion()
    .setFromEuler(new THREE.Euler(0, dYaw, 0));
  rig.position.sub(worldPoint).applyQuaternion(rot).add(worldPoint);
  rig.quaternion.premultiply(rot);
}
