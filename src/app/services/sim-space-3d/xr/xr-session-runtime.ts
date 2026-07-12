/**
 * @xr
 * @module services/sim-space-3d/xr/xr-session-runtime
 *
 * The three.js side of the XR engine (xr-1 + xr-2). This module tree
 * is the ONLY place XR touches three — reached exclusively via dynamic
 * import from XrEngineService, so it rides the sim-space-3d lazy chunk
 * and ZERO XR code loads until someone actually enters.
 *
 * Owns AT MOST ONE XR-capable WebGLRenderer + ONE XRSession. The
 * session RIG (camera + controllers + hands + wrist UI + comfort
 * visuals + mirror ghost) is created once per session and moved
 * between scenes on switch; it is the only scene mutation, so exit
 * restores the flat view byte-identically. xr-2 adds: input
 * visualization (xr-input-rig), grip navigation (xr-navigation),
 * comfort + evidence visuals (xr-nav-visuals), the ring-0 wrist seed
 * (xr-wrist-ui), the desktop-mirror headset ghost (xr-mirror-ghost),
 * and framing-aware scale-relative entry (xr-entry-placement).
 *
 * Exit is always reachable, three independent paths, ONE exit
 * mechanism: the wrist EXIT button and the engine's exit() both call
 * session.end(); the headset system button ends the session directly;
 * every path funnels through the session 'end' event handler.
 * Headset removal (visibilitychange ≠ visible) interrupts any live
 * navigation gesture — a blurred session never keeps driving.
 *
 * Q5 (Dustin): DISPOSED on exit — resources freed between sessions,
 * re-entry pays the setup moment.
 */

import * as THREE from 'three';

import type { XrSceneEntry } from '@services/xr/xr-scene-registry.service';
import type {
  XrEnterContext, XrRigPose,
} from '@models/xr/xr-types';
import { XR_NAV_DEFAULTS } from '@models/xr/xr-types';
import {
  deriveEntryScale, placeRigForFraming, sceneBoundingSphere,
} from './xr-entry-placement';
import { XrInputRig } from './xr-input-rig';
import { XrNavigation } from './xr-navigation';
import { XrNavVisuals } from './xr-nav-visuals';
import { XrWristUi } from './xr-wrist-ui';
import { XrMirrorGhost, XR_MIRROR_GHOST_LAYER } from './xr-mirror-ghost';

export type XrRuntimeEndReason = 'exit' | 'device' | 'error';

export interface XrRuntimeCallbacks {
  /** Fired exactly once when the session is gone (any path — our
   *  exit(), the wrist button, the headset system button, device
   *  sleep). The runtime has already cleaned up + disposed. */
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

  // xr-2 members (all session-lifetime; wrist UI is per-bind because
  // its handedness is a per-space knob).
  private inputRig: XrInputRig | null = null;
  private navigation: XrNavigation | null = null;
  private visuals: XrNavVisuals | null = null;
  private ghost: XrMirrorGhost | null = null;
  private wristUi: XrWristUi | null = null;
  private flatCameraRestore:
    { camera: THREE.Camera; mask: number } | null = null;
  private lastFrameTime: number | null = null;

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
  async enter(entry: XrSceneEntry, context: XrEnterContext):
      Promise<void> {
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
        optionalFeatures: ['local-floor', 'hand-tracking'],
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
    session.addEventListener('visibilitychange',
      this.handleVisibilityChange);

    this.buildRig();
    this.bind(entry, context);
    this.renderer.setAnimationLoop(this.renderFrame);
  }

