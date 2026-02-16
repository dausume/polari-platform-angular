import {
  Component, Input, OnChanges, SimpleChanges,
  ElementRef, ViewChild, OnDestroy, NgZone
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { NamedGeoJsonConfig } from '@models/geojson/NamedGeoJsonConfig';

@Component({
  standalone: true,
  selector: 'map-renderer',
  template: `
    <div #mapContainer class="map-container">
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
    </div>
  `,
  styleUrls: ['./map-renderer.css'],
  imports: [CommonModule, MatIconModule, MatProgressSpinnerModule]
})
export class MapRendererComponent implements OnChanges, OnDestroy {
  @Input() config!: NamedGeoJsonConfig;
  @Input() instanceData: any[] = [];
  @Input() classTypeData: any = {};

  @ViewChild('mapContainer', { static: true }) container!: ElementRef;

  loading = false;
  error = '';
  noData = false;

  private maplibregl: any = null;
  private map: any = null;
  private markers: any[] = [];
  private resizeObserver: ResizeObserver | null = null;

  constructor(private ngZone: NgZone) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['config'] || changes['instanceData']) {
      this.renderMap();
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

    if (!this.config) return;

    const gc = this.config.geoJsonConfig;

    // Check if coordinate variables are configured
    const hasCoordConfig = gc.coordinateMode === 'tuple'
      ? !!gc.tupleVariable
      : (!!gc.latitudeVariable && !!gc.longitudeVariable);

    if (!hasCoordConfig) {
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

      if (!this.map) {
        this.ngZone.runOutsideAngular(() => {
          this.map = new MapClass({
            container: this.container.nativeElement,
            style: mapOptions.style,
            center: mapOptions.center as [number, number],
            zoom: mapOptions.zoom
          });

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

          // Resize observer for container changes
          this.resizeObserver = new ResizeObserver(() => {
            if (this.map) {
              this.map.resize();
            }
          });
          this.resizeObserver.observe(this.container.nativeElement);
        });
      } else {
        // Map already exists — update center/zoom and re-add markers
        this.map.setCenter(mapOptions.center as [number, number]);
        this.map.setZoom(mapOptions.zoom);
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
  }

  ngOnDestroy(): void {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    this.destroyMap();
  }
}
