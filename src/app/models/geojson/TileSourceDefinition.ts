import { TileSourceType, TileSourceConfig, DEFAULT_TILE_SOURCE } from './GeoJsonConfigData';

export interface TileSourceSummary {
    id: string;
    name: string;
    type: TileSourceType;
}

export class TileSourceDefinition {
    id: string;
    name: string;
    type: TileSourceType;
    url: string;
    attribution: string;
    defaultCenter: [number, number] | null;
    defaultZoom: number | null;

    constructor(id: string, name: string, type: TileSourceType) {
        this.id = id;
        this.name = name;
        this.type = type;
        this.url = '';
        this.attribution = '';
        this.defaultCenter = null;
        this.defaultZoom = null;
    }

    toTileSourceConfig(): TileSourceConfig {
        const config: TileSourceConfig = {
            type: this.type,
            name: this.name,
            url: this.url,
            attribution: this.attribution
        };
        if (this.defaultCenter) {
            config.defaultCenter = [...this.defaultCenter] as [number, number];
        }
        if (this.defaultZoom != null) {
            config.defaultZoom = this.defaultZoom;
        }
        return config;
    }

    toDefinitionJSON(): string {
        return JSON.stringify({
            type: this.type,
            url: this.url,
            attribution: this.attribution,
            defaultCenter: this.defaultCenter,
            defaultZoom: this.defaultZoom
        });
    }

    static fromBackend(backendObj: any): TileSourceDefinition {
        const def = new TileSourceDefinition(
            backendObj.id || '',
            backendObj.name || '',
            backendObj.type || 'tileserver'
        );

        if (backendObj.definition && backendObj.definition !== '{}') {
            try {
                const parsed = typeof backendObj.definition === 'string'
                    ? JSON.parse(backendObj.definition)
                    : backendObj.definition;

                def.type = parsed.type || backendObj.type || 'tileserver';
                def.url = parsed.url || '';
                def.attribution = parsed.attribution || '';
                def.defaultCenter = parsed.defaultCenter || null;
                def.defaultZoom = parsed.defaultZoom != null ? parsed.defaultZoom : null;
            } catch (e) {
                console.warn('[TileSourceDefinition] Failed to parse definition:', e);
            }
        }

        return def;
    }
}
