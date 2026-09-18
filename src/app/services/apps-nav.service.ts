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

/**
 * ROLES -> APPS, and one person's refinement of it (his ask 2026-09-18):
 *
 *   "We want to be able to have a primary role and additional roles. We will
 *    want to be able to tie Apps to roles so that the user can see and
 *    navigate to the apps they need more easily. And then the user should be
 *    able to refine that further and add apps they want to use or remove ones
 *    they do not care about."
 *
 * `/api/apps/mine` answers for the SIGNED-IN person only (401 otherwise), and
 * identifies them by their Keycloak `sub` alone — the roles they hold are the
 * token's `groups` claim, never anything Polari stored.
 */
export interface MyApp {
  name: string;
  title: string;
  /** §58: the app's one-line "who this serves and what they do with it",
   *  so the tailored home's cards say more than a title. */
  useCase?: string;
  route: string;
  /** primary = the leading role's; additional = another held role's;
   *  added = the person asked for it themselves. */
  via: 'primary' | 'additional' | 'added';
  role: string;
  removable: boolean;
}

export interface MyAppsPayload {
  ok: boolean;
  /** 401 when nobody is signed in — not an error to show, just nothing to render. */
  status?: number;
  error?: string;
  sub?: string;
  held_roles: string[];
  primary_role: string;
  additional_roles: string[];
  apps: MyApp[];
  /** Apps this person hid. `suggestions` is the subset a role of theirs binds. */
  removed: { name: string; title: string; useCase?: string; route: string }[];
  suggestions: { name: string; title: string; useCase?: string;
                 route: string; why?: string }[];
  unboundRoles?: string[];
  knownApps?: string[];
}

export const EMPTY_MINE: MyAppsPayload = {
  ok: false, held_roles: [], primary_role: '', additional_roles: [],
  apps: [], removed: [], suggestions: [],
};

/** What POST /api/apps/mine accepts. */
export interface MyAppsChange {
  primary_role?: string;
  add?: string[];
  remove?: string[];
  restore?: string[];
}

@Injectable({ providedIn: 'root' })
export class AppsNavService {
  readonly payload$ = new BehaviorSubject<AppsNavPayload | null>(null);
  private loading = false;

  /** roles -> apps: the signed-in person's own apps. `null` = never asked;
   *  a payload with ok:false (usually 401) = asked, nobody is signed in. */
  readonly mine$ = new BehaviorSubject<MyAppsPayload | null>(null);
  private loadingMine = false;

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

  // ---- roles -> apps: "My apps" (his ask 2026-09-18) -------------------

  private mineUrl(): string {
    return `${this.polariService.getBackendBaseUrl()}/api/apps/mine`;
  }

  /** Fetch once. A 401 is the NORMAL anonymous answer, not an error: it is
   *  stored as a refusal-shaped payload so the shell renders nothing extra
   *  rather than an error box. */
  ensureMineLoaded(): void {
    if (this.loadingMine || this.mine$.value) { return; }
    this.refreshMine();
  }

  /** Re-ask. Called when the signed-in user changes and after every save —
   *  the answer depends on the token's `groups` claim, so a just-claimed
   *  role shows up as soon as the token carries it. */
  refreshMine(): void {
    this.loadingMine = true;
    firstValueFrom(this.http.get<MyAppsPayload>(
      this.mineUrl(), this.polariService.backendRequestOptions))
      .then(p => this.mine$.next({ ...EMPTY_MINE, ...(p ?? {}) }))
      .catch(err => this.mine$.next({
        ...EMPTY_MINE,
        status: err?.status ?? 0,
        error: err?.error?.error
          ?? (err?.status === 401 ? 'not signed in' : 'my apps unreachable'),
      }))
      .finally(() => { this.loadingMine = false; });
  }

  /** Await the my-apps answer once (401-shaped for anonymous, never null).
   *
   *  §58: the landing guard must DECIDE, so unlike the fire-and-forget
   *  `ensureMineLoaded()` it has to wait. It waits at most `timeoutMs`; a
   *  backend that never answers renders the main Polari home rather than an
   *  indefinitely blank page — the honest default is "no tailored home". */
  whenMineLoaded(timeoutMs = 4000): Promise<MyAppsPayload | null> {
    this.ensureMineLoaded();
    return Promise.race([
      firstValueFrom(this.mine$.pipe(
        filter((m): m is MyAppsPayload => m !== null))),
      new Promise<null>(resolve => setTimeout(() => resolve(null), timeoutMs)),
    ]);
  }

  // ---- §58: the tailored home -----------------------------------------
  //
  // "when logged in as your user it takes you to your tailored home page …
  //  it should still be possible to go to the main Polari Home page via
  //  another route" (his words, 2026-09-18).
  //
  // The choice is per browser SESSION and lives in sessionStorage, exactly
  // like the sep-0 clamp: nothing about it is stored on the person's row,
  // and clearing it costs a new tab.

  private static readonly HOME_CHOICE_KEY = 'polari-home-choice';

  /** True when this person asked, this session, to stay on the main Polari
   *  home (they clicked "Polari home", or arrived with `?home=polari`). */
  get polariHomeChosen(): boolean {
    try {
      return sessionStorage.getItem(AppsNavService.HOME_CHOICE_KEY)
        === 'polari';
    } catch { return false; }
  }

  /** Remember "the main Polari home, please" for this browser session. */
  choosePolariHome(): void {
    try {
      sessionStorage.setItem(AppsNavService.HOME_CHOICE_KEY, 'polari');
    } catch { /* private mode — the link still works, it just won't stick */ }
  }

  /** Forget that choice — what opening the tailored home deliberately means. */
  chooseTailoredHome(): void {
    try {
      sessionStorage.removeItem(AppsNavService.HOME_CHOICE_KEY);
    } catch { /* nothing to forget */ }
  }

  /** Does a tailored home exist for whoever is here? Signed in (mine
   *  answered ok, which a 401 never does) AND at least one app in it.
   *  A locked shell has no home but its app's — the clamp wins. */
  get tailoredHomeApplies(): boolean {
    if (this.locked) { return false; }
    const mine = this.mine$.value;
    return !!mine?.ok && mine.apps.length > 0;
  }

  /** Where "home" points right now: the person's own page when they have
   *  one and have not asked for the main page this session, else the main
   *  Polari home. The header logo and the landing guard share this. */
  homeRoute(): string {
    return this.tailoredHomeApplies && !this.polariHomeChosen
      ? '/home' : '/';
  }

  /** Forget the answer — what sign-out does (the next sign-in re-asks). */
  clearMine(): void {
    this.loadingMine = false;
    this.mine$.next(null);
  }

  /** POST /api/apps/mine. The backend answers the WHOLE new view, so the
   *  result is pushed straight onto mine$ — one round trip per change.
   *  A refusal (an unheld primary role, an unknown app) comes back as the
   *  payload's `error` and mine$ is left alone. */
  async saveMine(change: MyAppsChange): Promise<MyAppsPayload> {
    const failed = (err: any): MyAppsPayload => ({
      ...EMPTY_MINE,
      status: err?.status ?? 0,
      error: err?.error?.error ?? 'could not save your app choices',
      knownApps: err?.error?.knownApps,
    });
    try {
      const p = await firstValueFrom(this.http.post<MyAppsPayload>(
        this.mineUrl(), change,
        this.polariService.backendRequestOptions));
      const next = { ...EMPTY_MINE, ...(p ?? {}) };
      if (next.ok) { this.mine$.next(next); }
      return next;
    } catch (err: any) {
      return failed(err);
    }
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
