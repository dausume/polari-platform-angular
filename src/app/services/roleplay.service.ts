import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, firstValueFrom } from 'rxjs';

import { PolariService } from '@services/polari-service';

/**
 * roleplay.service — the frontend half of dev-mode role-play observation.
 *
 * On a DEV-POSTURE instance a person holding the role-play permission can
 * "act as" a prototype role (e.g. a Journalist). While acting:
 *   - every backend request carries `X-Polari-Roleplay: <role>`
 *     (see `interceptors/roleplay.interceptor.ts`), so the backend can count
 *     the endpoints and the objects x verbs the role touched;
 *   - the frontend posts the apps / pages / actions it used to
 *     `POST /api/security/observe/usage`, so the review can show the whole
 *     picture and propose a permission profile.
 *
 * In production posture the roles endpoint answers `can_roleplay: false`
 * with `why: 'role-play exists only on a dev-posture instance'` — the menu
 * then renders nothing and this service never posts anything.
 *
 * Nothing here ever throws: the instance may not carry the security module
 * at all, and a shell that cannot reach it must still work normally.
 */

export interface RoleplayRole {
  name: string;
  title?: string;
  description?: string;
  state?: string;
  [k: string]: any;
}

export interface RoleplaySession {
  name?: string;
  role?: string;
  actor?: string;
  active?: boolean;
  [k: string]: any;
}

export interface RoleplayState {
  can_roleplay: boolean;
  roles: RoleplayRole[];
  why?: string;
  roleplay_groups?: string[];
  open_sessions?: RoleplaySession[];
}

export interface RoleplayUsageItem {
  kind: 'app' | 'page' | 'component' | 'action';
  item: string;
  app?: string | null;
  page?: string | null;
  detail?: any;
}

const STORAGE_KEY = 'polari-roleplay';
const REFRESH_MS = 5 * 60 * 1000;
const BATCH_MS = 2000;

const EMPTY_STATE: RoleplayState = { can_roleplay: false, roles: [] };

@Injectable({ providedIn: 'root' })
export class RoleplayService {

  /** The role currently being acted as — '' when not acting. */
  readonly role$ = new BehaviorSubject<string>('');

  /** The last answer from GET /api/security/observe/roles. */
  readonly state$ = new BehaviorSubject<RoleplayState>(EMPTY_STATE);

  private queue: RoleplayUsageItem[] = [];
  private flushTimer: any = null;
  private refreshTimer: any = null;

  constructor(
    private http: HttpClient,
    private polariService: PolariService
  ) {
    this.role$.next(this.readStoredRole());
    // Deferred: the runtime config loads in an APP_INITIALIZER, and
    // constructing this service from the interceptor must not re-enter
    // the HTTP stack synchronously.
    setTimeout(() => { void this.refresh(); }, 0);
    this.refreshTimer = setInterval(() => { void this.refresh(); }, REFRESH_MS);
  }

  // ---------------------------------------------------------------- state

  get role(): string { return this.role$.value; }
  get active(): boolean { return !!this.role$.value; }
  get state(): RoleplayState { return this.state$.value; }

  /** Re-read the roles / permission from the backend. Never throws. */
  async refresh(): Promise<void> {
    const base = this.backendBase();
    if (!base) { return; }
    try {
      const body: any = await firstValueFrom(this.http.get<any>(
        `${base}/api/security/observe/roles`,
        this.polariService.backendRequestOptions));
      if (body && body.ok) {
        this.state$.next({
          can_roleplay: !!body.can_roleplay,
          roles: Array.isArray(body.roles) ? body.roles : [],
          why: body.why,
          roleplay_groups: body.roleplay_groups,
          open_sessions: Array.isArray(body.open_sessions) ? body.open_sessions : [],
        });
      } else {
        this.state$.next(EMPTY_STATE);
      }
    } catch (err) {
      // No security module here, production posture, or unreachable —
      // say nothing and render nothing.
      console.warn('[roleplay] could not read observe/roles', err);
      this.state$.next(EMPTY_STATE);
    }
    if (this.role$.value && !this.knownRole(this.role$.value)) {
      // The stored role no longer exists (or role-play is off here):
      // stop pretending to act as it.
      this.setRole('');
    }
  }

