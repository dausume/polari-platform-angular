/**
 * @xr
 * @module services/sim-space-3d/xr/xr-navigation
 *
 * Grip navigation (xr-2, Dustin's spec): the GRIP buttons are
 * navigation; triggers stay selection. One consistent split.
 *
 *  - TWO grips = world-grab: hands apart zooms IN (the world grows),
 *    together zooms OUT; moving both hands translates; twisting the
 *    hand pair rotates about the vertical axis. Implemented as solving
 *    the rig transform so the world points under the hands STAY under
 *    the hands (nausea-safe — the world never lurches).
 *  - ONE grip = push/pull shift: the press records an ORIGIN; after
 *    the debounce window the shift ARMS (haptic tick); the
 *    origin→hand vector drives translation, magnitude growing with
 *    the vector past a dead zone. Pressing the OTHER grip while a
 *    shift is armed CANCELS it (haptic; gestures stay dead until all
 *    grips release). Both grips pressed within the debounce window
 *    simply begin a world-grab — that is how two-grip gestures start.
 *  - Everything is SIM-RADIUS-relative (Dustin 2026-07-12): drive
 *    speed is measured in R/sec (R = the space's bounding radius), so
 *    a molecule space and a room space feel the same and a full hand
 *    extension crosses a predictable fraction of the sim per second.
 *
 * Yaw-only rotation throughout (the horizon never tilts). All tuning
 * values are knobs (Q8 defaults in XR_NAV_DEFAULTS).
 */

import * as THREE from 'three';

import {
  XR_NAV_DEFAULTS, XrNavKnobs, XrRigPose,
} from '@models/xr/xr-types';
import {
  applyPoseToRig, poseFromRig, rotateRigAboutPoint,
} from './xr-entry-placement';
import type { XrControllerHandle, XrInputRig } from './xr-input-rig';

type NavMode =
  'idle' | 'shift-pending' | 'shift-armed' | 'grab' | 'cancelled';

/** Per-frame HUD data (wrist panel), all in Sim Radii. */
export interface XrNavHud {
  state: 'idle' | 'moving';
  xR: number;
  yR: number;
  zR: number;
  distanceR: number;
  zoom: number;
  /** R itself in world units — a broken bounds measurement must be
   *  diagnosable at a glance. */
  simRadius: number;
  moveRadiiPerSec: number;
}

const HISTORY_CAP = 50;
/** Hands stacked nearly vertically give no usable heading. */
const MIN_HEADING_SPAN_M = 0.05;
const SNAP_FIRE_THRESHOLD = 0.7;
const SNAP_REARM_THRESHOLD = 0.3;

export class XrNavigation {
  knobs: XrNavKnobs = { ...XR_NAV_DEFAULTS };

  private mode: NavMode = 'idle';
  private home: XrRigPose;
  private entryScale: number;
  private history: XrRigPose[] = [];
  private boundsCenter = new THREE.Vector3();
  private boundsRadius = 1;

  // shift state
  private shiftHandle: XrControllerHandle | null = null;
  private shiftOriginLocal = new THREE.Vector3();
  private shiftDriving = false;
  /** live drive rate for the HUD, in R/sec (0 when not driving). */
  private shiftRadiiPerSec = 0;

  // grab state (start snapshot; each frame solves fresh from it)
  private grabP1 = new THREE.Vector3();
  private grabP2 = new THREE.Vector3();
  private grabStartPose: XrRigPose | null = null;
  private grabWorldMid = new THREE.Vector3();
  private grabStartHeading = 0;
  private lastHeadingDelta = 0;

  private preGesturePose: XrRigPose | null = null;
  private snapArmed = true;
  private limitHit = false;

  constructor(
    private rig: THREE.Group,
    private input: XrInputRig,
    /** false while another surface owns input (wrist UI hover/press;
     *  xr-3 adds grabbed panels) — world gestures then never START. */
    private worldFocusFn: () => boolean,
  ) {
    this.home = poseFromRig(rig);
    this.entryScale = this.home.scale;
  }

  /** Called at bind: the entry pose is home, and the soft clamps are
   *  relative to this scale + these bounds. */
  setHome(center: THREE.Vector3, radius: number): void {
    this.home = poseFromRig(this.rig);
    this.entryScale = this.home.scale;
    this.boundsCenter.copy(center);
    this.boundsRadius = this.saneRadius(radius);
    this.history = [];
    this.mode = 'idle';
  }

