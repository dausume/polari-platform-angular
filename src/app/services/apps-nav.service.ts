import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { filter } from 'rxjs/operators';
import { BehaviorSubject, firstValueFrom } from 'rxjs';
import { PolariService } from '@services/polari-service';

/**
 * nav-2/nav-3: the app-navigation read model (/api/apps/nav).
 *
 * Apps carry their menus as DATA (nav groups -> items with kind +
 * tri-state availability). The shell renders every app's SIDE map
 * in full; groups flagged topMenu are ADDITIONALLY promoted to the
 * top bar. Absent modules stay visible with a bring-online
 * affordance — the map survives the missing territory.
 */

export interface AppNavItem {
  label: string;
  kind: 'page' | 'simspace' | 'view' | 'tech-node';
  availability: 'enabled' | 'absent' | 'unknown';
  route?: string;
  ref?: string;
  requiresModule?: string;
  bringup?: { route: string; requires?: string[] };
}

export interface AppNavGroup {
  group: string;
  topMenu: boolean;
  items: AppNavItem[];
}

export interface AppNav {
  name: string;
  title: string;
  useCase: string;
  discipline: string;
  // sep-4: the engine DATA PAGE this app carries ('' = not an
  // engine). Duals (odoo-likes) keep their own UI as the front;
  // this rides as the secondary view.
  enginePage?: string;
  personas: string[];
  pages: string[];
  modules: string[];
  moduleStates: Record<string, 'enabled' | 'absent' | 'unknown'>;
  navSynthesized: boolean;
  nav: AppNavGroup[];
}

export interface AppsNavPayload {
  ok: boolean;
  gatingReadable: boolean;
  apps: AppNav[];
  personas: Record<string, string[]>;
  refusal?: string;
}

@Injectable({ providedIn: 'root' })
export class AppsNavService {
  readonly payload$ = new BehaviorSubject<AppsNavPayload | null>(null);
  private loading = false;

  /**
   * sep-0: the single-app clamp. `?shellApp=<name>` locks the shell
   * to ONE app for the whole browser session — the URL is the
   * channel (works in a plain browser, survives reloads; the native
   * shell appends it in sep-1). An explicit empty `?shellApp=`
   * clears the lock. Locking hides chrome and redirects foreign
   * routes; it never changes what KC authorizes.
   */
  private _lockedAppName: string | null;
  private warnedUnknownLock = false;

  get lockedAppName(): string | null {
    return this._lockedAppName;
  }

  constructor(private http: HttpClient,
              private polariService: PolariService) {
    this._lockedAppName = AppsNavService.readLock();
  }

  /** sep-7 (decision 11a): lock programmatically — same
   *  session-sticky semantics as ?shellApp=. */
  lockTo(name: string): void {
    try {
      sessionStorage.setItem(AppsNavService.LOCK_KEY, name);
    } catch { /* private mode — lock still holds in-memory */ }
    this._lockedAppName = name;
  }

  /** sep-7 (decision 11a): a signed-in user whose grants cover
   *  exactly ONE app, arriving at the MAIN URL, enters it clamped.
   *  Applies only when the permission system is ON (mode!=off) and
   *  nothing else already locked; admins are never auto-clamped. */
  async autoRouteIfSingleApp(router: Router): Promise<boolean> {
    if (this.locked) { return false; }
    if ((router.url.split('?')[0] || '/') !== '/') { return false; }
    const grants: any = await firstValueFrom(this.http.get(
      `${this.polariService.getBackendBaseUrl()}`
      + '/api/apps/permissions/my',
      this.polariService.backendRequestOptions))
      .catch(() => null);
    if (!grants?.ok || grants.mode === 'off' || grants.admin) {
      return false;
    }
    const apps: string[] = grants.apps ?? [];
    if (apps.length !== 1) { return false; }
    this.lockTo(apps[0]);
    router.navigateByUrl('/app/' + apps[0]);
    return true;
  }

  private static readonly LOCK_KEY = 'polari.shellApp';

