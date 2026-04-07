import {
    GeoJsonConfigData, DEFAULT_GEOJSON_CONFIG, DEFAULT_MAP_VIEW,
    DEFAULT_SVG_MARKER, DEFAULT_TILE_SOURCE, SvgMarkerDefinition
} from './GeoJsonConfigData';
import { getSvgIcon, getSvgStyle, applyStyleToSvg, SvgIconStyle } from '@models/shared/SvgIconLibrary';

export interface GeoJsonDefinitionSummary {
    id: string;
    name: string;
    description: string;
    source_class: string;
}

export class NamedGeoJsonConfig {
    id: string;
    name: string;
    description: string;
    source_class: string;
    geoJsonConfig: GeoJsonConfigData;

    constructor(id: string, name: string, description: string, sourceClass: string) {
        this.id = id;
        this.name = name;
        this.description = description;
        this.source_class = sourceClass;
        this.geoJsonConfig = {
            ...DEFAULT_GEOJSON_CONFIG,
            svgMarkers: [{ ...DEFAULT_SVG_MARKER }],
            mapOptions: { ...DEFAULT_MAP_VIEW }
        };
    }

    toDefinitionJSON(): string {
        return JSON.stringify({
            geoJsonConfig: this.geoJsonConfig
        });
    }

    static fromBackend(backendObj: any): NamedGeoJsonConfig {
        const config = new NamedGeoJsonConfig(
            backendObj.id || '',
            backendObj.name || '',
            backendObj.description || '',
            backendObj.source_class || ''
        );

        if (backendObj.definition && backendObj.definition !== '{}') {
            try {
                const parsed = typeof backendObj.definition === 'string'
                    ? JSON.parse(backendObj.definition)
                    : backendObj.definition;

                if (parsed.geoJsonConfig) {
                    const savedMapOptions = parsed.geoJsonConfig.mapOptions || {};
                    config.geoJsonConfig = {
                        ...DEFAULT_GEOJSON_CONFIG,
                        ...parsed.geoJsonConfig,
                        svgMarkers: parsed.geoJsonConfig.svgMarkers?.length > 0
                            ? parsed.geoJsonConfig.svgMarkers.map((m: any) => ({
                                ...DEFAULT_SVG_MARKER, ...m
                            }))
                            : [{ ...DEFAULT_SVG_MARKER }],
                        mapOptions: {
                            ...DEFAULT_MAP_VIEW,
                            ...savedMapOptions,
                            tileSource: savedMapOptions.tileSource
                                ? { ...DEFAULT_TILE_SOURCE, ...savedMapOptions.tileSource }
                                : { ...DEFAULT_TILE_SOURCE }
                        }
                    };
                }
            } catch (e) {
                console.warn('[NamedGeoJsonConfig] Failed to parse definition:', e);
            }
        }

        return config;
    }

