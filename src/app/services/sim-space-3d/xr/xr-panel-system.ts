/**
 * @xr
 * @module services/sim-space-3d/xr/xr-panel-system
 *
 * xr-3-min floating page-panels + the scrub rail, with the MINIMUM
 * target-based dispatch (WEBXR_PLAN.md):
 *
 *  - RUN + CONDITIONS spawn as HTMLMesh rasterizations of the REAL
 *    Angular components (mounted off-screen by the page under
 *    .xr-panel-context, reached via XrSurfaceProvider.getElement) —
 *    behavior parity is automatic; TRIGGER forwards pointer events
 *    (mousedown/-move/-up/click at the ray's UV) to the LIVE DOM.
 *  - SCRUB is the world-anchored canvas rail (update-heavy → the
 *    day-one canvas fallback); trigger press/hold drags the puck.
 *  - Panels are UI surfaces like the wrist ring: ray-hover glows the
 *    frame, uiEngaged() blocks world gestures while hovering/holding,
 *    ONE-grip drag on a hovered quad repositions it (press-time
 *    target owns the gesture until release). Two-grip resize,
 *    distance-grab, tiling: full xr-3.
 *  - Each quad carries a ✕; its ring item toggles. World placements
 *    persist per mode via the XrInterfaceVariant merge and are
 *    restored on spawn. Measured rasterization cost is recorded in
 *    the variant (res-3 idiom — the canvas-fallback knob's evidence).
 *
 * Everything here lives in the scene as ONE group ('xr-panel-layer')
 * that dispose() removes wholesale — the byte-identical-exit
 * guarantee extends to panels.
 */

import * as THREE from 'three';
import { HTMLMesh } from 'three/examples/jsm/interactive/HTMLMesh.js';

import type {
  XrPanelPlacement, XrSurfaceProvider,
} from '@models/xr/xr-surface-model';
import type { XrVariantConfig } from '@models/xr/xr-types';
import type { XrControllerHandle, XrInputRig } from './xr-input-rig';
import { XrScrubRail } from './xr-scrub-rail';

export interface XrPanelSystemOptions {
  placements: Record<string, XrPanelPlacement>;
  persistPatch?: (patch: Partial<XrVariantConfig>) => void;
  /** True while the wrist cluster owns the pointer — panel dispatch
   *  then stands down (one interaction at a time). */
  isWristEngaged: () => boolean;
  /** A quad grab just started — the runtime kills any world gesture
   *  that slipped in on the same frame (press-time target owns the
   *  gesture, exclusively). */
  onGrabStart?: () => void;
}

type TargetKind = 'quad' | 'close' | 'rail';

interface RayTarget {
  kind: TargetKind;
  contentRef: string;
  uv: THREE.Vector2;
}

interface OpenQuad {
  contentRef: string;
  root: THREE.Group;
  mesh: THREE.Mesh;          // HTMLMesh or the rail plane
  html: HTMLMesh | null;     // null for the rail
  element: HTMLElement | null;
  close: THREE.Mesh;
  frame: THREE.Mesh;
  lastSize: { w: number; h: number };
}

/** User-space spawn offsets (scaled by rig scale): panels front-left/
 *  front-right at reading distance, the rail lower center. */
const SPAWN: Record<string, { forward: number; right: number;
    up: number }> = {
  'panel:run': { forward: 1.35, right: -0.42, up: 0.05 },
  'panel:conditions': { forward: 1.35, right: 0.42, up: 0.05 },
  'scrub-rail': { forward: 1.1, right: 0, up: -0.38 },
};
const SPAWN_DEFAULT = { forward: 1.3, right: 0, up: 0 };
/** Ray reach for panel targeting, user-space meters. */
const RAY_REACH_M = 6;
/** Element size re-check cadence (frames) — HTMLMesh's texture size
 *  is frozen at first capture, so growth needs a rebuild. */
const SIZE_CHECK_INTERVAL = 45;

