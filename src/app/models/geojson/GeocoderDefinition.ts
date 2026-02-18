export type GeocoderType = 'self-hosted' | 'web-limited';
export type GeocoderProvider = 'pelias' | 'nominatim' | 'google-maps';

export interface GeocoderSummary {
    id: string;
    name: string;
    type: GeocoderType;
    provider: GeocoderProvider;
}

export interface GeocoderResult {
    displayName: string;
    lat: number;
    lng: number;
    confidence?: number;
    bbox?: [number, number, number, number];
}

export class GeocoderDefinition {
    id: string;
    name: string;
    type: GeocoderType;
    provider: GeocoderProvider;
    baseUrl: string;
    apiKey: string;
    rateLimit: number | null;

    constructor(id: string, name: string, type: GeocoderType, provider: GeocoderProvider) {
        this.id = id;
        this.name = name;
        this.type = type;
        this.provider = provider;
        this.baseUrl = GeocoderDefinition.defaultBaseUrl(provider);
        this.apiKey = '';
        this.rateLimit = GeocoderDefinition.defaultRateLimit(provider);
    }

    toDefinitionJSON(): string {
        return JSON.stringify({
            baseUrl: this.baseUrl,
            apiKey: this.apiKey,
            rateLimit: this.rateLimit
        });
    }

    static fromBackend(backendObj: any): GeocoderDefinition {
        const def = new GeocoderDefinition(
            backendObj.id || '',
            backendObj.name || '',
            backendObj.type || 'self-hosted',
            backendObj.provider || 'pelias'
        );

        if (backendObj.definition && backendObj.definition !== '{}') {
            try {
                const parsed = typeof backendObj.definition === 'string'
                    ? JSON.parse(backendObj.definition)
                    : backendObj.definition;

                def.baseUrl = parsed.baseUrl || GeocoderDefinition.defaultBaseUrl(def.provider);
                def.apiKey = parsed.apiKey || '';
                def.rateLimit = parsed.rateLimit != null ? parsed.rateLimit : GeocoderDefinition.defaultRateLimit(def.provider);
            } catch (e) {
                console.warn('[GeocoderDefinition] Failed to parse definition:', e);
            }
        }

        return def;
    }

    static defaultBaseUrl(provider: GeocoderProvider): string {
        switch (provider) {
            case 'pelias': return 'http://localhost:4000/v1';
            case 'nominatim': return 'https://nominatim.openstreetmap.org';
            case 'google-maps': return 'https://maps.googleapis.com/maps/api/geocode';
            default: return '';
        }
    }

    static defaultRateLimit(provider: GeocoderProvider): number | null {
        switch (provider) {
            case 'pelias': return null;
            case 'nominatim': return 1;
            case 'google-maps': return 50;
            default: return null;
        }
    }
}
