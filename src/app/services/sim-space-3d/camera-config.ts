/**
 * @cross-cutting
 * @tags @xc:render-3d
 * @consumers
 *   - ThreeSimSpaceRenderer.loadDefinition (sole consumer)
 * @see /OVERLAP_MAP.md
 *
 * SimSpaceDefinition.camera_json → camera pose + control policy. Pure
 * functions kept out of the renderer per the small-module convention.
 *
 * mode:'fixed' locks the camera at the configured pose (orbit/keys/
 * double-click disabled via CADControls.enabled) — the knob SELECTION
 * SPACES use: stable framing keeps projected overlay anchors still.
 * mode:'orbit' (or no config) keeps today's free navigation; an
 * explicit position/target still overrides the viewport heuristic's
 * initial framing.
 */

import * as THREE from 'three';

import { SimSpaceCameraConfig } from '@models/sim-space/sim-space-types';
import { CADControls } from './controls/cad-controls';

function vec3(v: unknown, fallback: [number, number, number]):
    [number, number, number] {
  if (Array.isArray(v) && v.length >= 3
      && v.every(n => typeof n === 'number' && isFinite(n))) {
    return [v[0], v[1], v[2]];
  }
  return fallback;
}

/** True when the config declares a usable explicit pose. */
export function hasExplicitPose(cfg: SimSpaceCameraConfig | null | undefined):
    boolean {
  return !!cfg && (Array.isArray(cfg.position) || Array.isArray(cfg.target));
}

/** Scene extent the auto-fit frames (from viewport_json). */
export interface CameraFitScene {
  center: [number, number, number];
  extent: [number, number, number];
}

/**
 * Apply a camera config: pose the camera, retarget the controls, and
 * enable/disable navigation per mode. Returns true when the camera is
 * FIXED (callers skip any competing framing heuristics).
 *
 * RESPONSIVE AUTO-FIT (default for fixed cameras, knob `fit:'off'`):
 * the authored pose defines the viewing DIRECTION (desktop is the
 * authoring baseline); the distance is recomputed from the scene
 * extent and the CURRENT host aspect so the whole scene stays visible
 * on any screen — a phone's narrow canvas zooms out just enough.
 * Re-run on host resize (the renderer does).
 */
export function applyCameraConfig(
  camera: THREE.PerspectiveCamera | THREE.OrthographicCamera,
  controls: CADControls | undefined,
  cfg: SimSpaceCameraConfig,
  scene?: CameraFitScene | null,
  aspect?: number,
): boolean {
  const target = vec3(cfg.target, [0, 0, 0]);
  let position = vec3(cfg.position, [
    target[0] + 3, target[1] + 3, target[2] + 3,
  ]);
  if (camera instanceof THREE.PerspectiveCamera && cfg.fov) {
    camera.fov = cfg.fov;
    camera.updateProjectionMatrix();
  }
  if (cfg.mode === 'fixed' && cfg.fit !== 'off' && scene
      && camera instanceof THREE.PerspectiveCamera) {
    position = fitDistancePosition(camera, cfg, position, target, scene,
                                   aspect ?? camera.aspect);
  }
  camera.position.set(position[0], position[1], position[2]);
  camera.up.set(...vec3(cfg.up, [0, 1, 0]));
  camera.lookAt(target[0], target[1], target[2]);
  if (controls) {
    controls.orbit.target.set(target[0], target[1], target[2]);
    controls.enabled = cfg.mode !== 'fixed';
    controls.update();
  }
  return cfg.mode === 'fixed';
}

/** Slide the camera along its authored view direction until the scene
 *  extent fits BOTH the vertical and horizontal FOV at `aspect`. */
function fitDistancePosition(
  camera: THREE.PerspectiveCamera,
  cfg: SimSpaceCameraConfig,
  position: [number, number, number],
  target: [number, number, number],
  scene: CameraFitScene,
  aspect: number,
): [number, number, number] {
  const dir = new THREE.Vector3(
    position[0] - target[0], position[1] - target[1],
    position[2] - target[2]);
  if (dir.lengthSq() < 1e-12) dir.set(0, 0, 1);
  dir.normalize();
  // Half-extents projected conservatively: use the two largest extents
  // for width/height so any view direction keeps everything inside.
  const sorted = [...scene.extent].map(Math.abs).sort((a, b) => b - a);
  const halfW = sorted[0] || 1;
  const halfH = sorted[1] || sorted[0] || 1;
  const margin = cfg.fitMargin ?? 1.15;
  const vfov = ((cfg.fov ?? camera.fov) * Math.PI) / 180;
  const safeAspect = Math.max(aspect || 1, 0.1);
  const hfov = 2 * Math.atan(Math.tan(vfov / 2) * safeAspect);
  const distance = Math.max(
    (halfH * margin) / Math.tan(vfov / 2),
    (halfW * margin) / Math.tan(hfov / 2),
    0.5,
  );
  return [
    target[0] + dir.x * distance,
    target[1] + dir.y * distance,
    target[2] + dir.z * distance,
  ];
}
