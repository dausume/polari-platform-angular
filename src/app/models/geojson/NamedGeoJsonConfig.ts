import {
    GeoJsonConfigData, DEFAULT_GEOJSON_CONFIG, DEFAULT_MAP_VIEW,
    DEFAULT_SVG_MARKER, DEFAULT_TILE_SOURCE, SvgMarkerDefinition
} from './GeoJsonConfigData';

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
     */
    buildFeatureCollection(instanceData: any[]): any {
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
                features.push({
                    type: 'Feature',
                    geometry: {
                        type: 'Point',
                        coordinates: [lng, lat]
                    },
                    properties: { ...instance }
                });
            }
        }

        return {
            type: 'FeatureCollection',
            features
        };
    }

    /**
     * Gets the SVG marker definition by name, falling back to default.
     */
    getMarker(name?: string): SvgMarkerDefinition {
        const gc = this.geoJsonConfig;
        const targetName = name || gc.defaultMarkerName;
        return gc.svgMarkers.find(m => m.name === targetName)
            || gc.svgMarkers[0]
            || DEFAULT_SVG_MARKER;
    }
}