    /**
     * Builds a GeoJSON FeatureCollection from instance data using this config.
     * Each instance becomes a Feature with Point geometry.
     *
     * Override fields (_markerIconName, _markerStyleName, _minZoom, _maxZoom) are
     * only stamped when an explicit override exists at that level. Their presence
     * in the output IS the indicator that an override is active. Consumers should
     * fall back through: feature properties → collection level → config defaults.
     */
    buildFeatureCollection(
        instanceData: any[],
        collectionMarker?: { iconName: string; styleName: string },
        featureMarkerOverrides?: Map<string, { iconName: string; styleName: string }>,
        collectionViewRange?: { minZoom: number; maxZoom: number },
        featureViewRangeOverrides?: Map<string, { minZoom: number; maxZoom: number }>
    ): any {
        const gc = this.geoJsonConfig;

        // Parent mode: coordinates come from a parent class, nothing to build here
        if (gc.coordinateMode === 'parent') {
            return { type: 'FeatureCollection', features: [] };
        }

        const features: any[] = [];

        console.log('[GeoJSON buildGeoJson] Config:', {
            coordinateMode: gc.coordinateMode,
            tupleVariable: gc.tupleVariable,
            tupleOrder: gc.tupleOrder,
            latitudeVariable: gc.latitudeVariable,
            longitudeVariable: gc.longitudeVariable,
            geometryVariable: gc.geometryVariable,
        });
        console.log('[GeoJSON buildGeoJson] Instance count:', instanceData.length);

        for (const instance of instanceData) {
            let lng: number | null = null;
            let lat: number | null = null;

            if (gc.coordinateMode === 'tuple' && gc.tupleVariable) {
                let tuple = instance[gc.tupleVariable];
                const rawType = typeof tuple;
                console.log(`[GeoJSON] Instance ${instance.id}: raw tuple value =`, tuple, `(type: ${rawType})`);
                // Handle JSON string values (map_coordinate stored as TEXT in DB)
                if (typeof tuple === 'string') {
                    try {
                        tuple = JSON.parse(tuple);
                        console.log(`[GeoJSON] Instance ${instance.id}: parsed string to`, tuple);
                    } catch (e) {
                        console.warn(`[GeoJSON] Instance ${instance.id}: JSON.parse failed on`, tuple, e);
                    }
                }
                if (Array.isArray(tuple) && tuple.length >= 2) {
                    if (gc.tupleOrder === 'lat-lng') {
                        lat = parseFloat(tuple[0]);
                        lng = parseFloat(tuple[1]);
                    } else {
                        lng = parseFloat(tuple[0]);
                        lat = parseFloat(tuple[1]);
                    }
                    console.log(`[GeoJSON] Instance ${instance.id}: extracted lat=${lat}, lng=${lng}`);
                } else {
                    console.warn(`[GeoJSON] Instance ${instance.id}: tuple not a valid array after parse:`, tuple, `isArray=${Array.isArray(tuple)}, length=${tuple?.length}`);
                }
            } else if (gc.coordinateMode === 'separate') {
                if (gc.latitudeVariable) lat = parseFloat(instance[gc.latitudeVariable]);
                if (gc.longitudeVariable) lng = parseFloat(instance[gc.longitudeVariable]);
                console.log(`[GeoJSON] Instance ${instance.id}: separate mode lat=${lat}, lng=${lng}`);
            } else if ((gc.coordinateMode === 'line_center' || gc.coordinateMode === 'polygon_center') && gc.geometryVariable) {
                let geomVal = instance[gc.geometryVariable];
                console.log(`[GeoJSON] Instance ${instance.id}: raw geometry value =`, geomVal, `(type: ${typeof geomVal})`);
                if (typeof geomVal === 'string') {
                    try { geomVal = JSON.parse(geomVal); } catch { /* not valid JSON */ }
                }
                const center = this.extractGeometryCenter(geomVal, gc.coordinateMode);
                if (center) {
                    lng = center[0];
                    lat = center[1];
                }
                console.log(`[GeoJSON] Instance ${instance.id}: geometry center lat=${lat}, lng=${lng}`);
            } else {
                console.warn(`[GeoJSON] Instance ${instance.id}: no matching coordinateMode. mode=${gc.coordinateMode}, tupleVar=${gc.tupleVariable}, geomVar=${gc.geometryVariable}`);
            }

            if (lng != null && lat != null && !isNaN(lng) && !isNaN(lat)) {
                const instanceId = instance.id || instance._id || instance._instanceId || '';
                const idStr = String(instanceId);

                // Only stamp override properties when an explicit override exists
                const featureMarker = featureMarkerOverrides?.get(idStr);
                const featureViewRange = featureViewRangeOverrides?.get(idStr);

                const props: any = { ...instance };
                if (featureMarker) {
                    props._markerIconName = featureMarker.iconName;
                    props._markerStyleName = featureMarker.styleName;
                }
                if (featureViewRange) {
                    props._minZoom = featureViewRange.minZoom;
                    props._maxZoom = featureViewRange.maxZoom;
                }

                features.push({
                    type: 'Feature',
                    geometry: {
                        type: 'Point',
                        coordinates: [lng, lat]
                    },
                    properties: props
                });
            }
        }

        // Build collection output — only include override fields when explicitly set
        const defaultDef = this.getMarkerDef();
        const result: any = {
            type: 'FeatureCollection',
            features,
            _markerDefaults: {
                configDefault: { iconName: defaultDef.iconName, styleName: defaultDef.styleName }
            }
        };

        if (collectionMarker) {
            result._markerIconName = collectionMarker.iconName;
            result._markerStyleName = collectionMarker.styleName;
        }
        if (collectionViewRange) {
            result._minZoom = collectionViewRange.minZoom;
            result._maxZoom = collectionViewRange.maxZoom;
        }

        return result;
    }