  /** Live bounds re-measure (runtime wires sceneBoundingSphere): the
   *  bind-time sphere can predate async mesh loading — since drive
   *  speed is priced in R, bounds refresh at gesture start. */
  private boundsProvider:
    (() => { center: THREE.Vector3; radius: number }) | null = null;

  setBoundsProvider(
      provider: () => { center: THREE.Vector3; radius: number }): void {
    this.boundsProvider = provider;
  }

  private refreshBounds(): void {
    if (!this.boundsProvider) return;
    try {
      const sphere = this.boundsProvider();
      this.boundsCenter.copy(sphere.center);
      this.boundsRadius = this.saneRadius(sphere.radius);
    } catch { /* keep the previous bounds */ }
  }

  /** R must be trustworthy before anything multiplies by it: entry
   *  framing works (entryScale = radius/apparent at derivation), so
   *  a plausible R lies within a band of entryScale. Implausible
   *  measurements clamp LOUDLY. */
  private saneRadius(measured: number): number {
    const low = this.entryScale * 0.45 * 0.2;
    const high = this.entryScale * 2.5 * 20;
    if (!Number.isFinite(measured) || measured < low
        || measured > high) {
      const fallback = Math.min(Math.max(
        Number.isFinite(measured) ? measured : 0, low), high);
      console.warn(
        `[xr-nav] implausible sim radius ${measured} for entry `
        + `scale ${this.entryScale} — clamped to ${fallback}`);
      return Math.max(fallback, 1e-9);
    }
    return measured;
  }

  /** Last-resort escape (every frame, any mode): a rig that is
   *  non-finite or implausibly far snaps back home, loudly. */
  private rescueIfLost(): void {
    const position = this.rig.position;
    const scale = this.rig.scale.x;
    const finite = Number.isFinite(position.x)
      && Number.isFinite(position.y) && Number.isFinite(position.z)
      && Number.isFinite(scale) && scale > 0;
    const maxDist = this.boundsRadius * this.knobs.clampRadii * 4
      + Math.abs(scale) * 20;
    const homeDist = position
      .distanceTo(new THREE.Vector3(...this.home.position));
    if (finite && homeDist <= maxDist) return;
    console.error('[xr-nav] RESCUE: rig implausibly far or '
      + 'non-finite — snapping home', {
        position: position.toArray(), scale,
        boundsRadius: this.boundsRadius, homeDist, maxDist,
        mode: this.mode,
      });
    applyPoseToRig(this.rig, this.home);
    this.limitHit = true;
    this.cancelGesture();
  }

  // ------------------------------------------------------------------
  // Frame update
  // ------------------------------------------------------------------

  update(dtSeconds: number): void {
    this.rescueIfLost();
    const pressed = this.input.pressedGrips();

    switch (this.mode) {
      case 'idle':
        this.shiftDriving = false;
        if (!this.worldFocusFn()) break;
        if (pressed.length >= 2) {
          this.startGrab(pressed[0], pressed[1]);
        } else if (pressed.length === 1) {
          this.mode = 'shift-pending';
          this.shiftHandle = pressed[0];
          this.shiftOriginLocal.copy(pressed[0].grip.position);
        }
        break;

      case 'shift-pending': {
        const held = this.shiftHandle?.gripPressed ?? false;
        if (!held) { this.toIdle(); break; }
        if (pressed.length >= 2) {
          // Second grip inside the debounce window: this IS the
          // two-grip gesture starting, not a cancel.
          this.startGrab(pressed[0], pressed[1]);
          break;
        }
        const heldMs =
          performance.now() - (this.shiftHandle?.gripPressedAt ?? 0);
        if (heldMs >= this.knobs.shiftDebounceMs) {
          this.mode = 'shift-armed';
          this.refreshBounds();
          this.preGesturePose = poseFromRig(this.rig);
          // Re-record the origin AT arm time — the "shift event" arms
          // here; drift during the debounce is not a command.
          this.shiftOriginLocal.copy(this.shiftHandle!.grip.position);
          this.input.pulse(this.shiftHandle);
        }
        break;
      }

      case 'shift-armed': {
        if (!this.shiftHandle?.gripPressed) {
          this.endGesture();
          break;
        }
        const other = pressed.find(p => p !== this.shiftHandle);
        if (other) {
          // The OTHER grip is the abort button for an armed shift.
          this.input.pulse(other, 0.6, 80);
          this.cancelGesture();
          break;
        }
        this.driveShift(dtSeconds);
        break;
      }

      case 'grab': {
        const h1 = this.grabHandles[0];
        const h2 = this.grabHandles[1];
        if (!h1?.gripPressed || !h2?.gripPressed) {
          // Releasing either hand ends the grab; a still-held grip
          // does NOT silently become a shift — re-press to shift.
          this.endGesture();
          if (pressed.length > 0) this.mode = 'cancelled';
          break;
        }
        this.solveGrab();
        break;
      }

      case 'cancelled':
        if (pressed.length === 0) this.toIdle();
        break;
    }

    this.updateSnapTurn();
  }

