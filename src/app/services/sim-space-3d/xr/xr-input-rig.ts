/**
 * @xr
 * @module services/sim-space-3d/xr/xr-input-rig
 *
 * Seeing yourself (xr-2): controller models, target rays, and hand
 * models, all children of the session rig so world navigation carries
 * the user's whole body.
 *
 * The motion-controller profiles are BUNDLED LOCALLY under
 * /assets/webxr-profiles (oculus-touch-v3 for the Quest 2, htc-vive
 * wands, generic fallbacks, generic-hand) — the factories' default
 * CDN fetch would violate our self-contained deploys. Hand tracking
 * is feature-detected per input source: when the device reports
 * hands, hand models render; otherwise controllers do — an honest
 * fallback, never a dead limb.
 */

import * as THREE from 'three';
import { XRControllerModelFactory } from
  'three/examples/jsm/webxr/XRControllerModelFactory.js';
import { XRHandModelFactory } from
  'three/examples/jsm/webxr/XRHandModelFactory.js';

/** Local, self-contained profile assets (angular.json copies them). */
const PROFILES_PATH = 'assets/webxr-profiles';

/** A squeeze release shorter than this is analog-grip flutter, not
 *  a command (Vive wands report analog grips; see the listener
 *  comment below). */
const GRIP_RELEASE_DEBOUNCE_MS = 150;

/**
 * Per-device pointer pitch correction (Dustin, 2026-07-12 headset
 * session: the ray's default direction "really bothers" him on the
 * Vive — it doesn't line up with where the wand physically points).
 * WebXR's target-ray-space pose is runtime-defined, and Wolvic/OpenVR's
 * Vive-wand ray is tilted noticeably below the felt pointing line;
 * Oculus Touch profiles (Quest) do NOT have this problem — the
 * default target ray already tracks the physical controller, so this
 * correction must be OFF for Quest (Dustin's explicit caution: don't
 * let a Vive fix bend Quest pointing). Detected from the connected
 * input source's `profiles` list, never from a global default.
 * Sign/magnitude is a first estimate — dial in on the next in-headset
 * pass (build tag on the HELP panel identifies the running code).
 */
const VIVE_POINTER_PITCH_DEG = -18;
/** Profile-id substring that identifies an HTC Vive wand — ONLY the
 *  vendor-specific id, deliberately NOT the shared
 *  'generic-trigger-squeeze-*' fallback family: Quest controllers
 *  also carry a generic-trigger-squeeze-thumbstick entry later in
 *  their profiles list, so matching on that generic family would
 *  wrongly pitch Quest rays too (exactly the cross-device bug to
 *  avoid). 'htc-vive' only ever appears for the actual wand. */
const VIVE_PROFILE_MARKERS = ['htc-vive'];

export type XrHandedness = 'left' | 'right';

export interface XrControllerHandle {
  /** three slot index (0/1 — handedness is only known on connect). */
  index: number;
  /** target-ray space (select/squeeze events arrive here; RAW runtime
   *  pose — do not use for aiming, see `pointer`). */
  ray: THREE.XRTargetRaySpace;
  /** The AIMING transform: a child of `ray` carrying the per-device
   *  pitch correction (identity on Quest/unknown devices). Raycasting
   *  and the visual ray line both read this, so the beam you see is
   *  always exactly where clicks land. */
  pointer: THREE.Object3D;
  /** grip space (models attach here; grip pose = hand pose). */
  grip: THREE.XRGripSpace;
  /** hand-tracking space (joint-driven when hands active). */
  hand: THREE.XRHandSpace;
  handedness: XrHandedness | 'none';
  /** live gamepad while a controller (not a hand) is connected. */
  gamepad: Gamepad | null;
  /** the input source is a tracked hand, not a controller. */
  isHand: boolean;
  /** squeeze (grip button) currently held. */
  gripPressed: boolean;
  /** ms timestamp of the last squeeze press (debounce window). */
  gripPressedAt: number;
  /** touchpad/thumbstick CLICK held — a full alternative to the
   *  grip (Dustin's right Vive grip is physically broken; every
   *  nav gesture accepts grip OR pad per hand). Polled from the
   *  gamepad each frame with the same release debounce. */
  padPressed: boolean;
}

export class XrInputRig {
  readonly controllers: XrControllerHandle[] = [];
  private disposed = false;

