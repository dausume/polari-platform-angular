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
    tileFormat: 'raster' | 'vector';
    sourceLayer: string;

    constructor(id: string, name: string, type: TileSourceType) {
        this.id = id;
        this.name = name;
        this.type = type;
        this.url = '';
        this.attribution = '';
        this.defaultCenter = null;
        this.defaultZoom = null;
        this.tileFormat = 'raster';
        this.sourceLayer = 'default';
    }

    toTileSourceConfig(): TileSourceConfig {
        const config: TileSourceConfig = {
            type: this.type,
            name: this.name,
            url: this.url,
            attribution: this.attribution,
            tileFormat: this.tileFormat,
            sourceLayer: this.sourceLayer
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
            defaultZoom: this.defaultZoom,
            tileFormat: this.tileFormat,
            sourceLayer: this.sourceLayer
        });
    }

    static fromBackend(backendObj: any): TileSourceDefinition {
        console.log('[TileSourceDef.fromBackend] raw backendObj:', JSON.stringify(backendObj));
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

                console.log('[TileSourceDef.fromBackend] parsed definition:', JSON.stringify(parsed));

                // The definition's 'type' field may be 'vector'/'raster' (tile format)
                // while the top-level type is 'tileserver'/'s3-bucket' (source type).
                const parsedType = parsed.type || '';
                if (parsedType === 'vector' || parsedType === 'raster') {
                    def.tileFormat = parsedType;
                    def.type = backendObj.type || 'tileserver';
                } else {
                    def.type = parsedType || backendObj.type || 'tileserver';
                }
                def.url = parsed.url || '';
                def.attribution = parsed.attribution || '';
                def.defaultCenter = parsed.defaultCenter || null;
                def.defaultZoom = parsed.defaultZoom != null ? parsed.defaultZoom : null;
                if (parsed.tileFormat) {
                    def.tileFormat = parsed.tileFormat;
                }
                if (parsed.sourceLayer) {
                    def.sourceLayer = parsed.sourceLayer;
                }
            } catch (e) {
                console.warn('[TileSourceDefinition] Failed to parse definition:', e);
            }
        }

        console.log(`[TileSourceDef.fromBackend] result: name="${def.name}" type="${def.type}" tileFormat="${def.tileFormat}" url="${def.url}" sourceLayer="${def.sourceLayer}"`);
        return def;
    }
}
