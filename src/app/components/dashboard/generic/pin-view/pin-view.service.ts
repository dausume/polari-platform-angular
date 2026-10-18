import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, map, of, catchError } from 'rxjs';

import { PolariService } from '@services/polari-service';
import { PvPayload, PvQuery } from './pin-view.types';

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
    if (q.protocol && q.activated_only) { names.push('activated_only=1'); }
    const params = names.join('&');
    return `${this.polari.getBackendBaseUrl()}${door}/${encodeURIComponent(board)}/pin-view${params ? '?' + params : ''}`;
  }

  load(board: string, q: PvQuery): Observable<PvPayload> {
    return this.http.get<PvPayload>(this.url(board, q), this.opts());
  }

  /** The firmware bindings of one board, for the binding picker (an empty list when the door is not there). */
  bindings(board: string): Observable<string[]> {
    return this.http.get<{ bindings?: { name: string; board?: string }[] }>(`${this.polari.getBackendBaseUrl()}/api/firmware/bindings`, this.opts()).pipe(
      map(r => (r?.bindings || []).filter(b => !b.board || b.board === board).map(b => b.name)),
      catchError(() => of([] as string[])));
  }
}