  // ------------------------------------------------------------------
  // Queries (visuals read these each frame)
  // ------------------------------------------------------------------

  isShiftArmed(): boolean { return this.mode === 'shift-armed'; }
  isGrabbing(): boolean { return this.mode === 'grab'; }
  vignetteActive(): boolean {
    return this.knobs.vignetteOnShift
      && (this.mode === 'grab'
          || (this.mode === 'shift-armed' && this.shiftDriving));
  }
  /** rig-local origin of the armed shift (anchor ghost position). */
  shiftOrigin(): THREE.Vector3 { return this.shiftOriginLocal; }
  /** rig-local hand position of the armed shift (vector line end). */
  shiftHand(): THREE.Vector3 | null {
    return this.shiftHandle?.grip.position ?? null;
  }
  /** User-perceived zoom vs the space default (>1 = zoomed in). */
  zoomFactor(): number { return this.entryScale / this.rig.scale.x; }
  /** True once when a soft clamp engaged since the last call. */
  consumeLimitHit(): boolean {
    const hit = this.limitHit;
    this.limitHit = false;
    return hit;
  }

  // ------------------------------------------------------------------
  // Actions (wrist UI / engine API)
  // ------------------------------------------------------------------

  /** The "I'm lost" escape: home pose + default scale. */
  resetView(): void {
    this.pushHistory(poseFromRig(this.rig));
    applyPoseToRig(this.rig, this.home);
    this.mode = 'cancelled'; // any held grips must release first
  }

  /** Jump back to the previous viewpoint. */
  back(): boolean {
    const prev = this.history.pop();
    if (!prev) return false;
    applyPoseToRig(this.rig, prev);
    return true;
  }

  currentPose(): XrRigPose { return poseFromRig(this.rig); }

  /** Everything the wrist HUD shows, in Sim Radii. */
  hud(): XrNavHud {
    const offset = this.headWorld().sub(this.boundsCenter)
      .divideScalar(this.boundsRadius);
    const moving = this.mode === 'shift-armed' && this.shiftDriving;
    return {
      state: moving || this.mode === 'grab' ? 'moving' : 'idle',
      xR: offset.x,
      yR: offset.y,
      zR: offset.z,
      distanceR: offset.length(),
      zoom: this.zoomFactor(),
      simRadius: this.boundsRadius,
      moveRadiiPerSec: moving ? this.shiftRadiiPerSec : 0,
    };
  }

  /** Trigger pressed anywhere (runtime forwards selectstart): while
   *  a gesture is live this is an extra cancel button. */
  notifyTriggerPress(): void {
    if (this.mode === 'shift-armed' || this.mode === 'grab') {
      this.input.pulse(this.shiftHandle
        ?? this.grabHandles[0], 0.6, 80);
      this.cancelGesture();
    }
  }

  jumpTo(pose: XrRigPose): void {
    this.pushHistory(poseFromRig(this.rig));
    applyPoseToRig(this.rig, pose);
  }

  historyDepth(): number { return this.history.length; }

  /** External interruption (headset removal / visibility loss): kill
   *  any live gesture; grips must fully release before navigating
   *  again — a blurred session never keeps driving. */
  interrupt(): void {
    this.cancelGesture();
  }

