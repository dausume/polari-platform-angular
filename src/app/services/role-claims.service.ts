import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { PolariService } from '@services/polari-service';

/**
 * role-claims.service — SELF-CLAIMABLE ROLES (his words, 2026-09-18):
 *
 *   "I see no way, upon registering, to simply assign myself a role in the
 *    Polari interface. ... It should not be the case all roles can be taken
 *    by anyone, but self-proclaimable roles should be a thing, especially in
 *    dev mode."
 *
 * A role IS a Keycloak group, so claiming one puts the signed-in person into
 * that group through the backend's Keycloak service account. The backend
 * decides WHICH roles may be taken (dev posture: every prototype role;
 * production: only the ones flagged self_claimable or listed in the
 * `claimable_groups` knob; administrator roles never) — the frontend only
 * shows what it is told and asks.
 *
 * Nothing here throws: an instance may carry no security module at all, and
 * the header must keep working.
 */

export interface ClaimableRole {
  role: string;
  title?: string;
  description?: string;
  /** 'prototype' (a RolePrototype row) or 'knob' (the claimable_groups list). */
  source?: string;
  state?: string;
  held?: boolean;
  why?: string;
}

export interface ClaimableState {
  ok: boolean;
  posture?: string;
  authenticated?: boolean;
  /** The caller's OWN opaque Keycloak id. His PII rule (2026-09-18):
   *  Keycloak exists to keep names and e-mails out of Polari, so the API
   *  never echoes a username — the display name the header shows comes
   *  from the browser's own token, not from Polari. */
  sub?: string;
  roles: ClaimableRole[];
  held: string[];
  /** The Keycloak account console for this realm, or '' when there is none. */
  account_url: string;
  keycloak?: { ready?: boolean; why?: string };
  how?: string;
}

export interface ClaimResult {
  ok: boolean;
  role?: string;
  group_id?: string;
  note?: string;
  refusal?: string;
}

export const EMPTY_CLAIMABLE: ClaimableState = {
  ok: false, roles: [], held: [], account_url: '',
};

@Injectable({ providedIn: 'root' })
export class RoleClaimsService {

  constructor(
    private http: HttpClient,
    private polariService: PolariService,
  ) {}

  /** GET /api/security/roles/claimable — what this caller may take. */
  async claimable(): Promise<ClaimableState> {
    const base = this.backendBase();
    if (!base) { return EMPTY_CLAIMABLE; }
    try {
      const body: any = await firstValueFrom(this.http.get<any>(
        `${base}/api/security/roles/claimable`,
        this.polariService.backendRequestOptions));
      if (!body || !body.ok) { return EMPTY_CLAIMABLE; }
      return {
        ok: true,
        posture: body.posture,
        authenticated: !!body.authenticated,
        sub: body.sub,
        roles: Array.isArray(body.roles) ? body.roles : [],
        held: Array.isArray(body.held) ? body.held : [],
        account_url: body.account_url || '',
        keycloak: body.keycloak,
        how: body.how,
      };
    } catch (err) {
      // No security module, no Keycloak, or unreachable: offer nothing.
      console.warn('[role-claims] could not read roles/claimable', err);
      return EMPTY_CLAIMABLE;
    }
  }

  /** POST /api/security/roles/claim — join the role's Keycloak group. */
  async claim(role: string): Promise<ClaimResult> {
    const base = this.backendBase();
    if (!base || !role) { return { ok: false, refusal: 'no backend' }; }
    try {
      const body: any = await firstValueFrom(this.http.post<any>(
        `${base}/api/security/roles/claim`, { role },
        this.polariService.backendRequestOptions));
      return (body || { ok: false }) as ClaimResult;
    } catch (err: any) {
      return { ok: false, refusal: this.refusalOf(err, `could not claim ${role}`) };
    }
  }

  /** DELETE /api/security/roles/claim?role= — leave the group again. */
  async release(role: string): Promise<ClaimResult> {
    const base = this.backendBase();
    if (!base || !role) { return { ok: false, refusal: 'no backend' }; }
    try {
      const body: any = await firstValueFrom(this.http.delete<any>(
        `${base}/api/security/roles/claim?role=${encodeURIComponent(role)}`,
        this.polariService.backendRequestOptions));
      return (body || { ok: false }) as ClaimResult;
    } catch (err: any) {
      return { ok: false, refusal: this.refusalOf(err, `could not release ${role}`) };
    }
  }

  /** The backend always answers a refusal sentence; surface it, not "500". */
  private refusalOf(err: any, fallback: string): string {
    const body = err && err.error;
    if (body && typeof body === 'object' && body.refusal) { return body.refusal; }
    if (body && typeof body === 'object' && body.error) { return body.error; }
    if (err && err.status === 0) {
      return 'the backend could not be reached';
    }
    return fallback;
  }

  private backendBase(): string {
    try {
      return this.polariService.getBackendBaseUrl() || '';
    } catch {
      return '';
    }
  }
}