  /** Swap the bound scene without ending the session — entering
   *  another interface never means a second session. The rig (and the
   *  user's hands) ride along. */
  switchTo(entry: XrSceneEntry, context: XrEnterContext): void {
    if (!this.session) throw new Error('No active XR session to switch.');
    this.unbind();
    this.bind(entry, context);
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
  // Navigation API (engine passthrough: wrist UI already wires these
  // in-session; the engine exposes them to the flat UI + bookmarks)
  // ------------------------------------------------------------------

  resetView(): void { this.navigation?.resetView(); }
  back(): boolean { return this.navigation?.back() ?? false; }
  currentPose(): XrRigPose | null {
    return this.navigation?.currentPose() ?? null;
  }
  jumpTo(pose: XrRigPose): void { this.navigation?.jumpTo(pose); }

  // ------------------------------------------------------------------
  // Internals
  // ------------------------------------------------------------------

  private renderFrame = (time: number): void => {
    if (!this.renderer || !this.boundScene || !this.camera) return;
    const dt = this.lastFrameTime === null
      ? 0
      : Math.min((time - this.lastFrameTime) / 1000, 0.1);
    this.lastFrameTime = time;
    try {
      const navigation = this.navigation;
      if (navigation) {
        navigation.update(dt);
        this.wristUi?.update(navigation.hud());
        this.visuals?.update(dt, {
          vignetteActive: navigation.vignetteActive(),
          shiftArmed: navigation.isShiftArmed(),
          shiftOrigin: navigation.isShiftArmed()
            ? navigation.shiftOrigin() : null,
          shiftHand: navigation.shiftHand(),
          limitHit: navigation.consumeLimitHit(),
        });
      }
      this.ghost?.update();
      this.renderer.render(this.boundScene, this.camera);
    } catch (e) {
      // Never let one bad frame kill the session loop.
      console.error('[xr] frame error (loop continues):', e);
    }
  };

  /** Session-lifetime rig: camera + input + visuals + ghost. three's
   *  WebXRManager overwrites the camera pose from the headset every
   *  frame IN REFERENCE SPACE, so the rig carries the world placement
   *  and scale — the flat viewer's camera is never touched. */
  private buildRig(): void {
    this.camera = new THREE.PerspectiveCamera(60, 1, 0.05, 1000);
    this.rig = new THREE.Group();
    this.rig.name = RIG_NAME;
    this.rig.add(this.camera);
    this.inputRig = new XrInputRig(this.renderer!, this.rig);
    this.visuals = new XrNavVisuals(this.rig, this.camera);
    this.ghost = new XrMirrorGhost(this.rig, this.camera);
    this.navigation = new XrNavigation(this.rig, this.inputRig,
      () => !(this.wristUi?.uiEngaged() ?? false));
    // Deferred-commit cancel: a trigger pull while a gesture is
    // PLANNING aborts it (navigation ignores triggers otherwise).
    for (const controller of this.inputRig.controllers) {
      controller.ray.addEventListener('selectstart',
        () => this.navigation?.notifyTriggerPress());
    }
  }

  private bind(entry: XrSceneEntry, context: XrEnterContext): void {
    const handle = entry.getHandle();
    if (!handle) {
      throw new Error(
        `XR scene "${entry.label}" is not ready (renderer re-mounting).`);
    }
    const scene = handle.scene as THREE.Scene;
    const rig = this.rig!;
    const navigation = this.navigation!;

    // Space extent BEFORE the rig (and its controller models) joins.
    const sphere = sceneBoundingSphere(scene);

    // Scale-relative entry: the variant's entry_scale wins; otherwise
    // derive from extent × framing and report it up for persistence
    // (knob over magic — the derived value becomes editable data).
    let entryScale = context.variantConfig.entry_scale;
    if (!(typeof entryScale === 'number' && entryScale > 0)) {
      entryScale = deriveEntryScale(sphere.radius, context.framing);
      context.onDerivedEntryScale?.(entryScale);
    }
    const placement = placeRigForFraming(
      sphere.center, entryScale, context.framing);
    rig.position.copy(placement.position);
    rig.quaternion.identity();
    rig.scale.setScalar(placement.scale);

    navigation.knobs = {
      ...XR_NAV_DEFAULTS, ...(context.variantConfig.nav ?? {}),
    };
    navigation.setHome(sphere.center, sphere.radius);
    // Bind-time bounds can predate async mesh loading — navigation
    // re-measures the LIVE scene at every gesture start (every plan
    // is priced in R, so R must be true, not merely early). The rig
    // subtree (controllers, wrist UI, comfort visuals — wherever the
    // USER is) must never inflate the measurement: R would then grow
    // with every travel, compounding the next plan.
    navigation.setBoundsProvider(() => {
      const parent = rig.parent;
      parent?.remove(rig);
      try {
        return sceneBoundingSphere(scene);
      } finally {
        parent?.add(rig);
      }
    });

    // Wrist UI is per-bind: its handedness is a per-space knob.
    // Ring-0 labels (Dustin 2026-07-12): EXIT / RE-CENTER / HELP.
    this.wristUi = new XrWristUi(
      this.inputRig!, this.camera!, navigation.knobs.wristHandedness, {
        exit: () => { void this.exit(); },
        resetView: () => navigation.resetView(),
        help: () => this.wristUi?.toggleHelp(),
      });

    // The mirror ghost renders on a dedicated layer only the FLAT
    // camera gets — the wearer never sees their own headset. The
    // exact mask is restored on unbind (byte-identical exit).
    const flatCamera = handle.camera as THREE.Camera | null;
    if (flatCamera) {
      this.flatCameraRestore =
        { camera: flatCamera, mask: flatCamera.layers.mask };
      flatCamera.layers.enable(XR_MIRROR_GHOST_LAYER);
    }

    scene.add(rig);
    this.boundScene = scene;
    this.boundEntryId = entry.id;
  }

  /** Remove every trace of the session from the bound scene — the
   *  byte-identical-exit guarantee is exactly this. */
  private unbind(): void {
    if (this.wristUi) {
      this.wristUi.dispose();
      this.wristUi = null;
    }
    if (this.flatCameraRestore) {
      this.flatCameraRestore.camera.layers.mask =
        this.flatCameraRestore.mask;
      this.flatCameraRestore = null;
    }
    if (this.rig) this.rig.parent?.remove(this.rig);
    this.boundScene = null;
    this.boundEntryId = null;
  }

  private handleVisibilityChange = (): void => {
    // Headset removal / system overlay: interrupt any live gesture.
    // Frames stop arriving on their own; what must never happen is a
    // gesture resuming with stale state when frames return.
    if (this.session && this.session.visibilityState !== 'visible') {
      this.navigation?.interrupt();
    }
  };

  private handleSessionEnd = (): void => {
    const reason = this.endReason;
    this.session?.removeEventListener('end', this.handleSessionEnd);
    this.session?.removeEventListener('visibilitychange',
      this.handleVisibilityChange);
    this.session = null;
    this.unbind();
    this.disposeRig();
    this.disposeRenderer();
    this.callbacks.onEnded(reason);
  };

  private disposeRig(): void {
    this.visuals?.dispose();
    this.visuals = null;
    this.ghost?.dispose();
    this.ghost = null;
    this.inputRig?.dispose();
    this.inputRig = null;
    this.navigation = null;
    this.camera = null;
    this.rig = null;
    this.lastFrameTime = null;
  }

  private disposeRenderer(): void {
    if (!this.renderer) return;
    this.renderer.setAnimationLoop(null);
    this.renderer.dispose();
    this.renderer = null;
  }
}
