export interface MapPointSummary {
    id: string;
    name: string;
    lat: number;
    lng: number;
}

export class MapPointDefinition {
    id: string;
    name: string;
    lat: number;
    lng: number;
    source_class: string;
    source_instance_id: string;

    constructor(id: string, name: string, lat: number, lng: number) {
        this.id = id;
        this.name = name;
        this.lat = lat;
        this.lng = lng;
        this.source_class = '';
        this.source_instance_id = '';
    }

    toLngLat(): [number, number] {
        return [this.lng, this.lat];
    }

    toGeoJsonFeature(): GeoJSON.Feature {
        return {
            type: 'Feature',
            geometry: {
                type: 'Point',
                coordinates: [this.lng, this.lat]
            },
            properties: {
                id: this.id,
                name: this.name,
                source_class: this.source_class,
                source_instance_id: this.source_instance_id,
                _geometryType: 'point'
            }
        };
    }

    static fromBackend(obj: any): MapPointDefinition {
        const pt = new MapPointDefinition(
            obj.id || '',
            obj.name || '',
            parseFloat(obj.lat) || 0,
            parseFloat(obj.lng) || 0
        );
        pt.source_class = obj.source_class || '';
        pt.source_instance_id = obj.source_instance_id || '';
        return pt;
    }
}
