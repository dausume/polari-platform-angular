import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import {
  ConnectionState,
  LocalParticipant,
  Participant,
  RemoteParticipant,
  Room,
  RoomEvent,
  Track,
} from 'livekit-client';

import { AuthSessionService } from '@services/auth/auth-session.service';
import {
  CollabCapability,
  CollabService,
  MeetingToken,
} from '@services/collab/collab.service';
import { RealtimeCodec } from '@services/collab/realtime';
import {
  PeerState,
  applyMessage,
  localPoseFrom,
  reseat,
} from '@services/collab/meeting-xr';
import { XrCapabilityService } from '@services/xr/xr-capability.service';

/**
 * mtg-3: the group-meeting client — THE milestone of the LiveKit arc
 * (LIVEKIT_COLLABORATION_PLAN v2). Join a CollaborationSession row by
 * name, talk, share video and a screen, see who is present, and
 * moderate if you hold the grant.
 *
 * Three postures carried from the plan, visible in this file:
 *  - The media plane is NOT authority. Moderation buttons call the
 *    BACKEND (which holds the admin token); nothing here mutates a
 *    Polari row from a LiveKit event.
 *  - An absent media server is a MESSAGE. The capability ladder's
 *    refusal (evidence/knob/action) renders as the page body rather
 *    than an empty screen or a lie.
 *  - Tokens are short-lived and minted per join; this page never
 *    stores one.
 */

interface Tile {
  identity: string;
  isLocal: boolean;
  speaking: boolean;
  audio: boolean;
  video: boolean;
  screen: boolean;
  /** mtg-4: what SURFACE the peer is on, from their presence
   *  message — 'web' | 'vr' | 'desktop'. A browser labels the
   *  headset in the room without rendering a body. */
  client?: string;
}

@Component({
  selector: 'meetings-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './meetings.component.html',
  styleUrls: ['./meetings.component.css'],
})
export class MeetingsComponent implements OnInit, OnDestroy {
  capability: CollabCapability | null = null;
  sessions: any[] = [];
  sessionName = '';
  loading = true;
  error = '';
  notice = '';

  room: Room | null = null;
  connection: ConnectionState | 'idle' = 'idle';
  joinedRoom = '';
  identity = '';
  moderation = false;
  moderator: string | null = null;

  micOn = false;
  camOn = false;
  screenOn = false;

  tiles: Tile[] = [];

  /** mtg-4 wire state. `peerClients` is what other surfaces told us
   *  they are; `protocolVersion` is shown so a mismatch in the room
   *  is visible rather than mysterious. */
  protocolVersion = '';
  peerClients = new Map<string, string>();
  wireNote = '';

  /** mtg-5: what this DEVICE can do — never conflated with what the
   *  meeting supports (the xr-1 honesty matrix). A disabled button
   *  with a reason, never a hidden affordance. */
  xrVr = false;
  xrReason: string | null = null;
  xrPeers: PeerState[] = [];

  private codec: RealtimeCodec | null = null;
  private peers = new Map<string, PeerState>();
  private tileTimer: any = null;

  constructor(
    private collab: CollabService,
    private auth: AuthSessionService,
    private xrCapability: XrCapabilityService,
  ) {}

  get signedIn(): boolean {
    return this.auth.isAuthenticated;
  }

  get username(): string {
    return this.auth.currentUser?.username ?? this.auth.currentUser?.name ?? '';
  }

  async ngOnInit(): Promise<void> {
    this.capability = await this.collab.capability();
    this.sessions = await this.collab.sessions();
    const catalog = await this.collab.realtimeCatalog();
    if (catalog?.kinds) {
      this.codec = new RealtimeCodec(catalog, this.username || 'me');
      this.protocolVersion = catalog.protocolVersion;
    }
    if (!this.sessionName && this.sessions.length) {
      this.sessionName = this.sessions[0]?.name ?? '';
    }
    const xr = await this.xrCapability.capability();
    this.xrVr = xr.vr;
    this.xrReason = xr.reason;
    this.loading = false;
  }

  ngOnDestroy(): void {
    this.leave();
  }

  /** Is the backend able to run a meeting at all? Null capability =
   *  the module itself is not served here. */
  get meetingsPossible(): boolean {
    return !!this.capability?.ok
      && !!this.capability?.keysConfigured
      && !!this.capability?.clientUrl;
  }

