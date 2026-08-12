import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { PolariService } from '@services/polari-service';
import { RealtimeCatalog } from '@services/collab/realtime';

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

  /** mtg-4: the realtime catalog, fetched rather than mirrored — the
   *  client validates against what the server declares, so there is
   *  no second copy to drift out of lockstep. */
  realtimeCatalog(): Promise<RealtimeCatalog | null> {
    return this.get<RealtimeCatalog>('/realtime-schema');
  }

  /** mtg-6: the meeting bound to this page/object, if any. An empty
   *  list is a normal answer — most pages have no meeting. */
  sessionsForSurface(route: string, ref = '') {
    const query = ref
      ? `ref=${encodeURIComponent(ref)}`
      : `route=${encodeURIComponent(route)}`;
    return this.get<{
      ok: boolean;
      sessions?: Array<{ name: string; title: string; room: string }>;
    }>(`/sessions/for-surface?${query}`);
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

  /** mtg-8: make a drag real. The drag itself rode LiveKit as
   *  ephemeral previews; THIS returns a PROPOSAL (202, applied
   *  false) — applying is a separate confirmed act through the
   *  normal execute path, never something a message did. */
  commitDrag(session: string, objectRef: string, updateData: Record<string, any>) {
    return this.post<{
      ok: boolean; applied: boolean;
      proposal?: { proposal_id: string; authority_level: number; summary: string };
      note?: string; error?: string;
    }>(`/sessions/${encodeURIComponent(session)}/commit-drag`,
       { objectRef, updateData });
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
   *  bespoke endpoint (object coherence).
   *
   *  The envelope is `[{ClassName: [{class, varsLimited, data:[…]}]}]`
   *  — the same unwrap CrudeClassService.read uses. Guessing a
   *  flatter shape silently yields an empty list (caught live). */
  async sessions(): Promise<any[]> {
    const base = this.polariService.getBackendBaseUrl();
    const envelope = await firstValueFrom(
      this.http.get<any>(`${base}/CollaborationSession`, this.polariService.backendRequestOptions),
    ).catch(() => null);
    return envelope?.[0]?.['CollaborationSession']?.[0]?.data ?? [];
  }
}
