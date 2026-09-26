import { Injectable } from '@angular/core';
import { firstValueFrom, Observable, Subject } from 'rxjs';
import { filter, take } from 'rxjs/operators';
import {
  ErrorResponse, InMemoryWebStorage, User, UserManager, UserManagerSettings, WebStorageStateStore
} from 'oidc-client-ts';
import { RuntimeConfigService } from '@services/runtime-config.service';
import { KeycloakConfig } from '@models/runtimeConfig';
import { AuthUser } from '../../classes/auth-user';

/**
 * The `state` we hand Keycloak on every authorization request and read back
 * off the response — success OR error.
 *
 *  - `returnTo` is the in-app URL to put the person back on.
 *  - `checkSso` marks the ONE silent `prompt=none` probe we fire on landing.
 *    It is what tells the callback handler that "no session at Keycloak" is a
 *    normal answer to swallow rather than a sign-in failure to display.
 *
 * Older builds sent a bare string here; `readCallbackState()` still accepts
 * that shape so a redirect already in flight when a new bundle ships lands
 * correctly instead of dumping the person on `/`.
 */
export interface CallbackState {
  returnTo: string;
  checkSso: boolean;
}

/**
 * Outcome of `/callback`. Three cases, deliberately distinct:
 *  - `user`      — an authorization code came back and was exchanged.
 *  - `no-session` — Keycloak answered `login_required` / `interaction_required`.
 *    Only reachable from a `prompt=none` request; means "nobody is signed in
 *    here", which is information, not an error.
 *  - `error`     — anything else. This one is worth a face.
 */
export type OidcCallbackResult =
  | { kind: 'user'; user: User; state: CallbackState }
  | { kind: 'no-session'; state: CallbackState }
  | { kind: 'error'; message: string; state: CallbackState };

/** Keycloak's "I would have had to ask the human" answers to prompt=none. */
const NO_SESSION_ERRORS = new Set(['login_required', 'interaction_required', 'consent_required']);

/**
 * Pick the most durable Storage the browser will actually give us.
 *
 * `window.localStorage` survives closing the tab AND closing the browser,
 * which is the whole point (see `userStore` below). It is not always
 * reachable though — a hardened profile, "block all cookies and site data",
 * or some embedded webviews make the *getter itself* throw — so probe it
 * with a real write/remove and fall back rather than letting the app die at
 * boot. sessionStorage is the degraded tier (login lasts the tab); the
 * in-memory object is the last resort (login lasts the page load).
 */
function durableStore(): Storage {
  const probe = '__polari_oidc_probe__';
  for (const get of [() => window.localStorage, () => window.sessionStorage]) {
    try {
      const store = get();
      store.setItem(probe, '1');
      store.removeItem(probe);
      return store;
    } catch {
      /* unavailable — try the next tier */
    }
  }
  console.warn('[OidcService] no web storage available — the session will not outlive this page load');
  return new InMemoryWebStorage();
}

/**
 * Low-level wrapper around oidc-client-ts UserManager.
 * Mirrors PSC's OidcService but pulls config from RuntimeConfigService
 * (Polari's tier-2 runtime-config.json pattern) rather than a build-time
 * environment proxy.
 *
 * AuthSessionService is the layer the rest of the app talks to — this class
 * stays thin and unaware of app state.
 */
@Injectable({ providedIn: 'root' })
export class OidcService {
  private userManager: UserManager | null = null;
  private kcConfig: KeycloakConfig | null = null;

  /** The realm URL the browser must reach for a sign-in (bp-2b: named in the message when it cannot). */
  get authority(): string { return this.kcConfig?.authority || ''; }
  private readonly _userLoaded$ = new Subject<User>();

  constructor(private runtimeConfig: RuntimeConfigService) {}

  /** Fires whenever oidc-client-ts loads or re-loads a user — the initial
   *  sign-in, a silent renew, or a restore from storage. AuthSessionService
   *  subscribes so its subjects track the token actually in storage. */
  get userLoaded$(): Observable<User> {
    return this._userLoaded$.asObservable();
  }

