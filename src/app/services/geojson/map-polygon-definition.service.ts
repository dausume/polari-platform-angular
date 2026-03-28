import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, forkJoin } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { PolariService } from '@services/polari-service';
import { MapPolygonDefinition, MapPolygonSummary } from '@models/geojson/MapPolygonDefinition';
import { MapPointDefinition } from '@models/geojson/MapPointDefinition';
import { MapLineSegmentDefinition } from '@models/geojson/MapLineSegmentDefinition';
import { MapPointDefinitionService } from './map-point-definition.service';
import { MapLineSegmentDefinitionService } from './map-line-segment-definition.service';

@Injectable({ providedIn: 'root' })
export class MapPolygonDefinitionService {

    polygonList$ = new BehaviorSubject<MapPolygonSummary[]>([]);
    loading$ = new BehaviorSubject<boolean>(false);

    private readonly className = 'MapPolygonDefinition';

    constructor(
        private http: HttpClient,
        private polariService: PolariService,
        private pointService: MapPointDefinitionService,
        private segmentService: MapLineSegmentDefinitionService
    ) {}

    private get baseUrl(): string {
        return `${this.polariService.getBackendBaseUrl()}/${this.className}`;
    }

    fetchAll(): void {
        this.loading$.next(true);
        this.http.get<any>(this.baseUrl, this.polariService.backendRequestOptions).subscribe({
            next: (response: any) => {
                const items = this.parseReadAllResponse(response);
                const summaries: MapPolygonSummary[] = items.map((item: any) => ({
                    id: item.id,
                    name: item.name || '',
                    composition_mode: item.composition_mode || 'points'
                }));
                this.polygonList$.next(summaries);
                this.loading$.next(false);
            },
            error: (err: any) => {
                console.error('[MapPolygonDefinitionService] Failed to fetch:', err);
                this.polygonList$.next([]);
                this.loading$.next(false);
            }
        });
    }

    fetchAllResolved(): Observable<MapPolygonDefinition[]> {
        return forkJoin([
            this.http.get<any>(this.baseUrl, this.polariService.backendRequestOptions),
            this.pointService.fetchAllAsMap(),
            this.segmentService.fetchAllResolved()
        ]).pipe(
            map(([response, pointsMap, segments]: [any, Map<string, MapPointDefinition>, MapLineSegmentDefinition[]]) => {
                const segmentsMap = new Map<string, MapLineSegmentDefinition>();
                segments.forEach(s => segmentsMap.set(s.id, s));

                const items = this.parseReadAllResponse(response);
                return items.map((item: any) => {
                    const poly = MapPolygonDefinition.fromBackend(item);
                    if (poly.composition_mode === 'points') {
                        poly.resolveFromPoints(pointsMap);
                    } else {
                        poly.resolveFromSegments(segmentsMap, pointsMap);
                    }
                    return poly;
                });
            })
        );
    }

    create(
        name: string,
        compositionMode: string = 'points',
        vertexPointIds: string[] = [],
        boundarySegmentIds: string[] = [],
        styleName: string = 'default-polygon'
    ): Observable<any> {
        const formData = new FormData();
        formData.append('initParamSets', JSON.stringify([{
            name,
            composition_mode: compositionMode,
            vertex_point_ids: JSON.stringify(vertexPointIds),
            boundary_segment_ids: JSON.stringify(boundarySegmentIds),
            style_name: styleName
        }]));
        return this.http.post(this.baseUrl, formData).pipe(
            tap(() => this.fetchAll())
        );
    }

    update(id: string, updateData: Record<string, any>): Observable<any> {
        const formData = new FormData();
        formData.append('polariId', id);
        if (updateData['vertex_point_ids'] && Array.isArray(updateData['vertex_point_ids'])) {
            updateData['vertex_point_ids'] = JSON.stringify(updateData['vertex_point_ids']);
        }
        if (updateData['boundary_segment_ids'] && Array.isArray(updateData['boundary_segment_ids'])) {
            updateData['boundary_segment_ids'] = JSON.stringify(updateData['boundary_segment_ids']);
        }
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
