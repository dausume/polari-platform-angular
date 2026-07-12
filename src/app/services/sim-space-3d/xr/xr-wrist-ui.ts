/**
 * @xr
 * @module services/sim-space-3d/xr/xr-wrist-ui
 *
 * The ring-0 seed (xr-2, labels per Dustin 2026-07-12): a minimal
 * wrist-anchored cluster — EXIT (never paginated away; one of the
 * three always-reachable exit paths), RE-CENTER (back to the entry
 * view; "Home" implied a home page, i.e. exiting) and HELP (how to
 * move/zoom) — plus the HUD panel: position and distance from the
 * sim center in SIM RADII, current zoom, and the live drive rate in
 * R/s while moving — the reference that keeps movement legible. xr-3 grows this anchor into the full tiered radial-menu
 * system; the exit item stays pinned on ring 0 by contract.
 *
 * Interaction: point the OTHER controller's ray at a button and pull
 * the TRIGGER (triggers select; grips never click). While the ray
 * hovers the cluster, world navigation is input-focus-blocked — one
 * interaction at a time. Handedness is a knob (left wrist assumes a
 * right-hand pointer).
 */

import * as THREE from 'three';

import type { XrNavHud } from './xr-navigation';
import type { XrHandedness, XrInputRig } from './xr-input-rig';

export interface XrWristActions {
  exit: () => void;
  resetView: () => void;
  help: () => void;
}

interface WristButton {
  mesh: THREE.Mesh;
  action: keyof XrWristActions;
}

const HOVER_SCALE = 1.18;
const RAY_REACH_M = 1.5;

import { XR_BUILD_TAG } from '@models/xr/xr-types';

const HELP_LINES = [
  'HOW TO MOVE',
  '',
  'GRIP or PAD-CLICK both work the',
  'same (backup for a broken grip).',
  '',
  'Hold ONE (short pause arms it, you',
  'feel a tick): push/pull your hand',
  'from the anchor to glide that way —',
  'small offsets move slowly for fine',
  'adjustment; speed shows in R/s.',
  'Release to stop.',
  '',
  'Hold BOTH hands: stretch apart =',
  'zoom in, together = out; twist =',
  'rotate; drag = move the world.',
  '',
  'Cancel a one-hand glide: press the',
  'other hand or pull a trigger.',
  '',
  'Triggers select. RE-CENTER returns',
  'to the entry view. R = the radius',
  'that holds the whole simulation.',
  '',
  `build: ${XR_BUILD_TAG}`,
];

export class XrWristUi {
  private group = new THREE.Group();
  private buttons: WristButton[] = [];
  private hudPlane: THREE.Mesh;
  private hudTexture: THREE.CanvasTexture;
  private hudCanvas: HTMLCanvasElement;
  private lastHudKey = '';
  private helpPlane: THREE.Mesh | null = null;
  private helpVisible = false;
  private hovered: WristButton | null = null;
  private raycaster = new THREE.Raycaster();
  private disposables: (THREE.BufferGeometry | THREE.Material
    | THREE.Texture)[] = [];
  private selectListeners: {
    target: THREE.XRTargetRaySpace; fn: () => void;
  }[] = [];

  constructor(
    private input: XrInputRig,
    private camera: THREE.Camera,
    private wristHandedness: XrHandedness,
    actions: XrWristActions,
  ) {
    this.group.name = 'xr-wrist-ui';
    this.buttons = [
      this.buildButton('EXIT', '#c62828', 'exit',
        new THREE.Vector3(-0.055, 0.08, 0), 30),
      this.buildButton('RE-CENTER', '#159588', 'resetView',
        new THREE.Vector3(0, 0.098, 0), 19),
      this.buildButton('HELP', '#455a64', 'help',
        new THREE.Vector3(0.055, 0.08, 0), 30),
    ];

    this.hudCanvas = document.createElement('canvas');
    this.hudCanvas.width = 440;
    this.hudCanvas.height = 320;
    this.hudTexture = new THREE.CanvasTexture(this.hudCanvas);
    const hudGeometry = new THREE.PlaneGeometry(0.126, 0.092);
    const hudMaterial = new THREE.MeshBasicMaterial({
      map: this.hudTexture, transparent: true, depthTest: false,
    });
    this.hudPlane = new THREE.Mesh(hudGeometry, hudMaterial);
    // Above the button ring (buttons top out ~0.12) — the data
    // display overlapping the menu made both hard to use (Dustin).
    this.hudPlane.position.set(0, 0.185, 0);
    this.hudPlane.renderOrder = 9991;
    this.group.add(this.hudPlane);
    this.disposables.push(hudGeometry, hudMaterial, this.hudTexture);

    this.buildHelpPanel();

    // Trigger = select. Listen on BOTH slots — the pointer is simply
    // whichever hand is not the wrist.
    for (const c of input.controllers) {
      const fn = () => {
        if (this.hovered
            && c.handedness !== this.wristHandedness) {
          actions[this.hovered.action]();
        }
      };
      c.ray.addEventListener('selectstart', fn);
      this.selectListeners.push({ target: c.ray, fn });
    }
  }

