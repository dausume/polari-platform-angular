import { Injectable } from '@angular/core';
import * as turf from '@turf/turf';
import { MapPointDefinition } from '@models/geojson/MapPointDefinition';
import { MapLineSegmentDefinition } from '@models/geojson/MapLineSegmentDefinition';
import { MapPolygonDefinition } from '@models/geojson/MapPolygonDefinition';
import { getMapLineStyle, getMapPolygonStyle } from '@models/shared/SvgIconLibrary';

@Injectable({ providedIn: 'root' })
export class TurfGeometryService {

    /**
     * Compute centroid and area for a polygon and stamp them onto the model.
     * Call this after resolving vertices / building the coordinate ring.
     */
    computePolygonMetrics(polygon: MapPolygonDefinition): void {
        const feature = polygon.toGeoJsonFeature();
        if (!feature) return;

        // Area in square meters
        polygon.area_sq_meters = turf.area(feature);

        // Centroid (geographic center of mass)
        const c = turf.centroid(feature);
        polygon.center_lng = c.geometry.coordinates[0];
        polygon.center_lat = c.geometry.coordinates[1];
    }

    /**
     * Compute the approximate "visual radius" of a polygon in meters.
     * This is the radius of a circle with the same area — useful for SVG scaling.
     */
    equivalentRadius(polygon: MapPolygonDefinition): number {
        return Math.sqrt(polygon.area_sq_meters / Math.PI);
    }

    buildMixedFeatureCollection(
        points: MapPointDefinition[],
        lines: MapLineSegmentDefinition[],
        polygons: MapPolygonDefinition[]
    ): GeoJSON.FeatureCollection {
        const features: GeoJSON.Feature[] = [];

        for (const pt of points) {
            features.push(pt.toGeoJsonFeature());
        }

        for (const line of lines) {
            const feature = line.toGeoJsonFeature();
            if (feature) {
                const lineStyle = getMapLineStyle(line.style_name);
                if (lineStyle) {
                    feature.properties = {
                        ...feature.properties,
                        _lineColor: lineStyle.lineColor,
                        _lineWidth: lineStyle.lineWidth,
                        _lineOpacity: lineStyle.lineOpacity,
                        _lineDasharray: lineStyle.lineDasharray,
                        _lineCap: lineStyle.lineCap,
                        _lineJoin: lineStyle.lineJoin
                    };
                }
                features.push(feature);
            }
        }

        for (const poly of polygons) {
            const feature = poly.toGeoJsonFeature();
            if (feature) {
                const polyStyle = getMapPolygonStyle(poly.style_name);
                if (polyStyle) {
                    feature.properties = {
                        ...feature.properties,
                        _fillColor: polyStyle.fillColor,
                        _fillOpacity: polyStyle.fillOpacity,
                        _outlineColor: polyStyle.outlineColor,
                        _outlineWidth: polyStyle.outlineWidth,
                        _outlineOpacity: polyStyle.outlineOpacity,
                        _outlineDasharray: polyStyle.outlineDasharray
                    };
                }
                features.push(feature);
            }
        }

        return { type: 'FeatureCollection', features };
    }

    area(polygon: MapPolygonDefinition): number | null {
        const feature = polygon.toGeoJsonFeature();
        if (!feature) return null;
        return turf.area(feature);
    }

    length(line: MapLineSegmentDefinition, units: turf.Units = 'kilometers'): number | null {
        const feature = line.toGeoJsonFeature();
        if (!feature) return null;
        return turf.length(feature, { units });
    }

    centroid(polygon: MapPolygonDefinition): [number, number] | null {
        const feature = polygon.toGeoJsonFeature();
        if (!feature) return null;
        const c = turf.centroid(feature);
        return c.geometry.coordinates as [number, number];
    }

    pointInPolygon(point: MapPointDefinition, polygon: MapPolygonDefinition): boolean {
        const polyFeature = polygon.toGeoJsonFeature();
        if (!polyFeature) return false;
        const pt = turf.point(point.toLngLat());
        return turf.booleanPointInPolygon(pt, polyFeature as turf.Feature<turf.Polygon>);
    }

