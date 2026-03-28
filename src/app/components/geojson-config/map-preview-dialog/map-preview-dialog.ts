import { Component, Inject, OnDestroy, AfterViewInit, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

export interface MapPreviewDialogData {
  title?: string;
  lng: number;
  lat: number;
  /** For polygon zoom calculation */
  areaSqMeters?: number;
  /** For line zoom calculation */
  bboxDiagonalMeters?: number;
  /** Optional polygon vertices to draw on the map */
  vertices?: [number, number][];
}

@Component({
  standalone: true,
  selector: 'map-preview-dialog',
  template: `
    <h2 mat-dialog-title>{{ data.title || 'Map Preview' }}</h2>
    <mat-dialog-content>
      <div #mapContainer class="preview-map-container">
        <div *ngIf="loading" class="map-loading">
          <mat-spinner diameter="32"></mat-spinner>
        </div>
      </div>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Close</button>
    </mat-dialog-actions>
  `,
  styles: [`
    .preview-map-container {
      width: 100%;
      height: 400px;
      min-width: 500px;
      position: relative;
      border-radius: 8px;
      overflow: hidden;
    }
    .map-loading {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(0,0,0,0.05);
    }
  `],
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule, MatProgressSpinnerModule]
})
export class MapPreviewDialogComponent implements AfterViewInit, OnDestroy {
  @ViewChild('mapContainer', { static: true }) container!: ElementRef;

  loading = true;
  private map: any = null;

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: MapPreviewDialogData,
    private dialogRef: MatDialogRef<MapPreviewDialogComponent>
  ) {}

  async ngAfterViewInit(): Promise<void> {
    const ml: any = await import('maplibre-gl');
    const MapClass = ml.Map || ml.default?.Map;
    const MarkerClass = ml.Marker || ml.default?.Marker;
    const NavControl = ml.NavigationControl || ml.default?.NavigationControl;

    // Compute zoom from geometry size
    let zoom = 14;
    const extentMeters = this.data.bboxDiagonalMeters || (this.data.areaSqMeters ? 2 * Math.sqrt(this.data.areaSqMeters / Math.PI) : 0);
    if (extentMeters > 0) {
      const containerWidth = this.container.nativeElement.offsetWidth || 500;
      const viewportExtent = extentMeters * 50;
      const metersAtZoom0 = containerWidth * 156543.03392 * Math.cos(this.data.lat * Math.PI / 180);
      zoom = Math.max(1, Math.min(Math.log2(metersAtZoom0 / viewportExtent), 20));
    }

    const style: any = {
      version: 8,
      sources: {
        'osm': { type: 'raster', tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'], tileSize: 256 }
      },
      layers: [{ id: 'osm', type: 'raster', source: 'osm', minzoom: 0, maxzoom: 19 }]
    };

    this.map = new MapClass({
      container: this.container.nativeElement,
      style,
      center: [this.data.lng, this.data.lat],
      zoom
    });

    if (NavControl) {
      this.map.addControl(new NavControl(), 'top-right');
    }

    // Add center marker
    if (MarkerClass) {
      new MarkerClass().setLngLat([this.data.lng, this.data.lat]).addTo(this.map);
    }

    this.map.on('load', () => {
      this.loading = false;

      // Draw polygon if vertices provided
      if (this.data.vertices && this.data.vertices.length >= 3) {
        const ring = [...this.data.vertices];
        const first = ring[0]; const last = ring[ring.length - 1];
        if (first[0] !== last[0] || first[1] !== last[1]) ring.push(ring[0]);

        this.map.addSource('preview-polygon', {
          type: 'geojson',
          data: { type: 'Feature', geometry: { type: 'Polygon', coordinates: [ring] }, properties: {} }
        });
        this.map.addLayer({
          id: 'preview-polygon-fill', type: 'fill', source: 'preview-polygon',
          paint: { 'fill-color': '#1976d2', 'fill-opacity': 0.25 }
        });
        this.map.addLayer({
          id: 'preview-polygon-outline', type: 'line', source: 'preview-polygon',
          paint: { 'line-color': '#0d47a1', 'line-width': 2 }
        });
      }
    });
  }

  ngOnDestroy(): void {
    if (this.map) {
      this.map.remove();
      this.map = null;
    }
  }
}
