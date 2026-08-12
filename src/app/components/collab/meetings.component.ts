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

  private tileTimer: any = null;

  constructor(
    private collab: CollabService,
    private auth: AuthSessionService,
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
    if (!this.sessionName && this.sessions.length) {
      this.sessionName = this.sessions[0]?.name ?? '';
    }
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
