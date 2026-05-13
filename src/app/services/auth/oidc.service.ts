import { Injectable } from '@angular/core';
import { User, UserManager, UserManagerSettings } from 'oidc-client-ts';
import { RuntimeConfigService, KeycloakConfig } from '@services/runtime-config.service';
import { AuthUser } from '../../classes/auth-user';

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

  constructor(private runtimeConfig: RuntimeConfigService) {}

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

    const settings: UserManagerSettings = {
      authority: cfg.authority,
      client_id: cfg.clientId,
      redirect_uri: cfg.redirectUri,
      post_logout_redirect_uri: cfg.postLogoutRedirectUri,
      response_type: cfg.responseType,
      scope: cfg.scope,
      silent_redirect_uri: cfg.silentRedirectUri,
      automaticSilentRenew: true,
      loadUserInfo: true,
      monitorSession: true,
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

  async login(): Promise<void> {
    const um = this.ensureUserManager();
    if (!um) throw new Error('OIDC not configured');
    await um.signinRedirect({ state: window.location.pathname });
  }

  /**
   * Initiate a registration flow. Keycloak honors the `kc_action=register`
   * extra param to land users on the registration form instead of login.
   */
  async register(): Promise<void> {
    const um = this.ensureUserManager();
    if (!um) throw new Error('OIDC not configured');
    await um.signinRedirect({
      state: window.location.pathname,
      extraQueryParams: { kc_action: 'register' }
    });
  }

  async handleCallback(): Promise<User | null> {
    const um = this.ensureUserManager();
    if (!um) return null;
    try { return await um.signinRedirectCallback(); }
    catch (err) { console.error('[OidcService] callback failed', err); return null; }
  }

  async logout(): Promise<void> {
    const um = this.ensureUserManager();
    if (!um) return;
    await um.signoutRedirect();
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
