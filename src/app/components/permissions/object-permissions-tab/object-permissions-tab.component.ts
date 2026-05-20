import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { RolesService, MyPermissions } from '@services/permissions/roles.service';

/**
 * Permissions → Object Permissions tab.
 *
 * Shows the *current user's* effective CRUDE matrix — the union of
 * grants from every role they hold. Each cell shows whether the user
 * has that op on that class, plus (via tooltip) which roles contributed
 * the grant. The matrix is computed transiently on the backend (keyed
 * by KC `sub`, no PII stored).
 */
const CRUDE_ORDER = ['C', 'R', 'U', 'D', 'E'] as const;
const CRUDE_LABELS: Record<string, string> = {
  C: 'Create', R: 'Read', U: 'Update', D: 'Delete', E: 'Event',
};

@Component({
  standalone: true,
  selector: 'object-permissions-tab',
  imports: [
    CommonModule, MatCardModule, MatTableModule, MatButtonModule,
    MatIconModule, MatChipsModule, MatTooltipModule, MatProgressSpinnerModule,
  ],
  templateUrl: './object-permissions-tab.component.html',
  styleUrls: ['./object-permissions-tab.component.css'],
})
export class ObjectPermissionsTabComponent implements OnInit {
  perms: MyPermissions | null = null;
  loading = false;
  errorMessage: string | null = null;

  readonly crudeOrder = CRUDE_ORDER;
  readonly crudeLabels = CRUDE_LABELS;

  constructor(private rolesService: RolesService) {}

  ngOnInit(): void {
    this.load();
  }

  async load(): Promise<void> {
    this.loading = true;
    this.errorMessage = null;
    try {
      this.perms = await this.rolesService.getMyPermissions();
    } catch (err: any) {
      this.errorMessage = err?.message || String(err);
      this.perms = null;
    } finally {
      this.loading = false;
    }
  }

  hasOp(ops: string[], op: string): boolean {
    return ops.includes(op);
  }

  sourceTooltip(className: string, op: string): string {
    const roles = this.perms?.sourceRoles?.[className]?.[op];
    if (!roles?.length) return '';
    return `Granted by: ${roles.join(', ')}`;
  }
}
