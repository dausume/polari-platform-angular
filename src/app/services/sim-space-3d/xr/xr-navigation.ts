/**
 * @xr
 * @module services/sim-space-3d/xr/xr-navigation
 *
 * Grip navigation (xr-2 + Dustin's deferred-commit refinement,
 * 2026-07-12): the GRIP buttons are navigation; triggers stay
 * selection — and NOTHING moves while a grip is held. A gesture only
 * PLANS an action; releasing the grip CONFIRMS it; the rig then
 * travels to the target over time (never a teleport). Live motion
 * while the hand was still shaping the vector was disorienting —
 * planning + confirm + timed travel replaces it.
 *
 *  - TWO grips = world-grab PLAN: hand distance plans zoom (apart =
 *    zoom in), moving the pair plans translation, twisting plans yaw
 *    — solved so the grabbed world midpoint lands under the hands at
 *    the committed target. Release either grip to confirm.
 *  - ONE grip = push/pull PLAN: the press records an ORIGIN; after
 *    the debounce the plan ARMS (haptic tick); the origin→hand
 *    vector plans a move measured in SIM RADII (a full reference
 *    extension plans shiftGainRadii R). Release to confirm.
 *  - CANCEL while planning: the OTHER grip (for a shift) or ANY
 *    trigger press (notifyTriggerPress) aborts — haptic, no motion,
 *    grips must fully release before the next gesture.
 *  - The confirmed action TRAVELS: duration grows with the planned
 *    Radii, the zoom change, and the apparent distance at the user's
 *    current scale (all knobs); vignette covers the travel.
 *
 * Everything is expressed in Sim Radii (R = the space's bounding
 * radius): the HUD reads position/distance/plans in R. Yaw-only
 * rotation throughout (the horizon never tilts). All tuning values
 * are knobs (Q8 defaults in XR_NAV_DEFAULTS).
 */

import * as THREE from 'three';

import {
  XR_NAV_DEFAULTS, XrNavKnobs, XrRigPose,
} from '@models/xr/xr-types';
import {
  applyPoseToRig, poseFromRig, rotateRigAboutPoint,
} from './xr-entry-placement';
import type { XrControllerHandle, XrInputRig } from './xr-input-rig';

type NavMode = 'idle' | 'shift-pending' | 'shift-planning'
  | 'grab-planning' | 'travelling' | 'cancelled';

/** A gesture's planned outcome — shown on the HUD while the grip is
 *  held, executed as a timed travel on release. */
export interface XrNavPlan {
  kind: 'move' | 'zoom';
  target: XrRigPose;
  /** |Δposition| of the plan, in Sim Radii. */
  moveRadii: number;
  /** planned zoom change (>1 = zooming in); 1 for a pure move. */
  zoomFactor: number;
}

/** Per-frame HUD data (wrist panel). */
export interface XrNavHud {
  state: 'idle' | 'planning' | 'travelling';
  plan: XrNavPlan | null;
  /** head offset from the sim center, in Sim Radii per axis. */
  xR: number;
  yR: number;
  zR: number;
  distanceR: number;
  /** user-perceived zoom vs the space default (>1 = zoomed in). */
  zoom: number;
  travelRemainingS: number;
}

const HISTORY_CAP = 50;
/** Hands stacked nearly vertically give no usable heading. */
const MIN_HEADING_SPAN_M = 0.05;
const SNAP_FIRE_THRESHOLD = 0.7;
const SNAP_REARM_THRESHOLD = 0.3;
/** Ratio cap: hand extensions past 1.5× the reference stop growing
 *  the plan (soft ceiling, not a cliff). */
const EXTENSION_RATIO_CAP = 1.5;
/** The 'inside' apparent radius (m) — used to translate a world
 *  move into how far it FEELS at the current user scale. */
const APPARENT_ROOM_M = 2.5;

interface Travel {
  from: XrRigPose;
  to: XrRigPose;
  duration: number;
  elapsed: number;
}

export class XrNavigation {
  knobs: XrNavKnobs = { ...XR_NAV_DEFAULTS };

  private mode: NavMode = 'idle';
  private home: XrRigPose;
  private entryScale: number;
  private history: XrRigPose[] = [];
  private boundsCenter = new THREE.Vector3();
  private boundsRadius = 1;

  // planning state
  private plan: XrNavPlan | null = null;
  private travel: Travel | null = null;

  // shift state
  private shiftHandle: XrControllerHandle | null = null;
  private shiftOriginLocal = new THREE.Vector3();

