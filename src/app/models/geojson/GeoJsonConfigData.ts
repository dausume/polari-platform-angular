/**
 * How geographic coordinates are specified on instances of the class.
 * - 'tuple': A single variable holds a [lat,lng] or [lng,lat] array/tuple
 * - 'separate': Latitude and longitude are stored in separate variables
 * - 'parent': Coordinates come from a parent GeoJSON-enabled class
 */
export type CoordinateMode = 'tuple' | 'separate' | 'parent';

/**
 * Coordinate ordering convention for tuple mode.
 * - 'lat-lng': [latitude, longitude] — common in GPS/geographic systems
 * - 'lng-lat': [longitude, latitude] — GeoJSON standard (RFC 7946)
 */
export type TupleOrder = 'lat-lng' | 'lng-lat';

/**
 * Where the marker anchor point attaches to the geographic coordinate.
 * - 'center': The center of the SVG aligns with the point
 * - 'bottom': The bottom-center of the SVG aligns with the point (typical for pin markers)
 */
export type MarkerAnchor = 'center' | 'bottom';

/**
 * Tile source type.
 * - 'tileserver': Standard raster tile server using {z}/{x}/{y} URL pattern (mbTiles)
 * - 's3-bucket': PMTiles file hosted on S3 or similar storage
 */
export type TileSourceType = 'tileserver' | 's3-bucket';

/**
 * Configuration for a tile data source used by the map.
 */
export interface TileSourceConfig {
    /** Tile source type */
    type: TileSourceType;
    /** Human-readable name for this tile source */
    name: string;
    /** Tile URL — for tileserver: pattern like https://host/{z}/{x}/{y}.png; for s3-bucket: URL to .pmtiles file */
    url: string;
    /** Attribution / citation text (HTML allowed) */
    attribution: string;
    /** Optional default center [longitude, latitude] for this tile source */
    defaultCenter?: [number, number];
    /** Optional default zoom level for this tile source */
    defaultZoom?: number;
    /** Tile data format: 'raster' for PNG/JPEG tiles, 'vector' for PBF/MVT tiles. Defaults to 'raster'. */
    tileFormat?: 'raster' | 'vector';
    /** For vector tiles: the source layer name inside the tileset (default: 'default') */
    sourceLayer?: string;
}

/**
 * A named SVG marker definition with styling overrides.
 * These are class-level definitions, NOT per-instance.
 * Stored as part of the GeoJSON config definition JSON.
 */
export interface SvgMarkerDefinition {
    /** Unique name for this marker within the config */
    name: string;
    /** Raw SVG markup string */
    svgString: string;
    /** Display width in pixels */
    width: number;
    /** Display height in pixels */
    height: number;
    /** Where the coordinate point attaches to the marker */
    anchor: MarkerAnchor;
    /** Fill color override (applied to SVG fill attributes) */
    fillColor: string;
    /** Stroke color override (applied to SVG stroke attributes) */
    strokeColor: string;
    /** Stroke width override */
    strokeWidth: number;
}

/**
 * Initial map view options for the MapLibre map instance.
 */
export interface MapViewOptions {
    /** Center coordinates [longitude, latitude] — MapLibre uses lng-lat order */
    center: [number, number];
    /** Initial zoom level (0-24) */
    zoom: number;
    /** Optional minimum zoom level (0-24). If set, map cannot zoom out beyond this level. */
    minZoom?: number;
    /** Optional maximum zoom level (0-24). If set, map cannot zoom in beyond this level. */
    maxZoom?: number;
    /** @deprecated Use tileSource instead. Kept for backwards compatibility. */
    style: string;
    /** Tile source configuration — replaces the style URL */
    tileSource?: TileSourceConfig;
}

/**
 * The complete GeoJSON configuration data that gets serialized
 * into the definition JSON field on the backend.
 */
export interface GeoJsonConfigData {
    /** How coordinates are specified: single tuple variable or separate lat/lng variables */
    coordinateMode: CoordinateMode;
    /** If mode is 'tuple': which class variable holds the coordinate tuple */
    tupleVariable: string;
    /** If mode is 'tuple': the ordering of coordinates in the tuple */
    tupleOrder: TupleOrder;
    /** If mode is 'separate': the class variable holding latitude values */
    latitudeVariable: string;
    /** If mode is 'separate': the class variable holding longitude values */
    longitudeVariable: string;
    /** Array of named SVG marker definitions */
    svgMarkers: SvgMarkerDefinition[];
    /** Name of the default SVG marker to use (references svgMarkers[].name) */
    defaultMarkerName: string;
    /** If mode is 'parent': the class name of the parent GeoJSON-enabled object */
    parentGeoClass: string;
    /** Initial map view settings */
    mapOptions: MapViewOptions;
}

export const DEFAULT_SVG_MARKER: SvgMarkerDefinition = {
    name: 'default-pin',
    svgString: '<svg width="24" height="36" viewBox="0 0 24 36" xmlns="http://www.w3.org/2000/svg">'
        + '<path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 24 12 24s12-15 12-24C24 5.4 18.6 0 12 0z" />'
        + '<circle cx="12" cy="12" r="5" fill="white" />'
        + '</svg>',
    width: 24,
    height: 36,
    anchor: 'bottom',
    fillColor: '#3f51b5',
    strokeColor: '#1a237e',
    strokeWidth: 1
};

export const DEFAULT_TILE_SOURCE: TileSourceConfig = {
    type: 'tileserver',
    name: 'OpenStreetMap',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
};

export const DEFAULT_MAP_VIEW: MapViewOptions = {
    center: [-98.5795, 39.8283],
    zoom: 4,
    style: 'https://demotiles.maplibre.org/style.json',
    tileSource: { ...DEFAULT_TILE_SOURCE }
};

