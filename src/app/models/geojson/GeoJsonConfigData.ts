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
    /** Initial zoom level (0-22) */
    zoom: number;
    /** Map style URL (e.g., a free tile provider) */
    style: string;
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

export const DEFAULT_MAP_VIEW: MapViewOptions = {
    center: [-98.5795, 39.8283],
    zoom: 4,
    style: 'https://demotiles.maplibre.org/style.json'
};

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
