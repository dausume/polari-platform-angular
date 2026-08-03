import { Component, Input, OnInit } from '@angular/core';
import { TableDefinitionService } from '@services/table/table-definition.service';
import { CRUDEservicesManager } from '@services/crude-services-manager';
import { NamedTableConfig } from '@models/tables/NamedTableConfig';

/**
 * Thin wrapper that loads a table config by ID and renders it via class-data-table.
 * Display definitions only store the config ID in componentProps — this component
 * resolves the full config at render time.
 */
@Component({
  standalone: false,
  selector: 'embedded-table',
  template: `
    <class-data-table *ngIf="loadedConfig"
      [className]="className"
      [classTypeData]="classTypeData"
      [instanceData]="instanceData"
      [namedTableConfig]="loadedConfig"
>
    </class-data-table>
    <div *ngIf="loading" class="embedded-loading">Loading table...</div>
    <div *ngIf="error" class="embedded-error">{{ error }}</div>
  `,
  styles: [`
    :host { display: block; width: 100%; }
    .embedded-loading {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
      color: #666;
      font-size: 14px;
    }
    .embedded-error {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
      color: #c62828;
      background: #ffebee;
      font-size: 13px;
      border-radius: 4px;
    }
  `]
})
export class EmbeddedTableComponent implements OnInit {
  @Input() tableConfigId!: string;

  /** Field holding the reference this embed is scoped to
   *  (e.g. 'design_ref'). Empty = every row of the class.
   *
   *  A per-object definition describes HOW to render a class; the
   *  reference says WHICH rows this page is about. Without it an
   *  embed on an M0 page silently showed every design's rows. */
  @Input() filterField = '';

  /** The reference value (e.g. 'clock-lavet-m0'). */
  @Input() filterValue = '';
  @Input() className: string = '';
  @Input() classTypeData: any = {};

  loadedConfig: NamedTableConfig | null = null;
  instanceData: any[] = [];
  loading: boolean = true;
  error: string = '';

  constructor(
    private tableDefService: TableDefinitionService,
    private crudeManager: CRUDEservicesManager
  ) {}

  ngOnInit(): void {
    if (!this.tableConfigId) {
      this.loading = false;
      this.error = 'No table config ID provided';
      return;
    }

    this.tableDefService.loadConfig(this.tableConfigId, this.classTypeData).subscribe({
      next: (config: NamedTableConfig) => {
        if (config.tableConfiguration.columns.length === 0 && this.classTypeData) {
          config.tableConfiguration.initializeFromClassTypeData(this.classTypeData);
        }
        this.loadedConfig = config;
        this.loadInstanceData();
      },
      error: (err: any) => {
        this.loading = false;
        this.error = 'Failed to load table config';
        console.error('[EmbeddedTable] Load config error:', err);
      }
    });
  }

  private loadInstanceData(): void {
    if (!this.className) {
      this.loading = false;
      return;
    }

    const crudeService = this.crudeManager.getCRUDEclassService(this.className);
    const filter = this.filterField && this.filterValue
      ? { [this.filterField]: this.filterValue }
      : undefined;
    crudeService.readAll(filter).subscribe({
      next: (data: any) => {
        this.instanceData = this.parseInstances(data);
        this.loading = false;
      },
      error: () => {
        this.instanceData = [];
        this.loading = false;
      }
    });
  }

  private parseInstances(data: any): any[] {
    let instances: any[] = [];
    if (!data) return [];
    if (typeof data === 'object' && !Array.isArray(data) && data.data && data.class) {
      instances = Array.isArray(data.data) ? data.data : [];
    } else if (Array.isArray(data)) {
      if (data.length === 1 && data[0]?.data && data[0]?.class) {
        instances = Array.isArray(data[0].data) ? data[0].data : [];
      } else if (this.className && data[0]?.[this.className]) {
        const classData = data[0][this.className];
        if (Array.isArray(classData)) {
          if (classData.length > 0 && classData[0]?.data) {
            classData.forEach((ds: any) => {
              if (Array.isArray(ds.data)) instances.push(...ds.data);
            });
          } else {
            instances = classData;
          }
        }
      } else if (data[0]?.id !== undefined || data[0]?._id !== undefined) {
        instances = data;
      }
    } else if (data?.data && Array.isArray(data.data)) {
      instances = data.data;
    }

    // Deduplicate by id to avoid repeated instances from multiple DataSets
    if (instances.length > 0) {
      const seen = new Set<string>();
      instances = instances.filter((inst: any) => {
        const id = inst?.id ?? inst?._id;
        if (id == null) return true;
        const key = String(id);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }
    return instances;
  }
}
