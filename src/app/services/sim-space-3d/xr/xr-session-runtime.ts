/**
 * @xr
 * @module services/sim-space-3d/xr/xr-session-runtime
 *
 * The three.js side of the XR engine (xr-1). This file is the ONLY
 * place XR touches three — it is reached exclusively via dynamic
 * import from XrEngineService, so it rides the sim-space-3d lazy
 * chunk and ZERO XR code loads until someone actually enters.
 *
 * Owns AT MOST ONE XR-capable WebGLRenderer + ONE XRSession
 * (a device allows one immersive session by construction). Binding a
 * registered scene = rendering that LIVE scene with a session-owned
 * camera rig; the flat viewer's renderer/camera/controls are never
 * mutated, so exit restores the flat view byte-identically — the only
 * scene mutation is the rig group, removed on exit/switch.
 *
 * Q5 (Dustin): DISPOSED on exit — resources freed between sessions,
 * re-entry pays the setup moment.
 */

import * as THREE from 'three';

import type { XrSceneEntry } from '@services/xr/xr-scene-registry.service';

export type XrRuntimeEndReason = 'exit' | 'device' | 'error';

export interface XrRuntimeCallbacks {
  /** Fired exactly once when the session is gone (any path — our
   *  exit(), the headset system button, device sleep). The runtime
   *  has already cleaned up + disposed when this fires. */
  onEnded: (reason: XrRuntimeEndReason) => void;
}

const RIG_NAME = 'polari-xr-rig';

export class XrSessionRuntime {
  private renderer: THREE.WebGLRenderer | null = null;
  private session: XRSession | null = null;
  private camera: THREE.PerspectiveCamera | null = null;
  private rig: THREE.Group | null = null;
  private boundScene: THREE.Scene | null = null;
  private boundEntryId: string | null = null;
  private endReason: XrRuntimeEndReason = 'device';
  private callbacks: XrRuntimeCallbacks;

  constructor(callbacks: XrRuntimeCallbacks) {
    this.callbacks = callbacks;
  }

  /** The id of the currently-bound registry entry (null = none). */
  get currentEntryId(): string | null {
    return this.boundEntryId;
  }

  /** Request the immersive session and bind the entry's live scene.
   *  Reference space: local-floor with fallback to local (headsets
   *  without floor tracking still enter, just seated-origin). */
  async enter(entry: XrSceneEntry): Promise<void> {
    if (this.session) {
      throw new Error('XR session already active — switch, don\'t re-enter.');
    }
    const xr = (navigator as any).xr;
    if (!xr?.requestSession) {
      throw new Error('WebXR is not available in this browser');
    }

    // The XR renderer never joins the DOM — the session presents to
    // the headset; the flat viewers keep mirroring via their own
    // untouched renderers.
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.xr.enabled = true;

    let session: XRSession;
    let referenceSpace: 'local-floor' | 'local' = 'local-floor';
    try {
      session = await xr.requestSession('immersive-vr', {
        optionalFeatures: ['local-floor'],
      });
    } catch (err) {
      this.disposeRenderer();
      throw err;
    }
    try {
      // local-floor was only OPTIONAL in the request — probe whether
      // the session actually grants it; fall back to local honestly.
      try {
        await session.requestReferenceSpace('local-floor');
      } catch {
        referenceSpace = 'local';
      }
      this.renderer.xr.setReferenceSpaceType(referenceSpace);
      await this.renderer.xr.setSession(session);
    } catch (err) {
      try { await session.end(); } catch { /* already gone */ }
      this.disposeRenderer();
      throw err;
    }

    this.session = session;
    this.endReason = 'device';
    session.addEventListener('end', this.handleSessionEnd);

    this.bind(entry);
    this.renderer.setAnimationLoop(this.renderFrame);
  }

  /** Swap the bound scene without ending the session — entering
   *  another interface never means a second session. */
  switchTo(entry: XrSceneEntry): void {
    if (!this.session) throw new Error('No active XR session to switch.');
    this.unbind();
    this.bind(entry);
  }

  /** User-initiated exit — ends the session; cleanup runs in the
   *  session 'end' handler (same path as headset-initiated ends). */
  async exit(): Promise<void> {
    if (!this.session) return;
    this.endReason = 'exit';
    // Unbind BEFORE the (async) session end: callers exit when a
    // viewer is tearing down, and no frame may render a scene whose
    // flat owner is disposing GPU resources. handleSessionEnd's
    // unbind is idempotent.
    this.unbind();
    try {
      await this.session.end();
    } catch {
      // Session already ended (race with device) — handler ran.
    }
  }

  // ------------------------------------------------------------------
  // Internals
  // ------------------------------------------------------------------

  private renderFrame = (): void => {
    if (!this.renderer || !this.boundScene || !this.camera) return;
    try {
      this.renderer.render(this.boundScene, this.camera);
    } catch (e) {
      // Never let one bad frame kill the session loop.
      console.error('[xr] frame error (loop continues):', e);
    }
  };

  private bind(entry: XrSceneEntry): void {
    const handle = entry.getHandle();
    if (!handle) {
      throw new Error(
        `XR scene "${entry.label}" is not ready (renderer re-mounting).`);
    }
    const scene = handle.scene as THREE.Scene;

    // Session-owned camera in a rig group. three's WebXRManager
    // overwrites the camera pose from the headset every frame, so the
    // rig carries the world-placement (and later, xr-2's scale) —
    // the flat viewer's camera is never touched.
    this.camera = new THREE.PerspectiveCamera(60, 1, 0.05, 1000);
    this.rig = new THREE.Group();
    this.rig.name = RIG_NAME;
    this.rig.add(this.camera);
    this.placeRig(scene, handle.camera as THREE.Camera | null);
    scene.add(this.rig);

    this.boundScene = scene;
    this.boundEntryId = entry.id;
  }

  /** Remove every trace of the session from the bound scene — the
   *  byte-identical-exit guarantee is exactly this. */
  private unbind(): void {
    if (this.rig) {
      this.rig.parent?.remove(this.rig);
      this.rig = null;
    }
    this.camera = null;
    this.boundScene = null;
    this.boundEntryId = null;
  }

  /** Initial rig placement: stand at the flat camera's position when
   *  it has one (the view you were just looking at), else back off
   *  the scene's bounding sphere. Framing-aware entry scale is xr-2
   *  (scale-relative everything); xr-1 places, never scales. */
  private placeRig(scene: THREE.Scene, flatCamera: THREE.Camera | null): void {
    if (!this.rig) return;
    if (flatCamera) {
      this.rig.position.copy(
        (flatCamera as THREE.PerspectiveCamera).position);
      return;
    }
    const bounds = new THREE.Box3().setFromObject(scene);
    if (bounds.isEmpty()) {
      this.rig.position.set(0, 1.6, 3);
      return;
    }
    const sphere = bounds.getBoundingSphere(new THREE.Sphere());
    this.rig.position.set(
      sphere.center.x,
      sphere.center.y,
      sphere.center.z + Math.max(sphere.radius * 1.5, 2));
  }

  private handleSessionEnd = (): void => {
    const reason = this.endReason;
    this.session?.removeEventListener('end', this.handleSessionEnd);
    this.session = null;
    this.unbind();
    this.disposeRenderer();
    this.callbacks.onEnded(reason);
  };

  private disposeRenderer(): void {
    if (!this.renderer) return;
    this.renderer.setAnimationLoop(null);
    this.renderer.dispose();
    this.renderer = null;
  }
}
