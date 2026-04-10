import { Component, Inject, OnInit, OnDestroy } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Subject, forkJoin, of } from 'rxjs';
import { takeUntil, map, catchError } from 'rxjs/operators';
import { RuntimeConfigService } from '@services/runtime-config.service';
import { GeoJsonDefinitionService } from '@services/geojson/geojson-definition.service';
import { NamedGeoJsonConfig } from '@models/geojson/NamedGeoJsonConfig';
import * as turf from '@turf/turf';

export type MapPointPickerMode = 'line' | 'polygon';

/** A resolved point extracted from any mappable class instance */
export interface ResolvedMapPoint {
  id: string;
  label: string;
  lat: number;
  lng: number;
  instance: any;
}

export interface MapPointPickerDialogData {
  mode: MapPointPickerMode;
  title?: string;
  /** The class whose instances should be shown on the map */
  refClassName: string;
  /** Pre-selected instance IDs (in order) */
  selectedPointIds?: string[];
  /** Minimum points required (2 for line, 3 for polygon) */
  minPoints?: number;
}

export interface MapPointPickerDialogResult {
  action: 'select' | 'cancel';
  /** Ordered list of selected instance IDs */
  selectedPointIds?: string[];
  /** The resulting geometry data as JSON */
  geometryData?: {
    ref_class: string;
    instance_ids: string[];
    style_name: string;
    /** Ordered vertex coordinates [lng, lat][] — stored so polygon can render without re-fetching */
    vertices?: [number, number][];
    /** Turf centroid longitude */
    center_lng?: number;
    /** Turf centroid latitude */
    center_lat?: number;
    center_offset_lng?: number;
    center_offset_lat?: number;
    /** Turf-computed area in square meters */
    area_sq_meters?: number;
  };
}

@Component({
  standalone: false,
  selector: 'map-point-picker-dialog',
  templateUrl: 'map-point-picker-dialog.html',
  styleUrls: ['./map-point-picker-dialog.css']
})
export class MapPointPickerDialogComponent implements OnInit, OnDestroy {
  isLoading = true;
  loadError: string | null = null;

  allPoints: ResolvedMapPoint[] = [];
  selectedPoints: ResolvedMapPoint[] = [];
  selectedIdSet = new Set<string>();

  /** Whether the user is in "create new points" mode (click map to place) */
  createMode = false;
  /** Counter for generating temp IDs for manually created points */
  private createdPointCounter = 0;

  /** The GeoJSON config used to resolve coordinates */
  geoJsonConfig: NamedGeoJsonConfig | null = null;

  private maplibregl: any = null;
  private map: any = null;
  private MarkerClass: any = null;
  private mapMarkers: any[] = [];
  private previewLayer = false;

