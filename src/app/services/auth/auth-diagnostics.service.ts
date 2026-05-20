import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { RuntimeConfigService } from '@services/runtime-config.service';

/**
 * Thin wrapper around the Phase-1 auth diagnostic endpoints.
 *
 *   GET /auth/me           — identity extracted from the caller's token
 *   GET /auth/jwks-health  — backend-side reachability of Keycloak's JWKS
 *
 * Both are deliberately routed through HttpClient so the AuthInterceptor
 * attaches the current bearer token to /auth/me (so we exercise the real
 * validation path, not a bypass).
 */
export interface AuthMeResponse {
  authenticated: boolean;
  sub?: string;
  username?: string;
  email?: string | null;
  roles: string[];
}

export interface JwksHealthResponse {
  configured: boolean;
  jwksUri: string | null;
  issuer: string | null;
  reachable: boolean;
  httpStatus: number | null;
  keyCount: number | null;
  kids: string[] | null;
  latencyMs: number | null;
  error: string | null;
}

export interface RoleSyncHealthResponse {
  configured: boolean;          // service-account secret + admin URL present
  adminUrl: string | null;
  realm: string | null;
  clientId: string | null;
  secretPresent: boolean;
  tokenOk: boolean;             // service-account token grant succeeded
  listOk: boolean;              // admin /roles call succeeded
  roleCount: number | null;     // roles Keycloak returned this attempt
  roleNames: string[] | null;
  localRoleCount: number;       // Role tree-objects already cached locally
  latencyMs: number | null;
  error: string | null;
}

@Injectable({ providedIn: 'root' })
export class AuthDiagnosticsService {
  constructor(
    private http: HttpClient,
    private runtimeConfig: RuntimeConfigService
  ) {}

  async getMe(): Promise<AuthMeResponse> {
    const url = `${this.runtimeConfig.getBackendBaseUrl()}/auth/me`;
    const resp = await firstValueFrom(
      this.http.get<{ success: boolean; data: AuthMeResponse }>(url)
    );
    return resp.data;
  }

  async getJwksHealth(): Promise<JwksHealthResponse> {
    const url = `${this.runtimeConfig.getBackendBaseUrl()}/auth/jwks-health`;
    const resp = await firstValueFrom(
      this.http.get<{ success: boolean; data: JwksHealthResponse }>(url)
    );
    return resp.data;
  }

  async getRoleSyncHealth(): Promise<RoleSyncHealthResponse> {
    const url = `${this.runtimeConfig.getBackendBaseUrl()}/api/roles/sync-health`;
    const resp = await firstValueFrom(
      this.http.get<{ success: boolean; data: RoleSyncHealthResponse }>(url)
    );
    return resp.data;
  }
}
