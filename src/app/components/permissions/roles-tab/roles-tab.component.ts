import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Subscription } from 'rxjs';

import { RolesService, RoleDTO } from '@services/permissions/roles.service';
import { KeycloakAdminLinkService } from '@services/permissions/keycloak-admin-link.service';

/**
 * Permissions → Roles tab.
 *
 * Lists every Role tree-object the backend knows about (synced from
 * Keycloak's realm role list). Click a row → /permissions/roles/:name
 * for the single-role view with full grant detail.
 *
 * Refreshing the table re-pulls from the backend, which in turn
 * triggers a Keycloak sync if its 60s cache has expired — so the
 * "create a new role in KC, see it here within a minute" flow works
 * with no manual sync.
 */
@Component({
  standalone: true,
  selector: 'roles-tab',
  imports: [
    CommonModule, MatCardModule, MatTableModule, MatButtonModule,
    MatIconModule, MatChipsModule, MatTooltipModule, MatProgressSpinnerModule,
  ],
  templateUrl: './roles-tab.component.html',
  styleUrls: ['./roles-tab.component.css'],
})
export class RolesTabComponent implements OnInit, OnDestroy {
  roles: RoleDTO[] = [];
  loading = false;
  errorMessage: string | null = null;
  syncWarning: string | null = null;

  readonly displayedColumns = ['name', 'description', 'source', 'grantCount', 'actions'];

  private sub?: Subscription;

  showIntro = true;

  constructor(
    private rolesService: RolesService,
    private router: Router,
    private kcLink: KeycloakAdminLinkService
  ) {}

  get rolesAdminUrl(): string | null { return this.kcLink.rolesPage(); }
  get groupsAdminUrl(): string | null { return this.kcLink.groupsPage(); }

  ngOnInit(): void {
    this.sub = this.rolesService.roles$.subscribe(rs => {
      this.roles = rs;
      this.syncWarning = this.rolesService.syncWarning;
    });
    this.load();
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  async load(force = false): Promise<void> {
    this.loading = true;
    this.errorMessage = null;
    try {
      await this.rolesService.load(force);
    } catch (err: any) {
      this.errorMessage = err?.message || String(err);
    } finally {
      this.loading = false;
    }
  }

  open(role: RoleDTO): void {
    this.router.navigate(['/permissions/roles', role.name]);
  }

  grantCount(role: RoleDTO): number {
    return role.grants?.reduce((acc, g) => acc + (g.ops?.length || 0), 0) || 0;
  }
}
