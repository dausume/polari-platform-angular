import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, throwError } from 'rxjs';
import { map, tap, catchError } from 'rxjs/operators';
import { PolariService } from '@services/polari-service';
import { MapPointDefinition, MapPointSummary } from '@models/geojson/MapPointDefinition';

@Injectable({ providedIn: 'root' })
export class MapPointDefinitionService {

    pointList$ = new BehaviorSubject<MapPointSummary[]>([]);
    loading$ = new BehaviorSubject<boolean>(false);

    private readonly className = 'MapPointDefinition';

    constructor(private http: HttpClient, private polariService: PolariService) {}

    private get baseUrl(): string {
        return `${this.polariService.getBackendBaseUrl()}/${this.className}`;
    }

    fetchAll(): void {
        this.loading$.next(true);
        this.http.get<any>(this.baseUrl, this.polariService.backendRequestOptions).subscribe({
            next: (response: any) => {
                const items = this.parseReadAllResponse(response);
                const summaries: MapPointSummary[] = items.map((item: any) => ({
                    id: item.id,
                    name: item.name || '',
                    lat: parseFloat(item.lat) || 0,
                    lng: parseFloat(item.lng) || 0
                }));
                this.pointList$.next(summaries);
                this.loading$.next(false);
            },
            error: (err: any) => {
                console.error('[MapPointDefinitionService] Failed to fetch:', err);
                this.pointList$.next([]);
                this.loading$.next(false);
            }
        });
    }

    fetchAllAsMap(): Observable<Map<string, MapPointDefinition>> {
        return this.http.get<any>(this.baseUrl, this.polariService.backendRequestOptions).pipe(
            map((response: any) => {
                const items = this.parseReadAllResponse(response);
                const result = new Map<string, MapPointDefinition>();
                for (const item of items) {
                    const pt = MapPointDefinition.fromBackend(item);
                    result.set(pt.id, pt);
                }
                return result;
            })
        );
    }

    load(id: string): Observable<MapPointDefinition> {
        return this.http.get<any>(this.baseUrl, this.polariService.backendRequestOptions).pipe(
            map((response: any) => {
                const items = this.parseReadAllResponse(response);
                const obj = items.find((item: any) => item.id === id);
                if (!obj) throw new Error(`MapPointDefinition ${id} not found`);
                return MapPointDefinition.fromBackend(obj);
            })
        );
    }

    create(name: string, lat: number, lng: number, sourceClass: string = '', sourceInstanceId: string = ''): Observable<any> {
        const formData = new FormData();
        formData.append('initParamSets', JSON.stringify([{
            name, lat, lng, source_class: sourceClass, source_instance_id: sourceInstanceId
        }]));
        return this.http.post(this.baseUrl, formData).pipe(
            tap(() => this.fetchAll())
        );
    }

    update(id: string, updateData: Partial<{ name: string; lat: number; lng: number }>): Observable<any> {
        const formData = new FormData();
        formData.append('polariId', id);
        formData.append('updateData', JSON.stringify(updateData));
        return this.http.put(this.baseUrl, formData).pipe(
            tap(() => this.fetchAll())
        );
    }

    delete(id: string): Observable<any> {
        const formData = new FormData();
        formData.append('targetInstance', JSON.stringify({ id }));
        return this.http.request('DELETE', this.baseUrl, { body: formData });
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