  async join(): Promise<void> {
    this.error = '';
    this.notice = '';
    if (!this.sessionName) {
      this.error = 'Pick a session first.';
      return;
    }
    if (!this.signedIn) {
      this.error = 'Sign in first — a LiveKit token requires a '
        + 'Keycloak-verified caller (the backend refuses otherwise).';
      return;
    }

    const info = await this.collab.joinInfo(this.sessionName);
    if (!info?.ok || !info.url) {
      this.error = info?.error ?? 'The backend would not say where to connect.';
      if (info?.suggestion?.action) { this.notice = info.suggestion.action; }
      return;
    }

    const minted: MeetingToken | null = await this.collab.token(this.sessionName);
    if (!minted?.ok || !minted.token) {
      this.error = minted?.error ?? 'No meeting token was issued.';
      if (minted?.suggestion?.action) { this.notice = minted.suggestion.action; }
      return;
    }

    this.moderation = !!minted.moderation;
    this.moderator = minted.moderator ?? null;
    this.identity = minted.identity ?? this.username;

    const room = new Room({ adaptiveStream: true, dynacast: true });
    this.room = room;
    room
      .on(RoomEvent.ConnectionStateChanged, (state) => {
        this.connection = state;
        this.refreshTiles();
      })
      .on(RoomEvent.ParticipantConnected, () => this.refreshTiles())
      .on(RoomEvent.ParticipantDisconnected, () => this.refreshTiles())
      .on(RoomEvent.TrackSubscribed, (track, _pub, participant) => {
        this.attach(track, participant);
        this.refreshTiles();
      })
      .on(RoomEvent.TrackUnsubscribed, (track) => {
        track.detach().forEach((el) => el.remove());
        this.refreshTiles();
      })
      .on(RoomEvent.LocalTrackPublished, () => this.refreshTiles())
      .on(RoomEvent.LocalTrackUnpublished, () => this.refreshTiles())
      .on(RoomEvent.ActiveSpeakersChanged, () => this.refreshTiles())
      .on(RoomEvent.DataReceived, (payload, participant) =>
        this.onWireMessage(payload, participant?.identity ?? ''))
      .on(RoomEvent.Disconnected, () => {
        this.connection = 'idle';
        this.joinedRoom = '';
        this.tiles = [];
      });

    try {
      await room.connect(info.url, minted.token);
    } catch (e: any) {
      this.error = `Could not reach the media server: ${e?.message ?? e}`;
      this.room = null;
      return;
    }
    this.joinedRoom = info.room ?? this.sessionName;

    try {
      await room.localParticipant.setMicrophoneEnabled(true);
      this.micOn = true;
    } catch {
      // A meeting without a working mic is still a meeting — listen,
      // watch, share. Say so instead of failing the join.
      this.notice = 'Joined without a microphone (no device, or '
        + 'permission denied) — you can still hear and share.';
    }
    this.refreshTiles();
    this.tileTimer = setInterval(() => this.refreshTiles(), 1000);
    // mtg-4: say who we are on the wire. Presence is sent on join and
    // on change — not a heartbeat; LiveKit already reports connection
    // state, and duplicating it would just spend bandwidth.
    this.emit('presence', { displayName: this.identity, client: 'web' });
  }

  /** Send one catalog-validated message. Returns false when the
   *  catalog is absent, the message is malformed, or the kind's rate
   *  ceiling says not yet — all three are the sender's problem, and
   *  none of them should reach a peer. */
  private emit(kind: string, data: Record<string, any>): boolean {
    if (!this.codec || !this.room) { return false; }
    const message = this.codec.encode(kind, data);
    if (!message) { return false; }
    this.room.localParticipant.publishData(
      new TextEncoder().encode(JSON.stringify(message)),
      { reliable: kind === 'presence' },
    );
    return true;
  }

  /** Everything arriving here is EPHEMERAL (plan §2). It may move a
   *  marker, label a tile, or draw a preview — it may never write a
   *  Polari row. */
  private onWireMessage(payload: Uint8Array, from: string): void {
    if (!this.codec) { return; }
    let raw: any;
    try {
      raw = JSON.parse(new TextDecoder().decode(payload));
    } catch {
      return;   // not ours; another data-channel user is not an error
    }
    const decoded = this.codec.decode(raw);
    if (!decoded.ok) {
      // Ignored kinds are forward compatibility working. A REFUSAL is
      // worth surfacing: it means a peer in this room disagrees with
      // us about the protocol, and a silent mismatch is how a VR
      // client "mysteriously does nothing".
      if ('refused' in decoded) {
        this.wireNote = `Message from ${from || 'a peer'} refused: ${decoded.reason}`;
      }
      return;
    }
    // mtg-5: the same messages drive the VR scene's peer table. Pure
    // functions decide seating/placement; nothing here writes a row.
    const seats = Math.max((this.room?.remoteParticipants.size ?? 0) + 1, 1);
    this.peers = applyMessage(this.peers, decoded, Date.now(), seats);
    this.xrPeers = [...reseat(this.peers, Date.now()).values()];

    if (decoded.kind === 'presence') {
      this.peerClients.set(decoded.sender || from, String(decoded.data['client'] ?? ''));
      this.refreshTiles();
      // Answer a newcomer so they learn about us too — presence is
      // exchanged, not broadcast into the void.
      this.emit('presence', { displayName: this.identity, client: 'web' });
    }
  }