  // ------------------------------------------------------------------
  // Gesture internals
  // ------------------------------------------------------------------

  private grabHandles: (XrControllerHandle | null)[] = [null, null];

  private toIdle(): void {
    this.mode = 'idle';
    this.shiftHandle = null;
    this.shiftDriving = false;
    this.grabHandles = [null, null];
    this.grabStartPose = null;
  }

  private startGrab(h1: XrControllerHandle, h2: XrControllerHandle): void {
    this.mode = 'grab';
    this.grabHandles = [h1, h2];
    this.refreshBounds();
    this.preGesturePose = this.preGesturePose ?? poseFromRig(this.rig);
    this.grabP1.copy(h1.grip.position);
    this.grabP2.copy(h2.grip.position);
    this.grabStartPose = poseFromRig(this.rig);
    this.lastHeadingDelta = 0;

    const midLocal = this.grabP1.clone().add(this.grabP2)
      .multiplyScalar(0.5);
    this.grabWorldMid.copy(this.localToWorld(midLocal,
      this.grabStartPose));
    this.grabStartHeading = this.headingOf(this.grabP1, this.grabP2);
  }

  /** World-grab solve: keep the grabbed world midpoint fixed under
   *  the hands while distance drives scale and twist drives yaw. */
  private solveGrab(): void {
    const start = this.grabStartPose!;
    const p1 = this.grabHandles[0]!.grip.position;
    const p2 = this.grabHandles[1]!.grip.position;

    const d0 = this.grabP1.distanceTo(this.grabP2);
    const d = p1.distanceTo(p2);
    // Hands apart (d > d0) → factor < 1 → smaller rig scale →
    // smaller user → the world appears BIGGER = zoom in.
    const factor = d > 1e-6 ? Math.max(d0, 1e-6) / d : 1;
    const scale = this.clampScale(start.scale * factor);

    let headingDelta = this.lastHeadingDelta;
    const span = new THREE.Vector2(p2.x - p1.x, p2.z - p1.z).length();
    if (span >= MIN_HEADING_SPAN_M) {
      headingDelta =
        this.headingOf(p1, p2) - this.grabStartHeading;
      this.lastHeadingDelta = headingDelta;
    }
    const yaw = start.yaw - headingDelta;

    // P = grabbedWorldMid − s·RotY(yaw)·midLocal
    const midLocal = p1.clone().add(p2).multiplyScalar(0.5);
    const rotated = midLocal.clone()
      .applyQuaternion(new THREE.Quaternion()
        .setFromEuler(new THREE.Euler(0, yaw, 0)))
      .multiplyScalar(scale);
    const position = this.grabWorldMid.clone().sub(rotated);
    this.clampTranslation(position, scale);

    applyPoseToRig(this.rig, {
      position: [position.x, position.y, position.z], yaw, scale,
    });
  }

  private driveShift(dt: number): void {
    const hand = this.shiftHandle!.grip.position;
    const v = hand.clone().sub(this.shiftOriginLocal);
    const magnitude = v.length() - this.knobs.deadZoneM;
    if (magnitude <= 0) {
      this.shiftDriving = false;
      this.shiftRadiiPerSec = 0;
      return;
    }
    this.shiftDriving = true;

    const shaped = this.knobs.responseCurve === 'expo'
      ? magnitude * magnitude / 0.25 // expo: quadratic, matched at 25cm
      : magnitude;
    // Speed in Sim Radii/sec: a full reference extension drives
    // shiftGainRadiiPerSec R/s (soft-capped) — never raw meters.
    const ratio = Math.min(shaped / this.knobs.handRefM, 1.5);
    const radiiPerSec = this.knobs.shiftGainRadiiPerSec * ratio;
    this.shiftRadiiPerSec = radiiPerSec;

    // Pushing the world along v = the rig moving along −v:
    // Δrig = −RotY(yaw)·v̂ · radiiPerSec·R·dt
    const dir = v.normalize()
      .applyQuaternion(this.rig.quaternion)
      .multiplyScalar(-radiiPerSec * this.boundsRadius * dt);
    const position = this.rig.position.clone().add(dir);
    this.clampTranslation(position, this.rig.scale.x);
    this.rig.position.copy(position);
  }

