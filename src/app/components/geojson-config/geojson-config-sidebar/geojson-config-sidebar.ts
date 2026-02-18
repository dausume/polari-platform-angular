import { Component, Input, Output, EventEmitter, OnChanges, OnInit, SimpleChanges } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import {
  NamedGeoJsonConfig
} from '@models/geojson/NamedGeoJsonConfig';
import {
  CoordinateMode, TupleOrder, MarkerAnchor, TileSourceType,
  SvgMarkerDefinition, TileSourceConfig,
  DEFAULT_SVG_MARKER, DEFAULT_TILE_SOURCE, buildStyleFromTileSource
} from '@models/geojson/GeoJsonConfigData';
import { TileSourceSummary } from '@models/geojson/TileSourceDefinition';
import { TileSourceDefinitionService } from '@services/geojson/tile-source-definition.service';
import { CreateTileSourceDialogComponent } from '@components/geojson-config/create-tile-source-dialog/create-tile-source-dialog';
import { TileSourceDetailDialogComponent } from '@components/geojson-config/tile-source-detail-dialog/tile-source-detail-dialog';
import { GeocoderSummary, GeocoderType } from '@models/geojson/GeocoderDefinition';
import { GeocoderDefinitionService } from '@services/geojson/geocoder-definition.service';
import { CreateGeocoderDialogComponent } from '@components/geojson-config/create-geocoder-dialog/create-geocoder-dialog';
import { GeocoderDetailDialogComponent } from '@components/geojson-config/geocoder-detail-dialog/geocoder-detail-dialog';

@Component({
  standalone: false,
  selector: 'geojson-config-sidebar',
  templateUrl: 'geojson-config-sidebar.html',
  styleUrls: ['./geojson-config-sidebar.css']
})
export class GeoJsonConfigSidebarComponent implements OnChanges, OnInit {
  @Input() config!: NamedGeoJsonConfig;
  @Input() classTypeData: any = {};
  @Output() configChange = new EventEmitter<NamedGeoJsonConfig>();

  availableFields: string[] = [];

  /** Index of marker currently being edited, or -1 for none */
  editingMarkerIndex: number = -1;

  /** Tile source selection state */
  selectedTileSourceType: TileSourceType = 'tileserver';
  selectedTileSourceId: string = '';
  filteredTileSources: TileSourceSummary[] = [];

  /** Geocoder selection state */
  selectedGeocoderType: GeocoderType = 'self-hosted';
  selectedGeocoderId: string = '';
  filteredGeocoders: GeocoderSummary[] = [];

  private sawLoadingTrue = false;
  private defaultSourceSeeded = false;

  constructor(
    private dialog: MatDialog,
    private tileSourceService: TileSourceDefinitionService,
    private geocoderDefService: GeocoderDefinitionService
  ) {}