  private knownRole(name: string): boolean {
    const st = this.state$.value;
    if (!st.can_roleplay) { return false; }
    return st.roles.some(r => r && r.name === name);
  }

  // ------------------------------------------------------------- sessions

  /** Begin acting as `role`. The header travels from here on. */
  async start(role: string): Promise<boolean> {
    const base = this.backendBase();
    if (!role || !base) { return false; }
    try {
      const body: any = await firstValueFrom(this.http.post<any>(
        `${base}/api/security/observe/session`, { role },
        this.polariService.backendRequestOptions));
      if (!body || body.ok === false) {
        console.warn('[roleplay] start refused', body && body.refusal);
        return false;
      }
    } catch (err) {
      console.warn('[roleplay] could not start a session', err);
      return false;
    }
    this.setRole(role);
    void this.refresh();
    return true;
  }

  /** Stop acting. Ends the backend session for the current role. */
  async stop(): Promise<void> {
    const role = this.role$.value;
    const base = this.backendBase();
    this.setRole('');
    this.queue = [];
    if (!role || !base) { return; }
    try {
      await firstValueFrom(this.http.delete<any>(
        `${base}/api/security/observe/session?role=${encodeURIComponent(role)}`,
        this.polariService.backendRequestOptions));
    } catch (err) {
      console.warn('[roleplay] could not end the session', err);
    }
    void this.refresh();
  }

  /** Create a new prototype role. Returns the role, or null on refusal. */
  async createPrototype(name: string, title?: string, description?: string):
    Promise<RoleplayRole | null> {
    const base = this.backendBase();
    if (!name || !base) { return null; }
    try {
      const body: any = await firstValueFrom(this.http.post<any>(
        `${base}/api/security/observe/roles`,
        { name, title: title || name, description: description || '' },
        this.polariService.backendRequestOptions));
      if (!body || body.ok === false) {
        console.warn('[roleplay] create refused', body && body.refusal);
        return null;
      }
      await this.refresh();
      return (body.role as RoleplayRole) || { name };
    } catch (err) {
      console.warn('[roleplay] could not create a prototype role', err);
      return null;
    }
  }

  // ---------------------------------------------------------------- usage

  /**
   * Record what the role used. Fire-and-forget, batched every 2 s, and
   * dropped entirely when no role is active.
   */
  usage(items: RoleplayUsageItem[]): void {
    if (!this.active || !items || !items.length) { return; }
    for (const it of items) {
      if (!it || !it.kind || !it.item) { continue; }
      const dup = this.queue.some(q =>
        q.kind === it.kind && q.item === it.item && q.app === it.app);
      if (!dup) { this.queue.push(it); }
    }
    if (this.queue.length && this.flushTimer === null) {
      this.flushTimer = setTimeout(() => {
        this.flushTimer = null;
        void this.flush();
      }, BATCH_MS);
    }
  }

  private async flush(): Promise<void> {
    const items = this.queue;
    this.queue = [];
    const base = this.backendBase();
    if (!items.length || !base || !this.active) { return; }
    try {
      await firstValueFrom(this.http.post<any>(
        `${base}/api/security/observe/usage`, { items },
        this.polariService.backendRequestOptions));
    } catch (err) {
      console.warn('[roleplay] could not record usage', err);
    }
  }

  // ------------------------------------------------------------- internals

  private backendBase(): string {
    try {
      return this.polariService.getBackendBaseUrl() || '';
    } catch {
      return '';
    }
  }

  private setRole(role: string): void {
    this.role$.next(role);
    try {
      if (role) { localStorage.setItem(STORAGE_KEY, role); }
      else { localStorage.removeItem(STORAGE_KEY); }
    } catch {
      // Private browsing / storage disabled: the role still holds for
      // this tab, it just will not survive a reload.
    }
  }

  private readStoredRole(): string {
    try {
      return localStorage.getItem(STORAGE_KEY) || '';
    } catch {
      return '';
    }
  }
}
