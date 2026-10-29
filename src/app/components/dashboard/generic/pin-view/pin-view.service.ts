import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, map, of, catchError, retry, switchMap, timer } from 'rxjs';

import { PolariService } from '@services/polari-service';
import {
  PvBenchBridge, PvBenchBridgesPayload, PvBridgeHop, PvEventsPayload, PvHopsPayload, PvPayload, PvQuery, PvRunsPayload, PvStructBindingsPayload,
} from './pin-view.types';

/**
 * pv-1 — the pin view's one data door. It sends NAMES only (board, system, binding, stage, protocol) in a GET;
 * it never writes to the backend, never touches the user's global selection and never navigates.
 */
@Injectable({ providedIn: 'root' })
export class PinViewService {
  constructor(private http: HttpClient, private polari: PolariService) {}

  private opts(): { headers?: any } { return this.polari.backendRequestOptions as { headers?: any }; }

  /** Builds the door URL; empty values are left out. */
  url(board: string, q: PvQuery, door = '/api/board'): string {
    const names = (['system', 'binding', 'stage', 'protocol'] as const)
      .filter(k => q[k]).map(k => `${k}=${encodeURIComponent(q[k])}`);
    if (q.stage === 'candidate') {   // pv-5: the stored run and candidate are asked for by name; the view never makes the search itself (a POST)
      if (q.run) { names.push(`run=${encodeURIComponent(q.run)}`); }
      if (q.candidate) { names.push(`candidate=${encodeURIComponent(q.candidate)}`); }
    }
    if (q.protocol && q.activated_only) { names.push('activated_only=1'); }
    if (q.phase && q.phase !== 'runtime') { names.push(`phase=${encodeURIComponent(q.phase)}`, `blank=${encodeURIComponent(q.blank || 'board')}`); }
    const params = names.join('&');
    return `${this.polari.getBackendBaseUrl()}${door}/${encodeURIComponent(board)}/pin-view${params ? '?' + params : ''}`;
  }

  /** One retry after a short back-off on a network / server failure (status 0 or 5xx): the first read right after a backend boot can fail
   *  while the next answers in under a second (seen on the test node 2026-10-18). A 4xx (a bad name) is reported at once, never retried. */
  load(board: string, q: PvQuery): Observable<PvPayload> {
    return this.http.get<PvPayload>(this.url(board, q), this.opts()).pipe(
      retry({ count: 1, delay: (err: any) => ((err?.status === 0 || err?.status >= 500) ? timer(1500) : (() => { throw err; })()) }));
  }

  /** pv-4: the configuration-event timeline (GET only; names only). An error is reported to the caller, who shows it in words next to the strip. */
  events(board: string, system: string, binding: string): Observable<PvEventsPayload> {
    const names = [system && `system=${encodeURIComponent(system)}`, binding && `binding=${encodeURIComponent(binding)}`].filter(Boolean).join('&');
    return this.http.get<PvEventsPayload>(`${this.polari.getBackendBaseUrl()}/api/board/${encodeURIComponent(board)}/config-events${names ? '?' + names : ''}`, this.opts());
  }

  /** pv-5: the stored solution searches of one Mission (GET only), newest first, for the run picker. */
  runs(mission: string): Observable<PvRunsPayload> {
    return this.http.get<PvRunsPayload>(`${this.polari.getBackendBaseUrl()}/api/missions/${encodeURIComponent(mission)}/solve-runs`, this.opts()).pipe(
      map(r => ({ ...r, rows: [...(r?.rows || [])].sort((a, b) => (b.ran_at || '').localeCompare(a.ran_at || '') || b.name.localeCompare(a.name)) })));
  }

  /** hsp-3b: the pin <-> struct-field bindings of one firmware variant (derived from its Catom assertions; GET only). */
  structBindings(variant: string): Observable<PvStructBindingsPayload> {
    return this.http.get<PvStructBindingsPayload>(`${this.polari.getBackendBaseUrl()}/api/cmod/catom-assertions/${encodeURIComponent(variant)}?view=bindings`, this.opts());
  }

  /** hsp-3b: the bench's bridge whose path runs from this board, then that bridge's hops as its mode says (serial: the cable path; simulated: the twin). GET only.
   *  A bench with no bridge from the board answers an empty chain with the reason in words. */
  bridgeChain(bench: string, board: string): Observable<{ bridge: PvBenchBridge | null; hops: PvBridgeHop[]; note: string }> {
    const base = `${this.polari.getBackendBaseUrl()}/api/grpc/bench-bridges/${encodeURIComponent(bench)}`;
    return this.http.get<PvBenchBridgesPayload>(base, this.opts()).pipe(
      switchMap(r => {
        const paths = new Set((r?.paths || []).filter(p => p.board === board).map(p => p.name));
        const bridge = (r?.bridges || []).find(b => paths.has(b.path)) || null;
        if (!bridge) { return of({ bridge: null, hops: [] as PvBridgeHop[], note: (r && r.error) || `No bridge on ${bench} runs from ${board}.` }); }
        return this.http.get<PvHopsPayload>(`${base}?view=hops&bridge=${encodeURIComponent(bridge.name)}`, this.opts()).pipe(
          map(h => ({ bridge, hops: [...(h?.rows || [])].sort((a, b) => a.n - b.n), note: (h && (h.error || h.note)) || '' })));
      }));
  }

  /** The firmware bindings of one board, for the binding picker (an empty list when the door is not there). */
  bindings(board: string): Observable<string[]> {
    return this.http.get<{ bindings?: { name: string; board?: string }[] }>(`${this.polari.getBackendBaseUrl()}/api/firmware/bindings`, this.opts()).pipe(
      map(r => (r?.bindings || []).filter(b => !b.board || b.board === board).map(b => b.name)),
      catchError(() => of([] as string[])));
  }
}