  /** mtg-5: publish this device's tracked pose, from an XR frame.
   *  Wired by the immersive session's frame loop; the catalog's
   *  20Hz ceiling throttles it. Public so the session runtime (and
   *  the specs) can drive it without reaching into private state. */
  publishPose(viewerTransform: any, hands: any[] = []): boolean {
    const pose = localPoseFrom(viewerTransform, hands);
    if (!pose) { return false; }   // tracking still settling
    return this.emit('pose', pose as unknown as Record<string, any>);
  }

  /** Cursor is the flat equivalent of a hand (mtg-4). Normalised so
   *  peers with different viewports agree; the codec's rate ceiling
   *  drops the excess rather than flooding the channel. */
  onPointerMove(event: PointerEvent): void {
    if (!this.joinedRoom) { return; }
    const host = event.currentTarget as HTMLElement;
    const box = host.getBoundingClientRect();
    if (!box.width || !box.height) { return; }
    this.emit('cursor', {
      x: Math.min(1, Math.max(0, (event.clientX - box.left) / box.width)),
      y: Math.min(1, Math.max(0, (event.clientY - box.top) / box.height)),
      surface: `/meetings#${this.joinedRoom}`,
    });
  }

  private attach(track: Track, participant: Participant): void {
    if (track.kind === Track.Kind.Audio && !participant.isLocal) {
      // Remote audio must be in the DOM to be audible; local audio
      // must NOT be (that is an echo).
      const el = track.attach();
      el.setAttribute('data-lk-audio', participant.identity);
      document.body.appendChild(el);
      return;
    }
    if (track.kind === Track.Kind.Video) {
      const host = document.getElementById(`video-${participant.identity}`);
      if (host) {
        const el = track.attach() as HTMLVideoElement;
        el.style.width = '100%';
        el.style.height = '100%';
        el.style.objectFit = 'cover';
        host.replaceChildren(el);
      }
    }
  }

  private refreshTiles(): void {
    const room = this.room;
    if (!room) { this.tiles = []; return; }
    const speaking = new Set(room.activeSpeakers.map((s) => s.identity));
    const rows: Tile[] = [];
    const describe = (p: Participant, isLocal: boolean): Tile => ({
      identity: p.identity,
      isLocal,
      speaking: speaking.has(p.identity),
      audio: this.hasTrack(p, Track.Source.Microphone),
      video: this.hasTrack(p, Track.Source.Camera),
      screen: this.hasTrack(p, Track.Source.ScreenShare),
      client: isLocal ? 'web' : this.peerClients.get(p.identity),
    });
    rows.push(describe(room.localParticipant as LocalParticipant, true));
    room.remoteParticipants.forEach((p: RemoteParticipant) =>
      rows.push(describe(p, false)));
    this.tiles = rows;
  }

  private hasTrack(p: Participant, source: Track.Source): boolean {
    const pub = p.getTrackPublication(source);
    return !!pub && !pub.isMuted;
  }

  async toggleMic(): Promise<void> {
    if (!this.room) { return; }
    this.micOn = !this.micOn;
    await this.room.localParticipant.setMicrophoneEnabled(this.micOn);
    this.refreshTiles();
  }

  async toggleCam(): Promise<void> {
    if (!this.room) { return; }
    this.camOn = !this.camOn;
    await this.room.localParticipant.setCameraEnabled(this.camOn);
    this.refreshTiles();
  }

  async toggleScreen(): Promise<void> {
    if (!this.room) { return; }
    this.screenOn = !this.screenOn;
    try {
      await this.room.localParticipant.setScreenShareEnabled(this.screenOn);
    } catch (e: any) {
      this.screenOn = false;
      this.notice = `Screen share not started: ${e?.message ?? e}`;
    }
    this.refreshTiles();
  }

  /** Moderation goes through POLARI, never through this client's own
   *  LiveKit connection — the browser holds no admin rights. */
  async mute(identity: string): Promise<void> {
    const result = await this.collab.mute(this.sessionName, identity);
    this.notice = result?.ok
      ? `Muted ${identity}. ${result.note ?? ''}`
      : `Could not mute ${identity}: ${result?.error ?? 'unknown error'}`;
  }

  async removeParticipant(identity: string): Promise<void> {
    const result = await this.collab.remove(this.sessionName, identity);
    this.notice = result?.ok
      ? `Removed ${identity}. ${result.note ?? ''}`
      : `Could not remove ${identity}: ${result?.error ?? 'unknown error'}`;
  }

  leave(): void {
    if (this.tileTimer) { clearInterval(this.tileTimer); this.tileTimer = null; }
    this.peerClients.clear();
    this.wireNote = '';
    document.querySelectorAll('[data-lk-audio]').forEach((el) => el.remove());
    if (this.room) {
      this.room.disconnect();
      this.room = null;
    }
    this.connection = 'idle';
    this.joinedRoom = '';
    this.tiles = [];
    this.micOn = this.camOn = this.screenOn = false;
  }
}
