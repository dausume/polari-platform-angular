/**
 * Pure unit specs for the deferred-commit grip navigation (xr-2 +
 * Dustin's 2026-07-12 refinement) — a fake input rig drives it
 * deterministically (no WebXR/iwer here; the session-level
 * integration rides the iwer specs). Pins the contract: grips PLAN
 * (nothing moves while held), the HUD reports the plan in Sim
 * Radii, release CONFIRMS and the rig travels over time, the other
 * grip / any trigger cancels a plan, soft clamps are never silent,
 * snap turn + re-center + history behave.
 */
import * as THREE from 'three';

import { XrNavigation } from './xr-navigation';
import { applyPoseToRig, poseFromRig } from './xr-entry-placement';

interface FakeHandle {
  index: number;
  grip: THREE.Group;
  ray: THREE.Group;
  hand: THREE.Group;
  handedness: 'left' | 'right';
  gamepad: null;
  isHand: boolean;
  gripPressed: boolean;
  gripPressedAt: number;
}

class FakeInputRig {
  handles: FakeHandle[];
  pulses: FakeHandle[] = [];
  axisXValue = 0;

  constructor() {
    this.handles = (['left', 'right'] as const).map((handedness, i) => ({
      index: i,
      grip: new THREE.Group(),
      ray: new THREE.Group(),
      hand: new THREE.Group(),
      handedness,
      gamepad: null,
      isHand: false,
      gripPressed: false,
      gripPressedAt: 0,
    }));
  }

  pressedGrips(): FakeHandle[] {
    return this.handles.filter(h => h.gripPressed && !h.isHand);
  }
  byHand(h: 'left' | 'right'): FakeHandle | null {
    return this.handles.find(x => x.handedness === h) ?? null;
  }
  pulse(handle: FakeHandle | null): void {
    if (handle) this.pulses.push(handle);
  }
  axisX(): number { return this.axisXValue; }
}