  /**
   * Lazy-build the UserManager once the runtime config has loaded.
   * APP_INITIALIZER ordering guarantees runtime config is ready before
   * AuthSessionService.start() calls into this.
   */
  private ensureUserManager(): UserManager | null {
    if (this.userManager) return this.userManager;

    const cfg = this.runtimeConfig.getKeycloakConfig();
    if (!cfg) {
      console.warn('[OidcService] No keycloak stanza in runtime-config.json — auth disabled');
      return null;
    }
    this.kcConfig = cfg;

    const store = durableStore();

    const settings: UserManagerSettings = {
      authority: cfg.authority,
      client_id: cfg.clientId,
      redirect_uri: cfg.redirectUri,
      post_logout_redirect_uri: cfg.postLogoutRedirectUri,
      response_type: cfg.responseType,
      scope: cfg.scope,
      silent_redirect_uri: cfg.silentRedirectUri,

      // WHY THIS IS SET EXPLICITLY — this is the fix for "closing the window
      // logs me out". oidc-client-ts defaults `userStore` to
      // `new WebStorageStateStore({ store: window.sessionStorage })`, and
      // sessionStorage is destroyed the moment the tab closes. That took the
      // refresh token with it, so reopening the app had nothing to resume from
      // and the only fallback left was a prompt=none iframe against Keycloak's
      // SSO cookie — which browsers block as third-party. On localStorage the
      // refresh token outlives the window, and `signinSilent()` can redeem it
      // directly over the token endpoint: no iframe, no third-party cookie.
      userStore: new WebStorageStateStore({ store }),

      // The PKCE verifier + `state` for one in-flight redirect. The library
      // already defaults this to localStorage; pinned here so the two stores
      // are stated together and a future edit can't silently split them.
      stateStore: new WebStorageStateStore({ store }),

      automaticSilentRenew: true,
      loadUserInfo: true,

      // OFF deliberately. `monitorSession` polls Keycloak's check_session
      // iframe, which only works while the browser sends the KC cookie into a
      // cross-site frame — the exact thing third-party-cookie blocking kills.
      // When it is blocked the monitor reports "signed out" for a session that
      // is perfectly alive, so leaving it on parks a false sign-out signal in
      // the app for the next person to wire a handler to. Sign-out that really
      // happened at Keycloak still surfaces within one access-token lifetime:
      // the refresh grant is rejected, silent renew fails, and the session
      // drops. Cross-tab propagation comes from the shared localStorage store.
      monitorSession: false,
    };

    this.userManager = new UserManager(settings);

    this.userManager.events.addAccessTokenExpiring(() => {
      console.log('[OidcService] access token expiring');
    });
    this.userManager.events.addAccessTokenExpired(() => {
      console.log('[OidcService] access token expired');
    });
    this.userManager.events.addSilentRenewError((error: Error) => {
      console.error('[OidcService] silent renew error', error);
    });
    // Every successful renew (and the initial load) lands here. Without this,
    // `automaticSilentRenew` refreshed the token in storage while
    // AuthSessionService's `currentUser$` / `accessToken$` kept publishing the
    // pre-renew copy until some 401 knocked them awake.
    this.userManager.events.addUserLoaded((user: User) => {
      this._userLoaded$.next(user);
    });

    return this.userManager;
  }

  isConfigured(): boolean {
    return this.runtimeConfig.getKeycloakConfig() !== null;
  }

  /**
   * `isConfigured()` but safe to call at boot.
   *
   * THE BUG THIS EXISTS FOR: the keycloak stanza lives in
   * `/assets/runtime-config.json`, fetched by `RuntimeConfigService.initialize()`.
   * Angular's `ApplicationInitStatus.runInitializers()` *invokes every*
   * `APP_INITIALIZER` factory in one synchronous loop and only then awaits
   * `Promise.all` over what they returned — so a second initializer starts
   * running while the first one's HTTP GET is still in flight. Anything that
   * asked `isConfigured()` at that moment got `false` from an empty
   * `startupConfig`, concluded "this instance has no logins", and gave up for
   * the lifetime of the page. Await the config first, then answer.
   */
  async whenConfigured(): Promise<boolean> {
    await firstValueFrom(
      this.runtimeConfig.isConfigLoaded$.pipe(filter(loaded => loaded), take(1))
    );
    return this.isConfigured();
  }

  async getUser(): Promise<User | null> {
    const um = this.ensureUserManager();
    if (!um) return null;
    try { return await um.getUser(); }
    catch (err) { console.error('[OidcService] getUser failed', err); return null; }
  }

