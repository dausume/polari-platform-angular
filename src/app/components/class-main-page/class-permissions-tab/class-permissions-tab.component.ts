import { Component, Input, OnChanges, OnDestroy, OnInit, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Subscription } from 'rxjs';

import { RolesService, RoleDTO } from '@services/permissions/roles.service';

/**
 * Per-class CRUDE grant editor — rendered inside class-main-page's
 * Permissions tab. Rows = roles, Cols = CRUDE + "All".
 *
 * Mirrors role-detail's editor but inverted: there we edit one role
 * across many classes; here we edit many roles for one class. Both
 * call the same PUT /api/roles/{name}/grants/{className} endpoint,
 * so a change here is visible in role-detail on next view (and vice
 * versa) thanks to the BehaviorSubject the service patches.
 */
const CRUDE_ORDER = ['C', 'R', 'U', 'D', 'E'] as const;
const CRUDE_LABELS: Record<string, string> = {
  C: 'Create', R: 'Read', U: 'Update', D: 'Delete', E: 'Event',
};
type CrudeOp = typeof CRUDE_ORDER[number];

interface RoleRow {
  roleName: string;
  description: string;
  source: string;
  ops: Set<CrudeOp>;
  saving: boolean;
  error: string | null;
}

@Component({
  standalone: true,
  selector: 'class-permissions-tab',
  imports: [
    CommonModule, MatCardModule, MatTableModule, MatButtonModule,
    MatIconModule, MatCheckboxModule, MatProgressSpinnerModule, MatTooltipModule,
  ],
  templateUrl: './class-permissions-tab.component.html',
  styleUrls: ['./class-permissions-tab.component.css'],
})
export class ClassPermissionsTabComponent implements OnInit, OnChanges, OnDestroy {
  /** className we're editing grants for. Required. */
  @Input() className?: string;

  rows: RoleRow[] = [];
  loading = false;
  errorMessage: string | null = null;

  readonly crudeOrder = CRUDE_ORDER;
  readonly crudeLabels = CRUDE_LABELS;
  readonly displayedColumns = ['roleName', 'all', 'op_C', 'op_R', 'op_U', 'op_D', 'op_E', 'status'];

  private rolesSub?: Subscription;

  constructor(
    private rolesService: RolesService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.rolesSub = this.rolesService.roles$.subscribe(roles => this.rebuildRows(roles));
    this.load();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['className'] && !changes['className'].firstChange) {
      // Rebuild from current cache when class context changes.
      this.rebuildRows(undefined);
    }
  }

  ngOnDestroy(): void {
    this.rolesSub?.unsubscribe();
  }

  async load(): Promise<void> {
    this.loading = true;
    this.errorMessage = null;
    try {
      await this.rolesService.load();
    } catch (err: any) {
      this.errorMessage = err?.message || String(err);
    } finally {
      this.loading = false;
    }
  }

  private rebuildRows(rolesArg: RoleDTO[] | undefined): void {
    const roles = rolesArg ?? [];
    if (!this.className) {
      this.rows = [];
      return;
    }
    const previous = new Map(this.rows.map(r => [r.roleName, r]));
    this.rows = roles
      .filter(r => r.source !== 'orphaned')
      .map(role => {
        const grant = role.grants?.find(g => g.className === this.className);
        const existing = previous.get(role.name);
        return {
          roleName: role.name,
          description: role.description,
          source: role.source,
          ops: new Set<CrudeOp>((grant?.ops || []) as CrudeOp[]),
          saving: existing?.saving ?? false,
          error: existing?.error ?? null,
        };
      });
  }

  hasOp(row: RoleRow, op: CrudeOp): boolean {
    return row.ops.has(op);
  }

  isAllOps(row: RoleRow): boolean {
    return CRUDE_ORDER.every(op => row.ops.has(op));
  }

  openRole(row: RoleRow): void {
    this.router.navigate(['/permissions/roles', row.roleName]);
  }

  async toggleOp(row: RoleRow, op: CrudeOp, checked: boolean): Promise<void> {
    if (row.saving || !this.className) return;
    const next = new Set(row.ops);
    if (checked) next.add(op);
    else next.delete(op);
    await this.persistRow(row, next);
  }

  async toggleAll(row: RoleRow, checked: boolean): Promise<void> {
    if (row.saving || !this.className) return;
    const next = checked
      ? new Set<CrudeOp>(CRUDE_ORDER)
      : new Set<CrudeOp>();
    await this.persistRow(row, next);
  }

  private async persistRow(row: RoleRow, nextOps: Set<CrudeOp>): Promise<void> {
    if (!this.className) return;
    const previousOps = new Set(row.ops);
    row.ops = nextOps;
    row.saving = true;
    row.error = null;
    try {
      await this.rolesService.saveGrant(
        row.roleName,
        this.className,
        Array.from(nextOps)
      );
    } catch (err: any) {
      row.ops = previousOps;
      row.error = err?.message || 'Save failed';
    } finally {
      row.saving = false;
    }
  }
}