export const OSM_RASTER_STYLE: any = {
    version: 8,
    sources: {
        'osm-tiles': {
            type: 'raster',
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }
    },
    layers: [
        {
            id: 'osm-tiles-layer',
            type: 'raster',
            source: 'osm-tiles',
            minzoom: 0,
            maxzoom: 19
        }
    ]
};

/**
 * Builds a MapLibre style object from a TileSourceConfig.
 */
export function buildStyleFromTileSource(tileSource: TileSourceConfig): any {
    if (tileSource.type === 'tileserver') {
        return {
            version: 8,
            sources: {
                'tile-source': {
                    type: 'raster',
                    tiles: [tileSource.url],
                    tileSize: 256,
                    attribution: tileSource.attribution || ''
                }
            },
            layers: [
                {
                    id: 'tile-layer',
                    type: 'raster',
                    source: 'tile-source',
                    minzoom: 0,
                    maxzoom: 22
                }
            ]
        };
    } else {
        // s3-bucket / pmTiles
        return {
            version: 8,
            sources: {
                'pmtiles-source': {
                    type: 'raster',
                    url: `pmtiles://${tileSource.url}`,
                    tileSize: 256,
                    attribution: tileSource.attribution || ''
                }
            },
            layers: [
                {
                    id: 'pmtiles-layer',
                    type: 'raster',
                    source: 'pmtiles-source',
                    minzoom: 0,
                    maxzoom: 22
                }
            ]
        };
    }
}

/** Color palette for auto-coloring vector tile layers */
const VECTOR_LAYER_COLORS = ['#e6194b', '#3cb44b', '#4363d8', '#f58231', '#911eb4', '#42d4f4', '#f032e6', '#bfef45'];

/**
 * Builds a single MapLibre style from multiple tile sources, compositing them as layers.
 * Handles both raster tiles (PNG/JPEG) and vector tiles (PBF from tippecanoe).
 */
export function buildStyleFromMultipleSources(tileSources: TileSourceConfig[], backendBaseUrl?: string): any {
    console.log('[buildStyleFromMultipleSources] Called with', tileSources.length, 'sources, backendBaseUrl=', backendBaseUrl);
    const sources: any = {};
    const layers: any[] = [];
    for (let i = 0; i < tileSources.length; i++) {
        const src = tileSources[i];
        const slug = src.name.replace(/\s+/g, '-');
        const sourceId = `source-${i}-${slug}`;
        const isVector = src.tileFormat === 'vector';
        console.log(`[buildStyleFromMultipleSources] [${i}] name="${src.name}" type="${src.type}" tileFormat="${src.tileFormat}" isVector=${isVector} url="${src.url}" sourceLayer="${src.sourceLayer}"`);

        if (isVector) {
            // Vector tiles from tippecanoe (.mbtiles served by backend)
            let tileUrl = src.url;
            // If the URL is relative (starts with /), prepend the backend base URL
            if (tileUrl.startsWith('/') && backendBaseUrl) {
                tileUrl = backendBaseUrl + tileUrl;
            }
            console.log(`[buildStyleFromMultipleSources] [${i}] VECTOR: resolved tileUrl="${tileUrl}"`);
            sources[sourceId] = {
                type: 'vector',
                tiles: [tileUrl],
                maxzoom: 14
            };
            const sourceLayer = src.sourceLayer || 'default';
            const color = VECTOR_LAYER_COLORS[i % VECTOR_LAYER_COLORS.length];
            // Add circle layer for point features
            layers.push({
                id: `${sourceId}-circles`,
                type: 'circle',
                source: sourceId,
                'source-layer': sourceLayer,
                paint: {
                    'circle-radius': 6,
                    'circle-color': color,
                    'circle-stroke-color': '#ffffff',
                    'circle-stroke-width': 1.5
                },
                minzoom: 0,
                maxzoom: 22
            });
            // Add line layer for line features
            layers.push({
                id: `${sourceId}-lines`,
                type: 'line',
                source: sourceId,
                'source-layer': sourceLayer,
                filter: ['==', '$type', 'LineString'],
                paint: {
                    'line-color': color,
                    'line-width': 2
                },
                minzoom: 0,
                maxzoom: 22
            });
            // Add fill layer for polygon features
            layers.push({
                id: `${sourceId}-fills`,
                type: 'fill',
                source: sourceId,
                'source-layer': sourceLayer,
                filter: ['==', '$type', 'Polygon'],
                paint: {
                    'fill-color': color,
                    'fill-opacity': 0.3
                },
                minzoom: 0,
                maxzoom: 22
            });
        } else {
            // Raster tiles (OSM, standard tile servers)
            const layerId = `layer-${i}-${slug}`;
            if (src.type === 'tileserver') {
                sources[sourceId] = { type: 'raster', tiles: [src.url], tileSize: 256, attribution: src.attribution || '' };
            } else {
                sources[sourceId] = { type: 'raster', url: `pmtiles://${src.url}`, tileSize: 256, attribution: src.attribution || '' };
            }
            layers.push({ id: layerId, type: 'raster', source: sourceId, minzoom: 0, maxzoom: 22 });
        }
    }
    const result = { version: 8, sources, layers };
    console.log('[buildStyleFromMultipleSources] Final style:', JSON.stringify(result, null, 2));
    return result;
}

export const DEFAULT_GEOJSON_CONFIG: GeoJsonConfigData = {
    coordinateMode: 'separate',
    tupleVariable: '',
    tupleOrder: 'lng-lat',
    latitudeVariable: '',
    longitudeVariable: '',
    parentGeoClass: '',
    svgMarkers: [{ ...DEFAULT_SVG_MARKER }],
    defaultMarkerName: 'default-pin',
    mapOptions: { ...DEFAULT_MAP_VIEW }
};