  convertToAuthUser(oidcUser: User): AuthUser {
    const profile: any = oidcUser.profile;
    return new AuthUser({
      id: profile.sub || '',
      username: profile.preferred_username || profile.email || '',
      email: profile.email || '',
      firstName: profile.given_name || '',
      lastName: profile.family_name || '',
      roles: this.extractRoles(oidcUser),
      permissions: [],
      preferences: {}
    });
  }

  private extractRoles(oidcUser: User): string[] {
    const profile = oidcUser.profile as any;
    const realmRoles: string[] = profile?.realm_access?.roles ?? [];
    const clientId = this.kcConfig?.clientId;
    const clientRoles: string[] = clientId
      ? (profile?.resource_access?.[clientId]?.roles ?? [])
      : [];
    return [...realmRoles, ...clientRoles];
  }

  /**
   * Where to put the person back after Keycloak redirects to /callback.
   * The whole in-app URL, not just the pathname, so a deep link with query
   * params or a fragment survives the round trip. `/callback` itself is never
   * a return target — the "Try Again" button on the failed-callback screen
   * calls login() from that route, and echoing it back would bounce the
   * person into a callback with no authorization code to exchange.
   */
  private currentReturnTo(): string {
    const { pathname, search, hash } = window.location;
    if (pathname.startsWith('/callback')) return '/';
    return `${pathname}${search}${hash}` || '/';
  }

  /** The state object every authorization request carries. */
  private signinState(checkSso: boolean, returnTo?: string): CallbackState {
    return { returnTo: returnTo ?? this.currentReturnTo(), checkSso };
  }

  async login(): Promise<void> {
    const um = this.ensureUserManager();
    if (!um) throw new Error('OIDC not configured');
    // Deliberately no `prompt` — the visible Login button means "ask me".
    await um.signinRedirect({ state: this.signinState(false) });
  }

  /**
   * ONE top-level `prompt=none` round trip, fired on landing when there is no
   * usable local session. This is Keycloak's own `check-sso` move, done the way
   * their adapter does it when iframes are not an option.
   *
   * WHY NOT AN IFRAME: the silent-renew iframe posts to
   * `silent_redirect_uri` and needs Keycloak's SSO cookie sent into a
   * cross-site frame. Polari's hostnames are `prf.<host>.nip.io` and
   * `auth.<host>.nip.io`, and `nip.io` is on the Public Suffix List — so those
   * are two different *sites*, the cookie is third-party, and every current
   * browser withholds it. The iframe answers `login_required` (or just times
   * out) for a session that is perfectly alive. A top-level navigation carries
   * the cookie normally, so it gets the true answer.
   *
   * WHY IT CANNOT LOOP: it is fired at most once per browser session, guarded
   * by `polari-sso-checked` in sessionStorage — see AuthSessionService.
   */
  async checkSso(returnTo: string): Promise<void> {
    const um = this.ensureUserManager();
    if (!um) throw new Error('OIDC not configured');
    await um.signinRedirect({
      prompt: 'none',
      state: this.signinState(true, returnTo),
    });
  }

  /**
   * Initiate a registration flow. Keycloak honors the `kc_action=register`
   * extra param to land users on the registration form instead of login.
   */
  async register(): Promise<void> {
    const um = this.ensureUserManager();
    if (!um) throw new Error('OIDC not configured');
    await um.signinRedirect({
      state: this.signinState(false),
      extraQueryParams: { kc_action: 'register' }
    });
  }

  /**
   * Normalise whatever came back in `state`.
   *
   * oidc-client-ts copies the request's custom state onto BOTH the success
   * response (`User.state`) and the failure one (`ErrorResponse.state`) —
   * `_processSigninState` assigns `response.userState = state.data` *before* it
   * throws on `response.error`, which is what makes the "no session" branch
   * able to find its way home. Tolerates the legacy bare-string shape.
   */
  private readCallbackState(raw: unknown): CallbackState {
    if (typeof raw === 'string' && raw) return { returnTo: raw, checkSso: false };
    const s = raw as Partial<CallbackState> | null | undefined;
    const returnTo = typeof s?.returnTo === 'string' && s.returnTo ? s.returnTo : '/';
    return { returnTo, checkSso: s?.checkSso === true };
  }

