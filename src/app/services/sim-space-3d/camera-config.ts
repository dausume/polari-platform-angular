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

/**
 * Apply a camera config: pose the camera, retarget the controls, and
 * enable/disable navigation per mode. Returns true when the camera is
 * FIXED (callers skip any competing framing heuristics).
 */
export function applyCameraConfig(
  camera: THREE.PerspectiveCamera | THREE.OrthographicCamera,
  controls: CADControls | undefined,
  cfg: SimSpaceCameraConfig,
): boolean {
  const target = vec3(cfg.target, [0, 0, 0]);
  const position = vec3(cfg.position, [
    target[0] + 3, target[1] + 3, target[2] + 3,
  ]);
  camera.position.set(position[0], position[1], position[2]);
  camera.up.set(...vec3(cfg.up, [0, 1, 0]));
  camera.lookAt(target[0], target[1], target[2]);
  if (camera instanceof THREE.PerspectiveCamera && cfg.fov) {
    camera.fov = cfg.fov;
    camera.updateProjectionMatrix();
  }
  if (controls) {
    controls.orbit.target.set(target[0], target[1], target[2]);
    controls.enabled = cfg.mode !== 'fixed';
    controls.update();
  }
  return cfg.mode === 'fixed';
}
