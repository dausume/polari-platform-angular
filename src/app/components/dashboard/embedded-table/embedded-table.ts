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
      [hideColumnSelector]="true">
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
    crudeService.readAll().subscribe({
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
    if (!data) return [];
    if (typeof data === 'object' && !Array.isArray(data) && data.data && data.class) {
      return Array.isArray(data.data) ? data.data : [];
    }
    if (Array.isArray(data)) {
      if (data.length === 1 && data[0]?.data && data[0]?.class) {
        return Array.isArray(data[0].data) ? data[0].data : [];
      }
      if (this.className && data[0]?.[this.className]) {
        const classData = data[0][this.className];
        if (Array.isArray(classData)) {
          if (classData.length > 0 && classData[0]?.data) {
            const instances: any[] = [];
            classData.forEach((ds: any) => {
              if (Array.isArray(ds.data)) instances.push(...ds.data);
            });
            return instances;
          }
          return classData;
        }
      }
      if (data[0]?.id !== undefined || data[0]?._id !== undefined) {
        return data;
      }
    }
    if (data?.data && Array.isArray(data.data)) return data.data;
    return [];
  }
}
