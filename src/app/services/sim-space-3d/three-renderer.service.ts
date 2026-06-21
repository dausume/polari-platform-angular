/**
 * @cross-cutting
 * @tags @xc:render-3d
 * @consumers
 *   - SimSpaceRendererFactory (instantiated when a SimSpaceDefinition has dimensionality='3d')
 *   - SimSpaceViewer (via the shared interface)
 * @impact-on-edit
 *   This is the only file outside `sim-space-3d/` allowed to import `three`.
 *   Adding a new method to the SimSpaceRenderer interface mid-Phase-2
 *   means the abstraction had a leak — investigate before merging.
 * @see /OVERLAP_MAP.md
 *
 * Three.js implementation of SimSpaceRenderer — lifecycle + reconciliation
 * only. Geometry, materials, and the corner gizmo live in sibling files:
 *   - three-geometry-builders.ts   primitive geometry factories
 *   - three-material-builders.ts   material factories + fallback
 *   - three-view-helper-setup.ts   ViewHelper mount/dismount
 *   - controls/cad-controls.ts     CAD-style nav (pan/orbit/zoom/snap)
 *
 * Lazy-loaded — the renderer-factory uses dynamic import so `three` only
 * enters the user's bundle when a 3D SimSpace is actually opened.
 */

import { Injectable } from '@angular/core';
import * as THREE from 'three';

import {
  SimSpaceObject,
  SimSpaceConnection,
  SimSpaceDefinitionPayload,
  SimSpaceScreenPosition,
} from '@models/sim-space/sim-space-types';
import {
  SimSpaceRenderer,
  SimSpacePickResult,
  SimSpaceTransformPatch,
} from '@services/sim-space/sim-space-renderer.interface';
import { Mesh3DLibraryService } from './mesh-3d-library.service';
import { Material3DLibraryService } from './material-3d-library.service';
import { CADControls } from './controls/cad-controls';
import { buildGeometry } from './three-geometry-builders';
import { buildMaterial } from './three-material-builders';
import { mountViewHelper, ViewHelperRig } from './three-view-helper-setup';
import { transformForAnchor } from '@services/sim-space-2d/d3-utils';

/** Hover highlight bump — applied MULTIPLICATIVELY to a mesh's base scale. */
const HIGHLIGHT_FACTOR = 1.15;

@Injectable()
export class ThreeSimSpaceRenderer implements SimSpaceRenderer {
  private host?: HTMLElement;
  private renderer?: THREE.WebGLRenderer;
  private scene?: THREE.Scene;
  private camera?: THREE.PerspectiveCamera | THREE.OrthographicCamera;
  private controls?: CADControls;
  private viewHelperRig?: ViewHelperRig;
  private clock = new THREE.Clock();
  private raycaster = new THREE.Raycaster();
  private animationFrameId: number | null = null;
  /** Gates the render loop — set false by destroy() so the (reschedule-first)
   *  loop stops instead of spinning forever after teardown. */
  private looping = false;
  /** Keeps the canvas sized to its container as the layout settles. Without
   *  it the WebGL canvas is stuck at whatever size the host had at attach
   *  time (often 0/wrong before the viewer finishes laying out), so the
   *  scene only appears/animates after an interaction (orbit) happens to
   *  fire onHostResize. */
  private resizeObserver: ResizeObserver | null = null;

  private definition?: SimSpaceDefinitionPayload;
  private currentObjects = new Map<string, SimSpaceObject>();
  private meshes = new Map<string, THREE.Object3D>();
  private currentConnections = new Map<string, SimSpaceConnection>();
  private connectionLines = new Map<string, THREE.Line>();

  private overlays = new Map<
    string,
    { el: HTMLElement; anchor: 'center' | 'top' | 'right' | 'bottom' | 'left' }
  >();

  private hoveredId: string | null = null;
  private onClick?: (result: SimSpacePickResult) => void;
  private onHoverChange?: (id: string | null) => void;
  private onTransformChange?: (id: string, patch: SimSpaceTransformPatch) => void;
  private onViewChange?: () => void;

  constructor(
    private meshLib: Mesh3DLibraryService,
    private materialLib: Material3DLibraryService
  ) {}

  // -------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------

  attach(host: HTMLElement): void {
    if (this.renderer) {
      throw new Error('ThreeSimSpaceRenderer already attached — destroy() first.');
    }
    this.host = host;
    const { width, height } = this.hostBox();

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xf5f5f5);
    this.installDefaultSceneFurniture();

