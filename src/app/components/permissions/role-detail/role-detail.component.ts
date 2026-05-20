import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatBadgeModule } from '@angular/material/badge';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';

import { RolesService, RoleDTO } from '@services/permissions/roles.service';
import { ClassTypingService } from '@services/class-typing-service';
import { classPolyTyping } from '@models/polyTyping/classPolyTyping';

/**
 * /permissions/roles/:name — single-role editor.
 *
 * Rows = every object class registered in ClassTypingService, grouped
 * into collapsible panels by module (`config.moduleBinding`) with
 * `framework` and `custom` as the catch-all groups for classes not
 * bound to a module.
 *
 * Cols = C / R / U / D / E + a per-row "All" toggle + a Module label.
 * Search filters by className OR module name. Saves on every change.
 */
const CRUDE_ORDER = ['C', 'R', 'U', 'D', 'E'] as const;
const CRUDE_LABELS: Record<string, string> = {
  C: 'Create', R: 'Read', U: 'Update', D: 'Delete', E: 'Event',
};
type CrudeOp = typeof CRUDE_ORDER[number];

interface GrantRow {
  className: string;
  moduleId: string;        // raw bucket key: module_id | 'framework' | 'custom'
  moduleLabel: string;     // pretty name for the column / chip
  ops: Set<CrudeOp>;
  saving: boolean;
  error: string | null;
}

interface ModuleGroup {
  moduleId: string;
  label: string;
  rows: GrantRow[];
  // Group-level "All" — when on, every row in the group is at full ops.
  groupAllChecked: boolean;
  expanded: boolean;
}

@Component({
  standalone: true,
  selector: 'role-detail',
  imports: [
    CommonModule, FormsModule, MatCardModule, MatTableModule, MatButtonModule,
    MatIconModule, MatChipsModule, MatProgressSpinnerModule,
    MatDividerModule, MatTooltipModule, MatCheckboxModule,
    MatFormFieldModule, MatInputModule, MatExpansionModule, MatBadgeModule,
  ],
  templateUrl: './role-detail.component.html',
  styleUrls: ['./role-detail.component.css'],
})
export class RoleDetailComponent implements OnInit, OnDestroy {
  role: RoleDTO | null = null;
  groups: ModuleGroup[] = [];
  loading = false;
  errorMessage: string | null = null;
  searchTerm = '';

  readonly crudeOrder = CRUDE_ORDER;
  readonly crudeLabels = CRUDE_LABELS;
  readonly displayedColumns = ['className', 'module', 'all', 'op_C', 'op_R', 'op_U', 'op_D', 'op_E', 'status'];

