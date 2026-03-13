import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { TableDefinitionService } from '@services/table/table-definition.service';
import { TableDefinitionSummary } from '@models/tables/NamedTableConfig';
import { ApiConfigService } from '@services/api-config.service';
import { ApiConfigObject } from '@models/apiConfig';

interface ClassTableGroup {
    className: string;
    configs: TableDefinitionSummary[];
    flatJsonEnabled: boolean;
    flatJsonEndpoint: string | null;
}

@Component({
    selector: 'app-tables',
    standalone: false,
    templateUrl: './tables.component.html',
    styleUrls: ['./tables.component.scss']
})
export class TablesComponent implements OnInit, OnDestroy {
    allConfigs: TableDefinitionSummary[] = [];
    loading: boolean = false;
    expandedClasses: Set<string> = new Set();
    apiConfigMap: Map<string, ApiConfigObject> = new Map();

    private subscriptions: Subscription[] = [];

    constructor(
        private tableDefService: TableDefinitionService,
        private apiConfigService: ApiConfigService,
        private router: Router
    ) {}

    ngOnInit(): void {
        this.subscriptions.push(
            this.tableDefService.allConfigList$.subscribe(configs => {
                this.allConfigs = configs;
            }),
            this.tableDefService.loading$.subscribe(loading => {
                this.loading = loading;
            })
        );
        this.tableDefService.fetchAllConfigs();
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

    get configsByClass(): ClassTableGroup[] {
        const map = new Map<string, TableDefinitionSummary[]>();
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
        this.router.navigate(['/class-main-page', className], { queryParams: { tab: 'tables' } });
    }

    toggleFlatJsonEndpoint(group: ClassTableGroup): void {
        const newState = !group.flatJsonEnabled;
        this.apiConfigService.updateFormats({ className: group.className, flatJson: newState }).subscribe({
            next: () => {
                group.flatJsonEnabled = newState;
            },
            error: (err: any) => {
                console.error('[TablesComponent] Failed to toggle flatJson endpoint:', err);
            }
        });
    }

    refresh(): void {
        this.tableDefService.fetchAllConfigs();
        this.loadApiConfig();
    }
}
