import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

import { OidcService } from './oidc.service';
import { AuthUser } from '../../classes/auth-user';

/**
 * "This browser session has already asked Keycloak whether anyone is signed
 * in, and the answer was no." sessionStorage, not localStorage, on purpose:
 * the answer is only stale-proof for as long as the tab tree lives, and a new
 * window deserves a fresh ask (that is how someone who signed in elsewhere
 * gets picked up). Cleared on a successful sign-in.
 */
const SSO_CHECKED_KEY = 'polari-sso-checked';
/** Timestamp of the last check-sso we *launched*, as a loop fuse. */
const SSO_ATTEMPT_KEY = 'polari-sso-attempted-at';
/** Two check-sso launches closer together than this means something is
 *  bouncing us; stop asking for the rest of the browser session. */
const SSO_LOOP_WINDOW_MS = 30_000;
/** Don't hold the first paint hostage if the redirect never actually leaves. */
const SSO_REDIRECT_GIVE_UP_MS = 8_000;

/**
 * What `/callback` should do next.
 *
 * `silent` is the one that matters: it marks an arrival the person did not
 * ask for (the landing check-sso probe), so the route goes quietly back to
 * `returnTo` instead of putting a "Sign-in failed" panel in front of someone
 * who never pressed Login.
 */
export interface CallbackOutcome {
  returnTo: string;
  signedIn: boolean;
  silent: boolean;
  errorMessage: string | null;
}

