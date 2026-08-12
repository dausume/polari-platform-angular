import { CommonModule } from '@angular/common';
import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { ConnectionState, Room, RoomEvent, Track } from 'livekit-client';

import { AuthSessionService } from '@services/auth/auth-session.service';
import { CollabService } from '@services/collab/collab.service';
import { RealtimeCodec } from '@services/collab/realtime';

/**
 * mtg-6: voice ALONGSIDE the model — a small dock any page can drop
 * in so people can talk while looking at the same simulation.
 *
 *   <meeting-dock></meeting-dock>                  (binds by route)
 *   <meeting-dock [ref]="'SimSpaceDefinition/x'">  (binds by object)
 *
 * Deliberately AUDIO-ONLY. A page whose whole point is a model on
 * screen should not have video tiles fighting it for pixels; the full
 * client at /meetings is where faces and screens belong.
 *
 * WHICH meeting belongs to this page is a ROW (bound_route /
 * bound_ref), so neither side hardcodes the other — and a page with
 * no meeting renders NOTHING at all rather than an apology for a
 * feature nobody asked for here.
 */
@Component({
  selector: 'meeting-dock',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="dock" *ngIf="session">
      <span class="dot" [class.live]="connected"></span>
      <span class="label">
        {{ session.title }}
        <span class="muted" *ngIf="!connected">· voice available</span>
        <span class="muted" *ngIf="connected">
          · {{ peers.length + 1 }} here{{ speaking.length ? ' · ' + speaking.join(', ') + ' speaking' : '' }}
        </span>
      </span>
      <button *ngIf="!connected" (click)="join()" [disabled]="!signedIn">
        Join voice
      </button>
      <ng-container *ngIf="connected">
        <button (click)="toggleMic()">{{ micOn ? 'Mute' : 'Unmute' }}</button>
        <button (click)="leave()">Leave</button>
      </ng-container>
      <a class="muted full" routerLink="/meetings">full meeting</a>
      <span class="muted" *ngIf="!signedIn">sign in to join</span>
      <span class="err" *ngIf="error">{{ error }}</span>
    </div>
  `,
  styles: [`
    .dock {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--spacing-sm);
      background: var(--surface-secondary);
      color: var(--text-on-card);
      border: 1px solid var(--surface-outline);
      border-radius: var(--radius-md);
      padding: var(--spacing-xs) var(--spacing-md);
      margin-bottom: var(--spacing-md);
    }
    .dot {
      width: 0.6rem; height: 0.6rem; border-radius: 50%;
      background: var(--text-on-card-muted); flex: none;
    }
    .dot.live { background: var(--brand-green); }
    .label { color: var(--text-on-card); }
    .muted { color: var(--text-on-card-muted); font-size: var(--font-size-sm); }
    .full { margin-left: auto; }
    .err { color: var(--color-error-text); font-size: var(--font-size-sm); }
    button {
      background: var(--surface-primary);
      color: var(--text-on-card);
      border: 1px solid var(--surface-outline);
      border-radius: var(--radius-sm);
      padding: var(--spacing-xs) var(--spacing-sm);
      cursor: pointer;
    }
    button:disabled { opacity: 0.55; cursor: not-allowed; }
  `],
})
export class MeetingDockComponent implements OnInit, OnDestroy {
  /** Bind by object instead of route ('Class/name'). */
  @Input() ref = '';
  /** Override the route to ask about (defaults to the current URL). */
  @Input() route = '';

  session: { name: string; title: string; room: string } | null = null;
  connected = false;
  micOn = false;
  error = '';
  peers: string[] = [];
  speaking: string[] = [];

  private room: Room | null = null;
  private codec: RealtimeCodec | null = null;

  constructor(
    private collab: CollabService,
    private auth: AuthSessionService,
    private router: Router,
  ) {}

  get signedIn(): boolean {
    return this.auth.isAuthenticated;
  }

  async ngOnInit(): Promise<void> {
    const route = this.route || this.router.url.split('?')[0];
    const found = await this.collab.sessionsForSurface(
      this.ref ? '' : route, this.ref);
    this.session = found?.sessions?.[0] ?? null;
    if (this.session) {
      const catalog = await this.collab.realtimeCatalog();
      if (catalog?.kinds) {
        this.codec = new RealtimeCodec(
          catalog, this.auth.currentUser?.username ?? 'me');
      }
    }
  }

  ngOnDestroy(): void {
    this.leave();
  }

  async join(): Promise<void> {
    this.error = '';
    if (!this.session) { return; }
    const info = await this.collab.joinInfo(this.session.name);
    const minted = await this.collab.token(this.session.name);
    if (!info?.ok || !info.url || !minted?.ok || !minted.token) {
      this.error = minted?.error ?? info?.error ?? 'Could not join.';
      return;
    }
    const room = new Room();
    this.room = room;
    room
      .on(RoomEvent.TrackSubscribed, (track, _pub, participant) => {
        if (track.kind === Track.Kind.Audio && !participant.isLocal) {
          const el = track.attach();
          el.setAttribute('data-lk-dock', participant.identity);
          document.body.appendChild(el);
        }
      })
      .on(RoomEvent.TrackUnsubscribed, (track) =>
        track.detach().forEach((el) => el.remove()))
      .on(RoomEvent.ParticipantConnected, () => this.refresh())
      .on(RoomEvent.ParticipantDisconnected, () => this.refresh())
      .on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
        this.speaking = speakers
          .filter((s) => !s.isLocal)
          .map((s) => s.identity);
      })
      .on(RoomEvent.ConnectionStateChanged, (state) => {
        this.connected = state === ConnectionState.Connected;
      })
      .on(RoomEvent.Disconnected, () => {
        this.connected = false;
        this.peers = [];
        this.speaking = [];
      });
    try {
      await room.connect(info.url, minted.token);
    } catch (e: any) {
      this.error = `Media server unreachable: ${e?.message ?? e}`;
      this.room = null;
      return;
    }
    try {
      await room.localParticipant.setMicrophoneEnabled(true);
      this.micOn = true;
    } catch {
      // Listening is still worth joining for.
      this.micOn = false;
    }
    this.refresh();
    // Say which surface we are on — a peer in the full client can see
    // that someone is here FROM the model page (mtg-4 presence).
    const message = this.codec?.encode('presence', {
      displayName: this.auth.currentUser?.username ?? 'someone',
      client: 'web',
    });
    if (message) {
      room.localParticipant.publishData(
        new TextEncoder().encode(JSON.stringify(message)),
        { reliable: true });
    }
  }

  async toggleMic(): Promise<void> {
    if (!this.room) { return; }
    this.micOn = !this.micOn;
    await this.room.localParticipant.setMicrophoneEnabled(this.micOn);
  }

  leave(): void {
    document.querySelectorAll('[data-lk-dock]').forEach((el) => el.remove());
    this.room?.disconnect();
    this.room = null;
    this.connected = false;
    this.micOn = false;
    this.peers = [];
    this.speaking = [];
  }

  private refresh(): void {
    this.peers = [...(this.room?.remoteParticipants.values() ?? [])]
      .map((p) => p.identity);
  }
}