  ngOnInit(): void {
    this.tileSourceService.fetchAll();
    this.tileSourceService.allSources$.subscribe(() => {
      this.refreshFilteredSources();
      this.autoMatchCurrentSource();
    });
    // After the first fetch completes, seed a default OSM tile source if none exists
    this.tileSourceService.loading$.subscribe((isLoading) => {
      if (isLoading) {
        this.sawLoadingTrue = true;
      }
      if (!isLoading && this.sawLoadingTrue && !this.defaultSourceSeeded) {
        this.defaultSourceSeeded = true;
        this.ensureDefaultOsmSource();
      }
    });

    // Fetch geocoders
    this.geocoderDefService.fetchAll();
    this.geocoderDefService.allGeocoders$.subscribe(() => {
      this.refreshFilteredGeocoders();
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['classTypeData']) {
      this.buildFieldList();
    }
    if (changes['config']) {
      this.syncTileSourceSelection();
    }
  }

  private buildFieldList(): void {
    if (!this.classTypeData) {
      this.availableFields = [];
      return;
    }
    this.availableFields = Object.keys(this.classTypeData);
  }

  // ===== Configuration Properties =====

  onNameChange(name: string): void {
    this.config.name = name;
    this.emitChange();
  }

  onDescriptionChange(description: string): void {
    this.config.description = description;
    this.emitChange();
  }

  // ===== Coordinate Mapping =====

  onCoordinateModeChange(mode: CoordinateMode): void {
    this.config.geoJsonConfig.coordinateMode = mode;
    this.emitChange();
  }

  onTupleVariableChange(variable: string): void {
    this.config.geoJsonConfig.tupleVariable = variable;
    this.emitChange();
  }

  onTupleOrderChange(order: TupleOrder): void {
    this.config.geoJsonConfig.tupleOrder = order;
    this.emitChange();
  }

  onLatitudeVariableChange(variable: string): void {
    this.config.geoJsonConfig.latitudeVariable = variable;
    this.emitChange();
  }

  onLongitudeVariableChange(variable: string): void {
    this.config.geoJsonConfig.longitudeVariable = variable;
    this.emitChange();
  }

  onParentGeoClassChange(className: string): void {
    this.config.geoJsonConfig.parentGeoClass = className;
    this.emitChange();
  }

  // ===== SVG Markers =====

  addMarker(): void {
    const newMarker: SvgMarkerDefinition = {
      ...DEFAULT_SVG_MARKER,
      name: `marker-${this.config.geoJsonConfig.svgMarkers.length + 1}`
    };
    this.config.geoJsonConfig.svgMarkers.push(newMarker);
    this.editingMarkerIndex = this.config.geoJsonConfig.svgMarkers.length - 1;
    this.emitChange();
  }

  removeMarker(index: number): void {
    this.config.geoJsonConfig.svgMarkers.splice(index, 1);
    if (this.editingMarkerIndex === index) {
      this.editingMarkerIndex = -1;
    } else if (this.editingMarkerIndex > index) {
      this.editingMarkerIndex--;
    }
    this.emitChange();
  }

  toggleEditMarker(index: number): void {
    this.editingMarkerIndex = this.editingMarkerIndex === index ? -1 : index;
  }

  onMarkerNameChange(index: number, name: string): void {
    this.config.geoJsonConfig.svgMarkers[index].name = name;
    this.emitChange();
  }

  onMarkerSvgChange(index: number, svg: string): void {
    this.config.geoJsonConfig.svgMarkers[index].svgString = svg;
    this.emitChange();
  }

  onMarkerWidthChange(index: number, value: number | string): void {
    const num = typeof value === 'string' ? parseInt(value, 10) : value;
    if (!isNaN(num) && num > 0) {
      this.config.geoJsonConfig.svgMarkers[index].width = num;
      this.emitChange();
    }
  }

  onMarkerHeightChange(index: number, value: number | string): void {
    const num = typeof value === 'string' ? parseInt(value, 10) : value;
    if (!isNaN(num) && num > 0) {
      this.config.geoJsonConfig.svgMarkers[index].height = num;
      this.emitChange();
    }
  }

  onMarkerAnchorChange(index: number, anchor: MarkerAnchor): void {
    this.config.geoJsonConfig.svgMarkers[index].anchor = anchor;
    this.emitChange();
  }

  onMarkerFillChange(index: number, color: string): void {
    this.config.geoJsonConfig.svgMarkers[index].fillColor = color;
    this.emitChange();
  }

  onMarkerStrokeChange(index: number, color: string): void {
    this.config.geoJsonConfig.svgMarkers[index].strokeColor = color;
    this.emitChange();
  }

  onMarkerStrokeWidthChange(index: number, value: number | string): void {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (!isNaN(num) && num >= 0) {
      this.config.geoJsonConfig.svgMarkers[index].strokeWidth = num;
      this.emitChange();
    }
  }

  onDefaultMarkerChange(name: string): void {
    this.config.geoJsonConfig.defaultMarkerName = name;
    this.emitChange();
  }

  // ===== Map Settings =====

  onCenterLngChange(value: number | string): void {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (!isNaN(num)) {
      this.config.geoJsonConfig.mapOptions.center[0] = num;
      this.emitChange();
    }
  }

  onCenterLatChange(value: number | string): void {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (!isNaN(num)) {
      this.config.geoJsonConfig.mapOptions.center[1] = num;
      this.emitChange();
    }
  }

  onZoomChange(value: number | string): void {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (!isNaN(num) && num >= 0 && num <= 24) {
      this.config.geoJsonConfig.mapOptions.zoom = num;
      this.emitChange();
    }
  }

  onMinZoomChange(value: number | string | null): void {
    if (value === null || value === '') {
      this.config.geoJsonConfig.mapOptions.minZoom = undefined;
      this.emitChange();
      return;
    }
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (!isNaN(num) && num >= 0 && num <= 24) {
      this.config.geoJsonConfig.mapOptions.minZoom = num;
      this.emitChange();
    }
  }

  onMaxZoomChange(value: number | string | null): void {
    if (value === null || value === '') {
      this.config.geoJsonConfig.mapOptions.maxZoom = undefined;
      this.emitChange();
      return;
    }
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (!isNaN(num) && num >= 0 && num <= 24) {
      this.config.geoJsonConfig.mapOptions.maxZoom = num;
      this.emitChange();
    }
  }

  clearMinZoom(): void {
    this.config.geoJsonConfig.mapOptions.minZoom = undefined;
    this.emitChange();
  }

  clearMaxZoom(): void {
    this.config.geoJsonConfig.mapOptions.maxZoom = undefined;
    this.emitChange();
  }

  // ===== Tile Source (Stored Objects) =====

  private syncTileSourceSelection(): void {
    const ts = this.config?.geoJsonConfig?.mapOptions?.tileSource;
    if (ts) {
      this.selectedTileSourceType = ts.type || 'tileserver';
    }
    this.refreshFilteredSources();
    this.autoMatchCurrentSource();
  }

  private refreshFilteredSources(): void {
    this.filteredTileSources = this.tileSourceService.getByType(this.selectedTileSourceType);
  }

  /** Match the current config's tileSource to a stored source by name and auto-select it */
  private autoMatchCurrentSource(): void {
    const ts = this.config?.geoJsonConfig?.mapOptions?.tileSource;
    if (!ts) return;
    // If already selected and matching, skip
    if (this.selectedTileSourceId) {
      const current = this.filteredTileSources.find(s => s.id === this.selectedTileSourceId);
      if (current && current.name === ts.name) return;
    }
    const match = this.filteredTileSources.find(s => s.name === ts.name);
    if (match) {
      this.selectedTileSourceId = match.id;
    }
  }

  /** Seed a default OpenStreetMap tile source if one doesn't exist in the backend */
  private ensureDefaultOsmSource(): void {
    const sources = this.tileSourceService.allSources$.value;
    const hasOsm = sources.some(s => s.name === 'OpenStreetMap' && s.type === 'tileserver');
    if (!hasOsm) {
      this.tileSourceService.createDefinition(
        'OpenStreetMap',
        'tileserver',
        'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      ).subscribe();
      // createDefinition calls fetchAll() via tap, which re-emits allSources$ → refreshFilteredSources + autoMatch
    }
  }

  onTileSourceTypeFilterChange(type: TileSourceType): void {
    this.selectedTileSourceType = type;
    this.selectedTileSourceId = '';
    this.refreshFilteredSources();
  }

  onTileSourceSelected(sourceId: string): void {
    this.selectedTileSourceId = sourceId;
    if (!sourceId) return;

    this.tileSourceService.loadDefinition(sourceId).subscribe({
      next: (def) => {
        const tileSourceConfig = def.toTileSourceConfig();
        this.config.geoJsonConfig.mapOptions.tileSource = tileSourceConfig;
        this.config.geoJsonConfig.mapOptions.style = tileSourceConfig.url;
        if (def.defaultCenter) {
          this.config.geoJsonConfig.mapOptions.center = [...def.defaultCenter] as [number, number];
        }
        if (def.defaultZoom != null) {
          this.config.geoJsonConfig.mapOptions.zoom = def.defaultZoom;
        }
        this.emitChange();
      },
      error: (err) => {
        console.error('[GeoJsonConfigSidebar] Failed to load tile source:', err);
      }
    });
  }

  openCreateTileSourceDialog(): void {
    const dialogRef = this.dialog.open(CreateTileSourceDialogComponent, {
      width: '480px',
      data: { preselectedType: this.selectedTileSourceType }
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        // Refresh the list and auto-select the newly created source
        this.tileSourceService.fetchAll();
        setTimeout(() => {
          this.refreshFilteredSources();
          if (result.id) {
            this.onTileSourceSelected(result.id);
          }
        }, 500);
      }
    });
  }

  openTileSourceDetailDialog(): void {
    if (!this.selectedTileSourceId) return;

    const dialogRef = this.dialog.open(TileSourceDetailDialogComponent, {
      width: '500px',
      data: { tileSourceId: this.selectedTileSourceId }
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.tileSourceService.fetchAll();
        setTimeout(() => {
          this.refreshFilteredSources();
          if (result.action === 'deleted') {
            this.selectedTileSourceId = '';
          } else if (result.action === 'saved') {
            // Re-apply the updated source config
            this.onTileSourceSelected(this.selectedTileSourceId);
          }
        }, 500);
      }
    });
  }