  /** Builds controller/grip/hand groups for both slots and mounts
   *  them on the rig. Must be called before the session renders. */
  constructor(renderer: THREE.WebGLRenderer, rig: THREE.Group) {
    const controllerModels = new XRControllerModelFactory();
    controllerModels.setPath(PROFILES_PATH);
    const handModels = new XRHandModelFactory();
    handModels.setPath(PROFILES_PATH);

    for (let i = 0; i < 2; i++) {
      const ray = renderer.xr.getController(i);
      const grip = renderer.xr.getControllerGrip(i);
      const hand = renderer.xr.getHand(i);

      grip.add(controllerModels.createControllerModel(grip));
      hand.add(handModels.createHandModel(hand as any, 'mesh'));
      const pointer = new THREE.Group();
      pointer.name = 'xr-pointer';
      pointer.add(this.buildRayLine());
      ray.add(pointer);

      const handle: XrControllerHandle = {
        index: i, ray, pointer, grip, hand,
        handedness: 'none', gamepad: null, isHand: false,
        gripPressed: false, gripPressedAt: 0, padPressed: false,
      };

      ray.addEventListener('connected', (event: any) => {
        const source = event.data as XRInputSource;
        handle.handedness =
          (source?.handedness as XrHandedness) ?? 'none';
        handle.isHand = !!source?.hand;
        handle.gamepad = (source?.gamepad as Gamepad) ?? null;
        // Rays belong to pointing devices; a tracked hand points with
        // its own joints (xr-3 pinch work) — hide the stick.
        this.setRayVisible(ray, !handle.isHand);
        // Device-specific aim correction (never touches Quest — see
        // VIVE_POINTER_PITCH_DEG above).
        const profiles = source?.profiles ?? [];
        const isViveWand = profiles.some(p =>
          VIVE_PROFILE_MARKERS.some(marker => p.includes(marker)));
        pointer.rotation.set(
          isViveWand ? THREE.MathUtils.degToRad(VIVE_POINTER_PITCH_DEG)
            : 0, 0, 0);
      });
      ray.addEventListener('disconnected', () => {
        handle.handedness = 'none';
        handle.gamepad = null;
        handle.isHand = false;
        handle.gripPressed = false;
      });
      // Grip = navigation (squeeze events; triggers stay selection).
      // ANALOG grips (Vive wands) can flutter squeeze events around
      // the threshold while physically held — an instant release
      // then chains release→commit→re-arm→commit into runaway serial
      // travel (Dustin's 'moves infinitely', invisible to the
      // binary-squeeze Quest harness). A release only counts after
      // the grip stays off for the debounce window; a flutter
      // re-press keeps the ORIGINAL gripPressedAt (no re-arming).
      let releaseTimer: ReturnType<typeof setTimeout> | null = null;
      ray.addEventListener('squeezestart', () => {
        if (releaseTimer !== null) {
          clearTimeout(releaseTimer);
          releaseTimer = null;
        }
        if (!handle.gripPressed) {
          handle.gripPressed = true;
          handle.gripPressedAt = performance.now();
        }
      });
      ray.addEventListener('squeezeend', () => {
        if (releaseTimer !== null) clearTimeout(releaseTimer);
        releaseTimer = setTimeout(() => {
          releaseTimer = null;
          handle.gripPressed = false;
        }, GRIP_RELEASE_DEBOUNCE_MS);
      });

      rig.add(ray, grip, hand);
      this.controllers.push(handle);
    }
  }

  /** Poll gamepad button state (once per frame, from the session
   *  runtime): pad CLICKS have no squeeze-style events. xr-standard
   *  mapping: buttons[2] = touchpad press, buttons[3] = thumbstick
   *  press. Release-debounced like the grip; a fresh pad press
   *  stamps gripPressedAt so the shift debounce window works
   *  identically for both inputs. */
  private padReleasedAt = [0, 0];

  pollGamepads(): void {
    const now = performance.now();
    for (const handle of this.controllers) {
      const buttons = handle.gamepad?.buttons;
      const rawDown = !!(buttons?.[2]?.pressed
        || buttons?.[3]?.pressed);
      if (rawDown) {
        this.padReleasedAt[handle.index] = 0;
        if (!handle.padPressed) {
          handle.padPressed = true;
          if (!handle.gripPressed) handle.gripPressedAt = now;
        }
      } else if (handle.padPressed) {
        if (this.padReleasedAt[handle.index] === 0) {
          this.padReleasedAt[handle.index] = now;
        } else if (now - this.padReleasedAt[handle.index]
            >= GRIP_RELEASE_DEBOUNCE_MS) {
          handle.padPressed = false;
          this.padReleasedAt[handle.index] = 0;
        }
      }
    }
  }

  byHand(handedness: XrHandedness): XrControllerHandle | null {
    return this.controllers.find(c => c.handedness === handedness)
      ?? null;
  }

  /** CONTROLLER handles currently nav-pressed — grip OR pad click,
   *  either counts (Q8: controller-only until hands stabilize). */
  pressedGrips(): XrControllerHandle[] {
    return this.controllers.filter(
      c => (c.gripPressed || c.padPressed) && !c.isHand);
  }

  /** Haptic tick, guarded — absent actuators are simply silent. */
  pulse(handle: XrControllerHandle | null,
        intensity = 0.4, durationMs = 50): void {
    const actuator: any =
      (handle?.gamepad as any)?.hapticActuators?.[0];
    try {
      actuator?.pulse?.(intensity, durationMs);
    } catch { /* haptics are best-effort */ }
  }

  /** Thumbstick/touchpad X of one handle (snap turn input).
   *  xr-standard gamepad mapping: axes[0/1] touchpad, [2/3]
   *  thumbstick — take whichever is live. */
  axisX(handle: XrControllerHandle | null): number {
    const axes = handle?.gamepad?.axes;
    if (!axes) return 0;
    const thumb = axes[2] ?? 0;
    return Math.abs(thumb) > Math.abs(axes[0] ?? 0)
      ? thumb : (axes[0] ?? 0);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const c of this.controllers) {
      c.ray.parent?.remove(c.ray);
      c.grip.parent?.remove(c.grip);
      c.hand.parent?.remove(c.hand);
    }
    this.controllers.length = 0;
  }

  private buildRayLine(): THREE.Line {
    const geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1),
    ]);
    const material = new THREE.LineBasicMaterial({
      color: 0x8fd3ce, transparent: true, opacity: 0.6,
    });
    const line = new THREE.Line(geometry, material);
    line.name = 'xr-target-ray';
    line.scale.z = 3;
    return line;
  }

  private setRayVisible(ray: THREE.Object3D, visible: boolean): void {
    const line = ray.getObjectByName('xr-target-ray');
    if (line) line.visible = visible;
  }
}