  private typingSub?: Subscription;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private rolesService: RolesService,
    private typingService: ClassTypingService
  ) {}

  async ngOnInit(): Promise<void> {
    const name = this.route.snapshot.paramMap.get('name');
    if (!name) {
      this.errorMessage = 'No role name in URL.';
      return;
    }
    this.loading = true;
    try {
      await this.rolesService.load();
      this.role = await this.rolesService.getByName(name);
      if (!this.role) {
        this.errorMessage = `Role "${name}" not found.`;
        return;
      }
    } catch (err: any) {
      this.errorMessage = err?.message || String(err);
      return;
    } finally {
      this.loading = false;
    }

    this.typingSub = this.typingService.polyTypingBehaviorSubject.subscribe(() => {
      this.rebuildRows();
    });
    this.rebuildRows();
    // `apiConfigCategoryMap` is populated asynchronously from /api-config —
    // separate from polyTyping's BehaviorSubject. If our initial rebuild
    // raced ahead of that fetch, every class falls into 'custom'.
    // Poll briefly for the map to populate and rebuild once it does.
    this.waitForCategoryMap();
  }

  private waitForCategoryMap(): void {
    const startSize = this.typingService.apiConfigCategoryMap.size;
    let attempts = 0;
    const maxAttempts = 20;     // 20 * 200ms = 4s
    const intervalMs = 200;
    const tick = () => {
      attempts++;
      const size = this.typingService.apiConfigCategoryMap.size;
      if (size > startSize) {
        // Map gained entries — rebuild buckets with proper module info.
        this.rebuildRows();
        return;
      }
      if (attempts < maxAttempts) {
        setTimeout(tick, intervalMs);
      }
    };
    setTimeout(tick, intervalMs);
  }

  ngOnDestroy(): void {
    this.typingSub?.unsubscribe();
  }

  private rebuildRows(): void {
    if (!this.role) return;
    const polyTyping = this.typingService.polyTyping as Record<string, classPolyTyping>;
    const allClasses = Object.keys(polyTyping || {}).sort();
    const currentGrants = new Map<string, Set<CrudeOp>>();
    for (const g of this.role.grants || []) {
      currentGrants.set(g.className, new Set(g.ops as CrudeOp[]));
    }

    // Preserve in-flight row state across rebuilds.
    const previousRows = new Map<string, GrantRow>();
    for (const grp of this.groups) {
      for (const row of grp.rows) {
        previousRows.set(row.className, row);
      }
    }
    // Preserve expansion state per group so a typing refresh doesn't
    // collapse open panels mid-edit.
    const previousExpanded = new Map(this.groups.map(g => [g.moduleId, g.expanded]));

    // Build flat rows.
    const flatRows: GrantRow[] = allClasses.map(cn => {
      const moduleId = this.deriveModuleId(cn);
      const moduleLabel = this.formatModuleLabel(moduleId);
      const existing = previousRows.get(cn);
      return {
        className: cn,
        moduleId,
        moduleLabel,
        ops: currentGrants.get(cn) || new Set<CrudeOp>(),
        saving: existing?.saving ?? false,
        error: existing?.error ?? null,
      };
    });

    // Bucket into groups by moduleId.
    const buckets = new Map<string, GrantRow[]>();
    for (const r of flatRows) {
      if (!buckets.has(r.moduleId)) buckets.set(r.moduleId, []);
      buckets.get(r.moduleId)!.push(r);
    }
    // Ordering rule: real modules first (alphabetically), then 'custom',
    // then 'framework' last so the noisier built-ins don't push module
    // classes off-screen.
    const orderedIds = Array.from(buckets.keys()).sort((a, b) => {
      const rank = (id: string) => id === 'framework' ? 2 : id === 'custom' ? 1 : 0;
      const diff = rank(a) - rank(b);
      return diff !== 0 ? diff : a.localeCompare(b);
    });
    this.groups = orderedIds.map(id => {
      const rows = buckets.get(id)!;
      return {
        moduleId: id,
        label: this.formatModuleLabel(id),
        rows,
        groupAllChecked: rows.length > 0 && rows.every(r => this.isAllOps(r)),
        // Default: real modules expanded, framework/custom collapsed
        // (the latter are typically dozens of base classes).
        expanded: previousExpanded.get(id)
          ?? !(id === 'framework' || id === 'custom'),
      };
    });
  }

  /** Authoritative source: ClassTypingService.apiConfigCategoryMap, which
   * the rest of the app (side-nav, object pages) uses to bucket classes
   * by sourceModule | 'framework' | 'custom'. config.moduleBinding alone
   * is unreliable — it's only set when the polyTypedObjects response
   * explicitly includes it, which most classes don't trigger. */
  private deriveModuleId(className: string): string {
    const fromMap = this.typingService.apiConfigCategoryMap.get(className);
    if (fromMap) return fromMap as string;
    const typingObj = (this.typingService.polyTyping as Record<string, classPolyTyping>)[className];
    return typingObj?.getObjectCategory() || 'custom';
  }

  /** materials_science → "Materials Science"; 'framework'/'custom' kept verbatim. */
  private formatModuleLabel(moduleId: string): string {
    if (!moduleId) return 'Custom';
    if (moduleId === 'framework') return 'Framework (base)';
    if (moduleId === 'custom') return 'Custom';
    return moduleId
      .split('_')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }

  /** Filtered view of groups — returns the *original* ModuleGroup refs
   * so mutations from toggle handlers stick. Visible rows + match count
   * are looked up via helper methods to avoid copying. */
  get filteredGroups(): ModuleGroup[] {
    const q = this.searchTerm.trim().toLowerCase();
    if (!q) return this.groups;
    return this.groups.filter(grp =>
      grp.rows.some(r =>
        r.className.toLowerCase().includes(q) ||
        r.moduleLabel.toLowerCase().includes(q) ||
        r.moduleId.toLowerCase().includes(q)
      )
    );
  }

  visibleRowsFor(grp: ModuleGroup): GrantRow[] {
    const q = this.searchTerm.trim().toLowerCase();
    if (!q) return grp.rows;
    return grp.rows.filter(r =>
      r.className.toLowerCase().includes(q) ||
      r.moduleLabel.toLowerCase().includes(q) ||
      r.moduleId.toLowerCase().includes(q)
    );
  }

  matchCountFor(grp: ModuleGroup): number {
    return this.visibleRowsFor(grp).length;
  }

  /** When a search is active, force-open all panels with matches. */
  isPanelExpanded(grp: ModuleGroup): boolean {
    return this.searchTerm.trim() ? true : grp.expanded;
  }

  onPanelToggle(moduleId: string, expanded: boolean): void {
    const grp = this.groups.find(g => g.moduleId === moduleId);
    if (grp) grp.expanded = expanded;
  }

  trackByModuleId = (_index: number, grp: ModuleGroup) => grp.moduleId;

  back(): void {
    this.router.navigateByUrl('/permissions');
  }

  hasOp(row: GrantRow, op: CrudeOp): boolean {
    return row.ops.has(op);
  }

  isAllOps(row: GrantRow): boolean {
    return CRUDE_ORDER.every(op => row.ops.has(op));
  }

  async toggleOp(row: GrantRow, op: CrudeOp, checked: boolean): Promise<void> {
    if (row.saving) return;
    const next = new Set(row.ops);
    if (checked) next.add(op);
    else next.delete(op);
    await this.persistRow(row, next);
    this.refreshGroupAll(row.moduleId);
  }

  async toggleAll(row: GrantRow, checked: boolean): Promise<void> {
    if (row.saving) return;
    const next = checked
      ? new Set<CrudeOp>(CRUDE_ORDER)
      : new Set<CrudeOp>();
    await this.persistRow(row, next);
    this.refreshGroupAll(row.moduleId);
  }

  /** Group-level All — grants every CRUDE op on every class in the
   * module, or clears them all when unchecked. Fires one PUT per class
   * in parallel; rolls back individual rows that fail. */
  async toggleGroupAll(grp: ModuleGroup, checked: boolean): Promise<void> {
    const target: Set<CrudeOp> = checked ? new Set(CRUDE_ORDER) : new Set();
    grp.groupAllChecked = checked;
    // Filter to rows that actually need changing — saves a roundtrip
    // for rows already at the target state.
    const work = grp.rows.filter(r => !this.opsEqual(r.ops, target));
    await Promise.all(work.map(r => this.persistRow(r, new Set(target))));
    this.refreshGroupAll(grp.moduleId);
  }

  private opsEqual(a: Set<string>, b: Set<string>): boolean {
    if (a.size !== b.size) return false;
    for (const x of a) if (!b.has(x)) return false;
    return true;
  }

  private refreshGroupAll(moduleId: string): void {
    const grp = this.groups.find(g => g.moduleId === moduleId);
    if (!grp) return;
    grp.groupAllChecked = grp.rows.length > 0 && grp.rows.every(r => this.isAllOps(r));
  }

  private async persistRow(row: GrantRow, nextOps: Set<CrudeOp>): Promise<void> {
    if (!this.role) return;
    const previousOps = new Set(row.ops);
    row.ops = nextOps;
    row.saving = true;
    row.error = null;
    try {
      const updated = await this.rolesService.saveGrant(
        this.role.name,
        row.className,
        Array.from(nextOps)
      );
      this.role = updated;
    } catch (err: any) {
      row.ops = previousOps;
      row.error = err?.message || 'Save failed';
    } finally {
      row.saving = false;
    }
  }
}