  // ===== Geocoders (Stored Objects) =====

  private refreshFilteredGeocoders(): void {
    this.filteredGeocoders = this.geocoderDefService.getByType(this.selectedGeocoderType);
  }

  onGeocoderTypeFilterChange(type: GeocoderType): void {
    this.selectedGeocoderType = type;
    this.selectedGeocoderId = '';
    this.refreshFilteredGeocoders();
  }

  onGeocoderSelected(geocoderId: string): void {
    this.selectedGeocoderId = geocoderId;
  }

  openCreateGeocoderDialog(): void {
    const dialogRef = this.dialog.open(CreateGeocoderDialogComponent, {
      width: '480px',
      data: { preselectedType: this.selectedGeocoderType }
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.geocoderDefService.fetchAll();
        setTimeout(() => {
          this.refreshFilteredGeocoders();
          if (result.id) {
            this.selectedGeocoderId = result.id;
          }
        }, 500);
      }
    });
  }

  openGeocoderDetailDialog(): void {
    if (!this.selectedGeocoderId) return;

    const dialogRef = this.dialog.open(GeocoderDetailDialogComponent, {
      width: '500px',
      data: { geocoderId: this.selectedGeocoderId }
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.geocoderDefService.fetchAll();
        setTimeout(() => {
          this.refreshFilteredGeocoders();
          if (result.action === 'deleted') {
            this.selectedGeocoderId = '';
          }
        }, 500);
      }
    });
  }

  // ===== Helpers =====

  getStyledSvg(marker: SvgMarkerDefinition): string {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(marker.svgString, 'image/svg+xml');
      const svg = doc.documentElement;
      const elements = svg.querySelectorAll('path, circle, rect, polygon, ellipse');
      elements.forEach((el: Element) => {
        const currentFill = el.getAttribute('fill');
        if (currentFill !== 'white' && currentFill !== 'none' && currentFill !== '#ffffff' && currentFill !== '#fff') {
          el.setAttribute('fill', marker.fillColor);
        }
        el.setAttribute('stroke', marker.strokeColor);
        el.setAttribute('stroke-width', String(marker.strokeWidth));
      });
      return new XMLSerializer().serializeToString(svg);
    } catch {
      return marker.svgString;
    }
  }

  emitChange(): void {
    this.configChange.emit(this.config);
  }
}
