import {
  Component, Input, Output, EventEmitter, OnChanges, SimpleChanges,
  ViewChild
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatPaginatorModule, MatPaginator } from '@angular/material/paginator';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatTabsModule } from '@angular/material/tabs';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { NamedGeoJsonConfig } from '@models/geojson/NamedGeoJsonConfig';
import { OSM_RASTER_STYLE, buildStyleFromTileSource } from '@models/geojson/GeoJsonConfigData';
import {
  getAllSvgIcons, getAllSvgStyles, getSvgIcon, getSvgStyle, applyStyleToSvg,
  SvgIconDef, SvgIconStyle
} from '@models/shared/SvgIconLibrary';
import { MapRendererComponent } from '@components/geojson-config/map-renderer/map-renderer';

@Component({
  standalone: true,
  selector: 'feature-collection-view',
  templateUrl: './feature-collection-view.html',
  styleUrls: ['./feature-collection-view.css'],
  imports: [
    CommonModule, FormsModule,
    MatFormFieldModule, MatSelectModule, MatInputModule,
    MatButtonModule, MatIconModule, MatTableModule,
    MatPaginatorModule, MatTooltipModule, MatTabsModule,
    MatSnackBarModule, MapRendererComponent
  ]
})
export class FeatureCollectionViewComponent implements OnChanges {
  @Input() config!: NamedGeoJsonConfig;
  @Input() instanceData: any[] = [];
  @Input() classTypeData: any = {};
  @Input() className: string = '';

  @Output() instanceDataChange = new EventEmitter<any[]>();

  @ViewChild(MatPaginator) paginator!: MatPaginator;

  svgIcons: SvgIconDef[] = getAllSvgIcons();
  svgStyles: SvgIconStyle[] = getAllSvgStyles();

  /** Whether collection-level marker override is enabled */
  collectionMarkerEnabled: boolean = false;
  collectionIconName: string = '';
  collectionStyleName: string = '';

  /** Whether collection-level view range override is enabled */
  collectionViewRangeEnabled: boolean = false;
  collectionMinZoom: number = 0;
  collectionMaxZoom: number = 24;

  /** Per-feature marker overrides keyed by instance id */
  featureMarkerOverrides = new Map<string, { iconName: string; styleName: string }>();
  /** Per-feature view range overrides keyed by instance id */
  featureViewRangeOverrides = new Map<string, { minZoom: number; maxZoom: number }>();

  /** Cached objects to avoid infinite change detection */
  cachedCollectionMarker: { iconName: string; styleName: string } | null = null;
  cachedCollectionViewRange: { minZoom: number; maxZoom: number } | null = null;

  /** The built FeatureCollection */
  featureCollection: any = null;
  featureCollectionJson: string = '';

  /** Table data source for the feature list */
  featureDataSource = new MatTableDataSource<any>([]);
  featureColumns: string[] = ['_id', '_coordinates', '_markerIconName', '_markerStyleName', '_viewRange', '_actions'];

  /** Cached map style */
  cachedMapStyle: any = OSM_RASTER_STYLE;

  /** Currently selected feature for detail view */
  selectedFeature: any = null;
  selectedFeatureJson: string = '';

  private idFields = ['id', '_instanceId', '_id', 'Id', 'ID', 'instanceId'];