  /** True while the pointer ray engages the cluster — world gestures
   *  must not start (input focus rules: one interaction at a time). */
  uiEngaged(): boolean {
    return this.hovered !== null;
  }

  /** HELP button action target (runtime wires it). */
  toggleHelp(): void {
    this.helpVisible = !this.helpVisible;
    if (this.helpPlane) this.helpPlane.visible = this.helpVisible;
  }

  isHelpVisible(): boolean { return this.helpVisible; }

  update(hud: XrNavHud): void {
    this.attachToWrist();
    if (this.group.parent) {
      // Billboard toward the wearer (world-space lookAt handles the
      // moving grip parent).
      const cameraWorld = new THREE.Vector3();
      this.camera.getWorldPosition(cameraWorld);
      this.group.lookAt(cameraWorld);
    }
    this.updateHover();
    const key = this.hudKey(hud);
    if (key !== this.lastHudKey) this.drawHud(hud, key);
  }

  dispose(): void {
    for (const l of this.selectListeners) {
      l.target.removeEventListener('selectstart', l.fn);
    }
    this.selectListeners = [];
    this.group.parent?.remove(this.group);
    for (const d of this.disposables) d.dispose();
    this.disposables = [];
  }

  // ------------------------------------------------------------------

  /** The wrist grip connects asynchronously — (re)attach when it
   *  appears or handedness flips. */
  private attachToWrist(): void {
    const wrist = this.input.byHand(this.wristHandedness);
    const grip = wrist && !wrist.isHand ? wrist.grip : null;
    if (grip && this.group.parent !== grip) {
      grip.add(this.group);
    } else if (!grip && this.group.parent) {
      this.group.parent.remove(this.group);
      this.hovered = null;
    }
  }

  private updateHover(): void {
    const previous = this.hovered;
    this.hovered = null;
    const pointer = this.input.byHand(
      this.wristHandedness === 'left' ? 'right' : 'left');
    if (this.group.parent && pointer && !pointer.isHand) {
      const origin = new THREE.Vector3();
      pointer.ray.getWorldPosition(origin);
      const quaternion = new THREE.Quaternion();
      pointer.ray.getWorldQuaternion(quaternion);
      const direction =
        new THREE.Vector3(0, 0, -1).applyQuaternion(quaternion);
      this.raycaster.set(origin, direction);
      // Reach is user-space meters — scale with the rig.
      const rigScale = this.group.getWorldScale(
        new THREE.Vector3()).x || 1;
      this.raycaster.far = RAY_REACH_M * rigScale;
      const hits = this.raycaster.intersectObjects(
        this.buttons.map(b => b.mesh), false);
      if (hits.length > 0) {
        this.hovered = this.buttons.find(
          b => b.mesh === hits[0].object) ?? null;
      }
    }
    if (previous !== this.hovered) {
      previous?.mesh.scale.setScalar(1);
      this.hovered?.mesh.scale.setScalar(HOVER_SCALE);
      if (this.hovered) {
        this.input.pulse(this.input.byHand(
          this.wristHandedness === 'left' ? 'right' : 'left'),
          0.15, 15);
      }
    }
  }

