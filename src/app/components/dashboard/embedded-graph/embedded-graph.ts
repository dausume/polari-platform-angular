import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GraphDefinitionService } from '@services/graph/graph-definition.service';
import { CRUDEservicesManager } from '@services/crude-services-manager';
import { NamedGraphConfig } from '@models/graphs/NamedGraphConfig';
import { GraphRendererComponent } from '@components/graph-config/graph-renderer/graph-renderer';

/**
 * Thin wrapper that loads a graph config by ID and renders it via graph-renderer.
 * Display definitions only store the config ID in componentProps — this component
 * resolves the full config at render time.
 */
@Component({
  standalone: true,
  selector: 'embedded-graph',
  template: `
    <graph-renderer *ngIf="loadedConfig"
      [config]="loadedConfig"
      [instanceData]="instanceData"
      [classTypeData]="classTypeData">
    </graph-renderer>
    <div *ngIf="loading" class="embedded-loading">Loading graph...</div>
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
  `],
  imports: [CommonModule, GraphRendererComponent]
})
export class EmbeddedGraphComponent implements OnInit {
  @Input() graphConfigId!: string;
  @Input() className: string = '';
  @Input() classTypeData: any = {};

  loadedConfig: NamedGraphConfig | null = null;
  instanceData: any[] = [];
  loading: boolean = true;
  error: string = '';

  constructor(
    private graphDefService: GraphDefinitionService,
    private crudeManager: CRUDEservicesManager
  ) {}

  ngOnInit(): void {
    if (!this.graphConfigId) {
      this.loading = false;
      this.error = 'No graph config ID provided';
      return;
    }

    this.graphDefService.loadConfig(this.graphConfigId).subscribe({
      next: (config: NamedGraphConfig) => {
        this.loadedConfig = config;
        this.loadInstanceData();
      },
      error: (err: any) => {
        this.loading = false;
        this.error = 'Failed to load graph config';
        console.error('[EmbeddedGraph] Load config error:', err);
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
