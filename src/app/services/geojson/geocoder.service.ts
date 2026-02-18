import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError, of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { GeocoderDefinitionService } from './geocoder-definition.service';
import { GeocoderDefinition, GeocoderResult } from '@models/geojson/GeocoderDefinition';

@Injectable({ providedIn: 'root' })
export class GeocoderService {

    /** Per-geocoder last-request timestamp for client-side rate limiting */
    private lastRequestTime: Map<string, number> = new Map();

    constructor(
        private http: HttpClient,
        private geocoderDefService: GeocoderDefinitionService
    ) {}

    forwardGeocode(query: string, geocoderId?: string): Observable<GeocoderResult[]> {
        return this.resolveGeocoder(geocoderId).pipe(
            switchMap(def => {
                const blocked = this.checkRateLimit(def);
                if (blocked) return throwError(() => new Error('Rate limit: please wait before searching again.'));
                this.recordRequest(def);
                return this.dispatchForwardGeocode(def, query);
            })
        );
    }

    reverseGeocode(lat: number, lng: number, geocoderId?: string): Observable<GeocoderResult[]> {
        return this.resolveGeocoder(geocoderId).pipe(
            switchMap(def => {
                const blocked = this.checkRateLimit(def);
                if (blocked) return throwError(() => new Error('Rate limit: please wait before searching again.'));
                this.recordRequest(def);
                return this.dispatchReverseGeocode(def, lat, lng);
            })
        );
    }

    // ==================== Provider dispatch ====================

    private dispatchForwardGeocode(def: GeocoderDefinition, query: string): Observable<GeocoderResult[]> {
        switch (def.provider) {
            case 'pelias':
                return this.peliasForward(def.baseUrl, query);
            case 'nominatim':
                return this.nominatimForward(def.baseUrl, query);
            case 'google-maps':
                return this.googleForward(def.baseUrl, query, def.apiKey);
            default:
                return throwError(() => new Error(`Unknown geocoder provider: ${def.provider}`));
        }
    }

    private dispatchReverseGeocode(def: GeocoderDefinition, lat: number, lng: number): Observable<GeocoderResult[]> {
        switch (def.provider) {
            case 'pelias':
                return this.peliasReverse(def.baseUrl, lat, lng);
            case 'nominatim':
                return this.nominatimReverse(def.baseUrl, lat, lng);
            case 'google-maps':
                return this.googleReverse(def.baseUrl, lat, lng, def.apiKey);
            default:
                return throwError(() => new Error(`Unknown geocoder provider: ${def.provider}`));
        }
    }

    // ==================== Pelias ====================

    private peliasForward(baseUrl: string, query: string): Observable<GeocoderResult[]> {
        const url = `${baseUrl}/search?text=${encodeURIComponent(query)}`;
        return this.http.get<any>(url).pipe(
            map(response => this.parsePeliasResponse(response))
        );
    }

    private peliasReverse(baseUrl: string, lat: number, lng: number): Observable<GeocoderResult[]> {
        const url = `${baseUrl}/reverse?point.lat=${lat}&point.lon=${lng}`;
        return this.http.get<any>(url).pipe(
            map(response => this.parsePeliasResponse(response))
        );
    }

    private parsePeliasResponse(response: any): GeocoderResult[] {
        if (!response?.features) return [];
        return response.features.map((f: any) => ({
            displayName: f.properties?.label || f.properties?.name || 'Unknown',
            lat: f.geometry?.coordinates?.[1] ?? 0,
            lng: f.geometry?.coordinates?.[0] ?? 0,
            confidence: f.properties?.confidence,
            bbox: f.bbox
        }));
    }

    // ==================== Nominatim ====================

    private nominatimForward(baseUrl: string, query: string): Observable<GeocoderResult[]> {
        const url = `${baseUrl}/search?q=${encodeURIComponent(query)}&format=json&limit=5`;
        return this.http.get<any[]>(url).pipe(
            map(results => this.parseNominatimResponse(results))
        );
    }

    private nominatimReverse(baseUrl: string, lat: number, lng: number): Observable<GeocoderResult[]> {
        const url = `${baseUrl}/reverse?lat=${lat}&lon=${lng}&format=json`;
        return this.http.get<any>(url).pipe(
            map(result => {
                if (!result || result.error) return [];
                return [{
                    displayName: result.display_name || 'Unknown',
                    lat: parseFloat(result.lat),
                    lng: parseFloat(result.lon),
                    bbox: result.boundingbox
                        ? [
                            parseFloat(result.boundingbox[2]),
                            parseFloat(result.boundingbox[0]),
                            parseFloat(result.boundingbox[3]),
                            parseFloat(result.boundingbox[1])
                          ] as [number, number, number, number]
                        : undefined
                }];
            })
        );
    }

    private parseNominatimResponse(results: any[]): GeocoderResult[] {
        if (!Array.isArray(results)) return [];
        return results.map(r => ({
            displayName: r.display_name || 'Unknown',
            lat: parseFloat(r.lat),
            lng: parseFloat(r.lon),
            bbox: r.boundingbox
                ? [
                    parseFloat(r.boundingbox[2]),
                    parseFloat(r.boundingbox[0]),
                    parseFloat(r.boundingbox[3]),
                    parseFloat(r.boundingbox[1])
                  ] as [number, number, number, number]
                : undefined
        }));
    }

    // ==================== Google Maps ====================

    private googleForward(baseUrl: string, query: string, apiKey: string): Observable<GeocoderResult[]> {
        const url = `${baseUrl}/json?address=${encodeURIComponent(query)}&key=${apiKey}`;
        return this.http.get<any>(url).pipe(
            map(response => this.parseGoogleResponse(response))
        );
    }

    private googleReverse(baseUrl: string, lat: number, lng: number, apiKey: string): Observable<GeocoderResult[]> {
        const url = `${baseUrl}/json?latlng=${lat},${lng}&key=${apiKey}`;
        return this.http.get<any>(url).pipe(
            map(response => this.parseGoogleResponse(response))
        );
    }

    private parseGoogleResponse(response: any): GeocoderResult[] {
        if (!response?.results) return [];
        return response.results.slice(0, 5).map((r: any) => ({
            displayName: r.formatted_address || 'Unknown',
            lat: r.geometry?.location?.lat ?? 0,
            lng: r.geometry?.location?.lng ?? 0,
            bbox: r.geometry?.viewport
                ? [
                    r.geometry.viewport.southwest.lng,
                    r.geometry.viewport.southwest.lat,
                    r.geometry.viewport.northeast.lng,
                    r.geometry.viewport.northeast.lat
                  ] as [number, number, number, number]
                : undefined
        }));
    }

    // ==================== Helpers ====================

    private resolveGeocoder(geocoderId?: string): Observable<GeocoderDefinition> {
        if (geocoderId) {
            return this.geocoderDefService.loadDefinition(geocoderId);
        }
        // Use the first available geocoder
        const all = this.geocoderDefService.allGeocoders$.value;
        if (all.length === 0) {
            return throwError(() => new Error('No geocoders configured. Please create one in the GeoJSON settings.'));
        }
        return this.geocoderDefService.loadDefinition(all[0].id);
    }

    private checkRateLimit(def: GeocoderDefinition): boolean {
        if (def.rateLimit == null) return false;
        const last = this.lastRequestTime.get(def.id);
        if (!last) return false;
        const minInterval = 1000 / def.rateLimit;
        return (Date.now() - last) < minInterval;
    }

    private recordRequest(def: GeocoderDefinition): void {
        this.lastRequestTime.set(def.id, Date.now());
    }
}
