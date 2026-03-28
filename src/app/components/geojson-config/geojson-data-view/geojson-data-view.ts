import {
  Component, Input, Output, EventEmitter, OnInit, OnChanges,
  SimpleChanges, ViewChild
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatSortModule, MatSort } from '@angular/material/sort';
import { MatPaginatorModule, MatPaginator } from '@angular/material/paginator';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { NamedGeoJsonConfig } from '@models/geojson/NamedGeoJsonConfig';
import { OSM_RASTER_STYLE, buildStyleFromTileSource } from '@models/geojson/GeoJsonConfigData';
import { GeolocationService } from '@services/geojson/geolocation.service';
import { GeolocationDialogComponent } from '@components/geojson-config/geolocation-dialog/geolocation-dialog';
import { MapRendererComponent } from '@components/geojson-config/map-renderer/map-renderer';
import { RuntimeConfigService } from '@services/runtime-config.service';
import { GeoJsonDefinitionService } from '@services/geojson/geojson-definition.service';
import { getMapPolygonStyle, getMapLineStyle } from '@models/shared/SvgIconLibrary';
import { MatSelectModule } from '@angular/material/select';

@Component({
  standalone: true,
  selector: 'geojson-data-view',
  templateUrl: './geojson-data-view.html',
  styleUrls: ['./geojson-data-view.css'],
  imports: [
    CommonModule, FormsModule,
    MatTableModule, MatSortModule, MatPaginatorModule,
    MatFormFieldModule, MatInputModule, MatButtonModule,
    MatIconModule, MatSnackBarModule, MatSelectModule,
    MapRendererComponent
  ]
})
export class GeoJsonDataViewComponent implements OnInit, OnChanges {
  @Input() config!: NamedGeoJsonConfig;
  @Input() instanceData: any[] = [];
  @Input() classTypeData: any = {};
  @Input() className: string = '';

  @Output() instanceDataChange = new EventEmitter<any[]>();

  @ViewChild(MapRendererComponent) mapRenderer!: MapRendererComponent;
  @ViewChild(MatSort) sort!: MatSort;
  @ViewChild(MatPaginator) paginator!: MatPaginator;

  dataSource = new MatTableDataSource<any>([]);
  displayedColumns: string[] = [];
  filterValue = '';

  pickModeActive = false;
  pickTargetRow: any = null;
  pickTargetLabel = '';

  /** Cached style object — computed once on init/config change, not every CD cycle */
  cachedMapStyle: any = OSM_RASTER_STYLE;

  /** Mixed geometry collection for polygon/line rendering on the map */
  mixedFeatureCollection: GeoJSON.FeatureCollection | null = null;

  private idFields = ['id', '_instanceId', '_id', 'Id', 'ID', 'instanceId'];

  constructor(
    private http: HttpClient,
    private snackBar: MatSnackBar,
    private dialog: MatDialog,
    private geolocationService: GeolocationService,
    private runtimeConfig: RuntimeConfigService,
    private geoJsonDefService: GeoJsonDefinitionService
  ) {}

