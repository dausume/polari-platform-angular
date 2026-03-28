import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, forkJoin } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { PolariService } from '@services/polari-service';
import { MapLineSegmentDefinition, MapLineSegmentSummary } from '@models/geojson/MapLineSegmentDefinition';
import { MapPointDefinition } from '@models/geojson/MapPointDefinition';
import { MapPointDefinitionService } from './map-point-definition.service';

@Injectable({ providedIn: 'root' })
export class MapLineSegmentDefinitionService {

    segmentList$ = new BehaviorSubject<MapLineSegmentSummary[]>([]);
    loading$ = new BehaviorSubject<boolean>(false);

    private readonly className = 'MapLineSegmentDefinition';

    constructor(
        private http: HttpClient,
        private polariService: PolariService,
        private pointService: MapPointDefinitionService
    ) {}

    private get baseUrl(): string {
        return `${this.polariService.getBackendBaseUrl()}/${this.className}`;
    }

    fetchAll(): void {
        this.loading$.next(true);
        this.http.get<any>(this.baseUrl, this.polariService.backendRequestOptions).subscribe({
            next: (response: any) => {
                const items = this.parseReadAllResponse(response);
                const summaries: MapLineSegmentSummary[] = items.map((item: any) => ({
                    id: item.id,
                    name: item.name || '',
                    start_point_id: item.start_point_id || '',
                    end_point_id: item.end_point_id || ''
                }));
                this.segmentList$.next(summaries);
                this.loading$.next(false);
            },
            error: (err: any) => {
                console.error('[MapLineSegmentDefinitionService] Failed to fetch:', err);
                this.segmentList$.next([]);
                this.loading$.next(false);
            }
        });
    }

    fetchAllResolved(): Observable<MapLineSegmentDefinition[]> {
        return forkJoin([
            this.http.get<any>(this.baseUrl, this.polariService.backendRequestOptions),
            this.pointService.fetchAllAsMap()
        ]).pipe(
            map(([response, pointsMap]: [any, Map<string, MapPointDefinition>]) => {
                const items = this.parseReadAllResponse(response);
                return items.map((item: any) => {
                    const seg = MapLineSegmentDefinition.fromBackend(item);
                    seg.resolvePoints(pointsMap);
                    return seg;
                });
            })
        );
    }

    create(name: string, startPointId: string, endPointId: string, styleName: string = 'default-line'): Observable<any> {
        const formData = new FormData();
        formData.append('initParamSets', JSON.stringify([{
            name, start_point_id: startPointId, end_point_id: endPointId, style_name: styleName
        }]));
        return this.http.post(this.baseUrl, formData).pipe(
            tap(() => this.fetchAll())
        );
    }

    update(id: string, updateData: Partial<{ name: string; start_point_id: string; end_point_id: string; style_name: string }>): Observable<any> {
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