    this.camera = new THREE.PerspectiveCamera(60, width / Math.max(height, 1), 0.1, 1000);
    this.camera.position.set(5, 5, 5);
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(width, height);
    // autoClear OFF — we render the main scene AND the ViewHelper each
    // frame using the same WebGLRenderer. With autoClear=true the second
    // render call clears the full framebuffer before drawing the corner
    // gizmo, blanking the main scene. We clear manually at frame start.
    this.renderer.autoClear = false;
    host.appendChild(this.renderer.domElement);
    this.renderer.domElement.style.display = 'block';

    this.controls = new CADControls({
      domElement: this.renderer.domElement,
      camera: this.camera,
      scene: this.scene,
      onCameraSwapped: (next) => {
        this.camera = next;
        if (this.viewHelperRig) {
          (this.viewHelperRig.helper as any).editorCamera = next;
        }
        this.onHostResize();
      },
    });
    this.controls.orbit.addEventListener('change', () => {
      this.onViewChange?.();
      this.repositionOverlays();
    });

    this.viewHelperRig = mountViewHelper(host, this.camera, this.controls);

    this.renderer.domElement.addEventListener('click', this.handleClick);
    this.renderer.domElement.addEventListener('mousemove', this.handleMouseMove);

    // Re-fit the canvas whenever the host element resizes — covers the
    // initial layout settling (host starts at 0/wrong size) and later
    // panel/sidebar/scrubber reflows, so the scene renders correctly
    // without needing a manual orbit/scroll nudge.
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.onHostResize());
      this.resizeObserver.observe(host);
    }

    this.startLoop();
  }

  destroy(): void {
    if (!this.renderer) return;
    this.looping = false;
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.renderer.domElement.removeEventListener('click', this.handleClick);
    this.renderer.domElement.removeEventListener('mousemove', this.handleMouseMove);
    this.controls?.dispose();
    this.viewHelperRig?.dispose();
    this.viewHelperRig = undefined;
    this.meshes.forEach(obj => this.disposeObject3D(obj));
    this.connectionLines.forEach(line => this.disposeObject3D(line));
    this.meshes.clear();
    this.connectionLines.clear();
    this.renderer.dispose();
    this.renderer.domElement.parentNode?.removeChild(this.renderer.domElement);
    this.renderer = undefined;
    this.scene = undefined;
    this.camera = undefined;
    this.controls = undefined;
    this.currentObjects.clear();
    this.currentConnections.clear();
    this.overlays.clear();
    this.hoveredId = null;
    this.host = undefined;
  }

  loadDefinition(def: SimSpaceDefinitionPayload): void {
    this.definition = def;
    if (this.camera && def.viewport) {
      const ex = def.viewport.extent[0] ?? 5;
      const ey = def.viewport.extent[1] ?? 5;
      const ez = def.viewport.extent[2] ?? 5;
      // Distance derived from the viewport diagonal so the scene fills
      // more of the FOV. Previously used 2.2× max-extent which placed
      // the camera too far for typical scenes.
      const diagonal = Math.sqrt(ex * ex + ey * ey + ez * ez);
      const distance = Math.max(diagonal * 1.1, 2);
      const cx = def.viewport.center[0] ?? 0;
      const cy = def.viewport.center[1] ?? 0;
      const cz = def.viewport.center[2] ?? 0;
      // Iso-ish angle: equal X/Y/Z offsets normalized to `distance`.
      const offset = distance / Math.sqrt(3);
      this.camera.position.set(cx + offset, cy + offset, cz + offset);
      this.camera.lookAt(cx, cy, cz);
      this.controls?.orbit.target.set(cx, cy, cz);
      this.controls?.update();
    }
    this.onViewChange?.();
  }

  onHostResize(): void {
    if (!this.renderer || !this.camera) return;
    const { width, height } = this.hostBox();
    this.renderer.setSize(width, height);
    if (this.camera instanceof THREE.PerspectiveCamera) {
      this.camera.aspect = width / Math.max(height, 1);
    } else if (this.camera instanceof THREE.OrthographicCamera) {
      const halfH = (this.camera.top - this.camera.bottom) / 2 || 5;
      const halfW = halfH * (width / Math.max(height, 1));
      this.camera.left = -halfW;
      this.camera.right = halfW;
      this.camera.top = halfH;
      this.camera.bottom = -halfH;
    }
    this.camera.updateProjectionMatrix();
    this.repositionOverlays();
  }

  // -------------------------------------------------------------------
  // Object lifecycle (reconciler)
  // -------------------------------------------------------------------

  setObjects(objects: SimSpaceObject[]): void {
    if (!this.scene) return;
    // Meshes are bound to a stable TRACK (trackKey), not to a per-timestep
    // row id. A track persists across the scrubber's full range, so stepping
    // is just a transform write on the same mesh — we destroy + rebuild only
    // on a real event: the track left the scene, or its shape/style ref
    // changed (a genuinely different visual). This kills the per-frame
    // geometry/material/GPU churn that made 3D playback intermittently fail.
    const keyOf = (o: SimSpaceObject) => o.trackKey ?? o.id;
    const next = new Map(objects.map(o => [keyOf(o), o]));
    for (const [key, mesh] of this.meshes) {
      if (!next.has(key)) {
        this.scene.remove(mesh);
        this.disposeObject3D(mesh);
        this.meshes.delete(key);
      }
    }
    for (const obj of objects) {
      const key = keyOf(obj);
      const sig = `${obj.shapeRef}|${obj.styleRef}`;
      let mesh = this.meshes.get(key);
      if (!mesh || mesh.userData['polariRenderSig'] !== sig) {
        // First appearance, or the track's visual changed → (re)build once.
        if (mesh) {
          this.scene.remove(mesh);
          this.disposeObject3D(mesh);
        }
        mesh = this.buildMeshFor(obj);
        mesh.userData['polariRenderSig'] = sig;
        this.meshes.set(key, mesh);
        this.scene.add(mesh);
      }
      this.applyTransform(mesh, obj);
      // The CURRENT row id rides on the persistent mesh so hover/click/pick
      // resolve to the on-screen timestep, even though the mesh itself is
      // bound to the stable track.
      mesh.userData['polariSimSpaceId'] = obj.id;
    }
    // currentObjects stays keyed by per-row id — updateObjectTransform,
    // overlays, and connection endpoint lookups all address objects by id.
    this.currentObjects = new Map(objects.map(o => [o.id, o]));
    this.repositionOverlays();
  }

  updateObjectTransform(id: string, patch: SimSpaceTransformPatch): void {
    const obj = this.currentObjects.get(id);
    // currentObjects is keyed by row id; the mesh is keyed by the track, so
    // resolve through the object's trackKey (fall back to id).
    const mesh = obj ? this.meshes.get(obj.trackKey ?? obj.id) : undefined;
    if (!obj || !mesh) return;
    const updated: SimSpaceObject = {
      ...obj,
      position: patch.position ?? obj.position,
      rotation: patch.rotation ?? obj.rotation,
      scale: patch.scale ?? obj.scale,
    };
    this.currentObjects.set(id, updated);
    this.applyTransform(mesh, updated);
    this.repositionOverlay(id);
  }

  setConnections(connections: SimSpaceConnection[]): void {
    if (!this.scene) return;
    // Same stable-track binding as setObjects: the line persists across the
    // scrubber range and we just rewrite its endpoint geometry each step,
    // rather than rebuilding the THREE.Line every frame.
    const keyOf = (c: SimSpaceConnection) => c.trackKey ?? c.id;
    const next = new Map(connections.map(c => [keyOf(c), c]));
    for (const [key, line] of this.connectionLines) {
      if (!next.has(key)) {
        this.scene.remove(line);
        this.disposeObject3D(line);
        this.connectionLines.delete(key);
      }
    }
    for (const conn of connections) {
      const srcPos = conn.sourcePosition
        ?? (conn.sourceId ? this.currentObjects.get(conn.sourceId)?.position : undefined);
      const tgtPos = conn.targetPosition
        ?? (conn.targetId ? this.currentObjects.get(conn.targetId)?.position : undefined);
      if (!srcPos || !tgtPos) continue;
      const key = keyOf(conn);
      let line = this.connectionLines.get(key);
      if (!line) {
        const geom = new THREE.BufferGeometry();
        const mat = new THREE.LineBasicMaterial({ color: 0x888888 });
        line = new THREE.Line(geom, mat);
        this.connectionLines.set(key, line);
        this.scene.add(line);
      }
      // Color the line from its binding's styleRef material (was hardcoded
      // gray) — this is what distinguishes e.g. the rod from the red gravity
      // and green net force arrows. Falls back to gray when the ref misses.
      const colorHex = conn.styleRef
        ? this.materialLib.get(conn.styleRef)?.color
        : undefined;
      (line.material as THREE.LineBasicMaterial).color.set(colorHex || '#888888');
      line.userData['polariSimSpaceId'] = conn.id;
      const positions = new Float32Array([
        srcPos[0] ?? 0, srcPos[1] ?? 0, srcPos[2] ?? 0,
        tgtPos[0] ?? 0, tgtPos[1] ?? 0, tgtPos[2] ?? 0,
      ]);
      (line.geometry as THREE.BufferGeometry).setAttribute(
        'position', new THREE.BufferAttribute(positions, 3)
      );
    }
    this.currentConnections = next;
  }

  // -------------------------------------------------------------------
  // Interaction
  // -------------------------------------------------------------------

  pickAt(screenPos: SimSpaceScreenPosition): SimSpacePickResult {
    if (!this.host || !this.camera || !this.scene) {
      return { id: null, screenPos };
    }
    const { width, height } = this.hostBox();
    const ndc = new THREE.Vector2(
      (screenPos.x / width) * 2 - 1,
      -(screenPos.y / height) * 2 + 1
    );
    this.raycaster.setFromCamera(ndc, this.camera);
    const hits = this.raycaster.intersectObjects(Array.from(this.meshes.values()), true);
    if (!hits.length) return { id: null, screenPos };
    let cursor: THREE.Object3D | null = hits[0].object;
    while (cursor && cursor.userData['polariSimSpaceId'] === undefined) {
      cursor = cursor.parent;
    }
    const pickedId = (cursor?.userData['polariSimSpaceId'] as string) ?? null;
    return { id: pickedId, screenPos };
  }

  setHighlight(id: string | null): void {
    // Meshes are keyed by trackKey, but `id` is the per-row picking id — so
    // match on the current row id stamped into userData, not the map key.
    // Scale RELATIVE to the binding's base scale (stored in applyTransform),
    // and persist the highlight flag so a scrub while hovered re-applies it.
    this.meshes.forEach((mesh) => {
      const hit = id !== null && mesh.userData['polariSimSpaceId'] === id;
      mesh.userData['polariHighlighted'] = hit;
      const base = (mesh.userData['polariBaseScale'] as number) ?? 1;
      mesh.scale.setScalar(base * (hit ? HIGHLIGHT_FACTOR : 1));
    });
  }

  setSelection(_ids: string[]): void {
    // Phase 2 placeholder — multi-select styling lands later.
  }

  zoomToFit(): void {
    if (this.definition) this.loadDefinition(this.definition);
  }

  // -------------------------------------------------------------------
  // Overlays
  // -------------------------------------------------------------------

  attachOverlay(
    objectId: string,
    anchor: 'center' | 'top' | 'right' | 'bottom' | 'left',
    el: HTMLElement
  ): void {
    if (!this.host) return;
    el.style.position = 'absolute';
    el.style.transform = transformForAnchor(anchor);
    if (!el.style.pointerEvents) el.style.pointerEvents = 'auto';
    if (el.parentNode !== this.host) this.host.appendChild(el);
    this.overlays.set(objectId, { el, anchor });
    this.repositionOverlay(objectId);
  }

  detachOverlay(objectId: string): void {
    const entry = this.overlays.get(objectId);
    if (!entry) return;
    entry.el.parentNode?.removeChild(entry.el);
    this.overlays.delete(objectId);
  }

  // -------------------------------------------------------------------
  // Event subscriptions
  // -------------------------------------------------------------------

  setOnClick(handler: (result: SimSpacePickResult) => void): void { this.onClick = handler; }
  setOnHoverChange(handler: (id: string | null) => void): void { this.onHoverChange = handler; }
  setOnTransformChange(handler: (id: string, patch: SimSpaceTransformPatch) => void): void {
    this.onTransformChange = handler;
  }
  setOnViewChange(handler: () => void): void { this.onViewChange = handler; }

  // -------------------------------------------------------------------
  // Internals
  // -------------------------------------------------------------------

  private handleClick = (event: MouseEvent): void => {
    const result = this.pickAt(this.localPos(event));
    this.onClick?.(result);
  };

  private handleMouseMove = (event: MouseEvent): void => {
    const result = this.pickAt(this.localPos(event));
    if (result.id !== this.hoveredId) {
      this.hoveredId = result.id;
      this.onHoverChange?.(result.id);
    }
  };

  private startLoop(): void {
    this.looping = true;
    const tick = () => {
      if (!this.looping) return;  // stopped by destroy()
      // Reschedule FIRST so the loop can NEVER die — neither a not-ready
      // frame nor a transient render exception below stops future frames.
      // (Previously the reschedule was last, so any throw froze the canvas
      // permanently — the scene-graph kept updating but nothing repainted.)
      this.animationFrameId = requestAnimationFrame(tick);
      if (!this.renderer || !this.scene || !this.camera) return;
      try {
        const delta = this.clock.getDelta();
        if (this.viewHelperRig?.helper.animating) {
          this.viewHelperRig.helper.update(delta);
        }
        this.controls?.update();
        // Manual clear (autoClear=false) so the main scene survives the
        // ViewHelper's subsequent partial-viewport render.
        this.renderer.clear();
        this.renderer.setViewport(
          0, 0, this.renderer.domElement.width, this.renderer.domElement.height
        );
        this.renderer.render(this.scene, this.camera);
        this.viewHelperRig?.helper.render(this.renderer);
      } catch (e) {
        console.error('[render] tick error (loop continues):', e);
      }
    };
    tick();
  }

  /** Ambient + directional light + axes/grid helpers — same defaults every scene gets. */
  private installDefaultSceneFurniture(): void {
    if (!this.scene) return;
    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambient);
    const directional = new THREE.DirectionalLight(0xffffff, 0.8);
    directional.position.set(5, 10, 7);
    this.scene.add(directional);
    this.scene.add(new THREE.AxesHelper(3));
    this.scene.add(new THREE.GridHelper(10, 10, 0xbdbdbd, 0xe0e0e0));
  }

  private buildMeshFor(obj: SimSpaceObject): THREE.Object3D {
    // Always returns a Mesh — geometry/material builders fall back to
    // defaults (cube / magenta material) when refs miss, so this never
    // returns null. Return type accordingly.
    const meshDef = this.meshLib.get(obj.shapeRef);
    const materialDef = this.materialLib.get(obj.styleRef);
    return new THREE.Mesh(buildGeometry(meshDef), buildMaterial(materialDef));
  }

  private applyTransform(node: THREE.Object3D, obj: SimSpaceObject): void {
    node.position.set(
      obj.position[0] ?? 0,
      obj.position[1] ?? 0,
      obj.position[2] ?? 0
    );
    if (obj.rotation) {
      node.rotation.set(
        obj.rotation[0] ?? 0,
        obj.rotation[1] ?? 0,
        obj.rotation[2] ?? 0
      );
    }
    const scale = typeof obj.scale === 'number'
      ? obj.scale
      : Array.isArray(obj.scale) ? (obj.scale[0] ?? 1) : 1;
    // Remember the binding's base scale so the hover highlight can scale
    // RELATIVE to it (a 15% bump), instead of slamming the mesh to an
    // absolute scalar — which blew small bobs (~0.12) up ~8× on hover.
    node.userData['polariBaseScale'] = scale;
    node.scale.setScalar(scale * (node.userData['polariHighlighted'] ? HIGHLIGHT_FACTOR : 1));
  }

  private repositionOverlays(): void {
    this.overlays.forEach((_, id) => this.repositionOverlay(id));
  }

  private repositionOverlay(objectId: string): void {
    const entry = this.overlays.get(objectId);
    if (!entry || !this.host || !this.camera) return;
    const obj = this.currentObjects.get(objectId);
    if (!obj) return;
    const worldPos = new THREE.Vector3(
      obj.position[0] ?? 0,
      obj.position[1] ?? 0,
      obj.position[2] ?? 0
    );
    const screenPos = worldPos.clone().project(this.camera);
    const { width, height } = this.hostBox();
    const sx = (screenPos.x + 1) * 0.5 * width;
    const sy = (1 - (screenPos.y + 1) * 0.5) * height;
    entry.el.style.left = `${sx}px`;
    entry.el.style.top = `${sy}px`;
    entry.el.style.display = screenPos.z > 1 ? 'none' : '';
  }

  private hostBox(): { width: number; height: number } {
    if (!this.host) return { width: 800, height: 600 };
    const rect = this.host.getBoundingClientRect();
    return { width: rect.width || 800, height: rect.height || 600 };
  }

  private localPos(event: MouseEvent): SimSpaceScreenPosition {
    if (!this.host) return { x: event.clientX, y: event.clientY };
    const rect = this.host.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  private disposeObject3D(node: THREE.Object3D): void {
    node.traverse(child => {
      const c = child as any;
      if (c.geometry && typeof c.geometry.dispose === 'function') c.geometry.dispose();
      if (c.material) {
        const mats = Array.isArray(c.material) ? c.material : [c.material];
        mats.forEach((m: any) => m?.dispose && m.dispose());
      }
    });
  }
}
