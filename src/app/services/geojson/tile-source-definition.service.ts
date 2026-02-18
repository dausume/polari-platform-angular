import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, throwError } from 'rxjs';
import { map, tap, catchError } from 'rxjs/operators';
import { PolariService } from '@services/polari-service';
import { TileSourceDefinition, TileSourceSummary } from '@models/geojson/TileSourceDefinition';
import { TileSourceType } from '@models/geojson/GeoJsonConfigData';

@Injectable({ providedIn: 'root' })
export class TileSourceDefinitionService {

    allSources$ = new BehaviorSubject<TileSourceSummary[]>([]);
    loading$ = new BehaviorSubject<boolean>(false);

    private readonly className = 'TileSourceDefinition';
    private cachedFull: TileSourceDefinition[] = [];

    constructor(private http: HttpClient, private polariService: PolariService) {}

    private get baseUrl(): string {
        return `${this.polariService.getBackendBaseUrl()}/${this.className}`;
    }

    fetchAll(): void {
        this.loading$.next(true);
        this.http.get<any>(this.baseUrl, this.polariService.backendRequestOptions).subscribe({
            next: (response: any) => {
                const items = this.parseReadAllResponse(response);
                this.cachedFull = items.map((item: any) => TileSourceDefinition.fromBackend(item));
                const summaries: TileSourceSummary[] = this.cachedFull.map(d => ({
                    id: d.id,
                    name: d.name,
                    type: d.type
                }));
                this.allSources$.next(summaries);
                this.loading$.next(false);
            },
            error: (err: any) => {
                console.error('[TileSourceDefinitionService] Failed to fetch:', err);
                this.allSources$.next([]);
                this.loading$.next(false);
            }
        });
    }

    getByType(type: TileSourceType): TileSourceSummary[] {
        return this.allSources$.value.filter(s => s.type === type);
    }

    loadDefinition(id: string): Observable<TileSourceDefinition> {
        // Try cache first
        const cached = this.cachedFull.find(d => d.id === id);
        if (cached) {
            return new Observable(obs => { obs.next(cached); obs.complete(); });
        }

        return this.http.get<any>(this.baseUrl, this.polariService.backendRequestOptions).pipe(
            map((response: any) => {
                const items = this.parseReadAllResponse(response);
                const backendObj = items.find((item: any) => item.id === id);
                if (!backendObj) {
                    throw new Error(`TileSourceDefinition ${id} not found`);
                }
                return TileSourceDefinition.fromBackend(backendObj);
            })
        );
    }

    createDefinition(name: string, type: TileSourceType, url: string, attribution: string): Observable<any> {
        const definition = JSON.stringify({ type, url, attribution, defaultCenter: null, defaultZoom: null });
        const formData = new FormData();
        formData.append('initParamSets', JSON.stringify([{ name, type, definition }]));
        return this.http.post(this.baseUrl, formData).pipe(
            tap(() => this.fetchAll()),
            map((response: any) => {
                const items = this.parseReadAllResponse(response);
                if (items.length > 0) return items[0];
                if (response && response[this.className]) {
                    const ids = Object.keys(response[this.className]);
                    if (ids.length > 0) return { id: ids[0], ...response[this.className][ids[0]] };
                }
                return response;
            })
        );
    }

    saveDefinition(def: TileSourceDefinition): Observable<any> {
        const formData = new FormData();
        formData.append('polariId', def.id);
        formData.append('updateData', JSON.stringify({
            name: def.name,
            type: def.type,
            definition: def.toDefinitionJSON()
        }));
        return this.http.put(this.baseUrl, formData).pipe(
            tap(() => this.fetchAll())
        );
    }

    deleteDefinition(id: string): Observable<any> {
        const formData = new FormData();
        formData.append('targetInstance', JSON.stringify({ id }));
        return this.http.request('DELETE', this.baseUrl, { body: formData }).pipe(
            tap(() => this.fetchAll())
        );
    }

    private parseReadAllResponse(response: any): any[] {
        let unwrapped = response;
        if (Array.isArray(response) && response.length === 1 && response[0] && response[0][this.className]) {
            unwrapped = response[0];
        }
        if (unwrapped && unwrapped[this.className]) {
            const classData = unwrapped[this.className];
            if (Array.isArray(classData)) {
                const instances: any[] = [];
                classData.forEach((dataSet: any) => {
                    if (dataSet.data && Array.isArray(dataSet.data)) {
                        instances.push(...dataSet.data);
                    } else if (dataSet.id !== undefined) {
                        instances.push(dataSet);
                    }
                });
                return instances;
            }
            const keys = Object.keys(classData);
            return keys.map(key => ({ id: key, ...classData[key] }));
        }
        if (Array.isArray(response)) return response;
        if (response && response.data && Array.isArray(response.data)) return response.data;
        return [];
    }
}
