import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { EquationDefinitionService } from '@services/equation/equation-definition.service';
import {
    EquationDefinitionSummary,
    EQUATION_OPERATION_LABELS,
    EquationOperationType
} from '@models/equations/EquationDefinition';

interface ClassEquationGroup {
    className: string;
    configs: EquationDefinitionSummary[];
}

/**
 * Browse / index page for EquationDefinition entities.
 *
 * Mirrors `DataSetsComponent`:
 *  - List grouped by source class (with "Unassigned" bucket).
 *  - Each card click-throughs to the edit page (/equations/:id).
 *  - "+ New" creates a new EquationDefinition and routes to its editor.
 */
@Component({
    selector: 'app-equations',
    standalone: false,
    templateUrl: './equations.component.html',
    styleUrls: ['./equations.component.scss']
})
export class EquationsComponent implements OnInit, OnDestroy {

    allConfigs: EquationDefinitionSummary[] = [];
    loading: boolean = false;
    expandedClasses: Set<string> = new Set();
    creating: boolean = false;
    operationLabelForId: Map<string, string> = new Map();

    private subscriptions: Subscription[] = [];

    constructor(
        private equationDefService: EquationDefinitionService,
        private router: Router
    ) {}

    ngOnInit(): void {
        this.subscriptions.push(
            this.equationDefService.allConfigList$.subscribe(configs => {
                this.allConfigs = configs;
            }),
            this.equationDefService.loading$.subscribe(loading => {
                this.loading = loading;
            })
        );
        this.equationDefService.fetchAllConfigs();
    }

    ngOnDestroy(): void {
        this.subscriptions.forEach(s => s.unsubscribe());
    }

    get configsByClass(): ClassEquationGroup[] {
        const map = new Map<string, EquationDefinitionSummary[]>();
        for (const c of this.allConfigs) {
            const cls = c.source_class || 'Unassigned';
            if (!map.has(cls)) map.set(cls, []);
            map.get(cls)!.push(c);
        }
        return Array.from(map.entries())
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([className, configs]) => ({ className, configs }));
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

    editConfig(config: EquationDefinitionSummary, event: Event): void {
        event.stopPropagation();
        this.router.navigate(['/equations', config.id]);
    }

    refresh(): void {
        this.equationDefService.refreshList();
    }

    createNew(): void {
        if (this.creating) return;
        this.creating = true;
        const name = `equation_${Date.now()}`;
        this.equationDefService.createConfig(name, '', '').subscribe({
            next: (created: any) => {
                this.creating = false;
                const id = created?.id;
                if (id) {
                    this.router.navigate(['/equations', id]);
                } else {
                    // Fall back to refresh — backend should have created the row.
                    this.refresh();
                }
            },
            error: (err: any) => {
                this.creating = false;
                console.error('[EquationsComponent] Failed to create equation:', err);
            }
        });
    }

    /** Map an operation type string to a friendly label for display. */
    operationLabel(opType: string | undefined | null): string {
        if (!opType) return '';
        return EQUATION_OPERATION_LABELS[opType as EquationOperationType] || opType;
    }
}
