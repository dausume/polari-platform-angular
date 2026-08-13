import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { PolariService } from '@services/polari-service';

/**
 * ret-1d: peer discovery + adjudication. Hearing is not admitting —
 * the buckets say which is which, and adjudication is a KC-verified
 * human act (a 401 here is the system working, and the UI shows it
 * as such rather than hiding the buttons).
 *
 * Null from peers() = the reticulum module is not served here.
 * adjudicate() always resolves with a body — refusals carry their
 * status + the backend's evidence/knob/action suggestion so the
 * template can teach instead of shrug.
 */

export interface PeerEntry {
  name: string;
  identity_hash?: string;
  identityHash?: string;
  dest_hash?: string;
  destHash?: string;
  aspects?: string;
  heard_via?: string;
  interface?: string;
  first_heard_ms?: number;
  firstHeardMs?: number;
  last_heard_ms?: number;
  lastHeardMs?: number;
  announce_count?: number;
  count?: number;
  status?: string;
  adjudicated_by?: string;
  arch_node_name?: string;
  hearingNow?: boolean;
  persisted?: boolean;
}

export interface PeersReport {
  ok: boolean;
  nowMs: number;
  sidecarLive: boolean;
  peers: {
    unadjudicated: PeerEntry[];
    archipelago: PeerEntry[];
    mesh: PeerEntry[];
    ignored: PeerEntry[];
  };
  note?: string;
}

export interface AdjudicationOutcome {
  ok: boolean;
  status?: number;
  error?: string;
  suggestion?: { evidence?: string; knob?: string; action?: string };
  decision?: string;
  by?: string;
  archNodeCreated?: string | null;
  note?: string;
}

@Injectable({ providedIn: 'root' })
export class ReticulumPeersService {
  constructor(
    private http: HttpClient,
    private polariService: PolariService,
  ) {}

  private get base(): string {
    return `${this.polariService.getBackendBaseUrl()}/api/reticulum`;
  }

  peers(): Promise<PeersReport | null> {
    return firstValueFrom(
      this.http.get<PeersReport>(
        `${this.base}/peers`,
        this.polariService.backendRequestOptions,
      ),
    ).catch((err) => (err?.error?.ok === false ? err.error : null));
  }

  adjudicate(
    name: string,
    decision: 'archipelago' | 'mesh' | 'ignored',
    archName?: string,
    heard?: PeerEntry,
  ): Promise<AdjudicationOutcome> {
    const body: Record<string, unknown> = { decision };
    if (archName) { body['archName'] = archName; }
    if (heard) { body['heard'] = heard; }
    return firstValueFrom(
      this.http.post<AdjudicationOutcome>(
        `${this.base}/peers/${encodeURIComponent(name)}/adjudicate`,
        body,
        this.polariService.backendRequestOptions,
      ),
    ).catch((err) => ({
      ok: false,
      status: err?.status,
      error: err?.error?.error
        ?? 'the backend did not answer the adjudication',
      suggestion: err?.error?.suggestion,
    }));
  }
}
