import { Injectable } from '@angular/core';

import { RuntimeConfigService } from '@services/runtime-config.service';

/**
 * Builds deep links into the Keycloak admin console.
 *
 * The runtime config's `keycloak.authority` is the realm-scoped issuer
 * (e.g. https://auth.prf.<host>/realms/Polari). We strip the
 * `/realms/<name>` suffix to get the base URL, then assemble the
 * admin console paths from there. All admin URLs are routed through
 * `/admin/master/console/#/<realm>/...` (KC's hash-routed admin SPA).
 *
 * Returns `null` when the runtime config has no keycloak block so
 * callers can hide buttons rather than rendering broken links.
 */
@Injectable({ providedIn: 'root' })
export class KeycloakAdminLinkService {
  constructor(private runtimeConfig: RuntimeConfigService) {}

  private baseAndRealm(): { base: string; realm: string } | null {
    const cfg = this.runtimeConfig.getKeycloakConfig();
    if (!cfg?.authority || !cfg?.realm) return null;
    // authority = https://auth.<host>/realms/<realm> → strip /realms/<realm>
    const idx = cfg.authority.lastIndexOf('/realms/');
    const base = idx >= 0 ? cfg.authority.substring(0, idx) : cfg.authority;
    return { base, realm: cfg.realm };
  }

  /** Top-level admin console home for the realm. */
  realmHome(): string | null {
    const ctx = this.baseAndRealm();
    return ctx ? `${ctx.base}/admin/master/console/#/${ctx.realm}` : null;
  }

  /** Realm Roles list page. */
  rolesPage(): string | null {
    const ctx = this.baseAndRealm();
    return ctx ? `${ctx.base}/admin/master/console/#/${ctx.realm}/roles` : null;
  }

  /** Single role detail. */
  rolePage(roleName: string): string | null {
    const ctx = this.baseAndRealm();
    return ctx
      ? `${ctx.base}/admin/master/console/#/${ctx.realm}/roles/${encodeURIComponent(roleName)}`
      : null;
  }

  /** Groups list page. */
  groupsPage(): string | null {
    const ctx = this.baseAndRealm();
    return ctx ? `${ctx.base}/admin/master/console/#/${ctx.realm}/groups` : null;
  }

  /** Single group's detail page. Lands on KC's default tab for the
   * group (members) rather than a sub-route — the `/settings` suffix
   * deep-link triggers a "can't access property 'map', R is null" in
   * KC 26's admin SPA when arrived at cold, because the component
   * mounts before the group state hydrates. The bare path waits on
   * the same data with the loading guards in place. */
  groupPage(groupId: string): string | null {
    const ctx = this.baseAndRealm();
    return ctx
      ? `${ctx.base}/admin/master/console/#/${ctx.realm}/groups/${groupId}`
      : null;
  }

  /** Fine-grained admin permissions page (requires adminPermissionsEnabled). */
  permissionsPage(): string | null {
    const ctx = this.baseAndRealm();
    return ctx ? `${ctx.base}/admin/master/console/#/${ctx.realm}/permissions` : null;
  }

  /** Clients list — useful for jumping to admin-permissions client. */
  clientsPage(): string | null {
    const ctx = this.baseAndRealm();
    return ctx ? `${ctx.base}/admin/master/console/#/${ctx.realm}/clients` : null;
  }
}
