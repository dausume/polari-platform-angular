import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

import { OidcService } from './oidc.service';
import { AuthUser } from '../../classes/auth-user';

/**
 * App-level orchestrator for auth state.
 *
 * Polari uses plain BehaviorSubjects (matches existing PolariService /
 * RuntimeConfigService patterns) — no NgRx, deliberately. PSC has the
 * NgRx variant; if we ever extract a shared auth lib we can graft NgRx
 * on top without touching consumers, since they only see `currentUser$`.
 *
 * Entry points:
 *   - start()              — call once on app boot
 *   - handleOAuthCallback()— call from the /callback route component
 *   - login() / register() / logout() — wired to header buttons
 *   - onApiUnauthorized()  — called by the HTTP error interceptor on 401
 */
@Injectable({ providedIn: 'root' })
export class AuthSessionService {
  private readonly _currentUser$ = new BehaviorSubject<AuthUser | null>(null);
  // Surfaces the raw access_token alongside currentUser. oidc-client-ts
  // keeps the canonical copy in browser storage; we mirror it here as a
  // BehaviorSubject so UI (e.g. Auth Diagnostics) and other services can
  // subscribe rather than awaiting `oidc.getAccessToken()` each time.
  private readonly _accessToken$ = new BehaviorSubject<string | null>(null);
  private started = false;
  private inFlight = false;

  constructor(private oidc: OidcService) {}

  get currentUser$(): Observable<AuthUser | null> {
    return this._currentUser$.asObservable();
  }

  get accessToken$(): Observable<string | null> {
    return this._accessToken$.asObservable();
  }

  get currentUser(): AuthUser | null {
    return this._currentUser$.value;
  }

  get accessToken(): string | null {
    return this._accessToken$.value;
  }

  get isAuthenticated(): boolean {
    return this._currentUser$.value !== null;
  }

  /**
   * Idempotent boot hook. Wired as a second APP_INITIALIZER after
   * RuntimeConfigService.initialize() so the OIDC settings are available.
   * Returns a Promise so Angular waits for the silent-signin attempt
   * before rendering — keeps the initial paint from flashing "Login"
   * for already-signed-in users.
   */
  async start(): Promise<void> {
    if (this.started) return;
    this.started = true;
    if (!this.oidc.isConfigured()) return;

    // If we're on the /callback route, leave session restore to the
    // callback component — calling signinSilent here would race the
    // authorization-code exchange.
    if (window.location.pathname.startsWith('/callback')) return;

    await this.attemptSessionRestore('startup');
  }

  async login(): Promise<void> {
    try { await this.oidc.login(); }
    catch (err) { console.error('[AuthSession] login failed', err); }
  }

  async register(): Promise<void> {
    try { await this.oidc.register(); }
    catch (err) { console.error('[AuthSession] register failed', err); }
  }

  async logout(): Promise<void> {
    try {
      await this.oidc.logout();
    } catch (err) {
      console.error('[AuthSession] logout failed', err);
    } finally {
      this._setSession(null, null);
    }
  }

  /** Called by the /callback route component after Keycloak redirects back. */
  async handleOAuthCallback(): Promise<string | null> {
    console.log('[AuthSession] handleOAuthCallback ENTRY');
    try {
      const oidcUser = await this.oidc.handleCallback();
      console.log('[AuthSession] handleOAuthCallback — oidc.handleCallback returned:', {
        gotUser: !!oidcUser,
        expired: oidcUser?.expired,
        hasAccessToken: !!oidcUser?.access_token,
      });
      if (oidcUser && !oidcUser.expired) {
        const authUser = this.oidc.convertToAuthUser(oidcUser);
        console.log('[AuthSession] setting session — authUser:', authUser, 'tokenLen:', oidcUser.access_token?.length || 0);
        this._setSession(authUser, oidcUser.access_token);
        const state = (oidcUser as any).state;
        const returnTo = (typeof state === 'string' && state) ? state : '/';
        console.log('[AuthSession] callback complete, returning to:', returnTo);
        return returnTo;
      }
      console.warn('[AuthSession] callback returned no usable user — clearing session');
      this._setSession(null, null);
      return '/';
    } catch (err) {
      console.error('[AuthSession] callback exception:', err);
      this._setSession(null, null);
      return '/';
    }
  }

  /** HTTP error interceptor calls this when a backend request returns 401. */
  async onApiUnauthorized(): Promise<void> {
    if (this.inFlight) return;
    this.inFlight = true;
    try {
      const user = await this.oidc.signinSilent();
      if (user && !user.expired) {
        this._setSession(this.oidc.convertToAuthUser(user), user.access_token);
      } else {
        this._setSession(null, null);
      }
    } finally {
      this.inFlight = false;
    }
  }

  /** Force-refresh the cached access token from oidc-client-ts. UI uses
   * this after a silent renew the interceptor isn't aware of, or just to
   * confirm the token in storage matches what we're tracking. */
  async refreshAccessToken(): Promise<string | null> {
    const token = await this.oidc.getAccessToken();
    this._accessToken$.next(token);
    return token;
  }

  /** Backing call for start() — kept private to discourage external invocation. */
  private async attemptSessionRestore(reason: string): Promise<void> {
    if (this.inFlight) return;
    this.inFlight = true;
    try {
      let user = await this.oidc.getUser();
      if (!user || user.expired) {
        user = await this.oidc.signinSilent();
      }
      if (user && !user.expired) {
        this._setSession(this.oidc.convertToAuthUser(user), user.access_token);
      } else {
        this._setSession(null, null);
      }
    } catch (err) {
      console.debug(`[AuthSession] session restore (${reason}) failed`, err);
      this._setSession(null, null);
    } finally {
      this.inFlight = false;
    }
  }

  /** Single chokepoint for updating both subjects — guarantees they
   * never drift (a UI subscribed to one but not the other would
   * otherwise see inconsistent state during transitions). */
  private _setSession(user: AuthUser | null, token: string | null): void {
    this._currentUser$.next(user);
    this._accessToken$.next(token);
  }
}
