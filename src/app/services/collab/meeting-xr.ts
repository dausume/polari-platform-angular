/**
 * mtg-5: the VR meeting scene, as PURE FUNCTIONS.
 *
 * Everything a headset session needs to decide — where an avatar
 * goes, how loud and which side a voice comes from, when a stale peer
 * disappears — lives here, free of THREE and of WebXR, so it can be
 * tested on a machine with no headset attached. The component wires
 * these outputs to actual objects; that binding is the only part that
 * needs a device to verify.
 *
 * THE LINE (plan §2) holds here too: this file consumes mtg-4
 * messages to DRAW, and never to write. A remote pose moves a
 * rendered head. It does not move a Polari row.
 *
 * Ring placement, not free positioning: a headset reports where a
 * person is in THEIR room, whose origin has nothing to do with
 * anyone else's. Until there is a shared spatial anchor (a scanned
 * environment, mtg-7), pretending otherwise would put two people in
 * the same chair. So peers are seated on a ring by a stable hash of
 * identity, and each peer's OWN tracked pose animates them within
 * their seat. That is honest about what we know.
 */

export interface PeerPose {
  head: [number, number, number];
  headRot: [number, number, number, number];
  leftHand?: [number, number, number];
  rightHand?: [number, number, number];
}

export interface PeerState {
  identity: string;
  displayName: string;
  client: string;
  avatarRef: string;
  colour: string;
  seat: number;
  /** Seat centre in scene metres. */
  origin: [number, number, number];
  /** Yaw so a seated peer faces the ring centre. */
  facing: number;
  pose: PeerPose | null;
  speaking: boolean;
  lastSeen: number;
}

/** Ring radius in metres — close enough to read a face, far enough
 *  that nobody is inside anyone else. */
export const RING_RADIUS_M = 1.8;

/** A peer that has said nothing for this long is treated as gone for
 *  RENDERING purposes only; LiveKit's participant list remains the
 *  authority on who is actually connected. */
export const STALE_AFTER_MS = 15000;

/** Stable seat index from an identity string: the same person lands
 *  in the same seat for everyone in the room, with no coordinator. */
export function seatOf(identity: string, seats: number): number {
  if (seats <= 0) { return 0; }
  let hash = 0;
  for (let i = 0; i < identity.length; i++) {
    hash = (hash * 31 + identity.charCodeAt(i)) >>> 0;
  }
  return hash % seats;
}

/** Seat centre + facing for a seat on the ring. Seat 0 sits at -Z
 *  (straight ahead of a default-oriented viewer) and everyone faces
 *  the middle. */
export function seatPlacement(
  seat: number, seats: number, radius = RING_RADIUS_M,
): { origin: [number, number, number]; facing: number } {
  const angle = seats > 0 ? (2 * Math.PI * seat) / seats : 0;
  const x = radius * Math.sin(angle);
  const z = -radius * Math.cos(angle);
  // Face the centre: the yaw that turns -Z toward the origin.
  return { origin: [x, 0, z], facing: Math.atan2(-x, -z) + Math.PI };
}

/** Where to draw a peer's head, in scene coordinates.
 *
 *  The peer's tracked head is RELATIVE to their own room origin, so
 *  only its offset from a nominal standing height is applied inside
 *  the seat — lateral sway and crouching read correctly, absolute
 *  room position (which means nothing to us) does not leak in.
 */
export function headPosition(
  peer: PeerState, eyeHeightM = 1.7,
): [number, number, number] {
  const [ox, , oz] = peer.origin;
  if (!peer.pose) { return [ox, eyeHeightM, oz]; }
  const [px, py, pz] = peer.pose.head;
  const lateralLimit = 0.6;   // a seat is not a room; clamp the sway
  const clamp = (v: number) => Math.max(-lateralLimit, Math.min(lateralLimit, v));
  return [ox + clamp(px), Math.max(0.4, py), oz + clamp(pz)];
}

/** Stereo pan (-1 left … +1 right) and gain (0…1) for a peer's voice,
 *  given where the listener is looking.
 *
 *  "Spatial-ish" on purpose (plan §5): panning by pose is enough to
 *  tell two speakers apart, and it costs nothing. Real HRTF spatial
 *  audio is a later step and should not be implied by this one.
 */