  private static readLock(): string | null {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.has('shellApp')) {
        const name = (params.get('shellApp') ?? '').trim();
        if (name) {
          sessionStorage.setItem(AppsNavService.LOCK_KEY, name);
          return name;
        }
        sessionStorage.removeItem(AppsNavService.LOCK_KEY);
        return null;
      }
      return sessionStorage.getItem(AppsNavService.LOCK_KEY);
    } catch {
      return null;
    }
  }

  /** True while the clamp is in force. A locked name the loaded
   *  payload does not know falls OPEN (full shell + one console
   *  warning) — a typo'd shellApp must not render a dead end. */
  get locked(): boolean {
    if (!this.lockedAppName) { return false; }
    const p = this.payload$.value;
    if (p?.ok && !this.appByName(this.lockedAppName)) {
      if (!this.warnedUnknownLock) {
        this.warnedUnknownLock = true;
        console.warn(`shellApp '${this.lockedAppName}' is not a known ` +
          'app — single-app clamp disabled, full shell shown');
      }
      return false;
    }
    return true;
  }

  lockedApp(): AppNav | null {
    return this.lockedAppName ? this.appByName(this.lockedAppName) : null;
  }

  /** Fetch once (idempotent); refusal-shaped result on failure so a
   *  gated-off backend renders as a message, never a blank shell. */
  ensureLoaded(): void {
    if (this.loading || this.payload$.value?.ok) { return; }
    this.loading = true;
    firstValueFrom(this.http.get<AppsNavPayload>(
      `${this.polariService.getBackendBaseUrl()}/api/apps/nav`,
      this.polariService.backendRequestOptions))
      .then(p => this.payload$.next(p))
      .catch(err => this.payload$.next(err?.error ?? {
        ok: false, gatingReadable: false, apps: [], personas: {},
        refusal: `apps nav unreachable (${err?.status ?? '?'}) — ` +
          `is 'polariapps' in POLARI_MODULES?`,
      }))
      .finally(() => { this.loading = false; });
  }

  refresh(): void {
    this.payload$.next(null);
    this.loading = false;
    this.ensureLoaded();
  }

  /** Await the payload.
   *
   *  ensureLoaded()/refresh() are fire-and-forget, which suits the
   *  header (it renders whenever the answer arrives). A caller that
   *  must ACT on the result — the app builder loading an app to edit,
   *  or re-reading after a save — needs to wait for it. `force`
   *  re-fetches rather than returning the cached answer. */
  whenLoaded(force = false): Promise<AppsNavPayload | null> {
    if (force) { this.refresh(); } else { this.ensureLoaded(); }
    return firstValueFrom(
      this.payload$.pipe(filter((p): p is AppsNavPayload => p !== null)));
  }

  appByName(name: string): AppNav | null {
    return this.payload$.value?.apps
      .find(a => a.name === name) ?? null;
  }

  /** The app context for a router URL: /app/:name wins; otherwise
   *  the app owning the LONGEST matching nav-item route (so
   *  /magnetics/motor lands in app-magnetics, /scoring/survival in
   *  scorecards rather than policy only when its match is longer).
   *  Null = no app context (core shell). */
  appForUrl(url: string): AppNav | null {
    // sep-0: under the clamp every URL belongs to the locked app —
    // both chrome consumers derive currentApp from this one answer.
    if (this.locked) { return this.lockedApp(); }
    const apps = this.payload$.value?.apps ?? [];
    const path = (url.split('?')[0] || '/');
    const direct = /^\/app\/([^/]+)/.exec(path);
    if (direct) { return this.appByName(direct[1]); }
    let best: AppNav | null = null;
    let bestLen = 0;
    for (const app of apps) {
      for (const grp of app.nav) {
        for (const item of grp.items) {
          const r = item.route;
          if (!r) { continue; }
          if ((path === r || path.startsWith(r + '/'))
              && r.length > bestLen) {
            best = app; bestLen = r.length;
          }
        }
      }
    }
    return best;
  }
}