export class XrPanelSystem {
  private group = new THREE.Group();
  private quads = new Map<string, OpenQuad>();
  private rail: XrScrubRail | null = null;
  private raycaster = new THREE.Raycaster();
  private hover = new Map<number, RayTarget | null>();
  private triggerHeld = new Map<number, RayTarget>();
  private prevNavHeld = new Map<number, boolean>();
  private drag: {
    handle: XrControllerHandle; quad: OpenQuad;
  } | null = null;
  private placements: Record<string, XrPanelPlacement>;
  private rasterMs: Record<string, number> = {};
  private rasterPersisted = new Set<string>();
  private frameCount = 0;
  private selectListeners: { target: THREE.XRTargetRaySpace;
    start: () => void; end: () => void; }[] = [];

  constructor(
    private scene: THREE.Scene,
    private rig: THREE.Group,
    private camera: THREE.Camera,
    private input: XrInputRig,
    private surfaces: XrSurfaceProvider,
    private options: XrPanelSystemOptions,
  ) {
    this.group.name = 'xr-panel-layer';
    this.placements = { ...options.placements };
    scene.add(this.group);

    for (const handle of input.controllers) {
      const start = () => this.onSelectStart(handle);
      const end = () => this.onSelectEnd(handle);
      handle.ray.addEventListener('selectstart', start);
      handle.ray.addEventListener('selectend', end);
      this.selectListeners.push({ target: handle.ray, start, end });
    }
  }

  // ------------------------------------------------------------------
  // Ring-item API
  // ------------------------------------------------------------------

  /** Toggle the quad for a surface-model content ref ('panel:<id>' or
   *  'scrub-rail'). No-ops (honestly logged) when the live element is
   *  not available. */
  toggle(contentRef: string): void {
    if (this.quads.has(contentRef)) {
      this.dismiss(contentRef);
      return;
    }
    if (contentRef === 'scrub-rail') {
      this.spawnRail();
      return;
    }
    this.spawnPanel(contentRef);
  }

  isOpen(contentRef: string): boolean {
    return this.quads.has(contentRef);
  }

  /** True while any panel surface owns the pointer or a gesture —
   *  world navigation must not start (input focus rules). */
  uiEngaged(): boolean {
    if (this.drag || this.triggerHeld.size > 0) return true;
    for (const target of this.hover.values()) {
      if (target) return true;
    }
    return false;
  }

  // ------------------------------------------------------------------
  // Frame update
  // ------------------------------------------------------------------

  update(): void {
    this.frameCount++;
    this.rail?.update();
    if (this.frameCount % SIZE_CHECK_INTERVAL === 0) {
      this.rebuildResizedPanels();
    }
    this.updateHover();
    this.updateDrag();
    this.updateHeldTriggers();
    this.updateFrames();
  }

  dispose(): void {
    for (const l of this.selectListeners) {
      l.target.removeEventListener('selectstart', l.start);
      l.target.removeEventListener('selectend', l.end);
    }
    this.selectListeners = [];
    for (const contentRef of Array.from(this.quads.keys())) {
      this.disposeQuad(contentRef);
    }
    this.scene.remove(this.group);
  }

  // ------------------------------------------------------------------
  // Spawning
  // ------------------------------------------------------------------

  private spawnPanel(contentRef: string): void {
    const id = contentRef.replace(/^panel:/, '');
    const def = this.surfaces.panels.find(p => p.id === id);
    const element = def?.getElement() ?? null;
    if (!element) {
      console.warn(`[xr-panels] no live element for "${contentRef}"`
        + ' — panel not spawned');
      return;
    }
    const t0 = performance.now();
    const html = new HTMLMesh(element);
    const ms = performance.now() - t0;
    html.material.side = THREE.DoubleSide;
    this.recordRasterCost(id, ms);
    this.mountQuad(contentRef, html, html, element);
  }

  private spawnRail(): void {
    this.rail = new XrScrubRail(this.surfaces);
    this.mountQuad('scrub-rail', this.rail.mesh, null, null);
  }

  private mountQuad(contentRef: string, mesh: THREE.Mesh,
      html: HTMLMesh | null, element: HTMLElement | null): void {
    const root = new THREE.Group();
    root.name = `xr-panel-${contentRef}`;
    root.add(mesh);

    const size = this.quadSize(mesh);
    const frame = this.buildFrame(size.w, size.h);
    const close = this.buildClose(size.w, size.h);
    root.add(frame, close);

    this.applyPlacement(root, contentRef);
    this.group.add(root);
    this.quads.set(contentRef, {
      contentRef, root, mesh, html, element, close, frame,
      lastSize: element
        ? { w: element.offsetWidth, h: element.offsetHeight }
        : { w: 0, h: 0 },
    });
  }

