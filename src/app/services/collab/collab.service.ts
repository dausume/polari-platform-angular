import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { PolariService } from '@services/polari-service';

/**
 * mtg-3: the backend half of a meeting (collab module).
 *
 * Only SIGNALLING and AUTHORITY live here — tokens, the roster,
 * moderation. Media never touches this service: LiveKit carries it
 * directly over UDP, and nothing arriving that way may mutate Polari
 * state (LIVEKIT_COLLABORATION_PLAN §2).
 *
 * Every call returns the backend's honest refusal body ({ok:false,
 * error, suggestion}) rather than throwing, so a page can RENDER the
 * reason a meeting is unavailable — an absent media server is a
 * message, not a blank screen.
 */

export interface CollabCapability {
  ok: boolean;
  keysConfigured?: boolean;
  serverUrl?: string | null;
  serverReachable?: boolean | null;
  clientUrl?: string | null;
  suggestion?: { evidence?: string; knob?: string; action?: string };
  error?: string;
}

export interface JoinInfo {
  ok: boolean;
  url?: string;
  room?: string;
  scope?: string;
  status?: string;
  tokenEndpoint?: string;
  error?: string;
  suggestion?: { evidence?: string; knob?: string; action?: string };
}

export interface MeetingToken {
  ok: boolean;
  token?: string;
  expiresAt?: number;
  ttlS?: number;
  room?: string;
  identity?: string;
  moderation?: boolean;
  moderator?: string | null;
  error?: string;
  suggestion?: { evidence?: string; knob?: string; action?: string };
}

export interface ServerParticipant {
  identity: string;
  name?: string;
  joinedAt?: string;
  tracks?: number;
}

@Injectable({ providedIn: 'root' })
export class CollabService {
  constructor(
    private http: HttpClient,
    private polariService: PolariService,
  ) {}

  private url(path: string): string {
    return `${this.polariService.getBackendBaseUrl()}/api/collab${path}`;
  }

  private async get<T>(path: string): Promise<T | null> {
    return firstValueFrom(
      this.http.get<T>(this.url(path), this.polariService.backendRequestOptions),
    ).catch((err) => (err?.error?.ok === false ? err.error : null));
  }

  private async post<T>(path: string, body: unknown = {}): Promise<T | null> {
    return firstValueFrom(
      this.http.post<T>(this.url(path), body, this.polariService.backendRequestOptions),
    ).catch((err) => (err?.error?.ok === false ? err.error : null));
  }

  capability(): Promise<CollabCapability | null> {
    return this.get<CollabCapability>('/capability');
  }

  joinInfo(session: string): Promise<JoinInfo | null> {
    return this.get<JoinInfo>(`/sessions/${encodeURIComponent(session)}/join-info`);
  }

  /** The KC-authenticated door onto LiveKit. The Bearer token rides
   *  the app's auth interceptor — this returns the SHORT-LIVED
   *  LiveKit JWT the client dials with. */
  token(session: string): Promise<MeetingToken | null> {
    return this.post<MeetingToken>(`/sessions/${encodeURIComponent(session)}/token`);
  }

  participants(session: string) {
    return this.get<{ ok: boolean; room?: string; participants?: ServerParticipant[]; error?: string }>(
      `/sessions/${encodeURIComponent(session)}/participants`,
    );
  }

  mute(session: string, identity: string) {
    return this.post<{ ok: boolean; mutedTracks?: string[]; error?: string; note?: string }>(
      `/sessions/${encodeURIComponent(session)}/participants/${encodeURIComponent(identity)}/mute`,
    );
  }

  remove(session: string, identity: string) {
    return this.post<{ ok: boolean; error?: string; note?: string }>(
      `/sessions/${encodeURIComponent(session)}/participants/${encodeURIComponent(identity)}/remove`,
    );
  }

  /** Sessions are plain CRUDE rows — the generic surface, not a
   *  bespoke endpoint (object coherence). */
  async sessions(): Promise<any[]> {
    const base = this.polariService.getBackendBaseUrl();
    const body = await firstValueFrom(
      this.http.get<any>(`${base}/CollaborationSession`, this.polariService.backendRequestOptions),
    ).catch(() => null);
    if (!body) { return []; }
    if (Array.isArray(body)) { return body; }
    return body.data ?? body.rows ?? body.CollaborationSession ?? [];
  }
}
