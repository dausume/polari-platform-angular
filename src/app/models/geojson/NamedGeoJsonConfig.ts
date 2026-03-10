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

        for (const instance of instanceData) {
            let lng: number | null = null;
            let lat: number | null = null;

            if (gc.coordinateMode === 'tuple' && gc.tupleVariable) {
                const tuple = instance[gc.tupleVariable];
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
