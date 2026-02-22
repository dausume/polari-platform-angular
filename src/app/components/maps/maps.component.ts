import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import {
    MapsService, MappedObjectSummary, TileSource,
    TileGenerationRequest, GenerationJob, MbtilesFile
} from '@services/maps.service';
import { TileSourceDefinitionService } from '@services/geojson/tile-source-definition.service';
import { TileSourceSummary, TileSourceDefinition } from '@models/geojson/TileSourceDefinition';
import { TileSourceConfig, buildStyleFromMultipleSources, DEFAULT_TILE_SOURCE } from '@models/geojson/GeoJsonConfigData';
import { NamedGeoJsonConfig } from '@models/geojson/NamedGeoJsonConfig';
import { PolariService } from '@services/polari-service';

@Component({
    selector: 'app-maps',
    standalone: false,
    templateUrl: './maps.component.html',
    styleUrls: ['./maps.component.scss']
})
export class MapsComponent implements OnInit, OnDestroy {
    // Tab state
    activeTab: 'mapped-objects' | 'tile-generator' | 'tile-sources' = 'mapped-objects';

    // Mapped Objects tab
    mappedObjects: MappedObjectSummary[] = [];
    loading: boolean = false;

    // Tile Generator tab
    tileGeneratorSources: TileSource[] = [];
    selectedSources: Set<number> = new Set();
    tilesetName: string = '';
    minZoom: number = 0;
    maxZoom: number = 14;
    layerName: string = 'default';
    bucketName: string = 'polari-tiles';
    outputMode: 'download' | 'minio' = 'download';
    objectStorageConnected: boolean = false;
    isGenerating: boolean = false;
    generationJob: GenerationJob | null = null;

    // Tile Sources tab
    tileSources: TileSourceSummary[] = [];
    tileSourceDefinitions: TileSourceDefinition[] = [];
    mbtilesFiles: MbtilesFile[] = [];
    tileSourcesLoading: boolean = false;

    // Multi-layer map preview
    selectedTileSourceIds: Set<string> = new Set();
    previewStyle: any = null;
    showMapPreview: boolean = false;
    /** Tracks per-layer visibility by tile source id */
    layerVisibility: { [id: string]: boolean } = {};
    /** Dummy config for the preview map-renderer (needs a valid NamedGeoJsonConfig shape) */
    previewConfig: NamedGeoJsonConfig = new NamedGeoJsonConfig('__preview__', 'preview', '', '');

    /** Built-in OSM tile source always available as a base layer */
    private static readonly OSM_BUILTIN: TileSourceDefinition = (() => {
        const d = new TileSourceDefinition('__osm__', 'OpenStreetMap', 'tileserver');
        d.url = DEFAULT_TILE_SOURCE.url;
        d.attribution = DEFAULT_TILE_SOURCE.attribution;
        return d;
    })();

    private subscriptions: Subscription[] = [];

    constructor(
        private mapsService: MapsService,
        private tileSourceDefService: TileSourceDefinitionService,
        private polariService: PolariService,
        private router: Router
    ) {}

    ngOnInit(): void {
        this.subscriptions.push(
            this.mapsService.mappedObjects$.subscribe(objects => {
                this.mappedObjects = objects;
            }),
            this.mapsService.tileGeneratorSources$.subscribe(sources => {
                this.tileGeneratorSources = sources;
            }),
            this.mapsService.loading$.subscribe(loading => {
                this.loading = loading;
            }),
            this.mapsService.generationStatus$.subscribe(job => {
                this.generationJob = job;
                if (job && (job.status === 'completed' || job.status === 'failed')) {
                    this.isGenerating = false;
                }
            }),
            this.tileSourceDefService.allSources$.subscribe(sources => {
                console.log('[MapsComponent] allSources$ fired, count:', sources.length, sources);
                // Prepend built-in OSM tile source
                const osmSummary: TileSourceSummary = {
                    id: MapsComponent.OSM_BUILTIN.id,
                    name: MapsComponent.OSM_BUILTIN.name,
                    type: MapsComponent.OSM_BUILTIN.type
                };
                this.tileSources = [osmSummary, ...sources];
                // Load full definitions for map preview
                this.tileSourceDefinitions = [MapsComponent.OSM_BUILTIN];
                for (const s of sources) {
                    console.log('[MapsComponent] Loading full definition for:', s.id, s.name);
                    this.tileSourceDefService.loadDefinition(s.id).subscribe({
                        next: (def) => {
                            console.log(`[MapsComponent] Loaded def: id="${def.id}" name="${def.name}" type="${def.type}" tileFormat="${def.tileFormat}" url="${def.url}" sourceLayer="${def.sourceLayer}"`);
                            const idx = this.tileSourceDefinitions.findIndex(d => d.id === def.id);
                            if (idx >= 0) {
                                this.tileSourceDefinitions[idx] = def;
                            } else {
                                this.tileSourceDefinitions.push(def);
                            }
                            console.log('[MapsComponent] tileSourceDefinitions now:', this.tileSourceDefinitions.map(d => ({ id: d.id, name: d.name, type: d.type, tileFormat: d.tileFormat, url: d.url })));
                        }
                    });
                }
            }),
            this.mapsService.mbtilesFiles$.subscribe(files => {
                this.mbtilesFiles = files;
            })
        );

        this.mapsService.fetchMappedObjects();
    }

