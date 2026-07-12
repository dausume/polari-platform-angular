/**
 * Pure unit specs for the xr-2 grip-navigation state machine — a fake
 * input rig drives it deterministically (no WebXR/iwer here; the
 * session-level integration rides the iwer specs). Pins the Dustin
 * navigation contract: grips navigate, debounce arms with a haptic
 * tick, the other grip cancels an ARMED shift, two grips world-grab
 * with the grabbed midpoint held invariant, soft clamps are never
 * silent, snap turn + reset + history behave.
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

describe('XrNavigation (xr-2 state machine)', () => {
  let rig: THREE.Group;
  let input: FakeInputRig;
  let nav: XrNavigation;
  let worldFocus: boolean;

  const DT = 1 / 60;

  beforeEach(() => {
    rig = new THREE.Group();
    rig.scale.setScalar(2);
    rig.updateMatrixWorld();
    input = new FakeInputRig();
    worldFocus = true;
    nav = new XrNavigation(rig, input as any, () => worldFocus);
    nav.setHome(new THREE.Vector3(0, 0, 0), 5);
  });

  function press(handle: FakeHandle, heldForMs = 0): void {
    handle.gripPressed = true;
    handle.gripPressedAt = performance.now() - heldForMs;
  }

  function left(): FakeHandle { return input.handles[0]; }
  function right(): FakeHandle { return input.handles[1]; }

  /** Pump: pending pickup + arm check + drive frames. */
  function frames(n: number): void {
    for (let i = 0; i < n; i++) nav.update(DT);
  }

  it('one grip arms after the debounce with a haptic tick, and the '
      + 'dead zone suppresses drive', () => {
    left().grip.position.set(0.2, 1.2, -0.3);
    press(left(), 0); // just pressed — inside the debounce window
    frames(1);
    expect(nav.isShiftArmed()).toBe(false);

    left().gripPressedAt = performance.now() - 300; // past 250ms
    frames(1);
    expect(nav.isShiftArmed()).toBe(true);
    expect(input.pulses.length).toBe(1); // the arm tick

    // Inside the dead zone: no motion.
    const before = poseFromRig(rig);
    left().grip.position.x += 0.02; // < 0.05 dead zone
    frames(5);
    expect(poseFromRig(rig).position).toEqual(before.position);
  });

  it('an armed shift drives the rig opposite the push (world pushed '
      + 'away), scale-relative', () => {
    left().grip.position.set(0, 1.2, 0);
    press(left(), 300);
    frames(2); // pending pickup + arm
    expect(nav.isShiftArmed()).toBe(true);

    left().grip.position.set(0, 1.2, -0.3); // push forward (−Z)
    frames(30);
    // World pushed away along −Z ⇒ rig retreats along +Z, scaled by
    // the rig scale (2).
    expect(rig.position.z).toBeGreaterThan(0.01);
    expect(Math.abs(rig.position.x)).toBeLessThan(1e-6);
    expect(rig.scale.x).toBeCloseTo(2, 10); // shift never scales
  });

  it('the OTHER grip cancels an armed shift; gestures stay dead until '
      + 'all grips release', () => {
    left().grip.position.set(0, 1.2, 0);
    press(left(), 300);
    frames(2);
    expect(nav.isShiftArmed()).toBe(true);

    press(right(), 0);
    frames(1);
    expect(nav.isShiftArmed()).toBe(false);
    expect(nav.isGrabbing()).toBe(false); // cancel, NOT a grab

    // Still held: nothing restarts.
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

  it('both grips pressed together start a world-grab, not a cancel',
      () => {
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

  it('two-grip: hands APART zooms IN (rig scale shrinks) and the '
      + 'grabbed world midpoint stays under the hands', () => {
    startGrab(new THREE.Vector3(-0.1, 1.2, 0),
      new THREE.Vector3(0.1, 1.2, 0));
    // The world point grabbed at the midpoint (rig scale 2, origin
    // rig): world = 2 × local.
    const grabbedWorld = new THREE.Vector3(0, 2.4, 0);

    left().grip.position.set(-0.2, 1.2, 0);
    right().grip.position.set(0.2, 1.2, 0); // distance ×2
    frames(1);
    expect(rig.scale.x).toBeCloseTo(1, 6); // 2 × (0.2/0.4)

    // Invariance: the grabbed world point is still under the (new)
    // midpoint: world = P + s·mid.
    const midWorld = new THREE.Vector3(0, 1.2, 0)
      .multiplyScalar(rig.scale.x).add(rig.position);
    expect(midWorld.distanceTo(grabbedWorld)).toBeLessThan(1e-6);
  });

  it('two-grip: moving both hands together translates; twisting '
      + 'rotates about the vertical axis', () => {
    startGrab(new THREE.Vector3(-0.1, 1.2, 0),
      new THREE.Vector3(0.1, 1.2, 0));

    // Translate both hands +X by 0.3: the world under the hands
    // follows ⇒ rig moves −s·Δ.
    left().grip.position.x += 0.3;
    right().grip.position.x += 0.3;
    frames(1);
    expect(rig.position.x).toBeCloseTo(-0.6, 6);
    expect(rig.scale.x).toBeCloseTo(2, 6);

    // Twist the pair 90° about Y (hands now along Z): yaw changes.
    left().grip.position.set(-0.3 + 0.3, 1.2, -0.1);
    right().grip.position.set(0.3 - 0.3, 1.2, 0.1);
    // Keep the distance 0.2 — pure rotation.
    left().grip.position.set(0.3, 1.2, -0.1);
    right().grip.position.set(0.3, 1.2, 0.1);
    frames(1);
    const yaw = poseFromRig(rig).yaw;
    expect(Math.abs(yaw)).toBeGreaterThan(0.5); // rotated
    expect(rig.scale.x).toBeCloseTo(2, 3);
  });

  it('the scale soft clamp engages honestly (limit hit flagged, '
      + 'never silent)', () => {
    nav.knobs.scaleRangeExponent = 1; // clamp at 10× either way
    startGrab(new THREE.Vector3(-0.01, 1.2, 0),
      new THREE.Vector3(0.01, 1.2, 0));
    // Hands apart ×100 → wanted scale 2/100 < 2/10 → clamped.
    left().grip.position.set(-1, 1.2, 0);
    right().grip.position.set(1, 1.2, 0);
    frames(1);
    expect(rig.scale.x).toBeCloseTo(0.2, 6);
    expect(nav.consumeLimitHit()).toBe(true);
    expect(nav.consumeLimitHit()).toBe(false); // consumed
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

  it('reset view restores home; back() walks the history', () => {
    const home = poseFromRig(rig);

    // Move via a shift.
    left().grip.position.set(0, 1.2, 0);
    press(left(), 300);
    frames(2);
    left().grip.position.set(0, 1.2, -0.4);
    frames(30);
    left().gripPressed = false;
    frames(1); // gesture end pushes history
    const moved = poseFromRig(rig);
    expect(moved.position).not.toEqual(home.position);

    expect(nav.back()).toBe(true); // back to pre-shift
    expect(poseFromRig(rig).position).toEqual(home.position);

    applyPoseToRig(rig, moved);
    nav.resetView();
    expect(poseFromRig(rig)).toEqual(home);
    expect(nav.back()).toBe(true); // reset pushed the pre-reset pose
    expect(poseFromRig(rig).position).toEqual(moved.position);
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

  it('interrupt() (headset removal) kills a live gesture until grips '
      + 'release', () => {
    left().grip.position.set(0, 1.2, 0);
    press(left(), 300);
    frames(2);
    expect(nav.isShiftArmed()).toBe(true);

    nav.interrupt();
    expect(nav.isShiftArmed()).toBe(false);
    left().grip.position.set(0, 1.2, -0.5);
    const before = poseFromRig(rig);
    frames(10);
    expect(poseFromRig(rig)).toEqual(before);
  });
});
