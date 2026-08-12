/**
 * mtg-5: specs for the VR meeting scene math. No headset, no THREE,
 * no WebXR — that is the point of keeping this logic pure: the
 * decisions (seating, placement, panning, staleness) are verifiable
 * on a machine with no device attached, leaving only the binding to
 * real objects for a device pass.
 */
import {
  PeerState,
  RING_RADIUS_M,
  STALE_AFTER_MS,
  applyMessage,
  audioPlacement,
  headPosition,
  localPoseFrom,
  reseat,
  seatOf,
  seatPlacement,
} from './meeting-xr';

const peerAt = (identity: string, seat: number, seats: number): PeerState => {
  const placement = seatPlacement(seat, seats);
  return {
    identity, displayName: identity, client: 'vr', avatarRef: '',
    colour: '#fff', seat, origin: placement.origin,
    facing: placement.facing, pose: null, speaking: false, lastSeen: 0,
  };
};

describe('mtg-5 meeting scene math', () => {
  it('seats an identity the same way for everyone (no coordinator)', () => {
    expect(seatOf('alice', 4)).toBe(seatOf('alice', 4));
    expect(seatOf('alice', 4)).toBeLessThan(4);
    expect(seatOf('', 4)).toBe(0);
    expect(seatOf('alice', 0)).toBe(0);
  });

  it('places seats on the ring, all facing the centre', () => {
    const seats = 4;
    for (let seat = 0; seat < seats; seat++) {
      const { origin } = seatPlacement(seat, seats);
      const radius = Math.hypot(origin[0], origin[2]);
      expect(radius).toBeCloseTo(RING_RADIUS_M, 6);
      expect(origin[1]).toBe(0);
    }
    // seat 0 is straight ahead at -Z
    expect(seatPlacement(0, seats).origin[2]).toBeCloseTo(-RING_RADIUS_M, 6);
  });

  it('keeps a peer inside their seat — a remote room origin never '
     + 'leaks in as absolute position', () => {
    const peer = peerAt('bob', 1, 4);
    // bob's headset says he is 40 metres away in HIS room
    peer.pose = { head: [40, 1.6, -40], headRot: [0, 0, 0, 1] };
    const [x, y, z] = headPosition(peer);
    expect(Math.abs(x - peer.origin[0])).toBeLessThanOrEqual(0.6);
    expect(Math.abs(z - peer.origin[2])).toBeLessThanOrEqual(0.6);
    expect(y).toBeCloseTo(1.6, 6);
  });

  it('never drops a head below a sensible floor', () => {
    const peer = peerAt('bob', 0, 2);
    peer.pose = { head: [0, -3, 0], headRot: [0, 0, 0, 1] };
    expect(headPosition(peer)[1]).toBeGreaterThanOrEqual(0.4);
  });

  it('pans a voice to the side the speaker is on, and recentres when '
     + 'the listener turns to face them', () => {
    const seats = 4;
    const right = peerAt('r', 1, seats);      // +X side of the ring
    const facingForward = audioPlacement(right, 0);
    expect(facingForward.pan).toBeGreaterThan(0.5);
    // turn to look at them: the bearing collapses, the pan centres
    const bearing = Math.atan2(right.origin[0], -right.origin[2]);
    const facingThem = audioPlacement(right, bearing);
    expect(Math.abs(facingThem.pan)).toBeLessThan(0.01);
  });

  it('keeps a distant colleague intelligible (gain floor)', () => {
    const far = peerAt('far', 2, 4);
    far.pose = { head: [0.6, 1.7, 0.6], headRot: [0, 0, 0, 1] };
    const { gain } = audioPlacement(far, 0);
    expect(gain).toBeGreaterThanOrEqual(0.35);
    expect(gain).toBeLessThanOrEqual(1);
  });

  it('folds presence, pose and speaking into the peer table', () => {
    let peers = new Map<string, PeerState>();
    peers = applyMessage(peers, {
      kind: 'presence', sender: 'zoe',
      data: { displayName: 'Zoe', client: 'vr', avatarRef: 'avatar-primitive-moss' },
    }, 1000, 2);
    expect(peers.get('zoe')!.displayName).toBe('Zoe');
    expect(peers.get('zoe')!.avatarRef).toBe('avatar-primitive-moss');

    peers = applyMessage(peers, {
      kind: 'pose', sender: 'zoe',
      data: { head: [0, 1.7, 0], headRot: [0, 0, 0, 1] },
    }, 1100, 2);
    expect(peers.get('zoe')!.pose!.head).toEqual([0, 1.7, 0]);
    expect(peers.get('zoe')!.displayName).toBe('Zoe');  // not clobbered

    peers = applyMessage(peers, {
      kind: 'speaking', sender: 'zoe', data: { speaking: true },
    }, 1200, 2);
    expect(peers.get('zoe')!.speaking).toBeTrue();
    expect(peers.get('zoe')!.lastSeen).toBe(1200);
  });

  it('tolerates pose arriving BEFORE presence', () => {
    const peers = applyMessage(new Map(), {
      kind: 'pose', sender: 'early',
      data: { head: [0, 1.5, 0], headRot: [0, 0, 0, 1] },
    }, 10, 1);
    expect(peers.get('early')!.pose).toBeTruthy();
    expect(peers.get('early')!.displayName).toBe('early');
  });

  it('ignores a message with no sender, and flat-surface kinds', () => {
    expect(applyMessage(new Map(), {
      kind: 'presence', sender: '', data: {},
    }, 0, 1).size).toBe(0);
    const peers = applyMessage(new Map(), {
      kind: 'cursor', sender: 'x', data: { x: 0.5, y: 0.5 },
    }, 0, 1);
    expect(peers.get('x')!.pose).toBeNull();   // known peer, no pose
  });

  it('re-seats on headcount change and drops the long-silent', () => {
    let peers = new Map<string, PeerState>();
    for (const who of ['a', 'b', 'c']) {
      peers = applyMessage(peers, {
        kind: 'presence', sender: who, data: { displayName: who, client: 'vr' },
      }, 1000, 3);
    }
    const reseated = reseat(peers, 1000);
    expect(reseated.size).toBe(3);
    const seatsUsed = new Set([...reseated.values()].map((p) => p.seat));
    expect(seatsUsed.size).toBeGreaterThan(1);   // not all in one chair

    const later = reseat(peers, 1000 + STALE_AFTER_MS + 1);
    expect(later.size).toBe(0);
  });

  it('publishes nothing while tracking is still settling', () => {
    expect(localPoseFrom(null)).toBeNull();
  });

  it('rounds a published pose to millimetres (bytes matter at 20Hz)', () => {
    const pose = localPoseFrom(
      { position: { x: 0.123456, y: 1.654321, z: -0.987654 },
        orientation: { x: 0, y: 0.7071068, z: 0, w: 0.7071068 } },
      [{ x: -0.3000004, y: 1.2, z: 0.2 }, null],
    );
    expect(pose!.head).toEqual([0.123, 1.654, -0.988]);
    expect(pose!.leftHand).toEqual([-0.3, 1.2, 0.2]);
    expect(pose!.rightHand).toBeUndefined();
  });
});
