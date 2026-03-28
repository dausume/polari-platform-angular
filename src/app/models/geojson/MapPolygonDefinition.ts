import { MapPointDefinition } from './MapPointDefinition';
import { MapLineSegmentDefinition } from './MapLineSegmentDefinition';

export type PolygonCompositionMode = 'points' | 'segments';

export interface MapPolygonSummary {
    id: string;
    name: string;
    composition_mode: PolygonCompositionMode;
}

export class MapPolygonDefinition {
    id: string;
    name: string;
    vertex_point_ids: string[];
    boundary_segment_ids: string[];
    composition_mode: PolygonCompositionMode;
    style_name: string;

    /** Named SVG icon to represent this polygon on the map */
    icon_name: string;
    /** Named style for the SVG icon (from SvgIconLibrary) */
    icon_style_name: string;

    /** Turf-computed centroid longitude */
    center_lng: number;
    /** Turf-computed centroid latitude */
    center_lat: number;
    /** User-adjustable offset from computed centroid (lng) — the "actual center" */
    center_offset_lng: number;
    /** User-adjustable offset from computed centroid (lat) — the "actual center" */
    center_offset_lat: number;
    /** Turf-computed area in square meters */
    area_sq_meters: number;

    resolvedVertices: MapPointDefinition[] = [];
    resolvedSegments: MapLineSegmentDefinition[] = [];

    constructor(id: string, name: string, compositionMode: PolygonCompositionMode = 'points') {
        this.id = id;
        this.name = name;
        this.vertex_point_ids = [];
        this.boundary_segment_ids = [];
        this.composition_mode = compositionMode;
        this.style_name = 'default-polygon';
        this.icon_name = '';
        this.icon_style_name = '';
        this.center_lng = 0;
        this.center_lat = 0;
        this.center_offset_lng = 0;
        this.center_offset_lat = 0;
        this.area_sq_meters = 0;
    }

    /**
     * The effective display center: Turf centroid + user offset.
     */
    get effectiveCenterLngLat(): [number, number] {
        return [
            this.center_lng + this.center_offset_lng,
            this.center_lat + this.center_offset_lat
        ];
    }

    /**
     * Area in more human-friendly units.
     */
    get areaSqKilometers(): number {
        return this.area_sq_meters / 1_000_000;
    }

    get areaAcres(): number {
        return this.area_sq_meters / 4046.8564224;
    }

    resolveFromPoints(pointsMap: Map<string, MapPointDefinition>): void {
        this.resolvedVertices = this.vertex_point_ids
            .map(id => pointsMap.get(id))
            .filter((p): p is MapPointDefinition => p !== undefined);
    }

    resolveFromSegments(
        segmentsMap: Map<string, MapLineSegmentDefinition>,
        pointsMap: Map<string, MapPointDefinition>
    ): void {
        this.resolvedSegments = this.boundary_segment_ids
            .map(id => segmentsMap.get(id))
            .filter((s): s is MapLineSegmentDefinition => s !== undefined);
        this.resolvedSegments.forEach(s => s.resolvePoints(pointsMap));
    }

    toCoordinateRing(): [number, number][] | null {
        if (this.composition_mode === 'points') {
            if (this.resolvedVertices.length < 3) return null;
            const ring = this.resolvedVertices.map(p => p.toLngLat());
            const first = ring[0];
            const last = ring[ring.length - 1];
            if (first[0] !== last[0] || first[1] !== last[1]) {
                ring.push([...first] as [number, number]);
            }
            return ring;
        } else {
            if (this.resolvedSegments.length < 3) return null;
            const coords: [number, number][] = [];
            for (const seg of this.resolvedSegments) {
                if (!seg.startPoint) return null;
                coords.push(seg.startPoint.toLngLat());
            }
            const first = coords[0];
            const last = coords[coords.length - 1];
            if (first[0] !== last[0] || first[1] !== last[1]) {
                coords.push([...first] as [number, number]);
            }
            return coords;
        }
    }

    toGeoJsonFeature(): GeoJSON.Feature | null {
        const ring = this.toCoordinateRing();
        if (!ring) return null;

        const effectiveCenter = this.effectiveCenterLngLat;

        return {
            type: 'Feature',
            geometry: {
                type: 'Polygon',
                coordinates: [ring]
            },
            properties: {
                id: this.id,
                name: this.name,
                composition_mode: this.composition_mode,
                _polygonStyleName: this.style_name,
                _geometryType: 'polygon',
                // Icon representation
                _iconName: this.icon_name || undefined,
                _iconStyleName: this.icon_style_name || undefined,
                // Centroid + offset
                _centerLng: this.center_lng,
                _centerLat: this.center_lat,
                _effectiveCenterLng: effectiveCenter[0],
                _effectiveCenterLat: effectiveCenter[1],
                _centerOffsetLng: this.center_offset_lng,
                _centerOffsetLat: this.center_offset_lat,
                // Area
                _areaSqMeters: this.area_sq_meters
            }
        };
    }

    static fromBackend(obj: any): MapPolygonDefinition {
        const poly = new MapPolygonDefinition(
            obj.id || '',
            obj.name || '',
            obj.composition_mode || 'points'
        );
        poly.style_name = obj.style_name || 'default-polygon';
        poly.icon_name = obj.icon_name || '';
        poly.icon_style_name = obj.icon_style_name || '';
        poly.center_lng = parseFloat(obj.center_lng) || 0;
        poly.center_lat = parseFloat(obj.center_lat) || 0;
        poly.center_offset_lng = parseFloat(obj.center_offset_lng) || 0;
        poly.center_offset_lat = parseFloat(obj.center_offset_lat) || 0;
        poly.area_sq_meters = parseFloat(obj.area_sq_meters) || 0;
        try {
            poly.vertex_point_ids = typeof obj.vertex_point_ids === 'string'
                ? JSON.parse(obj.vertex_point_ids)
                : (obj.vertex_point_ids || []);
        } catch {
            poly.vertex_point_ids = [];
        }
        try {
            poly.boundary_segment_ids = typeof obj.boundary_segment_ids === 'string'
                ? JSON.parse(obj.boundary_segment_ids)
                : (obj.boundary_segment_ids || []);
        } catch {
            poly.boundary_segment_ids = [];
        }
        return poly;
    }
}
