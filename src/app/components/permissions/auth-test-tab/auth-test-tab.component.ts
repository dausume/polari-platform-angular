import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Subscription } from 'rxjs';

import {
  AuthDiagnosticsService,
  AuthMeResponse,
  JwksHealthResponse,
  RoleSyncHealthResponse,
} from '@services/auth/auth-diagnostics.service';
import { AuthSessionService } from '@services/auth/auth-session.service';

/**
 * Permissions → Authentication Test sub-tab.
 *
 * Four independent panels — each isolates a single link in the auth chain
 * so a failure points at the exact layer:
 *
 *   1. Access Token     — what AuthSessionService.accessToken$ holds right now
 *   2. JWKS Health      — can the *backend* reach Keycloak's signing keys?
 *   3. /auth/me         — does the backend validate the user's token?
 *   4. Frontend Session — what oidc-client-ts thinks we have locally
 *
 * The "Recheck" buttons re-run each check independently, mirroring how
 * other diagnostic tabs in this codebase let users isolate flaky links.
 */
@Component({
  standalone: true,
  selector: 'auth-test-tab',
  imports: [
    CommonModule, MatCardModule, MatButtonModule, MatIconModule,
    MatChipsModule, MatProgressSpinnerModule, MatDividerModule, MatTooltipModule,
  ],
  templateUrl: './auth-test-tab.component.html',
  styleUrls: ['./auth-test-tab.component.css'],
})
export class AuthTestTabComponent implements OnInit, OnDestroy {
  // 1. Token
  accessToken: string | null = null;
  tokenVisible = false;
  copyFeedback: string | null = null;

  // 2. JWKS health
  jwks: JwksHealthResponse | null = null;
  jwksLoading = false;

  // 2b. Role sync health (service-account flow)
  roleSync: RoleSyncHealthResponse | null = null;
  roleSyncLoading = false;

  // 3. /auth/me
  me: AuthMeResponse | null = null;
  meLoading = false;
  meError: string | null = null;

  // 4. Frontend session
  frontendAuthenticated = false;
  frontendName = '';
  frontendEmail: string | null = null;
  frontendRoles: string[] = [];

  private subs = new Subscription();

  constructor(
    private diag: AuthDiagnosticsService,
    private authSession: AuthSessionService
  ) {}

  ngOnInit(): void {
    this.subs.add(
      this.authSession.currentUser$.subscribe(user => {
        this.frontendAuthenticated = !!user;
        this.frontendName = user?.name || '';
        this.frontendEmail = user?.email || null;
        this.frontendRoles = user?.roles || [];
      })
    );
    this.subs.add(
      this.authSession.accessToken$.subscribe(token => {
        this.accessToken = token;
      })
    );
    this.checkConnectivity();
    this.checkMe();
  }

  /** Runs both backend → Keycloak probes in parallel. The page shows
   * them as a single card since they're two probes of the same chain;
   * a failure in either points to the same class of problem (KC
   * unreachable / misconfigured) just at a different endpoint. */
  async checkConnectivity(): Promise<void> {
    await Promise.all([this.checkJwks(), this.checkRoleSync()]);
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  async checkJwks(): Promise<void> {
    this.jwksLoading = true;
    try {
      this.jwks = await this.diag.getJwksHealth();
    } catch (err: any) {
      this.jwks = {
        configured: false,
        jwksUri: null, issuer: null,
        reachable: false, httpStatus: null,
        keyCount: null, kids: null, latencyMs: null,
        error: err?.message || String(err),
      };
    } finally {
      this.jwksLoading = false;
    }
  }

  async checkRoleSync(): Promise<void> {
    this.roleSyncLoading = true;
    try {
      this.roleSync = await this.diag.getRoleSyncHealth();
    } catch (err: any) {
      this.roleSync = {
        configured: false,
        adminUrl: null, realm: null, clientId: null,
        secretPresent: false, tokenOk: false, listOk: false,
        roleCount: null, roleNames: null, localRoleCount: 0,
        latencyMs: null,
        error: err?.message || String(err),
      };
    } finally {
      this.roleSyncLoading = false;
    }
  }

  /** Both probes ok? — drives the combined card's status icon. */
  get connectivityOk(): boolean {
    return !!(this.jwks?.reachable && this.roleSync?.tokenOk && this.roleSync?.listOk);
  }

  get connectivityChecked(): boolean {
    return this.jwks !== null && this.roleSync !== null;
  }

  async checkMe(): Promise<void> {
    this.meLoading = true;
    this.meError = null;
    try {
      this.me = await this.diag.getMe();
    } catch (err: any) {
      this.meError = err?.message || String(err);
      this.me = null;
    } finally {
      this.meLoading = false;
    }
  }

  /** Force AuthSessionService to re-read the access_token from
   * oidc-client-ts storage. Surfaces post-renewal updates the
   * BehaviorSubject doesn't see automatically. */
  async refreshToken(): Promise<void> {
    await this.authSession.refreshAccessToken();
  }

  toggleTokenVisibility(): void {
    this.tokenVisible = !this.tokenVisible;
  }

  async copyToken(): Promise<void> {
    if (!this.accessToken) return;
    try {
      await navigator.clipboard.writeText(this.accessToken);
      this.copyFeedback = 'Copied to clipboard';
    } catch {
      this.copyFeedback = 'Copy failed — select manually';
    }
    setTimeout(() => (this.copyFeedback = null), 2000);
  }

  /** Decode the JWT payload (middle segment, base64url) so the user can
   * inspect claims without leaving the page. Returns null if the token
   * doesn't look like a JWT. */
  get decodedClaims(): any | null {
    if (!this.accessToken) return null;
    const parts = this.accessToken.split('.');
    if (parts.length !== 3) return null;
    try {
      const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const padded = payload + '='.repeat((4 - (payload.length % 4)) % 4);
      return JSON.parse(atob(padded));
    } catch {
      return null;
    }
  }

  /** Short preview of the token — first 12 + last 6 chars. */
  get tokenPreview(): string {
    if (!this.accessToken) return '—';
    if (this.accessToken.length <= 24) return this.accessToken;
    return `${this.accessToken.slice(0, 12)}…${this.accessToken.slice(-6)}`;
  }

  get tokenLength(): number {
    return this.accessToken?.length ?? 0;
  }
}