  private buildButton(label: string, background: string,
      action: keyof XrWristActions,
      position: THREE.Vector3, fontPx: number): WristButton {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = background;
    ctx.beginPath();
    ctx.arc(64, 64, 62, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${fontPx}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, 64, 64);

    const texture = new THREE.CanvasTexture(canvas);
    const geometry = new THREE.CircleGeometry(0.022, 24);
    const material = new THREE.MeshBasicMaterial({
      map: texture, transparent: true, depthTest: false,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = `xr-wrist-${action}`;
    mesh.position.copy(position);
    mesh.renderOrder = 9992;
    this.group.add(mesh);
    this.disposables.push(texture, geometry, material);
    return { mesh, action };
  }

  private buildHelpPanel(): void {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 680;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = 'rgba(20,28,38,0.92)';
    ctx.fillRect(0, 0, 512, 680);
    ctx.strokeStyle = '#5b8bb5';
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, 508, 676);
    ctx.fillStyle = '#e0f2f1';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    // Generous line height + bottom margin — the first cut clipped
    // the tail lines on-device.
    HELP_LINES.forEach((line, index) => {
      ctx.font = index === 0
        ? 'bold 30px sans-serif' : '23px sans-serif';
      ctx.fillText(line, 22, 20 + index * 29);
    });

    const texture = new THREE.CanvasTexture(canvas);
    const geometry = new THREE.PlaneGeometry(0.20, 0.266);
    const material = new THREE.MeshBasicMaterial({
      map: texture, transparent: true, depthTest: false,
      side: THREE.DoubleSide,
    });
    this.helpPlane = new THREE.Mesh(geometry, material);
    this.helpPlane.position.set(0, 0.375, 0);
    this.helpPlane.renderOrder = 9990;
    this.helpPlane.visible = false;
    this.group.add(this.helpPlane);
    this.disposables.push(texture, geometry, material);
  }

  /** Redraw only when a DISPLAYED value changes (quantized). */
  private hudKey(hud: XrNavHud): string {
    return [hud.state, hud.moveRadiiPerSec.toFixed(3),
      hud.distanceR.toFixed(2), hud.yawDeg.toFixed(1),
      hud.xR.toFixed(1), hud.yR.toFixed(1), hud.zR.toFixed(1),
      hud.zoom.toFixed(2),
      this.compact(hud.simRadius)].join('|');
  }

  private drawHud(hud: XrNavHud, key: string): void {
    this.lastHudKey = key;
    const ctx = this.hudCanvas.getContext('2d')!;
    ctx.clearRect(0, 0, 440, 320);
    ctx.fillStyle = 'rgba(33,33,33,0.78)';
    ctx.fillRect(0, 0, 440, 320);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    const zoomText = hud.zoom >= 1
      ? `×${hud.zoom >= 10 ? Math.round(hud.zoom)
        : hud.zoom.toFixed(1)}`
      : `÷${(1 / hud.zoom) >= 10 ? Math.round(1 / hud.zoom)
        : (1 / hud.zoom).toFixed(1)}`;

    // Position as a vector equation in R (Dustin's format), then the
    // yaw rotation matrix vs the ORIGINAL orientation. Every line is
    // length-checked against the 440px canvas (26px mono ≈ 28 chars).
    ctx.fillStyle = '#e0f2f1';
    ctx.font = '26px monospace';
    ctx.fillText(
      `${this.term(hud.xR, 'x', true)} ${this.term(hud.yR, 'y')} `
      + `${this.term(hud.zR, 'z')}  (R)`, 12, 24);
    const yaw = THREE.MathUtils.degToRad(hud.yawDeg);
    const c = Math.cos(yaw);
    const s = Math.sin(yaw);
    ctx.fillText(`rot ${hud.yawDeg >= 0 ? '+' : ''}`
      + `${hud.yawDeg.toFixed(1)}° vs start`, 12, 58);
    ctx.font = '22px monospace';
    ctx.fillStyle = '#9fb8c8';
    ctx.fillText(`[ ${this.m(c)} ${this.m(0)} ${this.m(s)} ]`,
      12, 90);
    ctx.fillText(`[ ${this.m(0)} ${this.m(1)} ${this.m(0)} ]`,
      12, 118);
    ctx.fillText(`[ ${this.m(-s)} ${this.m(0)} ${this.m(c)} ]`,
      12, 146);
    ctx.fillStyle = '#e0f2f1';
    ctx.font = '26px monospace';
    ctx.fillText(
      `dist ${hud.distanceR.toFixed(2)} R  zoom ${zoomText}`,
      12, 184);

    // The action line: what is happening right now.
    ctx.font = 'bold 28px monospace';
    if (hud.state === 'moving') {
      ctx.fillStyle = '#ffd54f';
      ctx.fillText(hud.moveRadiiPerSec > 0
        ? `moving ${hud.moveRadiiPerSec.toFixed(3)} R/s`
        : 'grabbing (zoom / rotate / drag)', 12, 228);
      ctx.font = '22px monospace';
      ctx.fillStyle = '#b0bec5';
      ctx.fillText('release = stop · trigger = cancel', 12, 268);
    } else {
      ctx.fillStyle = '#78909c';
      ctx.font = '22px monospace';
      ctx.fillText('grip or pad-click = move · HELP = how',
        12, 228);
      ctx.fillText(`R = ${this.compact(hud.simRadius)} world units`,
        12, 268);
    }
    this.hudTexture.needsUpdate = true;
  }

  /** One vector-equation term: '+5.0x' / '-7.2z' (leading term
   *  keeps its sign only when negative). */
  private term(value: number, axis: string, lead = false): string {
    const sign = value < 0 ? '-' : (lead ? '' : '+');
    return `${sign}${Math.abs(value).toFixed(1)}${axis}`;
  }

  /** Fixed-width rotation-matrix element. */
  private m(value: number): string {
    return (value < 0 ? '-' : ' ') + Math.abs(value).toFixed(2);
  }

  /** Compact number for the R display (1.2k / 3.4M when huge —
   *  a huge R is exactly what this line exists to expose). */
  private compact(value: number): string {
    if (!Number.isFinite(value)) return String(value);
    if (value >= 1e6) return (value / 1e6).toFixed(1) + 'M';
    if (value >= 1e3) return (value / 1e3).toFixed(1) + 'k';
    if (value >= 1) return value.toFixed(1);
    return value.toPrecision(2);
  }

  private r(value: number): string {
    return (value >= 0 ? '+' : '') + value.toFixed(1);
  }
}