/** sessionStorage can throw outright in a locked-down profile. Never at boot. */
function session(): Storage | null {
  try {
    const s = window.sessionStorage;
    s.getItem(SSO_CHECKED_KEY);
    return s;
  } catch { return null; }
}

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
   * Idempotent boot hook, run from the APP_INITIALIZER in app.module.ts.
   * Returns a Promise so Angular waits for the restore before rendering —
   * that is what keeps the first paint from flashing "Login" at somebody who
   * is in fact signed in.
   *
   * `whenConfigured()` rather than `isConfigured()`: Angular starts every
   * APP_INITIALIZER in one synchronous pass, so this used to be reached while
   * runtime-config.json was still downloading. It read "no keycloak stanza",
   * returned at the first line, and the session was never restored on ANY
   * landing — the whole bug. See OidcService.whenConfigured().
   */
  async start(): Promise<void> {
    if (this.started) return;
    this.started = true;
    // Lean instances genuinely have no keycloak stanza — no login UI, and
    // certainly no check-sso redirect. This is the only legitimate early exit.
    if (!await this.oidc.whenConfigured()) return;

    // Track the copy oidc-client-ts actually holds. `automaticSilentRenew`
    // swaps the token in storage on its own schedule; without this the
    // subjects below kept publishing the pre-renew token until a 401 forced
    // a resync, so the UI could show a signed-out header while the store
    // held a perfectly good session.
    this.oidc.userLoaded$.subscribe(user => {
      if (user && !user.expired) {
        this._setSession(this.oidc.convertToAuthUser(user), user.access_token);
      }
    });

    // If we're on the /callback route, leave session restore to the
    // callback component — calling signinSilent here would race the
    // authorization-code exchange.
    if (window.location.pathname.startsWith('/callback')) return;

    if (await this.attemptSessionRestore('startup')) return;

    // Nothing locally, and no refresh token to redeem. Keycloak may still hold
    // an SSO session for this person (they signed in on another tab, or in a
    // window that has since been closed). Ask it — once.
    await this.maybeCheckSso();
  }

  /**
   * The landing-time `prompt=none` probe. At most ONE per browser session,
   * and it never runs when a local session was restored.
   */
  private async maybeCheckSso(): Promise<void> {
    const store = session();
    if (store?.getItem(SSO_CHECKED_KEY)) return;   // already asked, answer was no

    // Loop fuse. The normal "no" path sets SSO_CHECKED_KEY on the way back
    // through /callback. If something stops that from happening — a code that
    // will not exchange, a state store the browser keeps wiping — the only
    // symptom left would be an endless bounce between here and Keycloak. Two
    // launches inside half a minute is the signature; stop on the second.
    const last = Number(store?.getItem(SSO_ATTEMPT_KEY) ?? 0);
    if (last && Date.now() - last < SSO_LOOP_WINDOW_MS) {
      console.warn('[AuthSession] check-sso re-entered too quickly — standing down for this browser session');
      this.markSsoChecked();
      return;
    }

    const returnTo = this.currentInAppUrl();
    try {
      store?.setItem(SSO_ATTEMPT_KEY, String(Date.now()));
      // signinRedirect()'s promise settles on unload, i.e. effectively never.
      // Race it so a redirect that cannot leave (Keycloak unreachable) costs a
      // few seconds of blank page rather than a permanently unbooted app.
      await Promise.race([
        this.oidc.checkSso(returnTo),
        new Promise<void>(resolve => setTimeout(resolve, SSO_REDIRECT_GIVE_UP_MS)),
      ]);
    } catch (err) {
      console.debug('[AuthSession] check-sso redirect could not start', err);
      this.markSsoChecked();
    }
  }

  /** The whole in-app URL, so a deep link survives the check-sso round trip. */
  private currentInAppUrl(): string {
    const { pathname, search, hash } = window.location;
    if (pathname.startsWith('/callback')) return '/';
    return `${pathname}${search}${hash}` || '/';
  }

  private markSsoChecked(): void {
    try { session()?.setItem(SSO_CHECKED_KEY, '1'); } catch { /* nothing to do */ }
  }

  private clearSsoChecked(): void {
    try {
      const s = session();
      s?.removeItem(SSO_CHECKED_KEY);
      s?.removeItem(SSO_ATTEMPT_KEY);
    } catch { /* nothing to do */ }
  }

  /** The realm URL a sign-in has to reach (for the message when it cannot). */
  get authority(): string { return this.oidc.authority; }

  /** false when the round trip to the realm could not even start (bp-2b: the caller SAYS so — a phone that does not
   *  trust the realm host's certificate used to see a button that did nothing, the failure only in the console). */
  async login(): Promise<boolean> {
    try { await this.oidc.login(); return true; }
    catch (err) { console.error('[AuthSession] login failed', err); return false; }
  }

  async register(): Promise<boolean> {
    try { await this.oidc.register(); return true; }
    catch (err) { console.error('[AuthSession] register failed', err); return false; }
  }

  async logout(): Promise<void> {
    // Marked BEFORE the redirect, not after: signoutRedirect() navigates away
    // and its promise never settles, so a `finally` here would not run. And
    // the answer is already known — the end-session redirect is about to kill
    // the SSO cookie, so "is anyone signed in?" is settled at "no". Recording
    // it now is what stops "sign out, land again" costing a pointless
    // prompt=none round trip through Keycloak. sessionStorage survives the
    // redirect; it is the same tab and the same origin.
    this.markSsoChecked();
    try {
      await this.oidc.logout();
    } catch (err) {
      console.error('[AuthSession] logout failed', err);
    } finally {
      this._setSession(null, null);
    }
  }

  /**
   * Called by the /callback route component after Keycloak redirects back.
   * Covers both arrivals: a real sign-in, and the return leg of the landing
   * check-sso probe.
   */
  async handleOAuthCallback(): Promise<CallbackOutcome> {
    const result = await this.oidc.handleCallback();

    if (result.kind === 'user' && !result.user.expired) {
      this._setSession(this.oidc.convertToAuthUser(result.user), result.user.access_token);
      // Somebody IS signed in here — retract any earlier "nobody is".
      this.clearSsoChecked();
      return { returnTo: result.state.returnTo, signedIn: true, silent: result.state.checkSso, errorMessage: null };
    }

    // Keycloak: "nobody is signed in". This is the whole point of the probe —
    // record the answer so we never ask again this browser session, and put
    // the person back where they were with no error UI and no second redirect.
    if (result.kind === 'no-session') {
      this.markSsoChecked();
      this._setSession(null, null);
      return { returnTo: result.state.returnTo, signedIn: false, silent: true, errorMessage: null };
    }

    // A code came back but produced an expired/unusable user, or the exchange
    // failed outright. Either way this browser session stops probing —
    // otherwise the next landing tries the same thing and bounces.
    this.markSsoChecked();
    this._setSession(null, null);

    // A failed check-sso is still not worth a face: the person never asked to
    // sign in. Log it, send them home quietly.
    if (result.state.checkSso) {
      console.warn('[AuthSession] check-sso round trip failed — continuing anonymously');
      return { returnTo: result.state.returnTo, signedIn: false, silent: true, errorMessage: null };
    }

    const errorMessage = result.kind === 'error'
      ? result.message
      : 'No usable session returned from Keycloak (see console for details).';
    return { returnTo: result.state.returnTo, signedIn: false, silent: false, errorMessage };
  }

  /**
   * HTTP error interceptor calls this when a token-bearing backend request
   * returns 401. One silent renew is attempted. If it does not come back with
   * a usable user we re-check the store before giving up: a 401 can come from
   * an endpoint that simply refuses this caller, and dropping the whole
   * session on one such answer is how a signed-in person ends up staring at a
   * "Login" button with a valid token sitting in storage. Only a store that
   * has no live user left means signed out.
   */
  async onApiUnauthorized(): Promise<void> {
    if (this.inFlight) return;
    this.inFlight = true;
    try {
      const renewed = await this.oidc.signinSilent();
      if (renewed && !renewed.expired) {
        this._setSession(this.oidc.convertToAuthUser(renewed), renewed.access_token);
        return;
      }
      const stored = await this.oidc.getUser();
      if (stored && !stored.expired) {
        // Session is alive; this 401 was about the endpoint, not the caller.
        this._setSession(this.oidc.convertToAuthUser(stored), stored.access_token);
        return;
      }
      if (stored) await this.oidc.removeUser();
      this._setSession(null, null);
    } finally {
      this.inFlight = false;
    }
  }

  /**
   * Re-mint the session silently (prompt=none at Keycloak), so a token
   * issued BEFORE a change at the identity provider is replaced by one
   * that reflects it. Used after a self-claimed role (the new `groups`
   * claim only exists in a freshly issued token) — the caller falls back
   * to "sign in again" when this returns false.
   *
   * Returns true when a fresh, unexpired user came back.
   */
  async renewSession(): Promise<boolean> {
    if (this.inFlight) { return false; }
    if (!this.oidc.isConfigured()) { return false; }
    this.inFlight = true;
    try {
      const user = await this.oidc.signinSilent();
      if (user && !user.expired) {
        this._setSession(this.oidc.convertToAuthUser(user), user.access_token);
        return true;
      }
      return false;
    } catch (err) {
      console.debug('[AuthSession] silent renew after a role claim failed', err);
      return false;
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

  /**
   * Backing call for start() — kept private to discourage external invocation.
   *
   * The persistence contract, in order:
   *   1. a live user already in the store (localStorage — survives the window
   *      closing) is used as-is;
   *   2. an expired one is renewed with `signinSilent()`, which redeems the
   *      stored refresh token straight against Keycloak's token endpoint —
   *      no iframe, so no third-party cookie to be blocked. This is what makes
   *      "close the window, come back, still signed in" work;
   *   3. only if that is refused too (the Keycloak SSO session finally aged
   *      out, or someone signed out) do we fall to signed-out — and the dead
   *      tokens are swept out of storage rather than left to rot there.
   *
   * INVARIANT: this never navigates. Deciding to go and ask Keycloak is the
   * caller's business (start() → maybeCheckSso()); all this does is answer
   * "could the session be brought back without leaving the page?".
   *
   * Returns true when the session is live afterwards.
   */
  private async attemptSessionRestore(reason: string): Promise<boolean> {
    if (this.inFlight) return this.isAuthenticated;
    this.inFlight = true;
    try {
      let user = await this.oidc.getUser();
      const hadStoredUser = !!user;
      if (user?.expired) {
        // Expired but with a refresh token in hand: redeem it against the
        // token endpoint. This runs BEFORE any redirect — a refresh grant is
        // cheaper, invisible, and works even when the SSO cookie is gone.
        // (oidc.signinSilent() declines the iframe fallback itself.)
        user = await this.oidc.signinSilent();
      }
      if (user && !user.expired) {
        this._setSession(this.oidc.convertToAuthUser(user), user.access_token);
        return true;
      }
      // Dead tokens are swept rather than left to rot in localStorage — they
      // would otherwise keep sending us down the refresh path forever.
      if (hadStoredUser) await this.oidc.removeUser();
      this._setSession(null, null);
      return false;
    } catch (err) {
      console.debug(`[AuthSession] session restore (${reason}) failed`, err);
      this._setSession(null, null);
      return false;
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
