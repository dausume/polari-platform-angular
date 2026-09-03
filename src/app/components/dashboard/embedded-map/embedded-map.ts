import { CommonModule } from '@angular/common';
import { Component, Input, OnInit } from '@angular/core';

import { MapRendererComponent } from '@components/geojson-config/map-renderer/map-renderer';
import { NamedGeoJsonConfig } from '@models/geojson/NamedGeoJsonConfig';
import { CRUDEservicesManager } from '@services/crude-services-manager';

/**
 * mps: the MAP display kind, embedded — the twin of embeddedTable /
 * embeddedGraph / embeddedCalendar. Resolves a GeoJsonDefinition by
 * NAME (ids are instance-local; names are seedable), reads the
 * source class's rows through CRUDE (scoped by one filter), and
 * draws them with the existing map-renderer — the one map engine.
 */
@Component({
  standalone: true,
  selector: 'embedded-map',
  imports: [CommonModule, MapRendererComponent],
  template: `
    <div class="embedded-map" [style.height]="height">
      <map-renderer *ngIf="loadedConfig && !error"
        [config]="loadedConfig"
        [instanceData]="instanceData"
        [interactive]="true">
      </map-renderer>
      <div *ngIf="loading" class="state">Loading map…</div>
      <div *ngIf="error" class="state error">{{ error }}</div>
      <div *ngIf="!loading && !error && loadedConfig && instanceData.length === 0" class="state">
        No {{ className || 'rows' }} to place yet — add one with its latitude and longitude.
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; width: 100%; min-width: 0; }
    .embedded-map { position: relative; width: 100%; min-height: 320px; }
    .embedded-map ::ng-deep map-renderer { display: block; height: 100%; }
    .state { padding: 16px; color: var(--text-on-card-muted, #666); font-size: 13px; }
    .state.error { color: var(--color-error-text, #c62828); }
  `],
})
export class EmbeddedMapComponent implements OnInit {
  /** GeoJsonDefinition.name — resolved by name, never by id. Required. */
  @Input() geoJsonName = '';
  /** The class whose rows are the pins (defaults to the definition's source_class). */
  @Input() className = '';
  @Input() filterField = '';
  @Input() filterValue = '';
  @Input() height = '480px';

  loadedConfig: NamedGeoJsonConfig | null = null;
  instanceData: any[] = [];
  loading = true;
  error = '';

  constructor(private crudeManager: CRUDEservicesManager) {}

  ngOnInit(): void {
    if (!this.geoJsonName) {
      this.loading = false;
      this.error = 'embedded-map: no geoJsonName input — which GeoJsonDefinition should this show?';
      return;
    }
    this.crudeManager.getCRUDEclassService('GeoJsonDefinition').readAll().subscribe({
      next: (data: any) => {
        const rows = this.parseInstances(data, 'GeoJsonDefinition');
        const row = rows.find(r => String(r['name']) === this.geoJsonName);
        if (!row) {
          this.loading = false;
          this.error = `GeoJsonDefinition "${this.geoJsonName}" is not on this node.`;
          return;
        }
        this.loadedConfig = NamedGeoJsonConfig.fromBackend(row);
        this.className = this.className || this.loadedConfig.source_class;
        this.loadRows();
      },
      error: () => { this.loading = false; this.error = 'Could not read the map definitions.'; },
    });
  }

  private loadRows(): void {
    if (!this.className) { this.loading = false; return; }
    const filter = this.filterField && this.filterValue ? { [this.filterField]: this.filterValue } : undefined;
    this.crudeManager.getCRUDEclassService(this.className).readAll(filter).subscribe({
      next: (data: any) => { this.instanceData = this.parseInstances(data, this.className); this.loading = false; },
      error: () => { this.instanceData = []; this.loading = false; },
    });
  }

  private parseInstances(data: any, className: string): any[] {
    if (!data) { return []; }
    if (Array.isArray(data)) {
      if (data.length && data[0]?.[className]) {
        const out: any[] = [];
        for (const ds of data[0][className]) { if (Array.isArray(ds?.data)) { out.push(...ds.data); } }
        return out;
      }
      if (data.length === 1 && Array.isArray(data[0]?.data)) { return data[0].data; }
      return data;
    }
    if (Array.isArray(data.data)) { return data.data; }
    return [];
  }
}