  ngOnInit(): void {
    this.setupTable();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['instanceData'] || changes['config']) {
      this.setupTable();
    }
  }

  ngAfterViewInit(): void {
    this.dataSource.sort = this.sort;
    this.dataSource.paginator = this.paginator;
  }

  private setupTable(): void {
    this.dataSource.data = this.instanceData || [];
    this.displayedColumns = this.detectColumns();
    this.updateCachedMapStyle();
    this.buildMixedFeatureCollection();
  }

  private updateCachedMapStyle(): void {
    const tileSource = this.config?.geoJsonConfig?.mapOptions?.tileSource;
    if (tileSource?.url) {
      this.cachedMapStyle = buildStyleFromTileSource(tileSource);
    } else {
      this.cachedMapStyle = OSM_RASTER_STYLE;
    }
  }

  private detectColumns(): string[] {
    if (!this.instanceData || this.instanceData.length === 0) return ['_setLocation'];

    const gc = this.config?.geoJsonConfig;
    const allKeys = Object.keys(this.instanceData[0]);

    // Find ID column
    const idCol = this.idFields.find(f => allKeys.includes(f));

    // Find coordinate columns
    const coordCols: string[] = [];
    if (gc) {
      if (gc.coordinateMode === 'separate') {
        if (gc.latitudeVariable && allKeys.includes(gc.latitudeVariable)) coordCols.push(gc.latitudeVariable);
        if (gc.longitudeVariable && allKeys.includes(gc.longitudeVariable)) coordCols.push(gc.longitudeVariable);
      } else if (gc.coordinateMode === 'tuple') {
        if (gc.tupleVariable && allKeys.includes(gc.tupleVariable)) coordCols.push(gc.tupleVariable);
      } else if ((gc.coordinateMode === 'line_center' || gc.coordinateMode === 'polygon_center') && gc.geometryVariable) {
        if (allKeys.includes(gc.geometryVariable)) coordCols.push(gc.geometryVariable);
      }
    }

    // Get other columns (excluding id and coord cols, limit to first 3)
    const excludeSet = new Set([...(idCol ? [idCol] : []), ...coordCols]);
    const otherCols = allKeys
      .filter(k => !excludeSet.has(k) && !k.startsWith('_'))
      .slice(0, 3);

    const cols: string[] = [];
    if (idCol) cols.push(idCol);
    cols.push(...coordCols, ...otherCols, '_setLocation');

    return cols;
  }

  applyFilter(): void {
    this.dataSource.filter = this.filterValue.trim().toLowerCase();
  }

  // ==================== Set Location Workflow ====================

  startPickMode(row: any): void {
    this.pickModeActive = true;
    this.pickTargetRow = row;
    const instanceId = this.getInstanceId(row);
    this.pickTargetLabel = instanceId || 'Selected Instance';
  }

  cancelPickMode(): void {
    this.pickModeActive = false;
    this.pickTargetRow = null;
    this.pickTargetLabel = '';
  }

  onMapClicked(coords: { lng: number; lat: number }): void {
    if (!this.pickModeActive || !this.pickTargetRow) return;

    const instanceId = this.getInstanceId(this.pickTargetRow);
    if (!instanceId) {
      this.snackBar.open('Cannot update: Unable to determine instance ID.', 'Dismiss', { duration: 5000 });
      this.cancelPickMode();
      return;
    }

    const gc = this.config.geoJsonConfig;
    let updatePayload: any = {};

    if (gc.coordinateMode === 'separate') {
      updatePayload[gc.latitudeVariable] = coords.lat;
      updatePayload[gc.longitudeVariable] = coords.lng;
    } else if (gc.coordinateMode === 'tuple') {
      updatePayload[gc.tupleVariable] = gc.tupleOrder === 'lat-lng'
        ? [coords.lat, coords.lng]
        : [coords.lng, coords.lat];
    }

    const backendUrl = this.runtimeConfig.getBackendBaseUrl();
    const formData = new FormData();
    formData.append('polariId', instanceId);
    formData.append('updateData', JSON.stringify(updatePayload));

    this.http.put(`${backendUrl}/${this.className}`, formData).subscribe({
      next: () => {
        // Update local row data
        if (gc.coordinateMode === 'separate') {
          this.pickTargetRow[gc.latitudeVariable] = coords.lat;
          this.pickTargetRow[gc.longitudeVariable] = coords.lng;
        } else if (gc.coordinateMode === 'tuple') {
          this.pickTargetRow[gc.tupleVariable] = gc.tupleOrder === 'lat-lng'
            ? [coords.lat, coords.lng]
            : [coords.lng, coords.lat];
        }

        // Refresh table and map
        this.dataSource.data = [...this.dataSource.data];
        this.instanceDataChange.emit(this.dataSource.data);

        this.snackBar.open(
          `Location set for ${this.pickTargetLabel}`,
          'OK', { duration: 3000 }
        );
        this.cancelPickMode();
      },
      error: (err) => {
        console.error('[GeoJsonDataView] Failed to update location:', err);
        this.snackBar.open(
          `Failed to set location: ${err.error?.error || err.statusText || 'Unknown error'}`,
          'Dismiss', { duration: 5000 }
        );
        this.cancelPickMode();
      }
    });
  }

  // ==================== Address Search Shortcut ====================

  openAddressSearchForRow(row: any): void {
    const dialogRef = this.dialog.open(GeolocationDialogComponent, {
      width: '480px'
    });
    dialogRef.afterClosed().subscribe((result: { lng: number; lat: number } | null) => {
      if (result) {
        // Temporarily enter pick mode so onMapClicked processes the coordinates
        this.pickModeActive = true;
        this.pickTargetRow = row;
        this.pickTargetLabel = this.getInstanceId(row) || 'Selected Instance';
        this.onMapClicked(result);
      }
    });
  }

  // ==================== Locate Me ====================

  onLocateMeClicked(): void {
    this.geolocationService.detectLocation().subscribe({
      next: (loc) => {
        if (this.mapRenderer) {
          this.mapRenderer.flyTo(loc.lng, loc.lat, 13);
        }
      },
      error: () => {
        // Open dialog as fallback
        const dialogRef = this.dialog.open(GeolocationDialogComponent, {
          width: '440px'
        });
        dialogRef.afterClosed().subscribe((result: { lng: number; lat: number } | null) => {
          if (result && this.mapRenderer) {
            this.mapRenderer.flyTo(result.lng, result.lat, 13);
          }
        });
      }
    });
  }

  // ==================== Geometry Feature Collection ====================

  /**
   * Build a mixed GeoJSON FeatureCollection from polygon/line geometry variables
   * so the map renderer can draw the actual shapes (not just center-point markers).
   *
   * For data WITH stored vertices (new format): builds polygon features directly.
   * For data WITHOUT stored vertices (legacy format with ref_class + instance_ids):
   * fetches the referenced class instances and resolves coordinates.
   */
  private buildMixedFeatureCollection(): void {
    const gc = this.config?.geoJsonConfig;
    if (!gc || !gc.geometryVariable) {
      this.mixedFeatureCollection = null;
      return;
    }
    if (gc.coordinateMode !== 'polygon_center' && gc.coordinateMode !== 'line_center') {
      this.mixedFeatureCollection = null;
      return;
    }
    if (!this.instanceData || this.instanceData.length === 0) {
      this.mixedFeatureCollection = null;
      return;
    }

    const features: GeoJSON.Feature[] = [];
    const unresolvedRefs: { refClass: string; instanceIds: string[]; styleName: string; parentIndex: number }[] = [];

    for (let i = 0; i < this.instanceData.length; i++) {
      const instance = this.instanceData[i];
      const rawValue = instance[gc.geometryVariable];
      if (!rawValue) continue;

      try {
        const parsed = typeof rawValue === 'string' ? JSON.parse(rawValue) : rawValue;

        if (gc.coordinateMode === 'polygon_center') {
          if (parsed.vertices && Array.isArray(parsed.vertices) && parsed.vertices.length >= 3) {
            // New format: vertices are stored inline
            const ring: [number, number][] = [...parsed.vertices];
            const first = ring[0];
            const last = ring[ring.length - 1];
            if (first[0] !== last[0] || first[1] !== last[1]) {
              ring.push([...first] as [number, number]);
            }

            const polyStyle = getMapPolygonStyle(parsed.style_name || 'default-polygon');
            const effectiveCenterLng = (parsed.center_lng || 0) + (parsed.center_offset_lng || 0);
            const effectiveCenterLat = (parsed.center_lat || 0) + (parsed.center_offset_lat || 0);

            features.push({
              type: 'Feature',
              geometry: { type: 'Polygon', coordinates: [ring] },
              properties: {
                _geometryType: 'polygon',
                _polygonStyleName: parsed.style_name || 'default-polygon',
                _fillColor: polyStyle?.fillColor || '#1976d2',
                _fillOpacity: polyStyle?.fillOpacity ?? 0.25,
                _outlineColor: polyStyle?.outlineColor || '#0d47a1',
                _outlineWidth: polyStyle?.outlineWidth ?? 2,
                _outlineOpacity: polyStyle?.outlineOpacity ?? 1,
                _centerLng: parsed.center_lng,
                _centerLat: parsed.center_lat,
                _effectiveCenterLng: effectiveCenterLng,
                _effectiveCenterLat: effectiveCenterLat,
                _areaSqMeters: parsed.area_sq_meters || 0
              }
            });
          } else if (parsed.ref_class && parsed.instance_ids?.length >= 3) {
            // Legacy format: needs resolution from ref class
            unresolvedRefs.push({
              refClass: parsed.ref_class,
              instanceIds: parsed.instance_ids,
              styleName: parsed.style_name || 'default-polygon',
              parentIndex: i
            });
          }
        } else if (gc.coordinateMode === 'line_center') {
          if (parsed.vertices && Array.isArray(parsed.vertices) && parsed.vertices.length >= 2) {
            const lineStyle = getMapLineStyle(parsed.style_name || 'default-line');
            features.push({
              type: 'Feature',
              geometry: { type: 'LineString', coordinates: parsed.vertices },
              properties: {
                _geometryType: 'line',
                _lineColor: lineStyle?.lineColor || '#1976d2',
                _lineWidth: lineStyle?.lineWidth ?? 3,
                _lineOpacity: lineStyle?.lineOpacity ?? 1
              }
            });
          } else if (parsed.ref_class && parsed.instance_ids?.length >= 2) {
            unresolvedRefs.push({
              refClass: parsed.ref_class,
              instanceIds: parsed.instance_ids,
              styleName: parsed.style_name || 'default-line',
              parentIndex: i
            });
          }
        }
      } catch { /* invalid JSON — skip */ }
    }

    // Set what we have immediately (from inline vertices)
    if (features.length > 0) {
      this.mixedFeatureCollection = { type: 'FeatureCollection', features };
    } else {
      this.mixedFeatureCollection = null;
    }

    // Resolve legacy refs that don't have inline vertices
    if (unresolvedRefs.length > 0) {
      this.resolveLegacyGeometryRefs(unresolvedRefs, features);
    }
  }

  /**
   * For geometry data stored WITHOUT inline vertices (legacy format),
   * fetch the referenced class instances and resolve coordinates to build features.
   */
  private resolveLegacyGeometryRefs(
    refs: { refClass: string; instanceIds: string[]; styleName: string; parentIndex: number }[],
    existingFeatures: GeoJSON.Feature[]
  ): void {
    // Group by ref_class to minimize fetches
    const byClass = new Map<string, typeof refs>();
    for (const ref of refs) {
      if (!byClass.has(ref.refClass)) byClass.set(ref.refClass, []);
      byClass.get(ref.refClass)!.push(ref);
    }

    const gc = this.config.geoJsonConfig;

    for (const [refClass, classRefs] of byClass) {
      // Fetch the ref class's GeoJSON config + instances
      const backendUrl = this.runtimeConfig.getBackendBaseUrl();
      this.geoJsonDefService.fetchAllGeoJsonDefs().subscribe({
        next: (defs) => {
          const matchingDef = defs.find((d: any) => d.source_class === refClass);
          if (!matchingDef) return;

          const refConfig = NamedGeoJsonConfig.fromBackend(matchingDef);
          const refGc = refConfig.geoJsonConfig;

          // Fetch instances of the ref class
          this.http.get<any>(`${backendUrl}/${refClass}`).subscribe({
            next: (response) => {
              const instances = this.extractRefInstances(response, refClass);
              const instanceMap = new Map<string, any>();
              for (const inst of instances) {
                const id = inst.id || inst._id || inst._instanceId;
                if (id) instanceMap.set(String(id), inst);
              }

              const newFeatures: GeoJSON.Feature[] = [...existingFeatures];

              for (const ref of classRefs) {
                const coords: [number, number][] = [];
                for (const instId of ref.instanceIds) {
                  const inst = instanceMap.get(instId);
                  if (!inst) continue;
                  const center = refConfig.extractCoordinates(inst, refGc);
                  if (center) coords.push(center);
                }

                if (gc.coordinateMode === 'polygon_center' && coords.length >= 3) {
                  const ring = [...coords];
                  const first = ring[0];
                  const last = ring[ring.length - 1];
                  if (first[0] !== last[0] || first[1] !== last[1]) {
                    ring.push([...first] as [number, number]);
                  }
                  const polyStyle = getMapPolygonStyle(ref.styleName);
                  const avgLng = coords.reduce((s, c) => s + c[0], 0) / coords.length;
                  const avgLat = coords.reduce((s, c) => s + c[1], 0) / coords.length;
                  newFeatures.push({
                    type: 'Feature',
                    geometry: { type: 'Polygon', coordinates: [ring] },
                    properties: {
                      _geometryType: 'polygon',
                      _fillColor: polyStyle?.fillColor || '#1976d2',
                      _fillOpacity: polyStyle?.fillOpacity ?? 0.25,
                      _outlineColor: polyStyle?.outlineColor || '#0d47a1',
                      _outlineWidth: polyStyle?.outlineWidth ?? 2,
                      _outlineOpacity: polyStyle?.outlineOpacity ?? 1,
                      _centerLng: avgLng,
                      _centerLat: avgLat,
                      _effectiveCenterLng: avgLng,
                      _effectiveCenterLat: avgLat
                    }
                  });
                } else if (gc.coordinateMode === 'line_center' && coords.length >= 2) {
                  const lineStyle = getMapLineStyle(ref.styleName);
                  newFeatures.push({
                    type: 'Feature',
                    geometry: { type: 'LineString', coordinates: coords },
                    properties: {
                      _geometryType: 'line',
                      _lineColor: lineStyle?.lineColor || '#1976d2',
                      _lineWidth: lineStyle?.lineWidth ?? 3,
                      _lineOpacity: lineStyle?.lineOpacity ?? 1
                    }
                  });
                }
              }

              if (newFeatures.length > 0) {
                this.mixedFeatureCollection = { type: 'FeatureCollection', features: newFeatures };
              }
            }
          });
        }
      });
    }
  }

  /**
   * Extract instances from a CRUDE readAll response.
   */
  private extractRefInstances(response: any, className: string): any[] {
    if (!response) return [];
    if (Array.isArray(response) && response.length > 0 && response[0]?.[className]) {
      const classData = response[0][className];
      if (Array.isArray(classData)) {
        const instances: any[] = [];
        classData.forEach((ds: any) => {
          if (ds.data && Array.isArray(ds.data)) instances.push(...ds.data);
          else if (ds.id !== undefined) instances.push(ds);
        });
        return instances;
      }
    }
    if (Array.isArray(response)) return response;
    if (response?.data && Array.isArray(response.data)) return response.data;
    return [];
  }

  // ==================== Go-To Navigation ====================

  /**
   * Whether the row has resolvable coordinates for map navigation.
   */
  canGoTo(row: any): boolean {
    return this.resolveRowCoords(row) !== null;
  }

  /**
   * Fly the map to the row's coordinates.
   */
  goToLocation(row: any): void {
    const coords = this.resolveRowCoords(row);
    if (!coords || !this.mapRenderer) return;

    if (coords.areaSqMeters || coords.bboxDiagonalMeters) {
      this.mapRenderer.flyToGeometry(coords.lng, coords.lat, coords.areaSqMeters, coords.bboxDiagonalMeters);
    } else {
      this.mapRenderer.flyTo(coords.lng, coords.lat, 14);
    }
  }

  /**
   * Extract [lng, lat] + optional geometry metrics from a row based on the current coordinate mode.
   */
  private resolveRowCoords(row: any): { lng: number; lat: number; areaSqMeters?: number; bboxDiagonalMeters?: number } | null {
    const gc = this.config?.geoJsonConfig;
    if (!gc) return null;

    if (gc.coordinateMode === 'separate') {
      const lat = parseFloat(row[gc.latitudeVariable]);
      const lng = parseFloat(row[gc.longitudeVariable]);
      if (!isNaN(lat) && !isNaN(lng)) return { lng, lat };
    } else if (gc.coordinateMode === 'tuple' && gc.tupleVariable) {
      const tuple = row[gc.tupleVariable];
      if (Array.isArray(tuple) && tuple.length >= 2) {
        const [a, b] = tuple.map(Number);
        if (!isNaN(a) && !isNaN(b)) {
          return gc.tupleOrder === 'lat-lng' ? { lng: b, lat: a } : { lng: a, lat: b };
        }
      }
    } else if ((gc.coordinateMode === 'polygon_center' || gc.coordinateMode === 'line_center') && gc.geometryVariable) {
      const rawValue = row[gc.geometryVariable];
      if (!rawValue) return null;
      try {
        const parsed = typeof rawValue === 'string' ? JSON.parse(rawValue) : rawValue;
        // Try stored center
        const cLng = parseFloat(parsed.center_lng);
        const cLat = parseFloat(parsed.center_lat);
        if (!isNaN(cLng) && !isNaN(cLat) && (cLng !== 0 || cLat !== 0)) {
          const offLng = parseFloat(parsed.center_offset_lng) || 0;
          const offLat = parseFloat(parsed.center_offset_lat) || 0;
          return {
            lng: cLng + offLng,
            lat: cLat + offLat,
            areaSqMeters: parseFloat(parsed.area_sq_meters) || 0
          };
        }
        // Fallback: compute from vertices
        if (parsed.vertices?.length >= 2) {
          const verts = parsed.vertices as [number, number][];
          const avgLng = verts.reduce((s: number, v: [number, number]) => s + v[0], 0) / verts.length;
          const avgLat = verts.reduce((s: number, v: [number, number]) => s + v[1], 0) / verts.length;
          return { lng: avgLng, lat: avgLat, areaSqMeters: parseFloat(parsed.area_sq_meters) || 0 };
        }
      } catch { /* invalid JSON */ }
    }
    return null;
  }

  // ==================== Helpers ====================

  hasCoordinates(row: any): boolean {
    const gc = this.config?.geoJsonConfig;
    if (!gc) return false;

    if (gc.coordinateMode === 'separate') {
      return row[gc.latitudeVariable] != null && row[gc.longitudeVariable] != null
        && !isNaN(Number(row[gc.latitudeVariable])) && !isNaN(Number(row[gc.longitudeVariable]));
    } else if (gc.coordinateMode === 'tuple') {
      const tuple = row[gc.tupleVariable];
      return Array.isArray(tuple) && tuple.length >= 2
        && !isNaN(Number(tuple[0])) && !isNaN(Number(tuple[1]));
    }
    return false;
  }

  getSetLocationIcon(row: any): string {
    return this.hasCoordinates(row) ? 'edit_location' : 'add_location';
  }

  getSetLocationLabel(row: any): string {
    return this.hasCoordinates(row) ? 'Move' : 'Set';
  }

  private getInstanceId(row: any): string | undefined {
    for (const field of this.idFields) {
      if (row[field] !== undefined && row[field] !== null) {
        return String(row[field]);
      }
    }
    return undefined;
  }

  formatCellValue(value: any): string {
    if (value === null || value === undefined) return '';
    if (Array.isArray(value)) return JSON.stringify(value);
    return String(value);
  }

}