  async handleCallback(): Promise<OidcCallbackResult> {
    const um = this.ensureUserManager();
    if (!um) {
      console.error('[OidcService] handleCallback: UserManager not initialized (runtime config missing keycloak stanza?)');
      return { kind: 'error', message: 'Auth is not configured on this instance.', state: { returnTo: '/', checkSso: false } };
    }
    try {
      const user = await um.signinRedirectCallback();
      return { kind: 'user', user, state: this.readCallbackState((user as any).state) };
    } catch (err: any) {
      const state = this.readCallbackState(err?.state);

      // Keycloak said "I would have had to ask a human". Only a prompt=none
      // request can provoke this, so on the check-sso probe it is the expected
      // negative answer: nobody is signed in at the IdP. Not a failure — the
      // caller swallows it and the person browses anonymously.
      if (err instanceof ErrorResponse && err.error && NO_SESSION_ERRORS.has(err.error)) {
        console.debug('[OidcService] check-sso: no Keycloak session —', err.error);
        return { kind: 'no-session', state };
      }

      console.error('[OidcService] handleCallback FAILED:', err);
      console.error('[OidcService] callback error details:', {
        name: err?.name,
        message: err?.message,
        error: err?.error,
        errorDescription: err?.error_description,
      });
      // Persist for the diagnostics page so user can see it after navigating away.
      try {
        sessionStorage.setItem('__polari_auth_callback_error', JSON.stringify({
          when: new Date().toISOString(),
          name: err?.name,
          message: err?.message,
          error: err?.error,
          errorDescription: err?.error_description,
        }));
      } catch {}
      const message = err?.error_description || err?.message || err?.error
        || 'No usable session returned from Keycloak (see console for details).';
      return { kind: 'error', message, state };
    }
  }

  /**
   * End the session everywhere: `signoutRedirect()` drops the stored user and
   * then navigates to Keycloak's end-session endpoint, so the KC SSO cookie
   * goes too — otherwise "Sign out" would only forget the tokens and the next
   * silent renew would quietly sign the person back in.
   *
   * If the redirect can't be built (metadata unreachable, no end-session
   * endpoint) we still clear local storage. Now that the user store is
   * localStorage, a failed sign-out that left the tokens behind would persist
   * across restarts — the one failure mode worth being heavy-handed about.
   */
  async logout(): Promise<void> {
    const um = this.ensureUserManager();
    if (!um) return;
    try {
      await um.signoutRedirect();
    } catch (err) {
      console.error('[OidcService] signoutRedirect failed — clearing local session anyway', err);
      await this.removeUser();
      throw err;
    }
  }

  /**
   * Renew without leaving the page.
   *
   * oidc-client-ts takes the refresh-token branch whenever the stored user has
   * a `refresh_token` — a plain POST to the token endpoint, no frame, no
   * cookie. That is the path we want and the one that makes "close the window,
   * come back, still signed in" work.
   *
   * With NO stored refresh token the library falls back to a hidden
   * `prompt=none` iframe instead, and on Polari's `*.nip.io` hostnames that
   * iframe is a cross-*site* request that never receives Keycloak's cookie: it
   * cannot succeed, and it costs a ten-second timeout at boot before saying so.
   * So we decline it here and let the caller fall to the top-level check-sso
   * redirect, which is the same question asked in a way the browser answers.
   */
  async signinSilent(): Promise<User | null> {
    const um = this.ensureUserManager();
    if (!um) return null;
    try {
      const stored = await um.getUser();
      if (!stored?.refresh_token) {
        console.debug('[OidcService] no stored refresh token — skipping the iframe silent-signin path');
        return null;
      }
      return await um.signinSilent();
    }
    catch (err) {
      // Silent failure is expected when the refresh token has been revoked.
      console.debug('[OidcService] silent signin failed', err);
      return null;
    }
  }

  async isAuthenticated(): Promise<boolean> {
    const user = await this.getUser();
    return user !== null && !user.expired;
  }

  async getAccessToken(): Promise<string | null> {
    const user = await this.getUser();
    return user?.access_token ?? null;
  }

  async removeUser(): Promise<void> {
    const um = this.ensureUserManager();
    if (!um) return;
    try { await um.removeUser(); }
    catch (err) { console.error('[OidcService] removeUser failed', err); }
  }
}
