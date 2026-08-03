import { Component, Input, OnInit } from '@angular/core';
import { CRUDEservicesManager } from '@services/crude-services-manager';
import { TableDefinitionService } from '@services/table/table-definition.service';
import { DetailDisplayConfig } from '@models/tables/NamedTableConfig';

/**
 * SINGLE-REFERENCE no-code panel: renders ONE instance of a class
 * through that class's own configured instance display.
 *
 * This is the counterpart to `class-rows-table` (the multi-reference
 * side). Together they are the two ways a display gets used, which the
 * model already names — `ClassDataSourceSubType` is
 * `'all-instances' | 'row-instance' | 'static-data'`, and
 * `TableDefinition` already carries `is_default_instance_display` /
 * `is_default_dataset_display` per class.
 *
 * Nothing new is invented here. The panel only connects three things
 * that already existed separately:
 *   - the reference the page knows (`filterField` + `filterValue`,
 *     or a direct `instanceId`),
 *   - the class's default INSTANCE display (a TableDefinition whose
 *     `is_default_instance_display` is set, edited today on the class
 *     page),
 *   - `detail-display-renderer`, which already renders a
 *     `DetailDisplayConfig` for one instance.
 *
 * The point is that a drill-in stops being a JSON dump without any
 * per-module component work: configure the class's instance display
 * once and every page that references an instance of it renders.
 */
@Component({
  standalone: false,
  selector: 'instance-detail-panel',
  template: `
    <div class="instance-detail-panel">
      <div *ngIf="loading" class="state">Loading…</div>
      <div *ngIf="!loading && error" class="state error">{{ error }}</div>

      <!-- The class has a configured instance display: use it. -->
      <detail-display-renderer
        *ngIf="!loading && !error && instance && hasCards"
        [config]="detailConfig"
        [instance]="instance"
        [classTypeData]="classTypeData">
      </detail-display-renderer>

      <!-- No instance display configured yet. Say so, and name the
           knob that fixes it, rather than silently dumping JSON. -->
      <div *ngIf="!loading && !error && instance && !hasCards"
           class="state unconfigured">
        <b>{{ className }}</b> has no instance display configured.
        <div class="hint">
          Set one on the class page — a TableDefinition with
          “default instance display” — and this panel renders it.
        </div>
      </div>
    </div>
  `,
  styles: [`
    .instance-detail-panel { display: block; min-width: 0; }
    .state {
      padding: 12px;
      font-size: 13px;
      color: var(--text-on-card-muted);
    }
    .state.error { color: var(--color-error-text); }
    .state.unconfigured {
      border: 1px dashed var(--border-medium);
      border-radius: var(--radius-md);
      background: var(--surface-secondary);
      color: var(--text-on-card);
    }
    .hint {
      margin-top: 4px;
      font-size: 12px;
      color: var(--text-on-card-muted);
    }
  `],
})
export class InstanceDetailPanelComponent implements OnInit {
  /** Backend class of the instance to show. */
  @Input() className = '';

  /** Direct instance id, when the page already has one. */
  @Input() instanceId = '';

  /** Field holding the reference to match on (e.g. 'name'), used
   *  when the page knows a reference rather than an id. */
  @Input() filterField = '';

  /** The reference value to match (e.g. 'clock-lavet-m0'). */
  @Input() filterValue = '';

  /** Optional explicit TableDefinition id, when a page wants a
   *  specific instance display rather than the class default. */
  @Input() displayId = '';

  loading = true;
  error = '';
  instance: any = null;
  classTypeData: Record<string, any> = {};
  detailConfig: DetailDisplayConfig = { cards: [] };

  constructor(
    private crudeManager: CRUDEservicesManager,
    private tableDefs: TableDefinitionService,
  ) {}

  get hasCards(): boolean {
    return (this.detailConfig?.cards?.length ?? 0) > 0;
  }

  ngOnInit(): void {
    if (!this.className) {
      this.loading = false;
      this.error = 'instance-detail-panel: no className input.';
      return;
    }
    this.loadInstance();
  }

  private loadInstance(): void {
    const filter = this.filterField && this.filterValue
      ? { [this.filterField]: this.filterValue }
      : undefined;

    this.crudeManager.getCRUDEclassService(this.className)
      .readAll(filter)
      .subscribe({
        next: (envelope: any) => {
          const rows = envelope?.[0]?.[this.className]?.[0]?.data ?? [];
          this.instance = this.instanceId
            ? rows.find((row: any) => row?.id === this.instanceId) ?? null
            : rows[0] ?? null;
          if (!this.instance) {
            this.loading = false;
            this.error = this.describeMiss();
            return;
          }
          this.loadDisplay();
        },
        error: (err: any) => {
          this.loading = false;
          this.error = `Could not read ${this.className}: `
            + `${err?.message || 'request failed'}`;
        },
      });
  }

  /** Name what was actually asked for — a drill-in that finds nothing
   *  should say which reference missed, not just "no data". */
  private describeMiss(): string {
    if (this.instanceId) {
      return `No ${this.className} with id ${this.instanceId}.`;
    }
    if (this.filterField) {
      return `No ${this.className} where ${this.filterField} = `
        + `${this.filterValue}.`;
    }
    return `No ${this.className} rows.`;
  }

  /** Resolve which instance display to render: an explicitly named
   *  one, else the class's default. */
  private loadDisplay(): void {
    if (this.displayId) {
      this.applyDisplay(this.displayId);
      return;
    }
    this.tableDefs.configList$.subscribe((configs) => {
      const preferred = (configs || [])
        .find((config) => config.is_default_instance_display);
      if (preferred) {
        this.applyDisplay(preferred.id);
      } else {
        // No configured display is not an error — the panel says so
        // and names the knob.
        this.loading = false;
      }
    });
    this.tableDefs.fetchConfigsForClass(this.className);
  }

  private applyDisplay(displayId: string): void {
    this.tableDefs.loadConfigSilent(displayId, this.classTypeData)
      .subscribe({
        next: (config: any) => {
          this.detailConfig = config?.detailDisplay ?? { cards: [] };
          this.loading = false;
        },
        error: () => {
          // A missing display definition must not hide the instance;
          // fall through to the "not configured" state.
          this.loading = false;
        },
      });
  }
}
