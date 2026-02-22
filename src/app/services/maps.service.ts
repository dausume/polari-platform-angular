import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { PolariService } from '@services/polari-service';

export interface MappedObjectSummary {
    className: string;
    configId: string;
    configName: string;
    description: string;
    instanceCount: number;
    hasGeoJsonEndpoint: boolean;
}

export interface TileSource {
    type: 'class' | 'endpoint' | 'url';
    className?: string;
    geoJsonConfigId?: string;
    geoJsonConfigName?: string;
    instanceCount?: number;
    hasGeoJsonEndpoint?: boolean;
    endpointName?: string;
    endpointId?: string;
    url?: string;
}

export interface TileGenerationRequest {
    name: string;
    sources: TileSourceSelection[];
    options: TileOptions;
    outputMode: 'download' | 'minio';
    minioBucket?: string;
}

export interface TileSourceSelection {
    type: 'class' | 'endpoint' | 'url';
    className?: string;
    geoJsonConfigId?: string;
    endpointName?: string;
    url?: string;
}

export interface TileOptions {
    minZoom: number;
    maxZoom: number;
    layerName: string;
}

export interface GenerationJob {
    id: string;
    name: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
    progress: string;
    startedAt: number;
    completedAt: number | null;
    outputPath: string | null;
    downloadUrl: string | null;
    error: string | null;
}

export interface ObjectStorageStatus {
    connected: boolean;
    endpoint: string | null;
    secure: boolean;
    buckets: string[];
    error: string | null;
}

export interface MbtilesFile {
    bucket: string;
    name: string;
    size: number;
    lastModified: string | null;
    path: string;
}

@Injectable({ providedIn: 'root' })
export class MapsService {
    mappedObjects$ = new BehaviorSubject<MappedObjectSummary[]>([]);
    tileGeneratorSources$ = new BehaviorSubject<TileSource[]>([]);
    generationStatus$ = new BehaviorSubject<GenerationJob | null>(null);
    mbtilesFiles$ = new BehaviorSubject<MbtilesFile[]>([]);
    loading$ = new BehaviorSubject<boolean>(false);

    private readonly geoJsonDefClassName = 'GeoJsonDefinition';

    constructor(private http: HttpClient, private polariService: PolariService) {}

    private get baseUrl(): string {
        return this.polariService.getBackendBaseUrl();
    }

    fetchMappedObjects(): void {
        this.loading$.next(true);
        this.http.get<any>(
            `${this.baseUrl}/${this.geoJsonDefClassName}`,
            this.polariService.backendRequestOptions
        ).subscribe({
            next: (response: any) => {
                const items = this.parseReadAllResponse(response);
                const grouped: Map<string, MappedObjectSummary> = new Map();

                for (const item of items) {
                    const sourceClass = item.source_class || '';
                    if (!sourceClass) continue;

                    if (!grouped.has(sourceClass)) {
                        grouped.set(sourceClass, {
                            className: sourceClass,
                            configId: item.id || '',
                            configName: item.name || '',
                            description: item.description || '',
                            instanceCount: 0,
                            hasGeoJsonEndpoint: false
                        });
                    }
                }

                // Enrich with actual geoJson endpoint status from api-config
                this.http.get<any>(
                    `${this.baseUrl}/api-config`,
                    this.polariService.backendRequestOptions
                ).subscribe({
                    next: (configResp: any) => {
                        const classes = configResp?.classes || [];
                        for (const cls of classes) {
                            const name = cls.className;
                            if (grouped.has(name)) {
                                const formats = cls.apiFormats || {};
                                const geoJsonFmt = formats.geoJson || formats['geoJson'];
                                if (geoJsonFmt && geoJsonFmt.enabled) {
                                    grouped.get(name)!.hasGeoJsonEndpoint = true;
                                }
                            }
                        }
                        this.mappedObjects$.next(Array.from(grouped.values()));
                        this.loading$.next(false);
                    },
                    error: () => {
                        // If api-config fails, still emit what we have
                        this.mappedObjects$.next(Array.from(grouped.values()));
                        this.loading$.next(false);
                    }
                });
            },
            error: (err: any) => {
                console.error('[MapsService] Failed to fetch mapped objects:', err);
                this.mappedObjects$.next([]);
                this.loading$.next(false);
            }
        });
    }

    fetchTileGeneratorSources(): void {
        this.http.get<any>(
            `${this.baseUrl}/tile-generator/sources`,
            this.polariService.backendRequestOptions
        ).subscribe({
            next: (response: any) => {
                const sources = response?.sources || [];
                this.tileGeneratorSources$.next(sources);
            },
            error: (err: any) => {
                console.error('[MapsService] Failed to fetch tile sources:', err);
                this.tileGeneratorSources$.next([]);
            }
        });
    }

    generateTiles(request: TileGenerationRequest): Observable<any> {
        return this.http.post<any>(
            `${this.baseUrl}/tile-generator/generate`,
            request,
            this.polariService.backendRequestOptions
        ).pipe(
            tap((response: any) => {
                if (response?.jobId) {
                    this.pollJobStatus(response.jobId);
                }
            })
        );
    }

    checkGenerationStatus(jobId: string): Observable<GenerationJob> {
        return this.http.get<any>(
            `${this.baseUrl}/tile-generator/status/${jobId}`,
            this.polariService.backendRequestOptions
        ).pipe(
            map((response: any) => response?.job as GenerationJob)
        );
    }

    fetchObjectStorageStatus(): Observable<ObjectStorageStatus> {
        return this.http.get<ObjectStorageStatus>(
            `${this.baseUrl}/object-storage`,
            this.polariService.backendRequestOptions
        );
    }

    downloadTiles(jobId: string): void {
        const url = `${this.baseUrl}/tile-generator/download/${jobId}`;
        window.open(url, '_blank');
    }

    toggleGeoJsonFormat(className: string, enable: boolean): Observable<any> {
        const formData = { className, geoJson: enable };
        return this.http.put<any>(
            `${this.baseUrl}/api-config/formats`,
            formData,
            this.polariService.backendRequestOptions
        );
    }

    fetchMbtilesFiles(): void {
        this.http.get<any>(
            `${this.baseUrl}/tile-generator/mbtiles`,
            this.polariService.backendRequestOptions
        ).subscribe({
            next: (response: any) => {
                this.mbtilesFiles$.next(response?.files || []);
            },
            error: (err: any) => {
                console.error('[MapsService] Failed to fetch mbtiles files:', err);
                this.mbtilesFiles$.next([]);
            }
        });
    }

    private pollJobStatus(jobId: string): void {
        const interval = setInterval(() => {
            this.checkGenerationStatus(jobId).subscribe({
                next: (job: GenerationJob) => {
                    this.generationStatus$.next(job);
                    if (job.status === 'completed' || job.status === 'failed') {
                        clearInterval(interval);
                    }
                },
                error: () => clearInterval(interval)
            });
        }, 2000);
    }

    private parseReadAllResponse(response: any): any[] {
        let unwrapped = response;
        if (Array.isArray(response) && response.length === 1 && response[0] && response[0][this.geoJsonDefClassName]) {
            unwrapped = response[0];
        }
        if (unwrapped && unwrapped[this.geoJsonDefClassName]) {
            const classData = unwrapped[this.geoJsonDefClassName];
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
