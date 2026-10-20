import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';

import { OidcService } from '@services/auth/oidc.service';
import { PolariService } from '@services/polari-service';
import { LvInjectReply, LvPayload, LvSession, LvSteps, LvTwinEvent } from './layout-view.types';

/**
 * lay-2 / sim-3 - the layout view's doors. GETs are plain HttpClient reads (the auth interceptor adds the token). The twin's event stream is Server-Sent Events: EventSource cannot send
 * the Authorization header, so the stream is read with fetch and parsed here ("data: {json}" blocks); closing it aborts the request. A stream that ends is reported to the caller.
 */
export interface LvStream { close(): void; }

@Injectable({ providedIn: 'root' })
export class LayoutViewService {
  constructor(private http: HttpClient, private polari: PolariService, private oidc: OidcService) {}

  private opts(): { headers?: any } { return this.polari.backendRequestOptions as { headers?: any }; }
  private base(): string { return this.polari.getBackendBaseUrl(); }

  /** `{config}` in the configured path is filled with the config; empty values are left out of the query. */
  url(path: string, config: string, q: Record<string, string>): string {
    const p = path.split('{config}').join(encodeURIComponent(config));
    const params = Object.entries(q).filter(([, v]) => v).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
    const sep = p.includes('?') ? '&' : '?';
    return `${this.base()}${p}${params ? sep + params : ''}`;
  }

  layout(path: string, config: string, q: Record<string, string>): Observable<LvPayload> { return this.http.get<LvPayload>(this.url(path, config, q), this.opts()); }
  steps(path: string, config: string, q: Record<string, string>): Observable<LvSteps> {
    const withConfig = path.includes('{config}') ? q : { ...q, config };
    return this.http.get<LvSteps>(this.url(path, config, withConfig), this.opts());
  }

  /** The one session's row (the firmware panel's facts and whether it still runs), or null when it is not listed. */
  session(name: string): Observable<LvSession | null> {
    return this.http.get<{ rows?: LvSession[] }>(`${this.base()}/api/board/twins?name=${encodeURIComponent(name)}`, this.opts()).pipe(map(r => (r?.rows && r.rows[0]) || null));
  }

  inject(session: string, body: Record<string, unknown>): Observable<LvInjectReply> {
    return this.http.post<LvInjectReply>(`${this.base()}/api/board/twins/${encodeURIComponent(session)}/inject`, body, this.opts());
  }

  /** Subscribe to the session's pin edges. `replay` asks the backend for its last N events first (a page opened mid-session still learns the output's last edge). The first event is
   *  {t:'hello'}: the caller treats the stream as READY only then, and injects only after that. */
  events(session: string, replay: number, onEvent: (e: LvTwinEvent) => void, onEnd: (why: string) => void): LvStream {
    const ctl = new AbortController();
    void (async () => {
      try {
        const token = await this.oidc.getAccessToken();
        const resp = await fetch(`${this.base()}/api/board/twins/${encodeURIComponent(session)}/events?replay=${replay}`, {
          headers: { Accept: 'text/event-stream', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, signal: ctl.signal,
        });
        if (!resp.ok || !resp.body) { onEnd(resp.status === 404 ? 'this session is not known to the server any more' : resp.status === 409 ? 'this session has ended' : `the event stream was refused (HTTP ${resp.status})`); return; }
        const reader = resp.body.getReader();
        const dec = new TextDecoder();
        let buf = '';
        for (;;) {
          const { done, value } = await reader.read();
          if (done) { break; }
          buf += dec.decode(value, { stream: true });
          const blocks = buf.split('\n\n');
          buf = blocks.pop() ?? '';
          for (const blk of blocks) {
            const line = blk.split('\n').find(l => l.startsWith('data: '));
            if (line) { try { onEvent(JSON.parse(line.slice(6))); } catch { /* a half line: ignored */ } }
          }
        }
        onEnd('the event stream ended');
      } catch (e: any) {
        if (!ctl.signal.aborted) { onEnd(`the event stream was lost (${e?.message || e})`); }
      }
    })();
    return { close: () => ctl.abort() };
  }
}
