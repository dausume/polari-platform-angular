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

  @Output() mapClicked = new EventEmitter<{ lng: number; lat: number }>();
  @Output() locateMeClicked = new EventEmitter<void>();
  @Output() pickModeCancelled = new EventEmitter<void>();

  @ViewChild('mapContainer', { static: true }) container!: ElementRef;

  loading = false;
  error = '';
  noData = false;

  private maplibregl: any = null;
  private map: any = null;
  private markers: any[] = [];
  private resizeObserver: ResizeObserver | null = null;
  private clickHandlerRegistered = false;
  private currentStyleJson: string = '';

  constructor(private ngZone: NgZone) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['config'] || changes['instanceData'] || changes['styleOverride']) {
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

  private async loadMapLibre(): Promise<any> {
    if (this.maplibregl) return this.maplibregl;
    this.maplibregl = await import('maplibre-gl');
    return this.maplibregl;
  }

  private async renderMap(): Promise<void> {
    this.error = '';
    this.noData = false;

    console.log('[MapRenderer] renderMap called. config=', !!this.config, 'styleOverride=', !!this.styleOverride);
    if (!this.config) { console.log('[MapRenderer] No config, returning'); return; }

    const gc = this.config.geoJsonConfig;

    // Check if coordinate variables are configured.
    // When a styleOverride is provided (e.g. tile-only preview), skip this
    // check — we don't need data points to render tile layers.
    const hasCoordConfig = gc.coordinateMode === 'tuple'
      ? !!gc.tupleVariable
      : (!!gc.latitudeVariable && !!gc.longitudeVariable);

    console.log(`[MapRenderer] hasCoordConfig=${hasCoordConfig} styleOverride=${!!this.styleOverride}`);
    if (!hasCoordConfig && !this.styleOverride) {
      console.log('[MapRenderer] No coord config and no styleOverride — showing noData');
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

      console.log('[MapRenderer] Resolved mapStyle type:', typeof mapStyle);
      if (typeof mapStyle === 'object') {
        console.log('[MapRenderer] mapStyle sources:', Object.keys(mapStyle?.sources || {}));
        console.log('[MapRenderer] mapStyle layers:', (mapStyle?.layers || []).map((l: any) => l.id));
        console.log('[MapRenderer] Full mapStyle:', JSON.stringify(mapStyle, null, 2));
      } else {
        console.log('[MapRenderer] mapStyle (string):', mapStyle);
      }

      // Resolve zoom limits (MapLibre defaults: 0-24)
      const minZoom = mapOptions.minZoom != null ? mapOptions.minZoom : 0;
      const maxZoom = mapOptions.maxZoom != null ? mapOptions.maxZoom : 24;

      // Check if style changed — if so, destroy map so it rebuilds with new tiles
      const styleJson = typeof mapStyle === 'string' ? mapStyle : JSON.stringify(mapStyle);
      if (this.map && styleJson !== this.currentStyleJson) {
        console.log('[MapRenderer] Style changed, destroying old map');
        this.destroyMap();
      }
      this.currentStyleJson = styleJson;

      const containerEl = this.container.nativeElement;
      console.log(`[MapRenderer] Container dimensions: ${containerEl.offsetWidth}x${containerEl.offsetHeight}, clientHeight=${containerEl.clientHeight}`);

      if (!this.map) {
        console.log('[MapRenderer] Creating new MapLibre map...');
        this.ngZone.runOutsideAngular(() => {
          this.map = new MapClass({
            container: this.container.nativeElement,
            style: mapStyle,
            center: mapOptions.center as [number, number],
            zoom: mapOptions.zoom,
            minZoom: minZoom,
            maxZoom: maxZoom
          });
          console.log('[MapRenderer] Map instance created');

          if (NavControl) {
            this.map.addControl(new NavControl(), 'top-right');
          }

          this.map.on('load', () => {
            this.ngZone.run(() => {
              this.loading = false;
              this.addMarkers(MarkerClass);
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
      }
    } catch (e: any) {
      this.loading = false;
      this.error = e?.message || 'An error occurred while rendering the map.';
      console.error('[MapRenderer] Render error:', e);
    }
  }

  private addMarkers(MarkerClass: any): void {
    // Clear existing markers
    this.markers.forEach(m => m.remove());
    this.markers = [];

    if (!this.map || !this.config || !this.instanceData || this.instanceData.length === 0 || !MarkerClass) {
      return;
    }

    const featureCollection = this.config.buildFeatureCollection(this.instanceData);

    for (const feature of featureCollection.features) {
      const coords = feature.geometry.coordinates as [number, number];
      const marker = this.config.getMarker();

      // Create HTML element from SVG string
      const el = document.createElement('div');
      el.className = 'map-svg-marker';
      el.style.width = `${marker.width}px`;
      el.style.height = `${marker.height}px`;
      el.innerHTML = this.applySvgStyles(marker.svgString, marker);

      const anchor = marker.anchor === 'bottom' ? 'bottom' : 'center';

      const mlMarker = new MarkerClass({ element: el, anchor })
        .setLngLat(coords)
        .addTo(this.map!);

      this.markers.push(mlMarker);
    }
  }

  private applySvgStyles(svgString: string, marker: { fillColor: string; strokeColor: string; strokeWidth: number }): string {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(svgString, 'image/svg+xml');
      const svg = doc.documentElement;

      // Apply fill to paths/circles that don't have fill="white" or fill="none"
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
      return svgString;
    }
  }

  private destroyMap(): void {
    this.markers.forEach(m => m.remove());
    this.markers = [];
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
