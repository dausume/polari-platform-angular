/**
 * @xr
 * @module services/sim-space-3d/xr/xr-wrist-ui
 *
 * The ring-0 seed (xr-2, labels per Dustin 2026-07-12): a minimal
 * wrist-anchored cluster — EXIT (never paginated away; one of the
 * three always-reachable exit paths), RE-CENTER (back to the entry
 * view; "Home" implied a home page, i.e. exiting) and HELP (how to
 * move/zoom under the deferred-commit model) — plus the HUD panel:
 * position and distance from the sim center in SIM RADII, current
 * zoom, and, while a gesture is planning, WHAT the release will do
 * ("MOVE 0.8 R" / "ZOOM ×2.3") — the reference that keeps movement
 * legible. xr-3 grows this anchor into the full tiered radial-menu
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

const HELP_LINES = [
  'HOW TO MOVE',
  '',
  'Hold ONE grip: aim a move — the HUD',
  'shows how many R (sim radii) it is.',
  'RELEASE the grip to go; you glide',
  'there over a moment.',
  '',
  'Hold TWO grips: stretch apart = zoom',
  'in, together = out; twist = rotate;',
  'drag = move. Release either grip to',
  'confirm.',
  '',
  'Cancel while holding: pull a TRIGGER',
  '(or press the other grip during a',
  'one-hand move).',
  '',
  'Triggers select. RE-CENTER returns',
  'to the entry view. R = the radius',
  'that holds the whole simulation.',
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
    this.hudCanvas.width = 320;
    this.hudCanvas.height = 168;
    this.hudTexture = new THREE.CanvasTexture(this.hudCanvas);
    const hudGeometry = new THREE.PlaneGeometry(0.104, 0.055);
    const hudMaterial = new THREE.MeshBasicMaterial({
      map: this.hudTexture, transparent: true, depthTest: false,
    });
    this.hudPlane = new THREE.Mesh(hudGeometry, hudMaterial);
    this.hudPlane.position.set(0, 0.036, 0);
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
    canvas.height = 560;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = 'rgba(20,28,38,0.92)';
    ctx.fillRect(0, 0, 512, 560);
    ctx.strokeStyle = '#5b8bb5';
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, 508, 556);
    ctx.fillStyle = '#e0f2f1';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    HELP_LINES.forEach((line, index) => {
      ctx.font = index === 0
        ? 'bold 30px sans-serif' : '24px sans-serif';
      ctx.fillText(line, 22, 18 + index * 27);
    });

    const texture = new THREE.CanvasTexture(canvas);
    const geometry = new THREE.PlaneGeometry(0.20, 0.219);
    const material = new THREE.MeshBasicMaterial({
      map: texture, transparent: true, depthTest: false,
      side: THREE.DoubleSide,
    });
    this.helpPlane = new THREE.Mesh(geometry, material);
    this.helpPlane.position.set(0, 0.245, 0);
    this.helpPlane.renderOrder = 9990;
    this.helpPlane.visible = false;
    this.group.add(this.helpPlane);
    this.disposables.push(texture, geometry, material);
  }

  /** Redraw only when a DISPLAYED value changes (quantized). */
  private hudKey(hud: XrNavHud): string {
    return [hud.state,
      hud.plan ? `${hud.plan.kind}:${hud.plan.moveRadii.toFixed(2)}`
        + `:${hud.plan.zoomFactor.toFixed(2)}` : '-',
      hud.distanceR.toFixed(2),
      hud.xR.toFixed(1), hud.yR.toFixed(1), hud.zR.toFixed(1),
      hud.zoom.toFixed(2)].join('|');
  }

  private drawHud(hud: XrNavHud, key: string): void {
    this.lastHudKey = key;
    const ctx = this.hudCanvas.getContext('2d')!;
    ctx.clearRect(0, 0, 320, 168);
    ctx.fillStyle = 'rgba(33,33,33,0.78)';
    ctx.fillRect(0, 0, 320, 168);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    const zoomText = hud.zoom >= 1
      ? `×${hud.zoom >= 10 ? Math.round(hud.zoom)
        : hud.zoom.toFixed(1)}`
      : `÷${(1 / hud.zoom) >= 10 ? Math.round(1 / hud.zoom)
        : (1 / hud.zoom).toFixed(1)}`;

    ctx.fillStyle = '#e0f2f1';
    ctx.font = '30px monospace';
    ctx.fillText(
      `pos ${this.r(hud.xR)} ${this.r(hud.yR)} ${this.r(hud.zR)} R`,
      12, 26);
    ctx.fillText(
      `dist ${hud.distanceR.toFixed(1)} R   zoom ${zoomText}`,
      12, 62);

    // The action line: what a release WILL do / what is happening.
    ctx.font = 'bold 34px monospace';
    if (hud.state === 'planning' && hud.plan) {
      ctx.fillStyle = '#ffd54f';
      const plan = hud.plan;
      const zoomPart = Math.abs(Math.log2(plan.zoomFactor)) > 0.03
        ? ` zoom ${plan.zoomFactor >= 1
          ? '×' + plan.zoomFactor.toFixed(1)
          : '÷' + (1 / plan.zoomFactor).toFixed(1)}` : '';
      const movePart = plan.moveRadii > 0.005
        ? ` move ${plan.moveRadii.toFixed(2)} R` : '';
      ctx.fillText(
        (plan.kind === 'zoom' ? 'GRAB:' : 'AIM:')
        + (zoomPart + movePart || ' (too small)'), 12, 106);
      ctx.font = '24px monospace';
      ctx.fillStyle = '#b0bec5';
      ctx.fillText('release = go · trigger = cancel', 12, 142);
    } else if (hud.state === 'travelling') {
      ctx.fillStyle = '#80cbc4';
      ctx.fillText(
        `travelling… ${hud.travelRemainingS.toFixed(1)}s`, 12, 106);
    } else {
      ctx.fillStyle = '#78909c';
      ctx.font = '24px monospace';
      ctx.fillText('grip = aim a move · HELP for how',
        12, 106);
    }
    this.hudTexture.needsUpdate = true;
  }

  private r(value: number): string {
    return (value >= 0 ? '+' : '') + value.toFixed(1);
  }
}
