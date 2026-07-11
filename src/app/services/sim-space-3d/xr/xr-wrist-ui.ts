/**
 * @xr
 * @module services/sim-space-3d/xr/xr-wrist-ui
 *
 * The ring-0 seed (xr-2): a minimal wrist-anchored button cluster —
 * EXIT (never paginated away; one of the three always-reachable exit
 * paths), HOME (reset view — the "I'm lost" escape) and BACK (the
 * navigation history) — plus the subtle scale indicator (current zoom
 * vs the space default) so deep zooms stay oriented. xr-3 grows this
 * anchor into the full tiered radial-menu system; the exit item stays
 * pinned on ring 0 by contract.
 *
 * Interaction: point the OTHER controller's ray at a button and pull
 * the TRIGGER (triggers select; grips never click). While the ray
 * hovers the cluster, world navigation is input-focus-blocked — one
 * interaction at a time. Handedness is a knob (left wrist assumes a
 * right-hand pointer).
 */

import * as THREE from 'three';

import type { XrHandedness, XrInputRig } from './xr-input-rig';

export interface XrWristActions {
  exit: () => void;
  resetView: () => void;
  back: () => void;
}

interface WristButton {
  mesh: THREE.Mesh;
  action: keyof XrWristActions;
}

const HOVER_SCALE = 1.18;
const RAY_REACH_M = 1.5;

export class XrWristUi {
  private group = new THREE.Group();
  private buttons: WristButton[] = [];
  private zoomPlane: THREE.Mesh;
  private zoomTexture: THREE.CanvasTexture;
  private zoomCanvas: HTMLCanvasElement;
  private lastZoomDrawn = 0;
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
        new THREE.Vector3(-0.055, 0.08, 0)),
      this.buildButton('HOME', '#159588', 'resetView',
        new THREE.Vector3(0, 0.098, 0)),
      this.buildButton('BACK', '#455a64', 'back',
        new THREE.Vector3(0.055, 0.08, 0)),
    ];

    this.zoomCanvas = document.createElement('canvas');
    this.zoomCanvas.width = 256;
    this.zoomCanvas.height = 72;
    this.zoomTexture = new THREE.CanvasTexture(this.zoomCanvas);
    const zoomGeometry = new THREE.PlaneGeometry(0.085, 0.024);
    const zoomMaterial = new THREE.MeshBasicMaterial({
      map: this.zoomTexture, transparent: true, depthTest: false,
    });
    this.zoomPlane = new THREE.Mesh(zoomGeometry, zoomMaterial);
    this.zoomPlane.position.set(0, 0.048, 0);
    this.zoomPlane.renderOrder = 9991;
    this.group.add(this.zoomPlane);
    this.disposables.push(zoomGeometry, zoomMaterial, this.zoomTexture);
    this.drawZoom(1);

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

  update(zoomFactor: number): void {
    this.attachToWrist();
    if (this.group.parent) {
      // Billboard toward the wearer (world-space lookAt handles the
      // moving grip parent).
      const cameraWorld = new THREE.Vector3();
      this.camera.getWorldPosition(cameraWorld);
      this.group.lookAt(cameraWorld);
    }
    this.updateHover();
    if (Math.abs(zoomFactor - this.lastZoomDrawn)
        > 0.02 * Math.max(this.lastZoomDrawn, 1e-9)) {
      this.drawZoom(zoomFactor);
    }
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
      position: THREE.Vector3): WristButton {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = background;
    ctx.beginPath();
    ctx.arc(64, 64, 62, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 30px sans-serif';
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

  private drawZoom(zoomFactor: number): void {
    this.lastZoomDrawn = zoomFactor;
    const ctx = this.zoomCanvas.getContext('2d')!;
    ctx.clearRect(0, 0, 256, 72);
    ctx.fillStyle = 'rgba(33,33,33,0.75)';
    ctx.fillRect(0, 0, 256, 72);
    ctx.fillStyle = '#e0f2f1';
    ctx.font = '44px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const text = zoomFactor >= 1
      ? `zoom ×${zoomFactor >= 10
          ? Math.round(zoomFactor) : zoomFactor.toFixed(1)}`
      : `zoom ÷${(1 / zoomFactor) >= 10
          ? Math.round(1 / zoomFactor) : (1 / zoomFactor).toFixed(1)}`;
    ctx.fillText(text, 128, 36);
    this.zoomTexture.needsUpdate = true;
  }
}