describe('XrNavigation (deferred-commit state machine)', () => {
  let rig: THREE.Group;
  let input: FakeInputRig;
  let nav: XrNavigation;
  let worldFocus: boolean;

  const DT = 1 / 60;
  const RADIUS = 5;

  beforeEach(() => {
    rig = new THREE.Group();
    rig.scale.setScalar(2);
    rig.updateMatrixWorld();
    input = new FakeInputRig();
    worldFocus = true;
    nav = new XrNavigation(rig, input as any, () => worldFocus);
    nav.setHome(new THREE.Vector3(0, 0, 0), RADIUS);
  });

  function press(handle: FakeHandle, heldForMs = 0): void {
    handle.gripPressed = true;
    handle.gripPressedAt = performance.now() - heldForMs;
  }

  function left(): FakeHandle { return input.handles[0]; }
  function right(): FakeHandle { return input.handles[1]; }

  function frames(n: number): void {
    for (let i = 0; i < n; i++) nav.update(DT);
  }

  /** Pump until any pending commit + travel completes (bounded).
   *  Always runs at least one frame — a release is only DETECTED on
   *  the next update. */
  function settle(): void {
    frames(2);
    for (let i = 0; i < 400 && nav.isTravelling(); i++) {
      nav.update(DT);
    }
    expect(nav.isTravelling()).toBe(false);
  }

  function armShift(origin: THREE.Vector3): void {
    left().grip.position.copy(origin);
    press(left(), 300);
    frames(2); // pending pickup + arm
    expect(nav.isShiftArmed()).toBe(true);
  }

  it('one grip arms after the debounce with a haptic tick; the dead '
      + 'zone plans nothing', () => {
    left().grip.position.set(0.2, 1.2, -0.3);
    press(left(), 0); // just pressed — inside the debounce window
    frames(1);
    expect(nav.isShiftArmed()).toBe(false);

    left().gripPressedAt = performance.now() - 300; // past 250ms
    frames(1);
    expect(nav.isShiftArmed()).toBe(true);
    expect(input.pulses.length).toBe(1); // the arm tick

    // Inside the dead zone: no plan, and releasing goes nowhere.
    const before = poseFromRig(rig);
    left().grip.position.x += 0.02; // < 0.05 dead zone
    frames(5);
    expect(nav.hud().plan).toBeNull();
    left().gripPressed = false;
    frames(3);
    expect(poseFromRig(rig).position).toEqual(before.position);
  });

  it('a held shift only PLANS (rig frozen, plan in Sim Radii); '
      + 'release confirms and the rig TRAVELS to the target', () => {
    armShift(new THREE.Vector3(0, 1.2, 0));

    left().grip.position.set(0, 1.2, -0.3); // push forward (−Z)
    frames(10);
    // Nothing moved while the grip is held.
    expect(rig.position.length()).toBeLessThan(1e-9);
    // Plan: (0.3 − 0.05 deadzone) / 0.35 ref × 1.0 gain ≈ 0.714 R.
    const hud = nav.hud();
    expect(hud.state).toBe('planning');
    expect(hud.plan!.kind).toBe('move');
    expect(hud.plan!.moveRadii).toBeCloseTo(0.714, 2);

    left().gripPressed = false;
    frames(1);
    expect(nav.isTravelling()).toBe(true);
    const mid = poseFromRig(rig);
    settle();
    // World pushed away along −Z ⇒ rig lands +Z by 0.714 R × 5.
    expect(rig.position.z).toBeCloseTo(0.714 * RADIUS, 1);
    expect(Math.abs(rig.position.x)).toBeLessThan(1e-6);
    expect(rig.scale.x).toBeCloseTo(2, 10); // a move never scales
    // It travelled (some intermediate pose existed between ends).
    expect(mid.position[2]).toBeLessThan(rig.position.z);
  });

  it('the OTHER grip cancels a planned shift; gestures stay dead '
      + 'until all grips release', () => {
    armShift(new THREE.Vector3(0, 1.2, 0));

    press(right(), 0);
    frames(1);
    expect(nav.isShiftArmed()).toBe(false);
    expect(nav.isGrabbing()).toBe(false); // cancel, NOT a grab

    // Still held: nothing restarts, nothing moves.
    left().grip.position.set(0.5, 1.2, 0);
    const before = poseFromRig(rig);
    frames(10);
    expect(poseFromRig(rig)).toEqual(before);

    // Release everything → idle again → a fresh press works.
    left().gripPressed = false;
    right().gripPressed = false;
    frames(1);
    press(left(), 300);
    frames(2);
    expect(nav.isShiftArmed()).toBe(true);
  });

  it('a TRIGGER press cancels a plan (the cancel button)', () => {
    armShift(new THREE.Vector3(0, 1.2, 0));
    left().grip.position.set(0, 1.2, -0.4);
    frames(2);
    expect(nav.hud().plan).not.toBeNull();

    nav.notifyTriggerPress();
    frames(1);
    expect(nav.isShiftArmed()).toBe(false);
    left().gripPressed = false;
    frames(3);
    expect(rig.position.length()).toBeLessThan(1e-9); // never moved
  });

  it('both grips pressed together start a world-grab plan, not a '
      + 'cancel', () => {
    left().grip.position.set(-0.2, 1.2, 0);
    right().grip.position.set(0.2, 1.2, 0);
    press(left(), 0);
    frames(1); // shift-pending on the left grip
    press(right(), 0);
    frames(1);
    expect(nav.isGrabbing()).toBe(true);
  });

  function startGrab(p1: THREE.Vector3, p2: THREE.Vector3): void {
    left().grip.position.copy(p1);
    right().grip.position.copy(p2);
    press(left(), 0);
    press(right(), 0);
    frames(1);
    expect(nav.isGrabbing()).toBe(true);
  }

  it('two-grip: hands APART plan zoom IN (rig frozen while held); '
      + 'release commits — final scale halves and the grabbed world '
      + 'midpoint lands under the hands', () => {
    startGrab(new THREE.Vector3(-0.1, 1.2, 0),
      new THREE.Vector3(0.1, 1.2, 0));
    const grabbedWorld = new THREE.Vector3(0, 2.4, 0);

    left().grip.position.set(-0.2, 1.2, 0);
    right().grip.position.set(0.2, 1.2, 0); // distance ×2
    frames(2);
    expect(rig.scale.x).toBeCloseTo(2, 10); // frozen while held
    const hud = nav.hud();
    expect(hud.plan!.kind).toBe('zoom');
    expect(hud.plan!.zoomFactor).toBeCloseTo(2, 5);

    right().gripPressed = false; // release either hand = confirm
    frames(1);
    left().gripPressed = false;
    settle();
    expect(rig.scale.x).toBeCloseTo(1, 6); // 2 × (0.2/0.4)
    const midWorld = new THREE.Vector3(0, 1.2, 0)
      .multiplyScalar(rig.scale.x).add(rig.position);
    expect(midWorld.distanceTo(grabbedWorld)).toBeLessThan(1e-6);
  });

  it('two-grip: moving both hands plans a translation; twisting '
      + 'plans yaw — applied on release', () => {
    startGrab(new THREE.Vector3(-0.1, 1.2, 0),
      new THREE.Vector3(0.1, 1.2, 0));

    left().grip.position.x += 0.3;
    right().grip.position.x += 0.3;
    frames(1);
    expect(rig.position.x).toBeCloseTo(0, 10); // frozen while held
    right().gripPressed = false;
    frames(1);
    left().gripPressed = false;
    settle();
    expect(rig.position.x).toBeCloseTo(-0.6, 6);
    expect(rig.scale.x).toBeCloseTo(2, 6);

    // Twist: re-grab at a start pose FIRST (the snapshot frame),
    // THEN rotate the pair about Y (keep distance 0.2).
    left().grip.position.set(0.2, 1.2, 0);
    right().grip.position.set(0.4, 1.2, 0);
    press(left(), 0);
    press(right(), 0);
    frames(1); // snapshot
    left().grip.position.set(0.3, 1.2, -0.1);
    right().grip.position.set(0.3, 1.2, 0.1);
    frames(2);
    right().gripPressed = false;
    frames(1);
    left().gripPressed = false;
    settle();
    const yaw = poseFromRig(rig).yaw;
    expect(Math.abs(yaw)).toBeGreaterThan(0.5); // rotated
    expect(rig.scale.x).toBeCloseTo(2, 3);
  });

  it('the scale soft clamp engages honestly during planning (limit '
      + 'flagged, never silent)', () => {
    nav.knobs.scaleRangeExponent = 1; // clamp at 10× either way
    startGrab(new THREE.Vector3(-0.01, 1.2, 0),
      new THREE.Vector3(0.01, 1.2, 0));
    left().grip.position.set(-1, 1.2, 0);
    right().grip.position.set(1, 1.2, 0);
    frames(1);
    expect(nav.consumeLimitHit()).toBe(true);
    expect(nav.consumeLimitHit()).toBe(false); // consumed
    right().gripPressed = false;
    frames(1);
    left().gripPressed = false;
    settle();
    expect(rig.scale.x).toBeCloseTo(0.2, 6);
  });

  it('snap turn: stick right yaws right with hysteresis re-arm', () => {
    input.axisXValue = 1;
    frames(1);
    const yawAfterOne = poseFromRig(rig).yaw;
    expect(yawAfterOne).toBeCloseTo(
      -THREE.MathUtils.degToRad(30), 6);
    frames(5); // still deflected — must NOT re-fire
    expect(poseFromRig(rig).yaw).toBeCloseTo(yawAfterOne, 6);

    input.axisXValue = 0; // recenter re-arms
    frames(1);
    input.axisXValue = -1;
    frames(1);
    expect(poseFromRig(rig).yaw).toBeCloseTo(0, 6);
  });

  it('re-center travels home; back() walks the history (both timed, '
      + 'never a teleport)', () => {
    const home = poseFromRig(rig);

    // Move via a confirmed shift.
    armShift(new THREE.Vector3(0, 1.2, 0));
    left().grip.position.set(0, 1.2, -0.4);
    frames(3);
    left().gripPressed = false;
    settle();
    const moved = poseFromRig(rig);
    expect(moved.position).not.toEqual(home.position);

    expect(nav.back()).toBe(true); // back to pre-shift
    expect(nav.isTravelling()).toBe(true);
    settle();
    expect(poseFromRig(rig).position).toEqual(home.position);

    applyPoseToRig(rig, moved);
    nav.resetView();
    settle();
    expect(poseFromRig(rig)).toEqual(home);
    expect(nav.back()).toBe(true); // reset pushed the pre-reset pose
    settle();
    expect(poseFromRig(rig).position).toEqual(moved.position);
  });

  it('the HUD reports position and distance in Sim Radii', () => {
    rig.position.set(RADIUS, 0, 0); // one radius from the center
    const hud = nav.hud();
    expect(hud.state).toBe('idle');
    expect(hud.xR).toBeCloseTo(1, 6);
    expect(hud.distanceR).toBeCloseTo(1, 6);
    expect(hud.zoom).toBeCloseTo(1, 6);
  });

  it('the translation clamp holds plans within clampRadii', () => {
    nav.knobs.clampRadii = 2;
    nav.knobs.shiftGainRadii = 10; // absurd gain — must clamp
    armShift(new THREE.Vector3(0, 1.2, 0));
    left().grip.position.set(0, 1.2, -0.5);
    frames(2);
    const hud = nav.hud();
    // 2 R + scale slack (2×2=4 world units = 0.8 R) is the ceiling.
    expect(hud.plan!.moveRadii).toBeLessThanOrEqual(2.9);
    expect(nav.consumeLimitHit()).toBe(true);
  });

  it('an implausible bounds measurement is clamped into the '
      + 'entry-scale band, never trusted (the negative-millions-of-R '
      + 'regression)', () => {
    // entryScale is 2 (rig scale at setHome) — a plausible R lies in
    // 2×[0.09 … 50]. Degenerate + absurd measurements clamp loudly.
    nav.setHome(new THREE.Vector3(0, 0, 0), 1e-6); // scene not loaded
    expect(nav.hud().simRadius).toBeCloseTo(2 * 0.45 * 0.2, 6);
    nav.setHome(new THREE.Vector3(0, 0, 0), 1e9); // stray huge helper
    expect(nav.hud().simRadius).toBeCloseTo(2 * 2.5 * 20, 6);
    nav.setHome(new THREE.Vector3(0, 0, 0), Number.NaN);
    expect(Number.isFinite(nav.hud().simRadius)).toBe(true);
  });

  it('bounds are RE-MEASURED at gesture start (bind-time bounds can '
      + 'predate mesh loading)', () => {
    nav.setHome(new THREE.Vector3(0, 0, 0), 1e-6); // degenerate bind
    nav.setBoundsProvider(() => ({
      center: new THREE.Vector3(0, 0, 0), radius: RADIUS,
    }));
    armShift(new THREE.Vector3(0, 1.2, 0));
    expect(nav.hud().simRadius).toBe(RADIUS);
    left().grip.position.set(0, 1.2, -0.3);
    frames(2);
    // The plan is priced in the TRUE radius.
    expect(nav.hud().plan!.moveRadii).toBeCloseTo(0.714, 2);
    left().gripPressed = false;
    settle();
    expect(rig.position.z).toBeCloseTo(0.714 * RADIUS, 1);
  });

  it('a non-finite travel target is REFUSED in place, never applied',
      () => {
    nav.jumpTo({ position: [Number.NaN, 0, 0], yaw: 0, scale: 2 });
    frames(5);
    expect(nav.isTravelling()).toBe(false);
    expect(rig.position.length()).toBeLessThan(1e-9);
    nav.jumpTo({ position: [1e12, 0, 0], yaw: 0, scale: 2 });
    frames(5);
    expect(nav.isTravelling()).toBe(false);
    expect(rig.position.length()).toBeLessThan(1e-9);
  });

  it('RESCUE: a rig that somehow becomes non-finite or implausibly '
      + 'far snaps home loudly, in any mode', () => {
    rig.position.set(3e7, 0, 0); // whatever drove it there
    frames(1);
    expect(rig.position.length()).toBeLessThan(1e-9); // home
    expect(nav.consumeLimitHit()).toBe(true);

    rig.position.set(Number.NaN, 0, 0);
    frames(1);
    expect(Number.isFinite(rig.position.x)).toBe(true);
    expect(rig.position.length()).toBeLessThan(1e-9);
  });

  it('travel terminates even with a corrupted duration (NaN-proof '
      + 'landing + wall-clock cap)', () => {
    nav.jumpTo({ position: [4, 0, 0], yaw: 0, scale: 2 });
    expect(nav.isTravelling()).toBe(true);
    (nav as any).travel.duration = Number.NaN; // corrupt it
    frames(Math.ceil((nav.knobs.commitMaxSeconds + 1.2) / DT));
    expect(nav.isTravelling()).toBe(false);
    expect(rig.position.x).toBeCloseTo(4, 9); // landed on target
  });

  it('gestures never start while another surface owns input focus',
      () => {
    worldFocus = false;
    left().grip.position.set(0, 1.2, 0);
    press(left(), 300);
    frames(3);
    expect(nav.isShiftArmed()).toBe(false);
    press(right(), 300);
    frames(3);
    expect(nav.isGrabbing()).toBe(false);
  });

  it('interrupt() kills a live PLAN unexecuted, and completes a '
      + 'confirmed travel instantly', () => {
    armShift(new THREE.Vector3(0, 1.2, 0));
    left().grip.position.set(0, 1.2, -0.5);
    frames(2);
    nav.interrupt();
    expect(nav.isShiftArmed()).toBe(false);
    left().gripPressed = false;
    frames(5);
    expect(rig.position.length()).toBeLessThan(1e-9); // plan died

    // Confirmed travel + interrupt → lands on the target at once.
    armShift(new THREE.Vector3(0, 1.2, 0));
    left().grip.position.set(0, 1.2, -0.3);
    frames(2);
    left().gripPressed = false;
    frames(2);
    expect(nav.isTravelling()).toBe(true);
    nav.interrupt();
    expect(nav.isTravelling()).toBe(false);
    expect(rig.position.z).toBeCloseTo(0.714 * RADIUS, 1);
  });
});