  constructor(
    private sanitizer: DomSanitizer,
    private snackBar: MatSnackBar
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['config'] || changes['instanceData']) {
      this.initDefaults();
      this.rebuildFeatureCollection();
      this.updateCachedMapStyle();
    }
  }

  ngAfterViewInit(): void {
    this.featureDataSource.paginator = this.paginator;
  }

  private initDefaults(): void {
    if (!this.config) return;
    const def = this.config.getMarkerDef();
    // Pre-populate values so they're ready when user enables
    if (!this.collectionIconName) this.collectionIconName = def.iconName;
    if (!this.collectionStyleName) this.collectionStyleName = def.styleName;
  }

  private updateCachedMapStyle(): void {
    const tileSource = this.config?.geoJsonConfig?.mapOptions?.tileSource;
    if (tileSource?.url) {
      this.cachedMapStyle = buildStyleFromTileSource(tileSource);
    } else {
      this.cachedMapStyle = OSM_RASTER_STYLE;
    }
  }

  /** Rebuild the FeatureCollection and update all views */
  rebuildFeatureCollection(): void {
    if (!this.config || !this.instanceData) {
      this.featureCollection = null;
      this.featureCollectionJson = '';
      this.featureDataSource.data = [];
      return;
    }

    const collectionMarker = this.collectionMarkerEnabled
      ? { iconName: this.collectionIconName, styleName: this.collectionStyleName }
      : undefined;

    const collectionViewRange = this.collectionViewRangeEnabled
      ? { minZoom: this.collectionMinZoom, maxZoom: this.collectionMaxZoom }
      : undefined;

    this.featureCollection = this.config.buildFeatureCollection(
      this.instanceData,
      collectionMarker,
      this.featureMarkerOverrides.size > 0 ? this.featureMarkerOverrides : undefined,
      collectionViewRange,
      this.featureViewRangeOverrides.size > 0 ? this.featureViewRangeOverrides : undefined
    );

    // Update cached objects for map-renderer bindings
    this.cachedCollectionMarker = collectionMarker || null;
    this.cachedCollectionViewRange = collectionViewRange || null;

    this.featureCollectionJson = JSON.stringify(this.featureCollection, null, 2);

    // Build table rows from features
    this.featureDataSource.data = (this.featureCollection.features || []).map((f: any, i: number) => ({
      _index: i,
      _id: this.getFeatureId(f),
      _coordinates: f.geometry?.coordinates
        ? `[${f.geometry.coordinates[0].toFixed(4)}, ${f.geometry.coordinates[1].toFixed(4)}]`
        : 'N/A',
      _hasMarkerOverride: f.properties?._markerIconName != null,
      _markerIconName: f.properties?._markerIconName || '',
      _markerStyleName: f.properties?._markerStyleName || '',
      _hasViewRangeOverride: f.properties?._minZoom != null,
      _minZoom: f.properties?._minZoom,
      _maxZoom: f.properties?._maxZoom,
      _feature: f
    }));
  }

  // ===== Collection-Level Toggle + Controls =====

  toggleCollectionMarker(): void {
    this.collectionMarkerEnabled = !this.collectionMarkerEnabled;
    this.rebuildFeatureCollection();
  }

  toggleCollectionViewRange(): void {
    this.collectionViewRangeEnabled = !this.collectionViewRangeEnabled;
    this.rebuildFeatureCollection();
  }

  onCollectionIconChange(iconName: string): void {
    this.collectionIconName = iconName;
    this.rebuildFeatureCollection();
  }

  onCollectionStyleChange(styleName: string): void {
    this.collectionStyleName = styleName;
    this.rebuildFeatureCollection();
  }

  onCollectionMinZoomChange(value: number): void {
    this.collectionMinZoom = Math.max(0, Math.min(24, Number(value)));
    if (this.collectionMinZoom > this.collectionMaxZoom) {
      this.collectionMaxZoom = this.collectionMinZoom;
    }
    this.rebuildFeatureCollection();
  }

  onCollectionMaxZoomChange(value: number): void {
    this.collectionMaxZoom = Math.max(0, Math.min(24, Number(value)));
    if (this.collectionMaxZoom < this.collectionMinZoom) {
      this.collectionMinZoom = this.collectionMaxZoom;
    }
    this.rebuildFeatureCollection();
  }

  // ===== Per-Feature Enable/Disable + Controls =====

  enableFeatureMarker(row: any): void {
    const id = row._id;
    if (!id) return;
    const defaults = this.config.getMarkerDef();
    this.featureMarkerOverrides.set(id, {
      iconName: this.collectionMarkerEnabled ? this.collectionIconName : defaults.iconName,
      styleName: this.collectionMarkerEnabled ? this.collectionStyleName : defaults.styleName
    });
    this.featureMarkerOverrides = new Map(this.featureMarkerOverrides);
    this.rebuildFeatureCollection();
  }

  disableFeatureMarker(row: any): void {
    const id = row._id;
    if (id) {
      this.featureMarkerOverrides.delete(id);
      this.featureMarkerOverrides = new Map(this.featureMarkerOverrides);
      this.rebuildFeatureCollection();
    }
  }

  onFeatureIconChange(row: any, iconName: string): void {
    const id = row._id;
    if (!id) return;
    const existing = this.featureMarkerOverrides.get(id);
    if (!existing) return;
    this.featureMarkerOverrides.set(id, { ...existing, iconName });
    this.featureMarkerOverrides = new Map(this.featureMarkerOverrides);
    this.rebuildFeatureCollection();
  }

  onFeatureStyleChange(row: any, styleName: string): void {
    const id = row._id;
    if (!id) return;
    const existing = this.featureMarkerOverrides.get(id);
    if (!existing) return;
    this.featureMarkerOverrides.set(id, { ...existing, styleName });
    this.featureMarkerOverrides = new Map(this.featureMarkerOverrides);
    this.rebuildFeatureCollection();
  }

  enableFeatureViewRange(row: any): void {
    const id = row._id;
    if (!id) return;
    this.featureViewRangeOverrides.set(id, {
      minZoom: this.collectionViewRangeEnabled ? this.collectionMinZoom : 0,
      maxZoom: this.collectionViewRangeEnabled ? this.collectionMaxZoom : 24
    });
    this.featureViewRangeOverrides = new Map(this.featureViewRangeOverrides);
    this.rebuildFeatureCollection();
  }

  disableFeatureViewRange(row: any): void {
    const id = row._id;
    if (id) {
      this.featureViewRangeOverrides.delete(id);
      this.featureViewRangeOverrides = new Map(this.featureViewRangeOverrides);
      this.rebuildFeatureCollection();
    }
  }

  onFeatureMinZoomChange(row: any, value: number | string): void {
    const id = row._id;
    if (!id) return;
    const existing = this.featureViewRangeOverrides.get(id);
    if (!existing) return;
    const clamped = Math.max(0, Math.min(24, Number(value)));
    const maxZoom = Math.max(clamped, existing.maxZoom);
    this.featureViewRangeOverrides.set(id, { minZoom: clamped, maxZoom });
    this.featureViewRangeOverrides = new Map(this.featureViewRangeOverrides);
    this.rebuildFeatureCollection();
  }

  onFeatureMaxZoomChange(row: any, value: number | string): void {
    const id = row._id;
    if (!id) return;
    const existing = this.featureViewRangeOverrides.get(id);
    if (!existing) return;
    const clamped = Math.max(0, Math.min(24, Number(value)));
    const minZoom = Math.min(clamped, existing.minZoom);
    this.featureViewRangeOverrides.set(id, { minZoom, maxZoom: clamped });
    this.featureViewRangeOverrides = new Map(this.featureViewRangeOverrides);
    this.rebuildFeatureCollection();
  }

  hasFeatureOverride(row: any): boolean {
    return row._hasMarkerOverride || row._hasViewRangeOverride;
  }

  clearFeatureOverride(row: any): void {
    const id = row._id;
    if (id) {
      this.featureMarkerOverrides.delete(id);
      this.featureMarkerOverrides = new Map(this.featureMarkerOverrides);
      this.featureViewRangeOverrides.delete(id);
      this.featureViewRangeOverrides = new Map(this.featureViewRangeOverrides);
      this.rebuildFeatureCollection();
    }
  }

  // ===== Feature Detail =====

  selectFeature(row: any): void {
    this.selectedFeature = row._feature;
    this.selectedFeatureJson = JSON.stringify(row._feature, null, 2);
  }

  clearSelectedFeature(): void {
    this.selectedFeature = null;
    this.selectedFeatureJson = '';
  }

  // ===== Export =====

  copyGeoJson(): void {
    if (!this.featureCollectionJson) return;
    navigator.clipboard.writeText(this.featureCollectionJson).then(
      () => this.snackBar.open('GeoJSON copied to clipboard', 'OK', { duration: 2000 }),
      () => this.snackBar.open('Failed to copy', 'Dismiss', { duration: 3000 })
    );
  }

  exportGeoJson(): void {
    if (!this.featureCollectionJson) return;
    const blob = new Blob([this.featureCollectionJson], { type: 'application/geo+json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${this.className || 'features'}.geojson`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ===== Helpers =====

  private getFeatureId(feature: any): string {
    const props = feature.properties || {};
    for (const field of this.idFields) {
      if (props[field] !== undefined && props[field] !== null) {
        return String(props[field]);
      }
    }
    return '';
  }

  getIconPreviewSvg(iconName: string, styleName: string): SafeHtml {
    const icon = getSvgIcon(iconName);
    const style = getSvgStyle(styleName);
    if (!icon) return this.sanitizer.bypassSecurityTrustHtml('');
    const styledSvg = style ? applyStyleToSvg(icon.svgString, style) : icon.svgString;
    return this.sanitizer.bypassSecurityTrustHtml(styledSvg);
  }

  getSafeSvg(svgString: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(svgString);
  }

  /** Expose getSvgIcon for template use */
  getSvgIcon(name: string): SvgIconDef | undefined {
    return getSvgIcon(name);
  }

  get featureCount(): number {
    return this.featureCollection?.features?.length || 0;
  }

  get totalInstances(): number {
    return this.instanceData?.length || 0;
  }

  get unmappedCount(): number {
    return this.totalInstances - this.featureCount;
  }
}
