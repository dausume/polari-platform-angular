/**
 * @xr
 * @module services/sim-space-3d/xr/xr-nav-visuals
 *
 * Comfort + evidence visuals for grip navigation (xr-2):
 *  - motion VIGNETTE (tunneling) while a shift/grab moves the world —
 *    default ON, knob-off (Q8);
 *  - the AT-THE-LIMIT flash when a soft clamp engages — the honest
 *    indicator; clamps are never silent stops;
 *  - the shift ANCHOR GHOST: a small marker at the armed origin plus
 *    a line to the driving hand, so the command vector is visible.
 *
 * The vignette + limit flash are WEARER-ONLY (three's per-eye layers
 * 1/2 — flat cameras only carry layer 0, so the desktop mirror never
 * sees comfort overlays). The anchor ghost is rig-space geometry on
 * layer 0: the mirror shows it, which is exactly the demo-to-a-
 * colleague story.
 */

import * as THREE from 'three';

export interface XrNavVisualState {
  vignetteActive: boolean;
  shiftArmed: boolean;
  shiftOrigin: THREE.Vector3 | null;
  shiftHand: THREE.Vector3 | null;
  limitHit: boolean;
}

const VIGNETTE_MAX_OPACITY = 0.65;
const VIGNETTE_FADE_PER_SEC = 4;
const LIMIT_DECAY_PER_SEC = 2;

export class XrNavVisuals {
  private vignette: THREE.Mesh;
  private limitRing: THREE.Mesh;
  private anchor: THREE.Mesh;
  private vectorLine: THREE.Line;
  private disposables: (THREE.BufferGeometry | THREE.Material
    | THREE.Texture)[] = [];

  constructor(private rig: THREE.Group, camera: THREE.Camera) {
    this.vignette = this.buildRing('#000000');
    this.limitRing = this.buildRing('#e65100');
    camera.add(this.vignette, this.limitRing);

    const anchorGeometry = new THREE.SphereGeometry(0.012, 12, 8);
    const anchorMaterial = new THREE.MeshBasicMaterial({
      color: 0xffc94d, transparent: true, opacity: 0.9,
      depthTest: false,
    });
    this.anchor = new THREE.Mesh(anchorGeometry, anchorMaterial);
    this.anchor.name = 'xr-shift-anchor';
    this.anchor.renderOrder = 9990;
    this.anchor.visible = false;

    const lineGeometry = new THREE.BufferGeometry().setFromPoints(
      [new THREE.Vector3(), new THREE.Vector3()]);
    const lineMaterial = new THREE.LineBasicMaterial({
      color: 0xffc94d, transparent: true, opacity: 0.7,
      depthTest: false,
    });
    this.vectorLine = new THREE.Line(lineGeometry, lineMaterial);
    this.vectorLine.name = 'xr-shift-vector';
    this.vectorLine.renderOrder = 9990;
    this.vectorLine.visible = false;

    rig.add(this.anchor, this.vectorLine);
    this.disposables.push(anchorGeometry, anchorMaterial,
      lineGeometry, lineMaterial);
  }

  update(dt: number, state: XrNavVisualState): void {
    // Vignette eases toward its target opacity.
    const vignetteMaterial =
      this.vignette.material as THREE.MeshBasicMaterial;
    const target = state.vignetteActive ? VIGNETTE_MAX_OPACITY : 0;
    const step = VIGNETTE_FADE_PER_SEC * dt;
    vignetteMaterial.opacity +=
      Math.min(Math.max(target - vignetteMaterial.opacity, -step), step);
    this.vignette.visible = vignetteMaterial.opacity > 0.01;

    // Limit flash spikes on a clamp hit, then decays.
    const limitMaterial =
      this.limitRing.material as THREE.MeshBasicMaterial;
    if (state.limitHit) limitMaterial.opacity = 0.8;
    limitMaterial.opacity =
      Math.max(0, limitMaterial.opacity - LIMIT_DECAY_PER_SEC * dt);
    this.limitRing.visible = limitMaterial.opacity > 0.01;

    // Anchor ghost + command vector while a shift is armed.
    this.anchor.visible = state.shiftArmed && !!state.shiftOrigin;
    this.vectorLine.visible =
      state.shiftArmed && !!state.shiftOrigin && !!state.shiftHand;
    if (state.shiftOrigin) this.anchor.position.copy(state.shiftOrigin);
    if (this.vectorLine.visible) {
      const positions = this.vectorLine.geometry
        .getAttribute('position') as THREE.BufferAttribute;
      positions.setXYZ(0, state.shiftOrigin!.x, state.shiftOrigin!.y,
        state.shiftOrigin!.z);
      positions.setXYZ(1, state.shiftHand!.x, state.shiftHand!.y,
        state.shiftHand!.z);
      positions.needsUpdate = true;
    }
  }

  dispose(): void {
    this.vignette.parent?.remove(this.vignette);
    this.limitRing.parent?.remove(this.limitRing);
    this.anchor.parent?.remove(this.anchor);
    this.vectorLine.parent?.remove(this.vectorLine);
    for (const d of this.disposables) d.dispose();
    this.disposables = [];
  }

  /** A soft-edged ring texture on a camera-locked quad, enabled only
   *  on the per-eye layers (1/2) so the flat mirror never sees it. */
  private buildRing(color: string): THREE.Mesh {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;
    const gradient = ctx.createRadialGradient(
      128, 128, 60, 128, 128, 128);
    gradient.addColorStop(0, 'rgba(0,0,0,0)');
    gradient.addColorStop(0.75, `${this.hexToRgba(color, 0.85)}`);
    gradient.addColorStop(1, `${this.hexToRgba(color, 1)}`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 256, 256);

    const texture = new THREE.CanvasTexture(canvas);
    const geometry = new THREE.PlaneGeometry(1.2, 1.2);
    const material = new THREE.MeshBasicMaterial({
      map: texture, transparent: true, opacity: 0,
      depthTest: false, depthWrite: false,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.z = -0.4;
    mesh.renderOrder = 9998;
    mesh.frustumCulled = false;
    mesh.visible = false;
    mesh.layers.set(1);
    mesh.layers.enable(2);
    this.disposables.push(texture, geometry, material);
    return mesh;
  }

  private hexToRgba(hex: string, alpha: number): string {
    const n = parseInt(hex.slice(1), 16);
    const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    return `rgba(${r},${g},${b},${alpha})`;
  }
}