  /** Local (unscaled) plane size of a quad mesh. */
  private quadSize(mesh: THREE.Mesh): { w: number; h: number } {
    const geometry = mesh.geometry as THREE.PlaneGeometry;
    const p = geometry.parameters as { width: number; height: number };
    return { w: p.width, h: p.height };
  }

  private buildFrame(w: number, h: number): THREE.Mesh {
    const geometry = new THREE.PlaneGeometry(w + 0.05, h + 0.05);
    const material = new THREE.MeshBasicMaterial({
      color: 0x1976d2, transparent: true, opacity: 0.5,
      side: THREE.DoubleSide,
    });
    const frame = new THREE.Mesh(geometry, material);
    frame.name = 'xr-panel-frame';
    frame.position.z = -0.004;
    frame.visible = false;
    return frame;
  }

  private buildClose(w: number, h: number): THREE.Mesh {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#c62828';
    ctx.beginPath();
    ctx.arc(32, 32, 30, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(20, 20); ctx.lineTo(44, 44);
    ctx.moveTo(44, 20); ctx.lineTo(20, 44);
    ctx.stroke();
    const texture = new THREE.CanvasTexture(canvas);
    const geometry = new THREE.CircleGeometry(0.024, 24);
    const material = new THREE.MeshBasicMaterial({
      map: texture, transparent: true, side: THREE.DoubleSide,
    });
    const close = new THREE.Mesh(geometry, material);
    close.name = 'xr-panel-close';
    close.position.set(w / 2 + 0.035, h / 2 + 0.02, 0.002);
    return close;
  }

  /** Persisted world placement wins; otherwise spawn in front of the
   *  wearer at reading distance, facing them, at rig scale (HTMLMesh
   *  is 1mm/px in local units — rig scale makes that user-space). */
  private applyPlacement(root: THREE.Group, contentRef: string): void {
    const saved = this.placements[contentRef];
    if (saved) {
      root.position.set(...saved.position);
      root.rotation.set(0, saved.yaw, 0);
      root.scale.setScalar(saved.scale);
      return;
    }
    const rigScale = this.rig.scale.x || 1;
    const offsets = SPAWN[contentRef] ?? SPAWN_DEFAULT;
    const head = new THREE.Vector3();
    this.camera.getWorldPosition(head);
    const headQuat = new THREE.Quaternion();
    this.camera.getWorldQuaternion(headQuat);
    const forward = new THREE.Vector3(0, 0, -1)
      .applyQuaternion(headQuat);
    forward.y = 0;
    if (forward.lengthSq() < 1e-6) forward.set(0, 0, -1);
    forward.normalize();
    const right = new THREE.Vector3(forward.z, 0, -forward.x);

    root.position.copy(head)
      .addScaledVector(forward, offsets.forward * rigScale)
      .addScaledVector(right, offsets.right * rigScale)
      .add(new THREE.Vector3(0, offsets.up * rigScale, 0));
    root.rotation.set(0, Math.atan2(
      head.x - root.position.x, head.z - root.position.z), 0);
    root.scale.setScalar(rigScale);
  }

  private dismiss(contentRef: string): void {
    this.disposeQuad(contentRef);
  }

  private disposeQuad(contentRef: string): void {
    const quad = this.quads.get(contentRef);
    if (!quad) return;
    if (this.drag?.quad === quad) this.drag = null;
    for (const [index, held] of Array.from(this.triggerHeld)) {
      if (held.contentRef === contentRef) this.triggerHeld.delete(index);
    }
    this.quads.delete(contentRef);
    this.group.remove(quad.root);
    quad.html?.dispose();
    if (contentRef === 'scrub-rail') {
      this.rail?.dispose();
      this.rail = null;
    }
    quad.frame.geometry.dispose();
    (quad.frame.material as THREE.Material).dispose();
    quad.close.geometry.dispose();
    const closeMaterial = quad.close.material as THREE.MeshBasicMaterial;
    closeMaterial.map?.dispose();
    closeMaterial.dispose();
  }

  /** HTMLMesh freezes its texture canvas at first capture — content
   *  that grew (a run list loading, an accordion opening) would clip.
   *  Rebuild the mesh in place when the live element's size changed;
   *  the root keeps the pose. */
  private rebuildResizedPanels(): void {
    for (const quad of this.quads.values()) {
      if (!quad.element || !quad.html) continue;
      const w = quad.element.offsetWidth;
      const h = quad.element.offsetHeight;
      if (Math.abs(w - quad.lastSize.w) <= 2
          && Math.abs(h - quad.lastSize.h) <= 2) continue;
      quad.lastSize = { w, h };
      quad.root.remove(quad.mesh);
      quad.html.dispose();
      const t0 = performance.now();
      const html = new HTMLMesh(quad.element);
      this.recordRasterCost(
        quad.contentRef.replace(/^panel:/, ''),
        performance.now() - t0);
      html.material.side = THREE.DoubleSide;
      quad.mesh = html;
      quad.html = html;
      quad.root.add(html);
      const size = this.quadSize(html);
      quad.close.position.set(
        size.w / 2 + 0.035, size.h / 2 + 0.02, 0.002);
      quad.frame.geometry.dispose();
      quad.frame.geometry =
        new THREE.PlaneGeometry(size.w + 0.05, size.h + 0.05);
    }
  }

  /** res-3 idiom: the measured cost is the canvas-fallback knob's
   *  evidence — persisted once per panel per session. */
  private recordRasterCost(id: string, ms: number): void {
    this.rasterMs[id] = Math.round(ms * 10) / 10;
    if (this.rasterPersisted.has(id)) return;
    this.rasterPersisted.add(id);
    this.options.persistPatch?.({
      panel_raster_ms: { ...this.rasterMs },
    });
  }

  // ------------------------------------------------------------------
  // Hover + dispatch
  // ------------------------------------------------------------------

  private interactive(): THREE.Mesh[] {
    const meshes: THREE.Mesh[] = [];
    for (const quad of this.quads.values()) {
      meshes.push(quad.mesh, quad.close);
    }
    return meshes;
  }

  private targetOf(mesh: THREE.Object3D, uv: THREE.Vector2 | undefined):
      RayTarget | null {
    for (const quad of this.quads.values()) {
      if (mesh === quad.close) {
        return { kind: 'close', contentRef: quad.contentRef,
          uv: uv ?? new THREE.Vector2() };
      }
      if (mesh === quad.mesh) {
        return {
          kind: quad.contentRef === 'scrub-rail' ? 'rail' : 'quad',
          contentRef: quad.contentRef,
          uv: uv ?? new THREE.Vector2(),
        };
      }
    }
    return null;
  }

  private castRay(handle: XrControllerHandle): RayTarget | null {
    if (handle.isHand || handle.handedness === 'none') return null;
    const origin = new THREE.Vector3();
    handle.ray.getWorldPosition(origin);
    const quaternion = new THREE.Quaternion();
    handle.ray.getWorldQuaternion(quaternion);
    const direction =
      new THREE.Vector3(0, 0, -1).applyQuaternion(quaternion);
    this.raycaster.set(origin, direction);
    this.raycaster.far = RAY_REACH_M * (this.rig.scale.x || 1);
    const hits = this.raycaster.intersectObjects(
      this.interactive(), false);
    if (hits.length === 0) return null;
    return this.targetOf(hits[0].object, hits[0].uv);
  }

  private updateHover(): void {
    for (const handle of this.input.controllers) {
      const previous = this.hover.get(handle.index) ?? null;
      const target = this.options.isWristEngaged()
        ? null : this.castRay(handle);
      this.hover.set(handle.index, target);
      // Forward mousemove to the live DOM so hover styles track the
      // ray (HTMLMesh maps UV → element coordinates).
      if (target?.kind === 'quad') {
        this.forwardDomEvent(target, 'mousemove');
      }
      if ((previous?.contentRef ?? null)
          !== (target?.contentRef ?? null)) {
        if (target) this.input.pulse(handle, 0.1, 10);
      }
    }
  }

  /** Press-time-target grip dispatch: a grip (or pad) press that
   *  lands while this controller's ray is on a quad GRABS that quad
   *  until release; empty-space grips stay world navigation (the
   *  runtime's focus gate reads uiEngaged()). */
  private updateDrag(): void {
    for (const handle of this.input.controllers) {
      const held = handle.gripPressed || handle.padPressed;
      const wasHeld = this.prevNavHeld.get(handle.index) ?? false;
      this.prevNavHeld.set(handle.index, held);

      if (held && !wasHeld && !this.drag) {
        const target = this.hover.get(handle.index);
        if (target && target.kind !== 'close') {
          const quad = this.quads.get(target.contentRef);
          if (quad) {
            this.drag = { handle, quad };
            // three's attach preserves the world transform — the quad
            // rides the grip until release.
            handle.grip.attach(quad.root);
            this.input.pulse(handle, 0.3, 25);
            this.options.onGrabStart?.();
          }
        }
      }

      if (this.drag && this.drag.handle === handle && !held) {
        this.dropDraggedQuad();
      }
    }
  }

  /** Release: re-anchor in the world, flatten to an upright yaw-only
   *  pose (readability — the horizon rule extends to pages), persist. */
  private dropDraggedQuad(): void {
    const { quad } = this.drag!;
    this.drag = null;
    this.group.attach(quad.root);
    const position = new THREE.Vector3();
    quad.root.getWorldPosition(position);
    const quaternion = new THREE.Quaternion();
    quad.root.getWorldQuaternion(quaternion);
    const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(quaternion);
    const yaw = Math.atan2(normal.x, normal.z);
    const scale = quad.root.getWorldScale(new THREE.Vector3()).x;
    quad.root.position.copy(position);
    quad.root.rotation.set(0, yaw, 0);
    quad.root.scale.setScalar(scale);

    this.placements[quad.contentRef] = {
      position: [position.x, position.y, position.z], yaw, scale,
    };
    this.options.persistPatch?.({
      panel_placements: { ...this.placements },
    });
  }

  private onSelectStart(handle: XrControllerHandle): void {
    if (this.options.isWristEngaged()) return;
    const target = this.castRay(handle);
    if (!target) return;
    if (target.kind === 'close') {
      this.dismiss(target.contentRef);
      return;
    }
    this.triggerHeld.set(handle.index, target);
    if (target.kind === 'rail') {
      this.rail?.scrubAtUv(target.uv.x);
    } else {
      this.forwardDomEvent(target, 'mousedown');
    }
  }

  private onSelectEnd(handle: XrControllerHandle): void {
    const pressed = this.triggerHeld.get(handle.index);
    if (!pressed) return;
    this.triggerHeld.delete(handle.index);
    if (pressed.kind === 'rail') return;
    // Release on the CURRENT point when still on the same quad (drag
    // semantics for the live DOM), else on the press point.
    const now = this.castRay(handle);
    const at = (now && now.contentRef === pressed.contentRef)
      ? now : pressed;
    this.forwardDomEvent(at, 'mouseup');
    this.forwardDomEvent(at, 'click');
  }

  /** Held triggers keep driving their press-time target (rail puck
   *  drag; mousemove for in-panel press-drag). */
  private updateHeldTriggers(): void {
    for (const [index, pressed] of this.triggerHeld) {
      const handle = this.input.controllers
        .find(c => c.index === index);
      if (!handle) continue;
      const now = this.castRay(handle);
      if (!now || now.contentRef !== pressed.contentRef) continue;
      if (pressed.kind === 'rail') {
        this.rail?.scrubAtUv(now.uv.x);
      }
    }
  }

  private updateFrames(): void {
    const hovered = new Set<string>();
    for (const target of this.hover.values()) {
      if (target) hovered.add(target.contentRef);
    }
    for (const quad of this.quads.values()) {
      const dragging = this.drag?.quad === quad;
      quad.frame.visible = dragging || hovered.has(quad.contentRef);
      (quad.frame.material as THREE.MeshBasicMaterial).opacity =
        dragging ? 0.85 : 0.5;
    }
  }

  private forwardDomEvent(target: RayTarget,
      type: 'mousedown' | 'mousemove' | 'mouseup' | 'click'): void {
    const quad = this.quads.get(target.contentRef);
    if (!quad?.html) return;
    quad.html.dispatchEvent({
      type,
      data: { x: target.uv.x, y: 1 - target.uv.y },
    } as any);
  }
}