  private destroy$ = new Subject<void>();

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: MapPointPickerDialogData,
    private dialogRef: MatDialogRef<MapPointPickerDialogComponent>,
    private http: HttpClient,
    private runtimeConfig: RuntimeConfigService,
    private geoJsonDefService: GeoJsonDefinitionService
  ) {}

  get mode(): MapPointPickerMode {
    return this.data.mode;
  }

  get title(): string {
    return this.data.title || (this.mode === 'line'
      ? `Select ${this.data.refClassName} instances for Line Segment`
      : `Select ${this.data.refClassName} instances for Polygon`);
  }

  get minPoints(): number {
    return this.data.minPoints || (this.mode === 'line' ? 2 : 3);
  }

  get maxPoints(): number | null {
    return this.mode === 'line' ? 2 : null;
  }

  get canConfirm(): boolean {
    return this.selectedPoints.length >= this.minPoints;
  }

  get selectionLabel(): string {
    const count = this.selectedPoints.length;
    if (this.mode === 'line') {
      return `${count}/2 points selected`;
    }
    return `${count} points selected (min ${this.minPoints})`;
  }

  ngOnInit(): void {
    this.loadClassInstances();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.map) {
      // Remove all markers before destroying the map to avoid orphaned DOM
      this.mapMarkers.forEach(m => m.marker.remove());
      this.mapMarkers = [];
      // map.remove() cleanly releases the WebGL context rather than letting
      // the browser reclaim it (which triggers "WebGL context was lost").
      this.map.remove();
      this.map = null;
    }
  }

  /**
   * Load the referenced class's GeoJSON config + instances,
   * then resolve each instance to a map point using the coordinate config.
   */
  private loadClassInstances(): void {
    this.isLoading = true;
    const className = this.data.refClassName;
    const backendUrl = this.runtimeConfig.getBackendBaseUrl();

    const options = {
      headers: new HttpHeaders({
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      })
    };

    // Load GeoJSON definitions and class instances in parallel
    forkJoin([
      this.geoJsonDefService.fetchAllGeoJsonDefs(),
      this.http.get<any>(`${backendUrl}/${className}`, options).pipe(
        catchError(() => of([]))
      )
    ]).pipe(takeUntil(this.destroy$))
      .subscribe({
        next: ([geoJsonDefs, instanceResponse]) => {
          // Find the GeoJSON config for this class
          const matchingDef = geoJsonDefs.find((d: any) => d.source_class === className);
          let gc: any = {};
          if (matchingDef) {
            this.geoJsonConfig = NamedGeoJsonConfig.fromBackend(matchingDef);
            gc = this.geoJsonConfig.geoJsonConfig;
          } else {
            console.warn(`[MapPointPicker] No GeoJSON config for "${className}". Point creation mode will be available.`);
            // Auto-enable create mode when no config exists
            this.createMode = true;
          }

          // Extract instances from response
          const instances = this.extractInstances(instanceResponse, className);

          // Resolve each instance to lat/lng using the coordinate config
          this.allPoints = [];
          for (const inst of instances) {
            const resolved = this.resolveInstanceCoordinates(inst, gc);
            if (resolved) {
              this.allPoints.push(resolved);
            }
          }

          if (this.allPoints.length === 0 && instances.length > 0) {
            console.warn(`[MapPointPicker] Found ${instances.length} instances but none have valid coordinates. Showing map for manual point creation.`);
          }

          this.isLoading = false;

          // Restore pre-selections in order
          if (this.data.selectedPointIds?.length) {
            const pointsById = new Map(this.allPoints.map(p => [p.id, p]));
            for (const id of this.data.selectedPointIds) {
              const pt = pointsById.get(id);
              if (pt && !this.selectedIdSet.has(pt.id)) {
                this.selectedPoints.push(pt);
                this.selectedIdSet.add(pt.id);
              }
            }
          }

          // Wait for dialog entry animation to complete before initializing
          // the map. MatDialog applies a CSS transform during its animation,
          // which causes MapLibre to miscalculate container dimensions. The
          // error scales with latitude (Mercator cos(lat)) and is more visible
          // at low zoom levels. dialogRef.afterOpened() fires after the
          // animation finishes, guaranteeing stable container geometry.
          this.dialogRef.afterOpened().subscribe(() => {
            setTimeout(() => this.initMap(), 0);
          });
        },
        error: (err) => {
          this.loadError = `Failed to load data for "${className}"`;
          this.isLoading = false;
          console.error('[MapPointPicker] Load error:', err);
        }
      });
  }

  /**
   * Resolve an instance's lat/lng coordinates using the GeoJSON coordinate config.
   */
  private resolveInstanceCoordinates(instance: any, gc: any): ResolvedMapPoint | null {
    let lat: number | null = null;
    let lng: number | null = null;

    if (gc.coordinateMode === 'tuple' && gc.tupleVariable) {
      let tuple = instance[gc.tupleVariable];
      // Handle JSON string values (map_coordinate stored as TEXT in DB)
      if (typeof tuple === 'string') {
        try { tuple = JSON.parse(tuple); } catch { /* not valid JSON */ }
      }
      if (Array.isArray(tuple) && tuple.length >= 2) {
        if (gc.tupleOrder === 'lat-lng') {
          lat = parseFloat(tuple[0]);
          lng = parseFloat(tuple[1]);
        } else {
          lng = parseFloat(tuple[0]);
          lat = parseFloat(tuple[1]);
        }
      }
    } else if (gc.coordinateMode === 'separate') {
      if (gc.latitudeVariable) lat = parseFloat(instance[gc.latitudeVariable]);
      if (gc.longitudeVariable) lng = parseFloat(instance[gc.longitudeVariable]);
    } else if ((gc.coordinateMode === 'line_center' || gc.coordinateMode === 'polygon_center') && gc.geometryVariable) {
      let geomVal = instance[gc.geometryVariable];
      if (typeof geomVal === 'string') {
        try { geomVal = JSON.parse(geomVal); } catch { /* not valid JSON */ }
      }
      const center = this.extractGeometryCenter(geomVal, gc.coordinateMode);
      if (center) {
        lng = center[0];
        lat = center[1];
      }
    }

    if (lat == null || lng == null || isNaN(lat) || isNaN(lng)) {
      console.debug(`[MapPointPicker] resolveCoords: skipping instance (invalid coords) lat=${lat} lng=${lng}`, instance);
      return null;
    }

    const id = instance.id || instance._id || instance._instanceId || '';
    const label = instance.name || instance.title || instance.displayName || instance.label || String(id);

    console.debug(
      `[MapPointPicker] resolveCoords: id="${id}" label="${label}" ` +
      `lat=${lat} lng=${lng} coordMode="${gc.coordinateMode}"`
    );

    return { id: String(id), label, lat, lng, instance };
  }

  /**
   * Extract center coordinates from a geometry variable's JSON value.
   */
  private extractGeometryCenter(rawValue: any, mode: string): [number, number] | null {
    if (!rawValue) return null;
    try {
      const parsed = typeof rawValue === 'string' ? JSON.parse(rawValue) : rawValue;
      const cLng = parseFloat(parsed.center_lng);
      const cLat = parseFloat(parsed.center_lat);
      if (!isNaN(cLng) && !isNaN(cLat) && (cLng !== 0 || cLat !== 0)) {
        if (mode === 'polygon_center') {
          const offLng = parseFloat(parsed.center_offset_lng) || 0;
          const offLat = parseFloat(parsed.center_offset_lat) || 0;
          return [cLng + offLng, cLat + offLat];
        }
        return [cLng, cLat];
      }
    } catch { /* invalid JSON */ }
    return null;
  }

  /**
   * Extract instances from the CRUDE response (handles multiple formats).
   */
  private extractInstances(response: any, className: string): any[] {
    if (!response) return [];

    if (Array.isArray(response) && response.length > 0) {
      if (response[0]?.[className]) {
        const classData = response[0][className];
        if (Array.isArray(classData)) {
          const instances: any[] = [];
          classData.forEach((ds: any) => {
            if (ds.data && Array.isArray(ds.data)) instances.push(...ds.data);
            else if (ds.id !== undefined) instances.push(ds);
          });
          return instances;
        }
        return Object.values(classData);
      }
      if (response[0]?.id !== undefined) return response;
    }

    if (typeof response === 'object' && !Array.isArray(response)) {
      if (response[className]) {
        const classData = response[className];
        if (Array.isArray(classData)) {
          const instances: any[] = [];
          classData.forEach((ds: any) => {
            if (ds.data && Array.isArray(ds.data)) instances.push(...ds.data);
            else instances.push(ds);
          });
          return instances;
        }
        return Object.values(classData);
      }
      if (response.data && Array.isArray(response.data)) return response.data;
    }

    return [];
  }

  private async initMap(): Promise<void> {
    try {
      this.maplibregl = await import('maplibre-gl');
      const MapClass = this.maplibregl.Map || this.maplibregl.default?.Map;
      const MarkerClass = this.maplibregl.Marker || this.maplibregl.default?.Marker;
      const NavControl = this.maplibregl.NavigationControl || this.maplibregl.default?.NavigationControl;

      const container = document.getElementById('map-point-picker-container');
      if (!container) return;

      console.log(
        `[MapPointPicker] initMap: container=${container.clientWidth}x${container.clientHeight} ` +
        `offset=${container.offsetWidth}x${container.offsetHeight}`
      );

      // Use tile source from the GeoJSON config if available
      let mapStyle: any = {
        version: 8,
        sources: {
          'osm': {
            type: 'raster',
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: '&copy; OpenStreetMap contributors'
          }
        },
        layers: [{ id: 'osm', type: 'raster', source: 'osm' }]
      };

      const mapOptions = this.geoJsonConfig?.geoJsonConfig?.mapOptions;
      const center: [number, number] = mapOptions?.center || [-98.5795, 39.8283];
      const zoom = mapOptions?.zoom || 4;

      this.map = new MapClass({
        container,
        style: mapStyle,
        center,
        zoom
      });

      if (NavControl) {
        this.map.addControl(new NavControl(), 'top-right');
      }

      this.MarkerClass = MarkerClass;

      this.map.on('load', () => {
        this.map.resize();
        this.addPointMarkers(MarkerClass);
        if (this.allPoints.length > 0) {
          this.fitBoundsToPoints();
        }
        // Diagnostic: after fitBounds settles, compare map.project() to actual
        // marker DOM positions to identify any systematic offset.
        setTimeout(() => this.debugMarkerPositions(), 500);
      });

      // Re-check marker positions after zoom changes to track the drift
      this.map.on('zoomend', () => {
        this.debugMarkerPositions();
      });

      // Click handler for creating new points directly on the map
      this.map.on('click', (e: any) => {
        if (!this.createMode) return;
        const { lng, lat } = e.lngLat;
        this.addCreatedPoint(lat, lng);
      });
    } catch (e) {
      console.error('[MapPointPicker] Map init error:', e);
      this.loadError = 'Failed to initialize map';
    }
  }

  private addPointMarkers(MarkerClass: any): void {
    this.mapMarkers.forEach(m => m.marker.remove());
    this.mapMarkers = [];

    console.log(`[MapPointPicker] Adding ${this.allPoints.length} point markers. ` +
      `Using CSS circle markers with anchor="center" (20x20px).`);

    for (const pt of this.allPoints) {
      console.debug(
        `[MapPointPicker] Marker: id="${pt.id}" label="${pt.label}" ` +
        `lat=${pt.lat} lng=${pt.lng} anchor="center"`
      );

      const el = document.createElement('div');
      el.className = 'map-picker-point';
      el.title = pt.label;
      if (this.selectedIdSet.has(pt.id)) {
        el.classList.add('selected');
        const idx = this.selectedPoints.findIndex(p => p.id === pt.id);
        if (idx >= 0) {
          el.setAttribute('data-order', String(idx + 1));
        }
      }

      el.addEventListener('click', (e) => {
        e.stopPropagation();
        this.togglePoint(pt);
        this.refreshMarkerStyles();
        this.updatePreviewLine();
      });

      const marker = new MarkerClass({ element: el, anchor: 'center' })
        .setLngLat([pt.lng, pt.lat])
        .addTo(this.map);

      this.mapMarkers.push({ marker, point: pt, el });
    }
  }

  toggleCreateMode(): void {
    this.createMode = !this.createMode;
    if (this.map) {
      this.map.getCanvas().style.cursor = this.createMode ? 'crosshair' : '';
    }
  }

  /** Add a manually created point at the given coordinates */
  addCreatedPoint(lat: number, lng: number): void {
    this.createdPointCounter++;
    const id = `_created_${this.createdPointCounter}`;
    const label = `Point ${this.allPoints.length + 1}`;

    const newPoint: ResolvedMapPoint = {
      id,
      label,
      lat,
      lng,
      instance: { id, _isCreatedPoint: true, _lat: lat, _lng: lng }
    };

    this.allPoints.push(newPoint);

    // Add marker on the map
    if (this.MarkerClass && this.map) {
      const el = document.createElement('div');
      el.className = 'map-picker-marker';
      el.title = `${label} (${lat.toFixed(5)}, ${lng.toFixed(5)})`;
      const marker = new this.MarkerClass({ element: el, anchor: 'center' })
        .setLngLat([lng, lat])
        .addTo(this.map);
      el.addEventListener('click', (e: Event) => {
        e.stopPropagation();
        this.togglePoint(newPoint);
        this.refreshMarkerStyles();
        this.updatePreviewLine();
      });
      this.mapMarkers.push({ marker, el, point: newPoint });
    }

    // Auto-select the new point
    this.togglePoint(newPoint);
    this.refreshMarkerStyles();
    this.updatePreviewLine();
  }

  togglePoint(pt: ResolvedMapPoint): void {
    if (this.selectedIdSet.has(pt.id)) {
      this.selectedIdSet.delete(pt.id);
      this.selectedPoints = this.selectedPoints.filter(p => p.id !== pt.id);
    } else {
      if (this.maxPoints && this.selectedPoints.length >= this.maxPoints) {
        const removed = this.selectedPoints.shift();
        if (removed) this.selectedIdSet.delete(removed.id);
      }
      this.selectedPoints.push(pt);
      this.selectedIdSet.add(pt.id);
    }
  }

  removePoint(index: number): void {
    const removed = this.selectedPoints.splice(index, 1);
    if (removed.length > 0) {
      this.selectedIdSet.delete(removed[0].id);
    }
    this.refreshMarkerStyles();
    this.updatePreviewLine();
  }

  movePointUp(index: number): void {
    if (index <= 0) return;
    const temp = this.selectedPoints[index - 1];
    this.selectedPoints[index - 1] = this.selectedPoints[index];
    this.selectedPoints[index] = temp;
    this.refreshMarkerStyles();
    this.updatePreviewLine();
  }

  movePointDown(index: number): void {
    if (index >= this.selectedPoints.length - 1) return;
    const temp = this.selectedPoints[index + 1];
    this.selectedPoints[index + 1] = this.selectedPoints[index];
    this.selectedPoints[index] = temp;
    this.refreshMarkerStyles();
    this.updatePreviewLine();
  }

  refreshMarkerStyles(): void {
    for (const entry of this.mapMarkers) {
      const isSelected = this.selectedIdSet.has(entry.point.id);
      entry.el.classList.toggle('selected', isSelected);
      if (isSelected) {
        const idx = this.selectedPoints.findIndex((p: ResolvedMapPoint) => p.id === entry.point.id);
        entry.el.setAttribute('data-order', String(idx + 1));
      } else {
        entry.el.removeAttribute('data-order');
      }
    }
  }

  updatePreviewLine(): void {
    if (!this.map) return;
    if (!this.map.isStyleLoaded()) {
      this.map.once('style.load', () => this.updatePreviewLine());
      return;
    }

    if (this.previewLayer) {
      if (this.map.getLayer('preview-line')) this.map.removeLayer('preview-line');
      if (this.map.getLayer('preview-fill')) this.map.removeLayer('preview-fill');
      if (this.map.getSource('preview-geom')) this.map.removeSource('preview-geom');
      this.previewLayer = false;
    }

    if (this.selectedPoints.length < 2) return;

    const coords = this.selectedPoints.map(p => [p.lng, p.lat]);

    if (this.mode === 'line') {
      this.map.addSource('preview-geom', {
        type: 'geojson',
        data: {
          type: 'Feature',
          geometry: { type: 'LineString', coordinates: coords },
          properties: {}
        }
      });
      this.map.addLayer({
        id: 'preview-line',
        type: 'line',
        source: 'preview-geom',
        paint: { 'line-color': '#1976d2', 'line-width': 3, 'line-dasharray': [4, 2] }
      });
    } else if (this.selectedPoints.length >= 3) {
      const ring = [...coords, coords[0]];
      this.map.addSource('preview-geom', {
        type: 'geojson',
        data: {
          type: 'Feature',
          geometry: { type: 'Polygon', coordinates: [ring] },
          properties: {}
        }
      });
      this.map.addLayer({
        id: 'preview-fill',
        type: 'fill',
        source: 'preview-geom',
        paint: { 'fill-color': '#1976d2', 'fill-opacity': 0.15 }
      });
      this.map.addLayer({
        id: 'preview-line',
        type: 'line',
        source: 'preview-geom',
        paint: { 'line-color': '#1976d2', 'line-width': 2, 'line-dasharray': [4, 2] }
      });
    }

    this.previewLayer = true;
  }

  private fitBoundsToPoints(): void {
    if (!this.map || this.allPoints.length === 0) return;
    const LngLatBounds = this.maplibregl.LngLatBounds || this.maplibregl.default?.LngLatBounds;
    if (!LngLatBounds) return;

    const bounds = new LngLatBounds();
    for (const pt of this.allPoints) {
      bounds.extend([pt.lng, pt.lat]);
    }
    this.map.fitBounds(bounds, { padding: 50, maxZoom: 14 });
  }

  /**
   * Diagnostic: compare where map.project() says each point should be (px)
   * vs where the marker DOM element actually is. Also inspects the marker's
   * inline CSS transform and the parent DOM chain for transforms to identify
   * containing-block or stacking-context mismatches.
   */
  private debugMarkerPositions(): void {
    if (!this.map) return;
    const zoom = this.map.getZoom().toFixed(2);
    const canvas = this.map.getCanvas();
    const canvasRect = canvas.getBoundingClientRect();
    const container = this.map.getContainer();
    const containerRect = container.getBoundingClientRect();

    console.log(
      `[MapPointPicker] === Position debug at zoom=${zoom} ===\n` +
      `  canvas rect: ${canvasRect.width.toFixed(1)}x${canvasRect.height.toFixed(1)} ` +
      `at (${canvasRect.left.toFixed(1)}, ${canvasRect.top.toFixed(1)})\n` +
      `  container rect: ${containerRect.width.toFixed(1)}x${containerRect.height.toFixed(1)} ` +
      `at (${containerRect.left.toFixed(1)}, ${containerRect.top.toFixed(1)})\n` +
      `  canvas-vs-container offset: ` +
      `dx=${(canvasRect.left - containerRect.left).toFixed(1)} ` +
      `dy=${(canvasRect.top - containerRect.top).toFixed(1)}`
    );

    // Walk up from map container to find any CSS transforms on ancestors
    let el: HTMLElement | null = container;
    let depth = 0;
    const transformChain: string[] = [];
    while (el && depth < 20) {
      const computed = window.getComputedStyle(el);
      const transform = computed.transform;
      if (transform && transform !== 'none') {
        transformChain.push(
          `  [depth=${depth}] <${el.tagName.toLowerCase()}.${el.className.split(' ').slice(0, 2).join('.')}> ` +
          `transform: ${transform}`
        );
      }
      el = el.parentElement;
      depth++;
    }
    if (transformChain.length > 0) {
      console.warn('[MapPointPicker] Ancestor transforms found (may cause marker drift):\n' + transformChain.join('\n'));
    } else {
      console.log('[MapPointPicker] No ancestor transforms found.');
    }

    for (const entry of this.mapMarkers) {
      const pt = entry.point;
      const projected = this.map.project([pt.lng, pt.lat]);

      // Extract the translate values MapLibre actually wrote into the style
      const styleTransform = entry.el.style.transform || '';
      const translateMatch = styleTransform.match(/translate\((-?[\d.]+)px,\s*(-?[\d.]+)px\)/);
      const cssX = translateMatch ? parseFloat(translateMatch[1]) : NaN;
      const cssY = translateMatch ? parseFloat(translateMatch[2]) : NaN;

      // Where the marker DOM element actually renders on screen
      const elRect = entry.el.getBoundingClientRect();
      const actualX = (elRect.left + elRect.width / 2) - canvasRect.left;
      const actualY = (elRect.top + elRect.height / 2) - canvasRect.top;

      const driftX = actualX - projected.x;
      const driftY = actualY - projected.y;

      console.log(
        `  "${pt.label}" (lat=${pt.lat.toFixed(4)}):\n` +
        `    projected=(${projected.x.toFixed(1)}, ${projected.y.toFixed(1)})\n` +
        `    css-translate=(${cssX.toFixed(1)}, ${cssY.toFixed(1)}) ` +
        `match-projected=${Math.abs(cssX - projected.x) < 1 && Math.abs(cssY - projected.y) < 1}\n` +
        `    actual-on-screen=(${actualX.toFixed(1)}, ${actualY.toFixed(1)})\n` +
        `    drift=(${driftX.toFixed(1)}px, ${driftY.toFixed(1)}px)`
      );
    }
  }

  onConfirm(): void {
    // Check if any selected points are newly created (need to be persisted first)
    const createdPoints = this.selectedPoints.filter(p => p.instance?._isCreatedPoint);

    if (createdPoints.length > 0) {
      this.isLoading = true;
      this.persistCreatedPoints(createdPoints).then((idMap) => {
        this.isLoading = false;
        this.closeWithResult(idMap);
      }).catch((err) => {
        this.isLoading = false;
        console.error('[MapPointPicker] Failed to persist created points:', err);
        // Still close with temp IDs — vertices are correct even if instance creation failed
        this.closeWithResult(new Map());
      });
    } else {
      this.closeWithResult(new Map());
    }
  }

  /**
   * Persist newly created points as real instances of the reference class.
   * Returns a map of tempId -> realId for ID replacement.
   */
  private async persistCreatedPoints(createdPoints: ResolvedMapPoint[]): Promise<Map<string, string>> {
    const className = this.data.refClassName;
    const backendUrl = this.runtimeConfig.getBackendBaseUrl();
    const gc = this.geoJsonConfig?.geoJsonConfig;

    const idMap = new Map<string, string>();

    for (const pt of createdPoints) {
      try {
        // Build the instance data based on the coordinate config
        const instanceData: any = {};

        if (gc?.coordinateMode === 'tuple' && gc.tupleVariable) {
          // Store as [lat, lng] or [lng, lat] based on tupleOrder
          if (gc.tupleOrder === 'lat-lng') {
            instanceData[gc.tupleVariable] = JSON.stringify([pt.lat, pt.lng]);
          } else {
            instanceData[gc.tupleVariable] = JSON.stringify([pt.lng, pt.lat]);
          }
        } else if (gc?.coordinateMode === 'separate') {
          if (gc.latitudeVariable) instanceData[gc.latitudeVariable] = pt.lat;
          if (gc.longitudeVariable) instanceData[gc.longitudeVariable] = pt.lng;
        } else {
          // No config — store as a generic coordinate field if we can find one
          // Fall back to storing lat/lng as name for identification
          instanceData['name'] = `Point at ${pt.lat.toFixed(5)}, ${pt.lng.toFixed(5)}`;
        }

        // POST to CRUDE endpoint to create the instance
        const formData = new FormData();
        formData.append('initParamSets', JSON.stringify([instanceData]));

        const response: any = await this.http.post(
          `${backendUrl}/${className}`,
          formData
        ).toPromise();

        // Extract the new instance ID from the response
        const newId = this.extractCreatedInstanceId(response, className);
        if (newId) {
          idMap.set(pt.id, newId);
          // Update the point's ID in allPoints and selectedPoints
          pt.id = newId;
          pt.instance.id = newId;
          pt.instance._isCreatedPoint = false;
          console.log(`[MapPointPicker] Persisted point ${pt.label} as ${className} id=${newId}`);
        }
      } catch (err) {
        console.error(`[MapPointPicker] Failed to persist point ${pt.label}:`, err);
      }
    }

    return idMap;
  }

  /** Extract the instance ID from a CRUDE POST response */
  private extractCreatedInstanceId(response: any, className: string): string | null {
    try {
      // Response format: [{ className: { id: { ...data } } }] or { className: { id: { ...data } } }
      let classData = response;
      if (Array.isArray(response) && response.length > 0) {
        classData = response[0];
      }
      if (classData && classData[className]) {
        const ids = Object.keys(classData[className]);
        if (ids.length > 0) return ids[0];
      }
      // Alternate format: { data: [{ id: '...' }] }
      if (classData?.data && Array.isArray(classData.data) && classData.data.length > 0) {
        return classData.data[0].id;
      }
    } catch { /* parsing failed */ }
    return null;
  }

  /** Build geometry data and close the dialog */
  private closeWithResult(idMap: Map<string, string>): void {
    // Replace temp IDs with real IDs where available
    const instanceIds = this.selectedPoints.map(p => {
      return idMap.get(p.id) || p.id;
    });
    const vertices: [number, number][] = this.selectedPoints.map(p => [p.lng, p.lat]);

    const geometryData: MapPointPickerDialogResult['geometryData'] = {
      ref_class: this.data.refClassName,
      instance_ids: instanceIds,
      style_name: this.mode === 'line' ? 'default-line' : 'default-polygon',
      vertices
    };

    // For polygons, compute centroid + area from the vertex ring using turf
    if (this.mode === 'polygon' && vertices.length >= 3) {
      const ring: [number, number][] = [...vertices, vertices[0]];
      try {
        const polyFeature = turf.polygon([ring]);
        geometryData.area_sq_meters = turf.area(polyFeature);
        const centroid = turf.centroid(polyFeature);
        geometryData.center_lng = centroid.geometry.coordinates[0];
        geometryData.center_lat = centroid.geometry.coordinates[1];
        geometryData.center_offset_lng = 0;
        geometryData.center_offset_lat = 0;
      } catch {
        // Fallback: simple average center
        const avgLng = vertices.reduce((s, v) => s + v[0], 0) / vertices.length;
        const avgLat = vertices.reduce((s, v) => s + v[1], 0) / vertices.length;
        geometryData.center_lng = avgLng;
        geometryData.center_lat = avgLat;
        geometryData.center_offset_lng = 0;
        geometryData.center_offset_lat = 0;
      }
    }

    this.dialogRef.close({
      action: 'select',
      selectedPointIds: instanceIds,
      geometryData
    } as MapPointPickerDialogResult);
  }

  onCancel(): void {
    this.dialogRef.close({ action: 'cancel' } as MapPointPickerDialogResult);
  }
}