  // grab state (start snapshot; each frame re-plans fresh from it)
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
    this.boundsRadius = Math.max(radius, 1e-9);
    this.history = [];
    this.plan = null;
    this.travel = null;
    this.mode = 'idle';
  }

  // ------------------------------------------------------------------
  // Frame update
  // ------------------------------------------------------------------

  update(dtSeconds: number): void {
    const pressed = this.input.pressedGrips();

    switch (this.mode) {
      case 'idle':
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
          this.mode = 'shift-planning';
          this.preGesturePose = poseFromRig(this.rig);
          // Re-record the origin AT arm time — the plan arms here;
          // drift during the debounce is not a command.
          this.shiftOriginLocal.copy(this.shiftHandle!.grip.position);
          this.input.pulse(this.shiftHandle);
        }
        break;
      }

      case 'shift-planning': {
        if (!this.shiftHandle?.gripPressed) {
          this.commitPlan(); // release = confirm
          break;
        }
        const other = pressed.find(p => p !== this.shiftHandle);
        if (other) {
          // The OTHER grip is the abort button for a planned shift.
          this.input.pulse(other, 0.6, 80);
          this.cancelGesture();
          break;
        }
        this.plan = this.computeShiftPlan();
        break;
      }

      case 'grab-planning': {
        const h1 = this.grabHandles[0];
        const h2 = this.grabHandles[1];
        if (!h1?.gripPressed || !h2?.gripPressed) {
          this.commitPlan(); // releasing either hand confirms
          break;
        }
        this.plan = this.computeGrabPlan();
        break;
      }

      case 'travelling':
        this.driveTravel(dtSeconds);
        break;

      case 'cancelled':
        if (pressed.length === 0) this.toIdle();
        break;
    }

    this.updateSnapTurn();
  }

  // ------------------------------------------------------------------
  // Queries (visuals + HUD read these each frame)
  // ------------------------------------------------------------------

  isShiftArmed(): boolean { return this.mode === 'shift-planning'; }
  isGrabbing(): boolean { return this.mode === 'grab-planning'; }
  isTravelling(): boolean { return this.mode === 'travelling'; }
  /** Comfort vignette: only while a CONFIRMED action travels —
   *  planning moves nothing, so it needs no comfort cover. */
  vignetteActive(): boolean {
    return this.knobs.vignetteOnShift && this.mode === 'travelling';
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

  /** Everything the wrist HUD shows, in Sim Radii. */
  hud(): XrNavHud {
    const offset = this.headWorld().sub(this.boundsCenter)
      .divideScalar(this.boundsRadius);
    const planning = this.mode === 'shift-planning'
      || this.mode === 'grab-planning';
    return {
      state: this.mode === 'travelling' ? 'travelling'
        : planning ? 'planning' : 'idle',
      plan: planning ? this.plan : null,
      xR: offset.x,
      yR: offset.y,
      zR: offset.z,
      distanceR: offset.length(),
      zoom: this.zoomFactor(),
      travelRemainingS: this.travel
        ? Math.max(this.travel.duration - this.travel.elapsed, 0)
        : 0,
    };
  }

  /** Trigger pressed anywhere (runtime forwards selectstart): while
   *  a gesture is PLANNING this is the cancel button. */
  notifyTriggerPress(): void {
    if (this.mode === 'shift-planning'
        || this.mode === 'grab-planning') {
      this.input.pulse(this.shiftHandle
        ?? this.grabHandles[0], 0.6, 80);
      this.cancelGesture();
    }
  }

  // ------------------------------------------------------------------
  // Actions (wrist UI / engine API) — all travel, never teleport
  // ------------------------------------------------------------------

  /** The "I'm lost" escape (wrist RE-CENTER): home pose + default
   *  scale, reached by a timed travel. */
  resetView(): void {
    this.pushHistory(poseFromRig(this.rig));
    this.beginTravel(this.home);
  }

  /** Jump back to the previous viewpoint. */
  back(): boolean {
    const prev = this.history.pop();
    if (!prev) return false;
    this.beginTravel(prev);
    return true;
  }

  currentPose(): XrRigPose { return poseFromRig(this.rig); }

  jumpTo(pose: XrRigPose): void {
    this.pushHistory(poseFromRig(this.rig));
    this.beginTravel(pose);
  }

  historyDepth(): number { return this.history.length; }

  /** External interruption (headset removal / visibility loss): a
   *  PLAN dies unexecuted; a CONFIRMED travel completes instantly
   *  (it was already committed). Grips must fully release before
   *  navigating again — a blurred session never keeps driving. */
  interrupt(): void {
    if (this.travel) {
      applyPoseToRig(this.rig, this.travel.to);
      this.travel = null;
    }
    this.cancelGesture();
  }

  // ------------------------------------------------------------------
  // Gesture internals
  // ------------------------------------------------------------------

  private grabHandles: (XrControllerHandle | null)[] = [null, null];

  private toIdle(): void {
    this.mode = 'idle';
    this.shiftHandle = null;
    this.plan = null;
    this.grabHandles = [null, null];
    this.grabStartPose = null;
  }

  private startGrab(h1: XrControllerHandle, h2: XrControllerHandle): void {
    this.mode = 'grab-planning';
    this.grabHandles = [h1, h2];
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

  /** World-grab PLAN: solve the target pose that puts the grabbed
   *  world midpoint under the hands with distance driving scale and
   *  twist driving yaw. Nothing is applied — the target is the plan. */
  private computeGrabPlan(): XrNavPlan {
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

    const current = poseFromRig(this.rig);
    return {
      kind: 'zoom',
      target: {
        position: [position.x, position.y, position.z], yaw, scale,
      },
      moveRadii: position.clone()
        .sub(new THREE.Vector3(...current.position)).length()
        / this.boundsRadius,
      zoomFactor: current.scale / scale,
    };
  }

  /** Push/pull PLAN: the origin→hand vector maps to a move measured
   *  in Sim Radii — a full reference extension plans shiftGainRadii
   *  R. Nothing is applied until the grip releases. */
  private computeShiftPlan(): XrNavPlan | null {
    const hand = this.shiftHandle!.grip.position;
    const v = hand.clone().sub(this.shiftOriginLocal);
    const magnitude = v.length() - this.knobs.deadZoneM;
    if (magnitude <= 0) return null;

    const shaped = this.knobs.responseCurve === 'expo'
      ? magnitude * magnitude / 0.25 // expo: quadratic, matched at 25cm
      : magnitude;
    const ratio = Math.min(shaped / this.knobs.handRefM,
      EXTENSION_RATIO_CAP);
    const plannedRadii = this.knobs.shiftGainRadii * ratio;

    // Pushing the world along v = the rig moving along −v.
    const current = poseFromRig(this.rig);
    const worldDelta = v.normalize()
      .applyQuaternion(this.rig.quaternion)
      .multiplyScalar(-plannedRadii * this.boundsRadius);
    const position = new THREE.Vector3(...current.position)
      .add(worldDelta);
    this.clampTranslation(position, current.scale);

    return {
      kind: 'move',
      target: { position: [position.x, position.y, position.z],
                yaw: current.yaw, scale: current.scale },
      moveRadii: position.clone()
        .sub(new THREE.Vector3(...current.position)).length()
        / this.boundsRadius,
      zoomFactor: 1,
    };
  }

  /** Release = confirm: a meaningful plan travels; an empty plan
   *  (inside the dead zone) simply ends the gesture. */
  private commitPlan(): void {
    const plan = this.plan;
    const before = this.preGesturePose;
    this.toIdle();
    if (!plan
        || this.posesClose(plan.target, poseFromRig(this.rig))) {
      this.preGesturePose = null;
      return;
    }
    if (before) this.pushHistory(before);
    this.preGesturePose = null;
    this.beginTravel(plan.target, plan);
  }

  /** Confirmed actions travel over time, never teleport. Duration
   *  grows with the planned Radii, the zoom change, and how far the
   *  move FEELS at the current user scale — all knobs. */
  private beginTravel(to: XrRigPose, plan?: XrNavPlan): void {
    const from = poseFromRig(this.rig);
    if (this.posesClose(from, to)) { this.mode = 'idle'; return; }
    const moveRadii = plan?.moveRadii
      ?? (new THREE.Vector3(...to.position)
        .sub(new THREE.Vector3(...from.position)).length()
        / this.boundsRadius);
    const zoomFactor = plan?.zoomFactor ?? (from.scale / to.scale);
    const apparent = new THREE.Vector3(...to.position)
      .sub(new THREE.Vector3(...from.position)).length()
      / Math.max(from.scale * APPARENT_ROOM_M, 1e-9);
    const effective = moveRadii
      + Math.abs(Math.log2(Math.max(zoomFactor, 1e-9)))
      + Math.min(apparent, 4) * 0.25;
    const duration = Math.min(
      this.knobs.commitBaseSeconds
        + this.knobs.commitSecondsPerUnit * effective,
      this.knobs.commitMaxSeconds);
    this.travel = { from, to, duration, elapsed: 0 };
    this.mode = 'travelling';
  }

  private driveTravel(dt: number): void {
    const travel = this.travel!;
    travel.elapsed += dt;
    const u = Math.min(travel.elapsed / travel.duration, 1);
    if (u >= 1) {
      // Land EXACTLY on the confirmed target (no float drift from
      // the log-space interpolation).
      applyPoseToRig(this.rig, travel.to);
      this.travel = null;
      // Grips still held after a travel must release before the
      // next gesture — no accidental re-plan.
      this.mode = this.input.pressedGrips().length > 0
        ? 'cancelled' : 'idle';
      return;
    }
    const eased = u * u * (3 - 2 * u); // smoothstep
    const from = travel.from;
    const to = travel.to;
    const position = new THREE.Vector3(...from.position)
      .lerp(new THREE.Vector3(...to.position), eased);
    // Scale interpolates in LOG space (zooms feel uniform).
    const scale = Math.exp(THREE.MathUtils.lerp(
      Math.log(from.scale), Math.log(to.scale), eased));
    let yawDelta = to.yaw - from.yaw;
    yawDelta = Math.atan2(Math.sin(yawDelta), Math.cos(yawDelta));
    applyPoseToRig(this.rig, {
      position: [position.x, position.y, position.z],
      yaw: from.yaw + yawDelta * eased,
      scale,
    });
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

  /** Soft translation clamp: the rig origin stays within clampRadii
   *  Sim Radii of the space center (you cannot get lost beyond all
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