    buffer(feature: GeoJSON.Feature, radius: number, units: turf.Units = 'kilometers'): GeoJSON.Feature | null {
        const result = turf.buffer(feature, radius, { units });
        return result || null;
    }

    distance(pointA: MapPointDefinition, pointB: MapPointDefinition, units: turf.Units = 'kilometers'): number {
        return turf.distance(
            turf.point(pointA.toLngLat()),
            turf.point(pointB.toLngLat()),
            { units }
        );
    }

    bearing(pointA: MapPointDefinition, pointB: MapPointDefinition): number {
        return turf.bearing(
            turf.point(pointA.toLngLat()),
            turf.point(pointB.toLngLat())
        );
    }

    /**
     * Convert an area in square meters to approximate pixel size at a given zoom level.
     * Uses the Web Mercator approximation: resolution ≈ 156543 * cos(lat) / 2^zoom m/px.
     */
    areaSqMetersToPixelSize(areaSqM: number, lat: number, zoom: number): number {
        const metersPerPixel = 156543.03392 * Math.cos(lat * Math.PI / 180) / Math.pow(2, zoom);
        const areaInPixels = areaSqM / (metersPerPixel * metersPerPixel);
        return Math.sqrt(areaInPixels);
    }

    /**
     * Compute the bounding box diagonal in meters for a line segment.
     * Useful for determining appropriate zoom levels and auto-nav.
     */
    lineBboxDiagonal(line: MapLineSegmentDefinition, units: turf.Units = 'meters'): number | null {
        const feature = line.toGeoJsonFeature();
        if (!feature) return null;
        const bbox = turf.bbox(feature);
        // bbox = [minLng, minLat, maxLng, maxLat]
        const corner1 = turf.point([bbox[0], bbox[1]]);
        const corner2 = turf.point([bbox[2], bbox[3]]);
        return turf.distance(corner1, corner2, { units });
    }

    /**
     * Compute the bounding box diagonal in meters for a polygon.
     */
    polygonBboxDiagonal(polygon: MapPolygonDefinition, units: turf.Units = 'meters'): number | null {
        const feature = polygon.toGeoJsonFeature();
        if (!feature) return null;
        const bbox = turf.bbox(feature);
        const corner1 = turf.point([bbox[0], bbox[1]]);
        const corner2 = turf.point([bbox[2], bbox[3]]);
        return turf.distance(corner1, corner2, { units });
    }

    /**
     * Estimate a reasonable zoom range where a geometry is visible.
     * Returns { minZoom, maxZoom, fitZoom }.
     * - minZoom: geometry occupies ≥ ~5px (becomes visible)
     * - maxZoom: capped at 20
     * - fitZoom: geometry fills ~1/50th of an 800px viewport (comfortable nav zoom)
     *
     * @param extentMeters - Bounding diagonal or equivalent diameter in meters
     * @param lat - Latitude of the geometry center (for Mercator correction)
     */
    estimateZoomRange(extentMeters: number, lat: number): { minZoom: number; maxZoom: number; fitZoom: number } {
        if (extentMeters <= 0) {
            return { minZoom: 0, maxZoom: 20, fitZoom: 10 };
        }

        const cosLat = Math.cos(lat * Math.PI / 180);
        const baseRes = 156543.03392 * cosLat; // meters/pixel at zoom 0

        // minZoom: geometry is at least 5 pixels across
        const minZoom = Math.max(0, Math.floor(Math.log2(baseRes * 5 / extentMeters)));

        // fitZoom: geometry is ~1/50 of 800px viewport = 16px
        const fitZoom = Math.round(Math.log2(baseRes * 16 / extentMeters));

        return {
            minZoom: Math.min(minZoom, 20),
            maxZoom: 20,
            fitZoom: Math.max(1, Math.min(fitZoom, 20))
        };
    }

    /**
     * Compute the center point of a line segment.
     */
    lineCenter(line: MapLineSegmentDefinition): [number, number] | null {
        const feature = line.toGeoJsonFeature();
        if (!feature) return null;
        const mid = turf.along(feature as turf.Feature<turf.LineString>, turf.length(feature, { units: 'meters' }) / 2, { units: 'meters' });
        return mid.geometry.coordinates as [number, number];
    }
}
