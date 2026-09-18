import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { PolariService } from '@services/polari-service';
import { AuthSessionService } from '@services/auth/auth-session.service';

/**
 * people.service — names at RENDER time (his rule D18-1, 2026-09-18).
 *
 *   "largely the purpose of Keycloak is to keep PII secure and away from
 *    Polari itself."
 *
 * So a Polari row keys a person by their opaque Keycloak subject id and
 * nothing else. A table that wants to show a human-readable name asks the
 * ONE gated door for it while the page renders, and the name is never
 * written back anywhere:
 *
 *   POST /api/security/people  {subs: [...]}  (at most 200 per call)
 *     -> {ok, people: {sub: display_name|null}, denied: [...]}
 *
 * The gate is the backend's, applied per sub: your own sub always, anyone
 * else's only for an administrator or a member of a group named in the
 * `people_viewers` knob. A refusal is NOT an error the reader should see —
 * the cell simply keeps showing the shortened sub.
 *
 * MEMORY ONLY. The map below lives for the life of the browser tab. It is
 * never put in localStorage, sessionStorage, a cookie or a URL — closing
 * the tab forgets every name, exactly as the backend's cache dies with the
 * process. `asked` remembers which subs have already been sent so a table
 * that re-renders never asks twice, including for the subs that came back
 * null or denied.
 */
@Injectable({ providedIn: 'root' })
export class PeopleService {
  /** sub -> display name. In memory, for this tab, and nowhere else. */
  private readonly names = new Map<string, string>();
  /** Every sub already sent to the door (resolved, null or denied alike). */
  private readonly asked = new Set<string>();
  /** The door is unavailable on this instance (no security module, 401/503) — stop asking. */
  private closed = false;
  /** One in-flight promise per batch, so simultaneous tables do not duplicate a call. */
  private inFlight: Promise<void> | null = null;

  /** The most subject ids the backend will resolve in one call. */
  private static readonly MAX_SUBS = 200;

  constructor(
    private http: HttpClient,
    private polariService: PolariService,
    private auth: AuthSessionService,
  ) {}

  /** The name already known for this sub, or '' — never triggers a request. */
  nameFor(sub: string): string {
    return this.names.get(sub) || '';
  }

  /** A sub shortened for display: the first 8 characters, as a person reads a commit hash. */
  static short(sub: string): string {
    const s = String(sub || '');
    return s.length > 8 ? s.slice(0, 8) : s;
  }

  /**
   * Resolve every sub in `subs` that is not already known, in ONE call
   * (chunked at the backend's limit). Resolves when the names map has been
   * updated; never rejects and never surfaces an error — a viewer who may
   * not resolve names simply goes on seeing shortened subs.
   */
  async resolve(subs: string[]): Promise<void> {
    const wanted = Array.from(new Set(
      (subs || [])
        .map((s) => String(s || '').trim())
        .filter((s) => s.length > 0 && !this.asked.has(s)),
    ));
    if (this.closed || wanted.length === 0 || !this.auth.isAuthenticated) {
      return;
    }
    const base = this.backendBase();
    if (!base) { return; }
    const run = (async () => {
      for (let i = 0; i < wanted.length; i += PeopleService.MAX_SUBS) {
        const chunk = wanted.slice(i, i + PeopleService.MAX_SUBS);
        chunk.forEach((s) => this.asked.add(s));
        try {
          const body: any = await firstValueFrom(this.http.post<any>(
            `${base}/api/security/people`, { subs: chunk },
            this.polariService.backendRequestOptions));
          const people = (body && body.people) || {};
          for (const sub of Object.keys(people)) {
            const name = people[sub];
            if (typeof name === 'string' && name.length > 0) {
              this.names.set(sub, name);
            }
          }
        } catch (err: any) {
          // 403 (not allowed to resolve other people), 401 (signed out since),
          // 404 (no security module), 429 (asked too often), 503 (no Keycloak):
          // all of them mean "keep showing the sub". Only the permanent ones
          // close the door for this tab; a 429 may pass next render.
          const status = err && err.status;
          if (status === 401 || status === 403 || status === 404 || status === 503) {
            this.closed = true;
          }
          return;
        }
      }
    })();
    this.inFlight = run;
    try {
      await run;
    } finally {
      if (this.inFlight === run) { this.inFlight = null; }
    }
  }

  private backendBase(): string {
    try {
      return this.polariService.getBackendBaseUrl() || '';
    } catch {
      return '';
    }
  }
}
