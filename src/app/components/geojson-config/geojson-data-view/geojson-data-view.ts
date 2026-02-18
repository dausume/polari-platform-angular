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

@Component({
  standalone: true,
  selector: 'geojson-data-view',
  templateUrl: './geojson-data-view.html',
  styleUrls: ['./geojson-data-view.css'],
  imports: [
    CommonModule, FormsModule,
    MatTableModule, MatSortModule, MatPaginatorModule,
    MatFormFieldModule, MatInputModule, MatButtonModule,
    MatIconModule, MatSnackBarModule,
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

  private idFields = ['id', '_instanceId', '_id', 'Id', 'ID', 'instanceId'];

  constructor(
    private http: HttpClient,
    private snackBar: MatSnackBar,
    private dialog: MatDialog,
    private geolocationService: GeolocationService,
    private runtimeConfig: RuntimeConfigService
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