    ngOnDestroy(): void {
        this.subscriptions.forEach(s => s.unsubscribe());
    }

    setActiveTab(tab: 'mapped-objects' | 'tile-generator' | 'tile-sources'): void {
        this.activeTab = tab;
        if (tab === 'tile-generator') {
            this.mapsService.fetchTileGeneratorSources();
            this.checkObjectStorageStatus();
        } else if (tab === 'tile-sources') {
            this.loadTileSources();
        }
    }

    checkObjectStorageStatus(): void {
        this.mapsService.fetchObjectStorageStatus().subscribe({
            next: (status) => {
                this.objectStorageConnected = status.connected;
                if (!status.connected && this.outputMode === 'minio') {
                    this.outputMode = 'download';
                }
            },
            error: () => {
                this.objectStorageConnected = false;
                if (this.outputMode === 'minio') {
                    this.outputMode = 'download';
                }
            }
        });
    }

    navigateToClass(className: string): void {
        this.router.navigate(['/class-main-page', className]);
    }

    toggleGeoJsonEndpoint(obj: MappedObjectSummary): void {
        const newState = !obj.hasGeoJsonEndpoint;
        this.mapsService.toggleGeoJsonFormat(obj.className, newState).subscribe({
            next: () => {
                obj.hasGeoJsonEndpoint = newState;
            },
            error: (err: any) => {
                console.error('[MapsComponent] Failed to toggle GeoJSON endpoint:', err);
            }
        });
    }

    toggleSourceSelection(index: number): void {
        if (this.selectedSources.has(index)) {
            this.selectedSources.delete(index);
        } else {
            this.selectedSources.add(index);
        }
    }

    isSourceSelected(index: number): boolean {
        return this.selectedSources.has(index);
    }

    getSelectedSourceCount(): number {
        return this.selectedSources.size;
    }

    generateTiles(): void {
        if (this.selectedSources.size === 0) return;

        const sources = Array.from(this.selectedSources).map(i => {
            const src = this.tileGeneratorSources[i];
            if (src.type === 'class') {
                return {
                    type: 'class' as const,
                    className: src.className,
                    geoJsonConfigId: src.geoJsonConfigId
                };
            } else if (src.type === 'endpoint') {
                return {
                    type: 'endpoint' as const,
                    endpointName: src.endpointName
                };
            } else {
                return {
                    type: 'url' as const,
                    url: src.url
                };
            }
        });

        const request: TileGenerationRequest = {
            name: this.tilesetName || `tileset-${Date.now()}`,
            sources,
            options: {
                minZoom: this.minZoom,
                maxZoom: this.maxZoom,
                layerName: this.layerName
            },
            outputMode: this.outputMode,
            minioBucket: this.outputMode === 'minio' ? this.bucketName : undefined
        };

        this.isGenerating = true;
        this.generationJob = null;
        this.mapsService.generateTiles(request).subscribe({
            error: (err: any) => {
                console.error('[MapsComponent] Tile generation failed:', err);
                this.isGenerating = false;
            }
        });
    }

    downloadTiles(jobId: string): void {
        this.mapsService.downloadTiles(jobId);
    }

    refreshMappedObjects(): void {
        this.mapsService.fetchMappedObjects();
    }

