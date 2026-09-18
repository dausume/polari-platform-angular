import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import {
  InMemoryWebStorage, User, UserManager, UserManagerSettings, WebStorageStateStore
} from 'oidc-client-ts';
import { RuntimeConfigService } from '@services/runtime-config.service';
import { KeycloakConfig } from '@models/runtimeConfig';
import { AuthUser } from '../../classes/auth-user';

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

  async login(): Promise<void> {
    const um = this.ensureUserManager();
    if (!um) throw new Error('OIDC not configured');
    await um.signinRedirect({ state: this.currentReturnTo() });
  }

  /**
   * Initiate a registration flow. Keycloak honors the `kc_action=register`
   * extra param to land users on the registration form instead of login.
   */
  async register(): Promise<void> {
    const um = this.ensureUserManager();
    if (!um) throw new Error('OIDC not configured');
    await um.signinRedirect({
      state: this.currentReturnTo(),
      extraQueryParams: { kc_action: 'register' }
    });
  }

  async handleCallback(): Promise<User | null> {
    console.log('[OidcService] handleCallback() ENTRY — url:', window.location.href);
    const um = this.ensureUserManager();
    if (!um) {
      console.error('[OidcService] handleCallback: UserManager not initialized (runtime config missing keycloak stanza?)');
      return null;
    }
    try {
      const user = await um.signinRedirectCallback();
      console.log('[OidcService] handleCallback SUCCESS — user:', {
        sub: user?.profile?.sub,
        username: user?.profile?.preferred_username,
        hasAccessToken: !!user?.access_token,
        accessTokenLen: user?.access_token?.length || 0,
        expired: user?.expired,
        expiresIn: user?.expires_in,
        scope: user?.scope,
      });
      return user;
    } catch (err: any) {
      console.error('[OidcService] handleCallback FAILED:', err);
      console.error('[OidcService] callback error details:', {
        name: err?.name,
        message: err?.message,
        stack: err?.stack,
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
      return null;
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

  async signinSilent(): Promise<User | null> {
    const um = this.ensureUserManager();
    if (!um) return null;
    try { return await um.signinSilent(); }
    catch (err) {
      // Silent failure is expected when there's no existing session.
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