export function audioPlacement(
  peer: PeerState,
  listenerYaw: number,
  listenerAt: [number, number, number] = [0, 0, 0],
): { pan: number; gain: number; distance: number } {
  const [hx, , hz] = headPosition(peer);
  const dx = hx - listenerAt[0];
  const dz = hz - listenerAt[2];
  const distance = Math.hypot(dx, dz);
  // Bearing of the peer relative to where the listener faces.
  const bearing = Math.atan2(dx, -dz) - listenerYaw;
  const pan = Math.max(-1, Math.min(1, Math.sin(bearing)));
  // Gentle rolloff: a meeting is not a battlefield, and a quiet
  // colleague across the ring must stay intelligible.
  const gain = Math.max(0.35, Math.min(1, 1 / (1 + 0.25 * distance)));
  return { pan, gain, distance };
}

/** Fold one decoded mtg-4 message into the peer table. Returns a NEW
 *  map (the caller decides when to re-render), and never throws on a
 *  message for an unknown peer — presence may arrive after pose. */
export function applyMessage(
  peers: Map<string, PeerState>,
  decoded: { kind: string; data: Record<string, any>; sender: string },
  now: number,
  seats: number,
): Map<string, PeerState> {
  const identity = decoded.sender;
  if (!identity) { return peers; }
  const next = new Map(peers);
  const seat = seatOf(identity, Math.max(seats, 1));
  const placement = seatPlacement(seat, Math.max(seats, 1));
  const existing = next.get(identity);
  const peer: PeerState = existing ?? {
    identity,
    displayName: identity,
    client: 'unknown',
    avatarRef: '',
    colour: '#6a7fd6',
    seat,
    origin: placement.origin,
    facing: placement.facing,
    pose: null,
    speaking: false,
    lastSeen: now,
  };
  peer.lastSeen = now;
  switch (decoded.kind) {
    case 'presence':
      peer.displayName = String(decoded.data['displayName'] ?? identity);
      peer.client = String(decoded.data['client'] ?? 'unknown');
      peer.avatarRef = String(decoded.data['avatarRef'] ?? '');
      break;
    case 'pose':
      peer.pose = {
        head: decoded.data['head'],
        headRot: decoded.data['headRot'],
        leftHand: decoded.data['leftHand'],
        rightHand: decoded.data['rightHand'],
      };
      break;
    case 'speaking':
      peer.speaking = !!decoded.data['speaking'];
      break;
    default:
      break;   // cursor/drag-preview belong to the flat surfaces
  }
  next.set(identity, peer);
  return next;
}

/** Re-seat everyone for the current headcount and drop peers that
 *  have gone quiet. Called when the participant list changes. */
export function reseat(
  peers: Map<string, PeerState>, now: number,
): Map<string, PeerState> {
  const live = [...peers.values()].filter(
    (p) => now - p.lastSeen < STALE_AFTER_MS,
  );
  const seats = Math.max(live.length, 1);
  const next = new Map<string, PeerState>();
  for (const peer of live) {
    const seat = seatOf(peer.identity, seats);
    const placement = seatPlacement(seat, seats);
    next.set(peer.identity, {
      ...peer, seat, origin: placement.origin, facing: placement.facing,
    });
  }
  return next;
}

/** The local pose to PUBLISH, read from an XR frame's viewer pose.
 *  Returns null when the frame has no pose yet (tracking still
 *  settling) — sending zeros would teleport an avatar to the floor. */
export function localPoseFrom(
  viewerTransform: { position: { x: number; y: number; z: number };
                     orientation: { x: number; y: number; z: number; w: number } } | null,
  hands: Array<{ x: number; y: number; z: number } | null> = [],
): PeerPose | null {
  if (!viewerTransform) { return null; }
  const { position: p, orientation: o } = viewerTransform;
  const pose: PeerPose = {
    head: [round(p.x), round(p.y), round(p.z)],
    headRot: [round(o.x), round(o.y), round(o.z), round(o.w)],
  };
  if (hands[0]) { pose.leftHand = [round(hands[0].x), round(hands[0].y), round(hands[0].z)]; }
  if (hands[1]) { pose.rightHand = [round(hands[1].x), round(hands[1].y), round(hands[1].z)]; }
  return pose;
}

/** Millimetre precision is plenty for an avatar and keeps the
 *  messages small — at 20Hz across a room, the bytes matter. */
function round(v: number): number {
  return Math.round(v * 1000) / 1000;
}
