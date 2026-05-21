/**
 * @cross-cutting
 * @tags @xc:render-3d
 * @consumers
 *   - ThreeSimSpaceRenderer (sole consumer; lazy-loaded with the rest of 3D)
 * @impact-on-edit
 *   Mouse-button conventions differ between CAD packages (Fusion 360,
 *   AutoCAD, Blender). The defaults here match the most common
 *   engineering convention. Changing them affects user muscle-memory —
 *   surface as a config option rather than redefining defaults.
 * @see /OVERLAP_MAP.md
 *
 * CADControls — extends OrbitControls with engineering/scientific
 * conventions:
 *   - middle-click drag → pan
 *   - right-click drag  → orbit
 *   - left-click drag   → orbit (so users with two-button mice work)
 *   - scroll wheel      → zoom (toward the world point under the cursor)
 *   - numpad 1 / 3 / 7  → snap front / right / top
 *   - Ctrl + 1 / 3 / 7  → snap back / left / bottom
 *   - numpad 5          → toggle perspective ↔ orthographic
 *   - double-click      → focus camera on the world point under cursor
 *
 * Doesn't try to be a full CAD app's nav — just the standard primitives
 * any scientific viewer should support.
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export interface CADControlsHost {
  /** The DOM element receiving pointer events. */
  domElement: HTMLElement;
  /** The active camera (perspective OR orthographic). */
  camera: THREE.PerspectiveCamera | THREE.OrthographicCamera;
  /** The scene — needed for the focus-on-double-click raycast. */
  scene: THREE.Scene;
  /** Notify the renderer when the camera changes (e.g. ortho swap). */
  onCameraSwapped: (next: THREE.PerspectiveCamera | THREE.OrthographicCamera) => void;
}

export class CADControls {
  readonly orbit: OrbitControls;
  private raycaster = new THREE.Raycaster();
  private host: CADControlsHost;
  private perspective: THREE.PerspectiveCamera;
  private orthographic: THREE.OrthographicCamera;
  private isOrthographic = false;
  private boundKeydown: (e: KeyboardEvent) => void;
  private boundDblClick: (e: MouseEvent) => void;
  private boundWheel: (e: WheelEvent) => void;

  constructor(host: CADControlsHost) {
    this.host = host;
    if (host.camera instanceof THREE.PerspectiveCamera) {
      this.perspective = host.camera;
      this.orthographic = this.buildOrthoFromPersp(host.camera);
    } else {
      // Started in ortho — build a matching perspective companion.
      this.orthographic = host.camera as THREE.OrthographicCamera;
      this.perspective = this.buildPerspFromOrtho(host.camera as THREE.OrthographicCamera);
      this.isOrthographic = true;
    }

    this.orbit = new OrbitControls(host.camera, host.domElement);
    this.orbit.enableDamping = true;
    this.orbit.dampingFactor = 0.08;
    // Remap mouse buttons to CAD convention.
    this.orbit.mouseButtons = {
      LEFT:   THREE.MOUSE.ROTATE,
      MIDDLE: THREE.MOUSE.PAN,
      RIGHT:  THREE.MOUSE.ROTATE,
    };
    // Zoom-to-cursor: OrbitControls supports this directly since r135.
    this.orbit.zoomToCursor = true;

    // Wheel: pass-through to OrbitControls, but we intercept to keep
    // zoom-to-cursor stable when ortho is active.
    this.boundWheel = (e: WheelEvent) => this.handleWheel(e);
    host.domElement.addEventListener('wheel', this.boundWheel, { passive: false });

    // Keyboard view-snap shortcuts. Bound to the canvas, not window —
    // typing in a side panel input shouldn't snap the camera.
    this.boundKeydown = (e: KeyboardEvent) => this.handleKey(e);
    host.domElement.tabIndex = 0;  // so it can receive keyboard focus
    host.domElement.addEventListener('keydown', this.boundKeydown);
    // Make sure focus follows pointer entry so users don't have to click first.
    host.domElement.addEventListener('mouseenter', () => host.domElement.focus());

    // Double-click → focus camera on clicked world point.
    this.boundDblClick = (e: MouseEvent) => this.handleDoubleClick(e);
    host.domElement.addEventListener('dblclick', this.boundDblClick);
  }

