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
  private started = false;
  private inFlight = false;

  constructor(private oidc: OidcService) {}

  get currentUser$(): Observable<AuthUser | null> {
    return this._currentUser$.asObservable();
  }

  get currentUser(): AuthUser | null {
    return this._currentUser$.value;
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
      this._currentUser$.next(null);
    }
  }

  /** Called by the /callback route component after Keycloak redirects back. */
  async handleOAuthCallback(): Promise<string | null> {
    try {
      const oidcUser = await this.oidc.handleCallback();
      if (oidcUser && !oidcUser.expired) {
        this._currentUser$.next(this.oidc.convertToAuthUser(oidcUser));
        const state = (oidcUser as any).state;
        return (typeof state === 'string' && state) ? state : '/';
      }
      this._currentUser$.next(null);
      return '/';
    } catch (err) {
      console.error('[AuthSession] callback failed', err);
      this._currentUser$.next(null);
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
        this._currentUser$.next(this.oidc.convertToAuthUser(user));
      } else {
        this._currentUser$.next(null);
      }
    } finally {
      this.inFlight = false;
    }
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
        this._currentUser$.next(this.oidc.convertToAuthUser(user));
      } else {
        this._currentUser$.next(null);
      }
    } catch (err) {
      console.debug(`[AuthSession] session restore (${reason}) failed`, err);
      this._currentUser$.next(null);
    } finally {
      this.inFlight = false;
    }
  }
}
