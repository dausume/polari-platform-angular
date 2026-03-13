import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { GraphDefinitionService } from '@services/graph/graph-definition.service';
import { GraphDefinitionSummary } from '@models/graphs/NamedGraphConfig';
import { ApiConfigService } from '@services/api-config.service';
import { ApiConfigObject } from '@models/apiConfig';

interface ClassGraphGroup {
    className: string;
    configs: GraphDefinitionSummary[];
    d3ColumnEnabled: boolean;
    d3ColumnEndpoint: string | null;
}

@Component({
    selector: 'app-graphs',
    standalone: false,
    templateUrl: './graphs.component.html',
    styleUrls: ['./graphs.component.scss']
})
export class GraphsComponent implements OnInit, OnDestroy {
    allConfigs: GraphDefinitionSummary[] = [];
    loading: boolean = false;
    expandedClasses: Set<string> = new Set();
    apiConfigMap: Map<string, ApiConfigObject> = new Map();

    private subscriptions: Subscription[] = [];

    constructor(
        private graphDefService: GraphDefinitionService,
        private apiConfigService: ApiConfigService,
        private router: Router
    ) {}

    ngOnInit(): void {
        this.subscriptions.push(
            this.graphDefService.allConfigList$.subscribe(configs => {
                this.allConfigs = configs;
            }),
            this.graphDefService.loading$.subscribe(loading => {
                this.loading = loading;
            })
        );
        this.graphDefService.fetchAllConfigs();
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

    get configsByClass(): ClassGraphGroup[] {
        const map = new Map<string, GraphDefinitionSummary[]>();
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
                    d3ColumnEnabled: apiObj?.apiFormats?.d3Column?.enabled ?? false,
                    d3ColumnEndpoint: apiObj?.apiFormats?.d3Column?.endpoint ?? null
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
        this.router.navigate(['/class-main-page', className], { queryParams: { tab: 'graphs' } });
    }

    toggleD3ColumnEndpoint(group: ClassGraphGroup): void {
        const newState = !group.d3ColumnEnabled;
        this.apiConfigService.updateFormats({ className: group.className, d3Column: newState }).subscribe({
            next: () => {
                group.d3ColumnEnabled = newState;
            },
            error: (err: any) => {
                console.error('[GraphsComponent] Failed to toggle d3Column endpoint:', err);
            }
        });
    }

    refresh(): void {
        this.graphDefService.fetchAllConfigs();
        this.loadApiConfig();
    }
}
