import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, firstValueFrom } from 'rxjs';

import { RuntimeConfigService } from '@services/runtime-config.service';

/**
 * Thin wrapper around /api/roles + /api/me/permissions.
 *
 * Roles are cached in a BehaviorSubject so the Roles tab + Role detail
 * page + Object Permissions tab can share a single load. The backend
 * does its own lazy Keycloak sync (60s TTL), so a `refresh()` here
 * pulls fresh data without any extra plumbing on our side.
 */
export interface RoleGrant {
  className: string;
  ops: string[];
}

export interface RoleDTO {
  name: string;
  description: string;
  source: string;          // 'keycloak-realm' | 'orphaned' | (future: 'polari-local')
  syncedAt: string;
  grants: RoleGrant[];
}

export interface MyPermissions {
  authenticated: boolean;
  sub: string | null;
  username?: string;
  roles: string[];
  effectivePermissions: RoleGrant[];
  // {className: {op: [roleName, ...]}} — which role granted each op.
  sourceRoles: Record<string, Record<string, string[]>>;
}

export interface KeycloakGroupDTO {
  id: string;
  name: string;
  path: string;
  description: string;
  attributes: Record<string, string[]>;
  realmRoles: string[];
  memberCount: number | null;
}

@Injectable({ providedIn: 'root' })
export class RolesService {
  private readonly _roles$ = new BehaviorSubject<RoleDTO[]>([]);
  private _loaded = false;
  private _syncWarning: string | null = null;

  constructor(
    private http: HttpClient,
    private runtimeConfig: RuntimeConfigService
  ) {}

  get roles$(): Observable<RoleDTO[]> {
    return this._roles$.asObservable();
  }

  get syncWarning(): string | null {
    return this._syncWarning;
  }

  get loaded(): boolean {
    return this._loaded;
  }

  /** Loads roles into the BehaviorSubject. Pass force=true to bypass the
   * "already loaded once" short-circuit when the user hits Refresh. */
  async load(force = false): Promise<RoleDTO[]> {
    if (this._loaded && !force) return this._roles$.value;
    const url = `${this.runtimeConfig.getBackendBaseUrl()}/api/roles`;
    const resp = await firstValueFrom(
      this.http.get<{ success: boolean; data: RoleDTO[]; syncWarning?: string }>(url)
    );
    this._syncWarning = resp.syncWarning || null;
    const roles = resp.data || [];
    this._roles$.next(roles);
    this._loaded = true;
    return roles;
  }

  async getByName(name: string): Promise<RoleDTO | null> {
    // Prefer the cached list when we have it — avoids a round-trip per
    // page navigation. Falls back to the dedicated endpoint when missing.
    const cached = this._roles$.value.find(r => r.name === name);
    if (cached) return cached;
    const url = `${this.runtimeConfig.getBackendBaseUrl()}/api/roles/${encodeURIComponent(name)}`;
    try {
      const resp = await firstValueFrom(
        this.http.get<{ success: boolean; data: RoleDTO }>(url)
      );
      return resp.data;
    } catch {
      return null;
    }
  }

  async getMyPermissions(): Promise<MyPermissions> {
    const url = `${this.runtimeConfig.getBackendBaseUrl()}/api/me/permissions`;
    const resp = await firstValueFrom(
      this.http.get<{ success: boolean; data: MyPermissions }>(url)
    );
    return resp.data;
  }

  /** Live list of Keycloak realm groups + their realm-role mappings.
   * Not cached locally — groups are a KC concern and the Admin tab
   * pulls fresh on each visit. */
  async getGroups(): Promise<{ groups: KeycloakGroupDTO[]; warning: string | null }> {
    const url = `${this.runtimeConfig.getBackendBaseUrl()}/api/groups`;
    const resp = await firstValueFrom(
      this.http.get<{ success: boolean; data: KeycloakGroupDTO[]; syncWarning?: string }>(url)
    );
    return { groups: resp.data || [], warning: resp.syncWarning || null };
  }

  /** Replace the grant for one (role, className) pair. Empty `ops`
   * clears the grant entirely. Returns the updated role so the caller
   * can refresh local state. Also patches the BehaviorSubject so all
   * subscribers see the change without an extra round-trip. */
  async saveGrant(roleName: string, className: string, ops: string[]): Promise<RoleDTO> {
    const url = `${this.runtimeConfig.getBackendBaseUrl()}/api/roles/${encodeURIComponent(roleName)}/grants/${encodeURIComponent(className)}`;
    const resp = await firstValueFrom(
      this.http.put<{ success: boolean; data: RoleDTO }>(url, { ops })
    );
    const updated = resp.data;
    // Patch the cached list in place — keeps Roles tab / role detail /
    // class-main-page Permissions tab consistent without a refetch.
    const list = [...this._roles$.value];
    const idx = list.findIndex(r => r.name === updated.name);
    if (idx >= 0) {
      list[idx] = updated;
    } else {
      list.push(updated);
    }
    this._roles$.next(list);
    return updated;
  }
}