  update(): void { this.orbit.update(); }

  dispose(): void {
    this.orbit.dispose();
    this.host.domElement.removeEventListener('wheel', this.boundWheel);
    this.host.domElement.removeEventListener('keydown', this.boundKeydown);
    this.host.domElement.removeEventListener('dblclick', this.boundDblClick);
  }

  /** True if currently in ortho mode. */
  get orthographicMode(): boolean { return this.isOrthographic; }

  /**
   * Snap camera to one of the canonical orthographic views.
   * `axis` indicates the viewing direction: +X looks from +x toward origin
   * (right view), -X from -x (left), etc.
   */
  snapToView(view: 'front' | 'back' | 'left' | 'right' | 'top' | 'bottom'): void {
    const t = this.orbit.target.clone();
    const dist = this.host.camera.position.distanceTo(t) || 5;
    const directions: Record<typeof view, [number, number, number, number, number, number]> = {
      // [pos x,y,z, up x,y,z]
      front:  [0, 0, dist, 0, 1, 0],
      back:   [0, 0, -dist, 0, 1, 0],
      right:  [dist, 0, 0, 0, 1, 0],
      left:   [-dist, 0, 0, 0, 1, 0],
      top:    [0, dist, 0, 0, 0, -1],
      bottom: [0, -dist, 0, 0, 0, 1],
    };
    const v = directions[view];
    this.host.camera.position.set(t.x + v[0], t.y + v[1], t.z + v[2]);
    this.host.camera.up.set(v[3], v[4], v[5]);
    this.host.camera.lookAt(t);
    this.orbit.update();
  }

  /**
   * Toggle perspective ↔ orthographic, preserving the look direction +
   * approximate framing. The orbit controls are re-targeted at the new
   * camera; SimSpaceRenderer is notified via onCameraSwapped.
   */
  toggleOrtho(): void {
    this.isOrthographic = !this.isOrthographic;
    const next = this.isOrthographic ? this.orthographic : this.perspective;
    // Carry over position + target + up to the new camera.
    next.position.copy(this.host.camera.position);
    next.up.copy(this.host.camera.up);
    next.lookAt(this.orbit.target);
    next.updateProjectionMatrix();
    // Swap the orbit's camera reference.
    (this.orbit as any).object = next;
    this.host.onCameraSwapped(next);
    this.host.camera = next;
    this.orbit.update();
  }

  private buildOrthoFromPersp(p: THREE.PerspectiveCamera): THREE.OrthographicCamera {
    const aspect = p.aspect;
    const h = 5;  // initial frustum half-height; resized by host on resize
    const w = h * aspect;
    return new THREE.OrthographicCamera(-w, w, h, -h, p.near, p.far);
  }
  private buildPerspFromOrtho(o: THREE.OrthographicCamera): THREE.PerspectiveCamera {
    return new THREE.PerspectiveCamera(60, 1, o.near, o.far);
  }

  private handleWheel(_e: WheelEvent): void {
    // OrbitControls handles the wheel event itself; we install the
    // listener only so non-passive can be reserved if we later add
    // wheel-modifier behavior (e.g. shift+wheel = roll).
  }

  private handleKey(e: KeyboardEvent): void {
    // Only react to numpad keys to avoid stomping on regular text input.
    const numpad = e.code && e.code.startsWith('Numpad');
    if (!numpad) return;
    const ctrl = e.ctrlKey || e.metaKey;
    switch (e.code) {
      case 'Numpad1': this.snapToView(ctrl ? 'back' : 'front'); break;
      case 'Numpad3': this.snapToView(ctrl ? 'left' : 'right'); break;
      case 'Numpad7': this.snapToView(ctrl ? 'bottom' : 'top'); break;
      case 'Numpad5': this.toggleOrtho(); break;
      default: return;
    }
    e.preventDefault();
  }

  private handleDoubleClick(event: MouseEvent): void {
    const rect = this.host.domElement.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(new THREE.Vector2(x, y), this.host.camera);
    const hits = this.raycaster.intersectObjects(this.host.scene.children, true);
    if (!hits.length) return;
    // Animate target to hit point — instant for now; tween in a later phase.
    this.orbit.target.copy(hits[0].point);
    this.orbit.update();
  }
}
