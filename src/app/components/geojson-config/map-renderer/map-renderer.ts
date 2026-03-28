import {
  Component, Input, Output, EventEmitter, OnChanges, SimpleChanges,
  ElementRef, ViewChild, OnDestroy, NgZone
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { NamedGeoJsonConfig } from '@models/geojson/NamedGeoJsonConfig';
import { buildStyleFromTileSource } from '@models/geojson/GeoJsonConfigData';
import { getSvgIcon, getSvgStyle, applyStyleToSvg, getMapLineStyle, getMapPolygonStyle, validateMapAnchor } from '@models/shared/SvgIconLibrary';

@Component({
  standalone: true,
  selector: 'map-renderer',
  template: `
    <div #mapContainer class="map-container" [class.pick-mode]="pickModeActive">
      <div *ngIf="loading" class="map-loading">
        <mat-spinner diameter="32"></mat-spinner>
        <span>Loading map...</span>
      </div>
      <div *ngIf="error" class="map-error">
        <mat-icon>warning</mat-icon>
        <span>{{ error }}</span>
      </div>
      <div *ngIf="!loading && !error && noData" class="map-empty">
        <mat-icon>map</mat-icon>
        <span>Configure coordinate variables to display points on the map</span>
      </div>

      <!-- Pick mode banner -->
      <div *ngIf="pickModeActive && !loading && !error" class="pick-mode-banner">
        <mat-icon>pin_drop</mat-icon>
        <span>Click on the map to set location</span>
        <button mat-icon-button (click)="pickModeCancelled.emit()" class="pick-cancel-btn">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <!-- Locate Me button -->
      <button *ngIf="showLocateMe && !loading && !error"
              mat-mini-fab class="locate-me-btn" color="primary"
              (click)="locateMeClicked.emit()" title="Find my location">
        <mat-icon>my_location</mat-icon>
      </button>

      <!-- Zoom level indicator -->
      <div *ngIf="!loading && !error && !noData" class="zoom-indicator">
        Zoom: {{ currentZoom }}
      </div>
    </div>
  `,
  styleUrls: ['./map-renderer.css'],
  imports: [CommonModule, MatIconModule, MatButtonModule, MatProgressSpinnerModule]
})
export class MapRendererComponent implements OnChanges, OnDestroy {
  @Input() config!: NamedGeoJsonConfig;
  @Input() instanceData: any[] = [];
  @Input() classTypeData: any = {};
  @Input() interactive: boolean = false;
  @Input() pickModeActive: boolean = false;
  @Input() showLocateMe: boolean = false;
  @Input() styleOverride: any = null;
  @Input() collectionMarker: { iconName: string; styleName: string } | null = null;
  @Input() featureMarkerOverrides: Map<string, { iconName: string; styleName: string }> | null = null;
  @Input() collectionViewRange: { minZoom: number; maxZoom: number } | null = null;
  @Input() featureViewRangeOverrides: Map<string, { minZoom: number; maxZoom: number }> | null = null;
  @Input() mixedFeatureCollection: GeoJSON.FeatureCollection | null = null;

  @Output() mapClicked = new EventEmitter<{ lng: number; lat: number }>();
  @Output() locateMeClicked = new EventEmitter<void>();
  @Output() pickModeCancelled = new EventEmitter<void>();

  @ViewChild('mapContainer', { static: true }) container!: ElementRef;

  loading = false;
  error = '';
  noData = false;
  currentZoom: string = '0.00';

  private maplibregl: any = null;
  private map: any = null;
  private markers: { marker: any; lngLat: [number, number]; minZoom: number; maxZoom: number; visible: boolean }[] = [];
  private polygonIconMarkers: { marker: any; el: HTMLElement; lngLat: [number, number]; areaSqM: number; lat: number }[] = [];
  private resizeObserver: ResizeObserver | null = null;
  private clickHandlerRegistered = false;
  private currentStyleJson: string = '';

  constructor(private ngZone: NgZone) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['config'] || changes['instanceData'] || changes['styleOverride']
        || changes['collectionMarker'] || changes['featureMarkerOverrides']
        || changes['collectionViewRange'] || changes['featureViewRangeOverrides']
        || changes['mixedFeatureCollection']) {
      this.renderMap();
    }
    if (changes['pickModeActive'] && this.map) {
      this.map.getCanvas().style.cursor = this.pickModeActive ? 'crosshair' : '';
    }
  }

  flyTo(lng: number, lat: number, zoom?: number): void {
    if (this.map) {
      this.map.flyTo({
        center: [lng, lat],
        zoom: zoom || this.map.getZoom(),
        duration: 1500
      });
    }
  }

  /**
   * Fly to a geometry's center at an appropriate zoom level.
   * Uses the bounding box diagonal to determine a 1:50 ratio zoom
   * (the geometry fills ~1/50th of the viewport for comfortable context).
   *
   * @param centerLng - Center longitude (effective center for polygons)
   * @param centerLat - Center latitude
   * @param areaSqMeters - Area in square meters (for polygons) or 0
   * @param bboxDiagonalMeters - Optional bounding box diagonal in meters (for lines)
   */
  flyToGeometry(centerLng: number, centerLat: number, areaSqMeters: number = 0, bboxDiagonalMeters: number = 0): void {
    if (!this.map) return;

    // Determine the "extent" in meters
    let extentMeters: number;
    if (bboxDiagonalMeters > 0) {
      extentMeters = bboxDiagonalMeters;
    } else if (areaSqMeters > 0) {
      // Equivalent diameter of a circle with the same area
      extentMeters = 2 * Math.sqrt(areaSqMeters / Math.PI);
    } else {
      this.flyTo(centerLng, centerLat);
      return;
    }

    // 1:50 ratio — the geometry should appear as ~1/50th of the viewport width
    const viewportExtent = extentMeters * 50;

    // Convert to zoom: at zoom z, viewport width in meters ≈ (containerWidth * 156543 * cos(lat)) / 2^z
    const containerWidth = this.container.nativeElement.offsetWidth || 800;
    const metersAtZoom0 = containerWidth * 156543.03392 * Math.cos(centerLat * Math.PI / 180);
    let zoom = Math.log2(metersAtZoom0 / viewportExtent);
    zoom = Math.max(1, Math.min(zoom, 20));

    this.flyTo(centerLng, centerLat, zoom);
  }

  private async loadMapLibre(): Promise<any> {
    if (this.maplibregl) return this.maplibregl;
    this.maplibregl = await import('maplibre-gl');
    return this.maplibregl;
  }

  private async renderMap(): Promise<void> {
    this.error = '';
    this.noData = false;

    // console.log('[MapRenderer] renderMap called. config=', !!this.config, 'styleOverride=', !!this.styleOverride);
    // if (!this.config) { console.log('[MapRenderer] No config, returning'); return; }

    const gc = this.config.geoJsonConfig;

    // Check if coordinate variables are configured.
    // When a styleOverride is provided (e.g. tile-only preview), skip this
    // check — we don't need data points to render tile layers.
    let hasCoordConfig = false;
    switch (gc.coordinateMode) {
      case 'tuple':
        hasCoordConfig = !!gc.tupleVariable;
        break;
      case 'separate':
        hasCoordConfig = !!gc.latitudeVariable && !!gc.longitudeVariable;
        break;
      case 'line_center':
      case 'polygon_center':
        hasCoordConfig = !!gc.geometryVariable;
        break;
      case 'parent':
        hasCoordConfig = !!gc.parentGeoClass;
        break;
    }

    // console.log(`[MapRenderer] hasCoordConfig=${hasCoordConfig} styleOverride=${!!this.styleOverride}`);
    if (!hasCoordConfig && !this.styleOverride) {
      // console.log('[MapRenderer] No coord config and no styleOverride — showing noData');
      this.noData = true;
      this.destroyMap();
      return;
    }

    this.loading = true;

    try {
      const ml = await this.loadMapLibre();
      const MapClass = ml.Map || ml.default?.Map;
      const MarkerClass = ml.Marker || ml.default?.Marker;
      const NavControl = ml.NavigationControl || ml.default?.NavigationControl;
      const mapOptions = gc.mapOptions;
      // Resolve style: explicit override > tileSource config > legacy style URL
      let mapStyle: any = this.styleOverride;
      if (!mapStyle && mapOptions.tileSource) {
        mapStyle = buildStyleFromTileSource(mapOptions.tileSource);
      }
      if (!mapStyle) {
        mapStyle = mapOptions.style;
      }

      // console.log('[MapRenderer] Resolved mapStyle type:', typeof mapStyle);
      if (typeof mapStyle === 'object') {
        // console.log('[MapRenderer] mapStyle sources:', Object.keys(mapStyle?.sources || {}));
        // console.log('[MapRenderer] mapStyle layers:', (mapStyle?.layers || []).map((l: any) => l.id));
        // console.log('[MapRenderer] Full mapStyle:', JSON.stringify(mapStyle, null, 2));
      } else {
        // console.log('[MapRenderer] mapStyle (string):', mapStyle);
      }

      // Resolve zoom limits (MapLibre defaults: 0-24)
      const minZoom = mapOptions.minZoom != null ? mapOptions.minZoom : 0;
      const maxZoom = mapOptions.maxZoom != null ? mapOptions.maxZoom : 24;

      // Check if style changed — if so, destroy map so it rebuilds with new tiles
      const styleJson = typeof mapStyle === 'string' ? mapStyle : JSON.stringify(mapStyle);
      if (this.map && styleJson !== this.currentStyleJson) {
        // console.log('[MapRenderer] Style changed, destroying old map');
        this.destroyMap();
      }
      this.currentStyleJson = styleJson;

      const containerEl = this.container.nativeElement;
      // console.log(`[MapRenderer] Container dimensions: ${containerEl.offsetWidth}x${containerEl.offsetHeight}, clientHeight=${containerEl.clientHeight}`);

      if (!this.map) {
        // console.log('[MapRenderer] Creating new MapLibre map...');
        this.ngZone.runOutsideAngular(() => {
          this.map = new MapClass({
            container: this.container.nativeElement,
            style: mapStyle,
            center: mapOptions.center as [number, number],
            zoom: mapOptions.zoom,
            minZoom: minZoom,
            maxZoom: maxZoom
          });
          // console.log('[MapRenderer] Map instance created');

          if (NavControl) {
            this.map.addControl(new NavControl(), 'top-right');
          }

          this.map.on('load', () => {
            this.ngZone.run(() => {
              this.loading = false;
              this.currentZoom = this.map.getZoom().toFixed(2);
              this.addMarkers(MarkerClass);
              this.addMixedGeometryLayers();
            });
          });

          this.map.on('zoom', () => {
            this.ngZone.run(() => {
              this.currentZoom = this.map.getZoom().toFixed(2);
              this.updateMarkerVisibility();
              this.rescalePolygonIconMarkers();
            });
          });

          this.map.on('error', (e: any) => {
            this.ngZone.run(() => {
              this.loading = false;
              this.error = 'Map failed to load. Check the style URL.';
              console.error('[MapRenderer] Map error:', e);
            });
          });

          // Register click handler for interactive mode
          if (this.interactive) {
            this.map.on('click', (e: any) => {
              if (this.pickModeActive) {
                this.ngZone.run(() => {
                  this.mapClicked.emit({ lng: e.lngLat.lng, lat: e.lngLat.lat });
                });
              }
            });
            this.clickHandlerRegistered = true;
          }

          // Apply cursor if already in pick mode
          if (this.pickModeActive) {
            this.map.getCanvas().style.cursor = 'crosshair';
          }

          // Resize observer for container changes
          this.resizeObserver = new ResizeObserver(() => {
            if (this.map) {
              this.map.resize();
            }
          });
          this.resizeObserver.observe(this.container.nativeElement);
        });
      } else {
        // Map already exists — update center/zoom/limits and re-add markers
        this.map.setCenter(mapOptions.center as [number, number]);
        this.map.setZoom(mapOptions.zoom);
        this.map.setMinZoom(minZoom);
        this.map.setMaxZoom(maxZoom);
        this.loading = false;
        this.addMarkers(MarkerClass);
        this.addMixedGeometryLayers();
      }
    } catch (e: any) {
      this.loading = false;
      this.error = e?.message || 'An error occurred while rendering the map.';
      console.error('[MapRenderer] Render error:', e);
    }
  }

  private addMarkers(MarkerClass: any): void {
    // Clear existing markers
    this.markers.forEach(m => m.marker.remove());
    this.markers = [];

    if (!this.map || !this.config || !this.instanceData || this.instanceData.length === 0 || !MarkerClass) {
      return;
    }

    const featureCollection = this.config.buildFeatureCollection(
      this.instanceData,
      this.collectionMarker || undefined,
      this.featureMarkerOverrides || undefined,
      this.collectionViewRange || undefined,
      this.featureViewRangeOverrides || undefined
    );

    // Resolve collection-level fallbacks from the built FeatureCollection
    const fcIconName = featureCollection._markerIconName;
    const fcStyleName = featureCollection._markerStyleName;
    const fcMinZoom = featureCollection._minZoom;
    const fcMaxZoom = featureCollection._maxZoom;

    for (const feature of featureCollection.features) {
      const coords = feature.geometry.coordinates as [number, number];
      const props = feature.properties || {};

      // Resolve marker: feature props → collection level → config default
      const iconName = props._markerIconName || fcIconName;
      const styleName = props._markerStyleName || fcStyleName;
      const resolved = this.resolveMarker(iconName, styleName);

      // Create HTML element from styled SVG string
      const el = document.createElement('div');
      el.className = 'map-svg-marker';
      el.style.width = `${resolved.style.width}px`;
      el.style.height = `${resolved.style.height}px`;
      el.innerHTML = resolved.svgString;

      // Use effectiveAnchor (validated against icon's natural anchor) when available,
      // otherwise fall back to the style's declared anchor
      const anchor = resolved.effectiveAnchor
        || (resolved.style.anchor === 'bottom' ? 'bottom' : 'center');

      console.debug(
        `[MapRenderer] addMarker: icon="${iconName}" style="${styleName}" ` +
        `anchor="${anchor}" styleAnchor="${resolved.style.anchor}" ` +
        `size=${resolved.style.width}x${resolved.style.height} ` +
        `coords=[${coords[0].toFixed(5)}, ${coords[1].toFixed(5)}]`
      );

      const mlMarker = new MarkerClass({ element: el, anchor })
        .setLngLat(coords)
        .addTo(this.map!);

      // Resolve zoom range: feature props → collection level → full range
      const minZoom = props._minZoom ?? fcMinZoom ?? 0;
      const maxZoom = props._maxZoom ?? fcMaxZoom ?? 24;

      this.markers.push({ marker: mlMarker, lngLat: coords, minZoom, maxZoom, visible: true });
    }

    // Apply initial visibility based on current zoom
    this.updateMarkerVisibility();
  }

  private updateMarkerVisibility(): void {
    if (!this.map) return;
    const zoom = this.map.getZoom();
    for (const entry of this.markers) {
      const shouldBeVisible = zoom >= entry.minZoom && zoom <= entry.maxZoom;
      if (shouldBeVisible && !entry.visible) {
        entry.marker.setLngLat(entry.lngLat).addTo(this.map);
        entry.visible = true;
      } else if (!shouldBeVisible && entry.visible) {
        entry.marker.remove();
        entry.visible = false;
      }
    }
  }

  private resolveMarker(iconName: string, styleName: string): { svgString: string; style: any; effectiveAnchor?: string } {
    const icon = getSvgIcon(iconName);
    const style = getSvgStyle(styleName);
    if (icon && style) {
      const effectiveAnchor = validateMapAnchor(icon, style);
      return { svgString: applyStyleToSvg(icon.svgString, style), style, effectiveAnchor };
    }
    // Fallback to config default
    return this.config.getMarker();
  }

  private addMixedGeometryLayers(): void {
    if (!this.map || !this.mixedFeatureCollection) return;

    // MapLibre throws "Style is not done loading" if we add sources/layers
    // before the style is ready. Defer until the style finishes loading.
    if (!this.map.isStyleLoaded()) {
      this.map.once('style.load', () => this.addMixedGeometryLayers());
      return;
    }

    // Remove existing mixed-geometry layers/source if present
    this.removeMixedGeometryLayers();

    // Filter to only lines and polygons (points are handled by DOM markers)
    const lineFeatures = this.mixedFeatureCollection.features.filter(
      f => f.geometry.type === 'LineString'
    );
    const polygonFeatures = this.mixedFeatureCollection.features.filter(
      f => f.geometry.type === 'Polygon'
    );

    // Add polygon source + layers
    if (polygonFeatures.length > 0) {
      this.map.addSource('mixed-polygons', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: polygonFeatures }
      });

      const defaultPolyStyle = getMapPolygonStyle('default-polygon');
      this.map.addLayer({
        id: 'mixed-polygons-fill',
        type: 'fill',
        source: 'mixed-polygons',
        paint: {
          'fill-color': ['coalesce', ['get', '_fillColor'], defaultPolyStyle?.fillColor || '#1976d2'],
          'fill-opacity': ['coalesce', ['get', '_fillOpacity'], defaultPolyStyle?.fillOpacity || 0.25]
        }
      });

      this.map.addLayer({
        id: 'mixed-polygons-outline',
        type: 'line',
        source: 'mixed-polygons',
        paint: {
          'line-color': ['coalesce', ['get', '_outlineColor'], defaultPolyStyle?.outlineColor || '#0d47a1'],
          'line-width': ['coalesce', ['get', '_outlineWidth'], defaultPolyStyle?.outlineWidth || 2],
          'line-opacity': ['coalesce', ['get', '_outlineOpacity'], defaultPolyStyle?.outlineOpacity || 1]
        }
      });
    }

    // Add polygon icon markers (SVG at effective center, scaled to area)
    if (polygonFeatures.length > 0) {
      this.addPolygonIconMarkers(polygonFeatures);
    }

    // Add line source + layer
    if (lineFeatures.length > 0) {
      this.map.addSource('mixed-lines', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: lineFeatures }
      });

      const defaultLineStyle = getMapLineStyle('default-line');
      this.map.addLayer({
        id: 'mixed-lines-layer',
        type: 'line',
        source: 'mixed-lines',
        paint: {
          'line-color': ['coalesce', ['get', '_lineColor'], defaultLineStyle?.lineColor || '#1976d2'],
          'line-width': ['coalesce', ['get', '_lineWidth'], defaultLineStyle?.lineWidth || 3],
          'line-opacity': ['coalesce', ['get', '_lineOpacity'], defaultLineStyle?.lineOpacity || 1]
        },
        layout: {
          'line-cap': 'round',
          'line-join': 'round'
        }
      });
    }
  }

  /**
   * Add DOM markers for polygon representational SVG icons.
   * Each polygon with _iconName gets a styled SVG marker at its effective center,
   * scaled proportionally to the polygon's area at the current zoom level.
   */
  private addPolygonIconMarkers(polygonFeatures: GeoJSON.Feature[]): void {
    // Clear existing polygon icon markers
    this.polygonIconMarkers.forEach(m => m.marker.remove());
    this.polygonIconMarkers = [];

    if (!this.map) return;

    const ml = this.maplibregl;
    const MarkerClass = ml?.Marker || ml?.default?.Marker;
    if (!MarkerClass) return;

    for (const feature of polygonFeatures) {
      const props = feature.properties || {};
      const iconName = props._iconName;
      if (!iconName) continue;

      const styleName = props._iconStyleName || 'medium-marker';
      const icon = getSvgIcon(iconName);
      const style = getSvgStyle(styleName);
      if (!icon || !style) continue;

      const centerLng = props._effectiveCenterLng ?? props._centerLng;
      const centerLat = props._effectiveCenterLat ?? props._centerLat;
      if (centerLng == null || centerLat == null) continue;

      const areaSqM = props._areaSqMeters || 0;
      const styledSvg = applyStyleToSvg(icon.svgString, style);

      const el = document.createElement('div');
      el.className = 'polygon-icon-marker';
      el.innerHTML = styledSvg;
      el.style.display = 'flex';
      el.style.alignItems = 'center';
      el.style.justifyContent = 'center';
      el.style.pointerEvents = 'none';

      // Initial size will be set by rescalePolygonIconMarkers
      const lngLat: [number, number] = [centerLng, centerLat];

      console.debug(
        `[MapRenderer] polygonIconMarker: icon="${iconName}" style="${styleName}" ` +
        `anchor="center" center=[${centerLng.toFixed(5)}, ${centerLat.toFixed(5)}] ` +
        `area=${areaSqM.toFixed(1)}m²`
      );

      const marker = new MarkerClass({ element: el, anchor: 'center' })
        .setLngLat(lngLat)
        .addTo(this.map);

      this.polygonIconMarkers.push({ marker, el, lngLat, areaSqM, lat: centerLat });
    }

    this.rescalePolygonIconMarkers();
  }

  /**
   * Rescale polygon icon markers based on current zoom level.
   * The SVG scales so its pixel footprint approximates the polygon's real-world area.
   */
  private rescalePolygonIconMarkers(): void {
    if (!this.map || this.polygonIconMarkers.length === 0) return;
    const zoom = this.map.getZoom();

    for (const entry of this.polygonIconMarkers) {
      if (entry.areaSqM <= 0) {
        entry.el.style.width = '24px';
        entry.el.style.height = '24px';
        continue;
      }

      // Convert area to pixel size at this zoom level
      const metersPerPixel = 156543.03392 * Math.cos(entry.lat * Math.PI / 180) / Math.pow(2, zoom);
      const areaInPixels = entry.areaSqM / (metersPerPixel * metersPerPixel);
      let sizePx = Math.sqrt(areaInPixels);

      // Clamp to reasonable range
      sizePx = Math.max(16, Math.min(sizePx, 400));

      entry.el.style.width = `${sizePx}px`;
      entry.el.style.height = `${sizePx}px`;
    }
  }

  private removeMixedGeometryLayers(): void {
    if (!this.map) return;
    // Remove polygon icon markers
    this.polygonIconMarkers.forEach(m => m.marker.remove());
    this.polygonIconMarkers = [];
    const layerIds = ['mixed-lines-layer', 'mixed-polygons-fill', 'mixed-polygons-outline'];
    const sourceIds = ['mixed-lines', 'mixed-polygons'];
    for (const id of layerIds) {
      if (this.map.getLayer(id)) this.map.removeLayer(id);
    }
    for (const id of sourceIds) {
      if (this.map.getSource(id)) this.map.removeSource(id);
    }
  }

  private destroyMap(): void {
    this.markers.forEach(m => m.marker.remove());
    this.markers = [];
    this.polygonIconMarkers.forEach(m => m.marker.remove());
    this.polygonIconMarkers = [];
    if (this.map) {
      this.map.remove();
      this.map = null;
    }
    this.clickHandlerRegistered = false;
  }

  ngOnDestroy(): void {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    this.destroyMap();
  }
}
