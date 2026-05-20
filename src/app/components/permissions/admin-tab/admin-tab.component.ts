import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDividerModule } from '@angular/material/divider';

import { RolesService, KeycloakGroupDTO } from '@services/permissions/roles.service';
import { KeycloakAdminLinkService } from '@services/permissions/keycloak-admin-link.service';

/**
 * Permissions → Admin tab.
 *
 * Two purposes:
 *   1. Guidance — explain the recommended Keycloak configuration so
 *      groups auto-assign roles + intermediate admins can manage
 *      onboarding without code-level access.
 *   2. Live links — list existing realm groups and deep-link each to
 *      its Keycloak admin page for fast onboarding work.
 */
@Component({
  standalone: true,
  selector: 'admin-tab',
  imports: [
    CommonModule, MatCardModule, MatTableModule, MatButtonModule,
    MatIconModule, MatChipsModule, MatTooltipModule,
    MatProgressSpinnerModule, MatDividerModule,
  ],
  templateUrl: './admin-tab.component.html',
  styleUrls: ['./admin-tab.component.css'],
})
export class AdminTabComponent implements OnInit {
  groups: KeycloakGroupDTO[] = [];
  loading = false;
  errorMessage: string | null = null;
  syncWarning: string | null = null;

  readonly displayedColumns = ['name', 'description', 'realmRoles', 'actions'];

  constructor(
    private rolesService: RolesService,
    private kcLink: KeycloakAdminLinkService
  ) {}

  ngOnInit(): void {
    this.load();
  }

  async load(): Promise<void> {
    this.loading = true;
    this.errorMessage = null;
    this.syncWarning = null;
    try {
      const result = await this.rolesService.getGroups();
      this.groups = result.groups;
      this.syncWarning = result.warning;
    } catch (err: any) {
      this.errorMessage = err?.message || String(err);
      this.groups = [];
    } finally {
      this.loading = false;
    }
  }

  get groupsAdminUrl(): string | null { return this.kcLink.groupsPage(); }
  get rolesAdminUrl(): string | null { return this.kcLink.rolesPage(); }
  get permissionsAdminUrl(): string | null { return this.kcLink.permissionsPage(); }
  get clientsAdminUrl(): string | null { return this.kcLink.clientsPage(); }
  get realmHomeUrl(): string | null { return this.kcLink.realmHome(); }

  groupAdminUrl(group: KeycloakGroupDTO): string | null {
    return this.kcLink.groupPage(group.id);
  }
}