  private endGesture(): void {
    // Only a gesture that actually MOVED earns a history entry.
    if (this.preGesturePose
        && !this.posesClose(this.preGesturePose, poseFromRig(this.rig))) {
      this.pushHistory(this.preGesturePose);
    }
    this.preGesturePose = null;
    this.toIdle();
  }

  private cancelGesture(): void {
    this.preGesturePose = null;
    this.toIdle();
    this.mode = 'cancelled';
  }

  private updateSnapTurn(): void {
    if (!this.knobs.snapTurn) return;
    if (this.mode !== 'idle' && this.mode !== 'cancelled') return;
    const pointer = this.input.byHand(
      this.knobs.wristHandedness === 'left' ? 'right' : 'left');
    const x = this.input.axisX(pointer);
    if (this.snapArmed && Math.abs(x) > SNAP_FIRE_THRESHOLD) {
      this.snapArmed = false;
      const rad = THREE.MathUtils.degToRad(this.knobs.snapTurnDegrees);
      // Stick right = turn right = negative yaw, pivoting about the
      // wearer's feet (not the rig origin).
      const head = this.headWorld();
      rotateRigAboutPoint(this.rig, head, x > 0 ? -rad : rad);
      this.input.pulse(pointer, 0.25, 30);
    } else if (!this.snapArmed
               && Math.abs(x) < SNAP_REARM_THRESHOLD) {
      this.snapArmed = true;
    }
  }

  // ------------------------------------------------------------------
  // Helpers
  // ------------------------------------------------------------------

  private pushHistory(pose: XrRigPose): void {
    const top = this.history[this.history.length - 1];
    if (top && this.posesClose(top, pose)) return;
    this.history.push(pose);
    if (this.history.length > HISTORY_CAP) this.history.shift();
  }

  private posesClose(a: XrRigPose, b: XrRigPose): boolean {
    const dp = Math.hypot(
      a.position[0] - b.position[0],
      a.position[1] - b.position[1],
      a.position[2] - b.position[2]);
    return dp < 1e-4 * Math.max(a.scale, 1e-9)
      && Math.abs(a.yaw - b.yaw) < 1e-3
      && Math.abs(Math.log(a.scale / b.scale)) < 1e-3;
  }

  /** Soft scale clamp: 10^±scaleRangeExponent around the entry scale.
   *  Engaging it flags the honest at-the-limit indicator — never a
   *  silent stop. */
  private clampScale(s: number): number {
    const range = Math.pow(10, this.knobs.scaleRangeExponent);
    const min = this.entryScale / range;
    const max = this.entryScale * range;
    const clamped = Math.min(Math.max(s, min), max);
    if (clamped !== s) this.limitHit = true;
    return clamped;
  }

  /** Soft translation clamp: the rig origin stays within a generous
   *  multiple of the space bounds (you cannot get lost beyond all
   *  sight of the space). */
  private clampTranslation(p: THREE.Vector3, scale: number): void {
    const maxDist = this.boundsRadius * this.knobs.clampRadii
      + scale * 2;
    const offset = p.clone().sub(this.boundsCenter);
    const dist = offset.length();
    if (dist > maxDist) {
      p.copy(this.boundsCenter)
        .add(offset.multiplyScalar(maxDist / dist));
      this.limitHit = true;
    }
  }

  private headingOf(p1: THREE.Vector3, p2: THREE.Vector3): number {
    return Math.atan2(p2.x - p1.x, p2.z - p1.z);
  }

  private headWorld(): THREE.Vector3 {
    // The camera rides the rig; its local pose is the headset pose in
    // reference space. Fall back to the rig origin pre-first-frame.
    const camera = this.rig.children.find(
      c => (c as THREE.Camera).isCamera) as THREE.Camera | undefined;
    const local = camera?.position ?? new THREE.Vector3();
    return this.localToWorld(local, poseFromRig(this.rig));
  }

  private localToWorld(local: THREE.Vector3, pose: XrRigPose):
      THREE.Vector3 {
    return local.clone()
      .applyQuaternion(new THREE.Quaternion()
        .setFromEuler(new THREE.Euler(0, pose.yaw, 0)))
      .multiplyScalar(pose.scale)
      .add(new THREE.Vector3(...pose.position));
  }
}