    /**
     * Extract the center [lng, lat] from a geometry variable's JSON value.
     * For polygon_center: reads center_lng/center_lat + offsets from the stored polygon data.
     * For line_center: averages the referenced points' coordinates from the stored line data.
     *
     * The geometry variable stores JSON like:
     *   { ref_class: "City", instance_ids: ["id1","id2"], style_name: "..." }
     * or the direct polygon data with center fields.
     */
    private extractGeometryCenter(rawValue: any, mode: string): [number, number] | null {
        if (!rawValue) return null;
        try {
            const parsed = typeof rawValue === 'string' ? JSON.parse(rawValue) : rawValue;

            if (mode === 'polygon_center') {
                // Try stored center_lng/center_lat + offsets first
                const cLng = parseFloat(parsed.center_lng);
                const cLat = parseFloat(parsed.center_lat);
                if (!isNaN(cLng) && !isNaN(cLat) && (cLng !== 0 || cLat !== 0)) {
                    const offLng = parseFloat(parsed.center_offset_lng) || 0;
                    const offLat = parseFloat(parsed.center_offset_lat) || 0;
                    return [cLng + offLng, cLat + offLat];
                }
                // Fallback: compute center from stored vertices
                if (parsed.vertices && Array.isArray(parsed.vertices) && parsed.vertices.length >= 3) {
                    const verts = parsed.vertices as [number, number][];
                    const avgLng = verts.reduce((s: number, v: [number, number]) => s + v[0], 0) / verts.length;
                    const avgLat = verts.reduce((s: number, v: [number, number]) => s + v[1], 0) / verts.length;
                    return [avgLng, avgLat];
                }
            }

            if (mode === 'line_center') {
                // Try stored center first
                const cLng = parseFloat(parsed.center_lng);
                const cLat = parseFloat(parsed.center_lat);
                if (!isNaN(cLng) && !isNaN(cLat) && (cLng !== 0 || cLat !== 0)) {
                    return [cLng, cLat];
                }
                // Fallback: compute midpoint from stored vertices
                if (parsed.vertices && Array.isArray(parsed.vertices) && parsed.vertices.length >= 2) {
                    const verts = parsed.vertices as [number, number][];
                    const avgLng = verts.reduce((s: number, v: [number, number]) => s + v[0], 0) / verts.length;
                    const avgLat = verts.reduce((s: number, v: [number, number]) => s + v[1], 0) / verts.length;
                    return [avgLng, avgLat];
                }
            }
        } catch { /* invalid JSON */ }
        return null;
    }

    /**
     * Extract [lng, lat] coordinates from an instance using a given GeoJSON config.
     * This is the public counterpart of extractGeometryCenter — it handles
     * tuple, separate, and geometry center modes.
     */
    extractCoordinates(instance: any, gc: GeoJsonConfigData): [number, number] | null {
        let lng: number | null = null;
        let lat: number | null = null;

        if (gc.coordinateMode === 'tuple' && gc.tupleVariable) {
            let tuple = instance[gc.tupleVariable];
            console.log(`[GeoJSON extractCoordinates] Instance ${instance.id}: raw=${JSON.stringify(tuple)} (type: ${typeof tuple})`);
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

        if (lng != null && lat != null && !isNaN(lng) && !isNaN(lat)) {
            return [lng, lat];
        }
        return null;
    }

    /**
     * Gets the SVG marker definition by name, falling back to default.
     */
    getMarkerDef(name?: string): SvgMarkerDefinition {
        const gc = this.geoJsonConfig;
        const targetName = name || gc.defaultMarkerName;
        return gc.svgMarkers.find(m => m.name === targetName)
            || gc.svgMarkers[0]
            || DEFAULT_SVG_MARKER;
    }

    /**
     * Resolves a marker definition into a fully styled SVG string + style properties.
     * This is the primary method used by renderers.
     */
    getMarker(name?: string): { svgString: string; style: SvgIconStyle } {
        const def = this.getMarkerDef(name);
        const icon = getSvgIcon(def.iconName);
        const style = getSvgStyle(def.styleName);

        const fallbackStyle: SvgIconStyle = {
            name: 'fallback', label: 'Fallback',
            width: 24, height: 36, anchor: 'bottom',
            fillColor: '#3f51b5', strokeColor: '#1a237e', strokeWidth: 1
        };

        const resolvedStyle = style || fallbackStyle;
        const baseSvg = icon?.svgString || '<svg viewBox="0 0 24 36" xmlns="http://www.w3.org/2000/svg"><path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 24 12 24s12-15 12-24C24 5.4 18.6 0 12 0z" fill="currentColor"/><circle cx="12" cy="12" r="5" fill="white"/></svg>';

        return {
            svgString: applyStyleToSvg(baseSvg, resolvedStyle),
            style: resolvedStyle
        };
    }
}
