import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { DataSetDefinitionService } from '@services/dataset/dataset-definition.service';
import { DataSetDefinitionSummary } from '@models/datasets/NamedDataSetConfig';
import { ApiConfigService } from '@services/api-config.service';
import { ApiConfigObject } from '@models/apiConfig';

interface ClassDataSetGroup {
    className: string;
    configs: DataSetDefinitionSummary[];
    flatJsonEnabled: boolean;
    flatJsonEndpoint: string | null;
}

@Component({
    selector: 'app-datasets',
    standalone: false,
    templateUrl: './datasets.component.html',
    styleUrls: ['./datasets.component.scss']
})
export class DataSetsComponent implements OnInit, OnDestroy {
    allConfigs: DataSetDefinitionSummary[] = [];
    loading: boolean = false;
    expandedClasses: Set<string> = new Set();
    apiConfigMap: Map<string, ApiConfigObject> = new Map();

    private subscriptions: Subscription[] = [];

    constructor(
        private dataSetDefService: DataSetDefinitionService,
        private apiConfigService: ApiConfigService,
        private router: Router
    ) {}

    ngOnInit(): void {
        this.subscriptions.push(
            this.dataSetDefService.allConfigList$.subscribe(configs => {
                this.allConfigs = configs;
            }),
            this.dataSetDefService.loading$.subscribe(loading => {
                this.loading = loading;
            })
        );
        this.dataSetDefService.fetchAllConfigs();
        this.loadApiConfig();
    }

    ngOnDestroy(): void {
        this.subscriptions.forEach(s => s.unsubscribe());
    }

    loadApiConfig(): void {
        this.apiConfigService.getApiConfig().subscribe({
            next: (response) => {
                this.apiConfigMap.clear();
                for (const obj of response.objects) {
                    this.apiConfigMap.set(obj.className, obj);
                }
            }
        });
    }

    get configsByClass(): ClassDataSetGroup[] {
        const map = new Map<string, DataSetDefinitionSummary[]>();
        for (const c of this.allConfigs) {
            const cls = c.source_class || 'Unassigned';
            if (!map.has(cls)) map.set(cls, []);
            map.get(cls)!.push(c);
        }
        return Array.from(map.entries())
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([className, configs]) => {
                const apiObj = this.apiConfigMap.get(className);
                return {
                    className,
                    configs,
                    flatJsonEnabled: apiObj?.apiFormats?.flatJson?.enabled ?? false,
                    flatJsonEndpoint: apiObj?.apiFormats?.flatJson?.endpoint ?? null
                };
            });
    }

    toggleExpand(className: string): void {
        if (this.expandedClasses.has(className)) {
            this.expandedClasses.delete(className);
        } else {
            this.expandedClasses.add(className);
        }
    }

    isExpanded(className: string): boolean {
        return this.expandedClasses.has(className);
    }

    editConfig(className: string, event: Event): void {
        event.stopPropagation();
        this.router.navigate(['/class-main-page', className], { queryParams: { tab: 'datasets' } });
    }

    toggleFlatJsonEndpoint(group: ClassDataSetGroup): void {
        const newState = !group.flatJsonEnabled;
        this.apiConfigService.updateFormats({ className: group.className, flatJson: newState }).subscribe({
            next: () => {
                group.flatJsonEnabled = newState;
            },
            error: (err: any) => {
                console.error('[DataSetsComponent] Failed to toggle flatJson endpoint:', err);
            }
        });
    }

    refresh(): void {
        this.dataSetDefService.fetchAllConfigs();
        this.loadApiConfig();
    }
}