    getSourceIcon(type: string): string {
        switch (type) {
            case 'class': return 'layers';
            case 'endpoint': return 'api';
            case 'url': return 'link';
            default: return 'map';
        }
    }

    getSourceLabel(source: TileSource): string {
        if (source.type === 'class') {
            return source.className || 'Unknown Class';
        } else if (source.type === 'endpoint') {
            return source.endpointName || 'Unknown Endpoint';
        } else {
            return source.url || 'Unknown URL';
        }
    }

    // Tile Sources tab
    loadTileSources(): void {
        this.tileSourcesLoading = true;
        this.tileSourceDefService.fetchAll();
        this.mapsService.fetchMbtilesFiles();
        // Loading state clears when subscriptions fire
        setTimeout(() => { this.tileSourcesLoading = false; }, 1500);
    }

    refreshTileSources(): void {
        this.loadTileSources();
    }

    getTileSourceTypeIcon(type: string): string {
        return type === 's3-bucket' ? 'cloud' : 'dns';
    }

    formatFileSize(bytes: number): string {
        if (bytes === 0) return '0 B';
        const units = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return (bytes / Math.pow(1024, i)).toFixed(1) + ' ' + units[i];
    }

    deleteTileSource(id: string, event: Event): void {
        event.stopPropagation();
        if (id === '__osm__') return; // Built-in, cannot delete
        this.tileSourceDefService.deleteDefinition(id).subscribe({
            next: () => {
                this.tileSourceDefService.fetchAll();
            },
            error: (err: any) => {
                console.error('[MapsComponent] Failed to delete tile source:', err);
            }
        });
    }

    // -- Multi-layer map preview --

    toggleTileSourceSelection(id: string): void {
        if (this.selectedTileSourceIds.has(id)) {
            this.selectedTileSourceIds.delete(id);
            delete this.layerVisibility[id];
        } else {
            this.selectedTileSourceIds.add(id);
            this.layerVisibility[id] = true;
        }
        if (this.showMapPreview) {
            this.updateMapPreview();
        }
    }

    isTileSourceSelected(id: string): boolean {
        return this.selectedTileSourceIds.has(id);
    }

    getSelectedTileSourceConfigs(): TileSourceConfig[] {
        const selectedIds = Array.from(this.selectedTileSourceIds);
        console.log('[MapsComponent] getSelectedTileSourceConfigs: selectedIds=', selectedIds);
        console.log('[MapsComponent] layerVisibility=', this.layerVisibility);
        console.log('[MapsComponent] available definitions:', this.tileSourceDefinitions.map(d => ({ id: d.id, name: d.name })));

        const configs = selectedIds
            .filter(id => this.layerVisibility[id] !== false)
            .map(id => {
                const found = this.tileSourceDefinitions.find(d => d.id === id);
                if (!found) console.warn(`[MapsComponent] Definition not found for id="${id}"`);
                return found;
            })
            .filter((d): d is TileSourceDefinition => d != null)
            .map(d => {
                const cfg = d.toTileSourceConfig();
                console.log(`[MapsComponent] toTileSourceConfig for "${d.name}":`, JSON.stringify(cfg));
                return cfg;
            });

        console.log('[MapsComponent] Final configs count:', configs.length);
        return configs;
    }

    updateMapPreview(): void {
        const configs = this.getSelectedTileSourceConfigs();
        const backendUrl = this.polariService.getBackendBaseUrl();
        console.log('[MapsComponent] updateMapPreview: backendUrl=', backendUrl, 'configs count=', configs.length);
        this.previewStyle = configs.length > 0 ? buildStyleFromMultipleSources(configs, backendUrl) : null;
        console.log('[MapsComponent] previewStyle=', JSON.stringify(this.previewStyle, null, 2));
    }

    toggleMapPreview(): void {
        this.showMapPreview = !this.showMapPreview;
        if (this.showMapPreview) {
            this.updateMapPreview();
        }
    }

    toggleLayerVisibility(id: string): void {
        this.layerVisibility[id] = !this.layerVisibility[id];
        this.updateMapPreview();
    }

    getSelectedTileSourceDefs(): TileSourceDefinition[] {
        return Array.from(this.selectedTileSourceIds)
            .map(id => this.tileSourceDefinitions.find(d => d.id === id))
            .filter((d): d is TileSourceDefinition => d != null);
    }
}
