import { MapPointDefinition } from './MapPointDefinition';

export interface MapLineSegmentSummary {
    id: string;
    name: string;
    start_point_id: string;
    end_point_id: string;
}

export class MapLineSegmentDefinition {
    id: string;
    name: string;
    start_point_id: string;
    end_point_id: string;
    style_name: string;

    startPoint: MapPointDefinition | null = null;
    endPoint: MapPointDefinition | null = null;

    constructor(id: string, name: string, startPointId: string, endPointId: string) {
        this.id = id;
        this.name = name;
        this.start_point_id = startPointId;
        this.end_point_id = endPointId;
        this.style_name = 'default-line';
    }

    resolvePoints(pointsMap: Map<string, MapPointDefinition>): void {
        this.startPoint = pointsMap.get(this.start_point_id) || null;
        this.endPoint = pointsMap.get(this.end_point_id) || null;
    }

    isResolved(): boolean {
        return this.startPoint !== null && this.endPoint !== null;
    }

    toGeoJsonFeature(): GeoJSON.Feature | null {
        if (!this.startPoint || !this.endPoint) return null;
        return {
            type: 'Feature',
            geometry: {
                type: 'LineString',
                coordinates: [
                    this.startPoint.toLngLat(),
                    this.endPoint.toLngLat()
                ]
            },
            properties: {
                id: this.id,
                name: this.name,
                start_point_id: this.start_point_id,
                end_point_id: this.end_point_id,
                _lineStyleName: this.style_name,
                _geometryType: 'line'
            }
        };
    }

    static fromBackend(obj: any): MapLineSegmentDefinition {
        const seg = new MapLineSegmentDefinition(
            obj.id || '',
            obj.name || '',
            obj.start_point_id || '',
            obj.end_point_id || ''
        );
        seg.style_name = obj.style_name || 'default-line';
        return seg;
    }
}
