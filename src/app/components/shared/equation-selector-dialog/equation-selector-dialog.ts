// equation-selector-dialog.ts
// Pop-up picker for EquationDefinitions. Mirrors DataSetSelectorDialog —
// search across both `name` and `source_class`, grouped by source class.
// Used by `run-equation-overlay` to pick which equation a state will run.

import { Component, Inject, OnDestroy, OnInit } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { Subscription } from 'rxjs';
import { EquationDefinitionService } from '@services/equation/equation-definition.service';
import { EquationDefinitionSummary } from '@models/equations/EquationDefinition';

export interface EquationSelectorDialogData {
    title?: string;
    subtitle?: string;
    /** Optional: limit results to equations attached to this source class. */
    restrictToSourceClass?: string;
}

export interface EquationSelectorDialogResult {
    action: 'select' | 'cancel';
    equationId?: string;
    equationName?: string;
    sourceClass?: string;
}

interface EquationGroup {
    sourceClass: string;
    equations: EquationDefinitionSummary[];
    expanded: boolean;
}

@Component({
    standalone: false,
    selector: 'equation-selector-dialog',
    templateUrl: './equation-selector-dialog.html',
    styleUrls: ['./equation-selector-dialog.css'],
})
export class EquationSelectorDialogComponent implements OnInit, OnDestroy {

    query: string = '';
    private all: EquationDefinitionSummary[] = [];
    groups: EquationGroup[] = [];
    loading: boolean = false;
    private subs: Subscription[] = [];

    constructor(
        @Inject(MAT_DIALOG_DATA) public data: EquationSelectorDialogData,
        private dialogRef: MatDialogRef<EquationSelectorDialogComponent>,
        private equationService: EquationDefinitionService,
    ) {}

    ngOnInit(): void {
        this.loading = true;
        this.subs.push(
            this.equationService.allConfigList$.subscribe(list => {
                this.all = (list || []).filter(e => {
                    if (!this.data?.restrictToSourceClass) return true;
                    return (e.source_class || '') === this.data.restrictToSourceClass;
                });
                this.rebuildGroups();
                this.loading = false;
            }),
        );
        this.equationService.fetchAllConfigs();
    }

    ngOnDestroy(): void {
        this.subs.forEach(s => s.unsubscribe());
    }

    onSearch(value: string): void { this.query = value; this.rebuildGroups(); }
    clearSearch(): void { this.query = ''; this.rebuildGroups(); }
    toggleGroup(g: EquationGroup): void { g.expanded = !g.expanded; }
    onCancel(): void { this.dialogRef.close({ action: 'cancel' } as EquationSelectorDialogResult); }

    select(e: EquationDefinitionSummary): void {
        this.dialogRef.close({
            action: 'select',
            equationId: e.id,
            equationName: e.name,
            sourceClass: e.source_class,
        } as EquationSelectorDialogResult);
    }

    private rebuildGroups(): void {
        const q = (this.query || '').trim().toLowerCase();
        const matching = q
            ? this.all.filter(e => {
                const name = (e.name || '').toLowerCase();
                const klass = (e.source_class || '').toLowerCase();
                const desc = (e.description || '').toLowerCase();
                return name.includes(q) || klass.includes(q) || desc.includes(q);
            })
            : this.all;

        const map = new Map<string, EquationDefinitionSummary[]>();
        for (const e of matching) {
            const k = e.source_class || 'Unassigned';
            if (!map.has(k)) map.set(k, []);
            map.get(k)!.push(e);
        }

        const out: EquationGroup[] = [];
        const sortedKeys = Array.from(map.keys()).sort((a, b) => a.localeCompare(b));
        for (const k of sortedKeys) {
            out.push({
                sourceClass: k,
                equations: map.get(k)!.sort((a, b) => (a.name || '').localeCompare(b.name || '')),
                expanded: q.length > 0 || map.size <= 3,
            });
        }
        this.groups = out;
    }

    get totalShown(): number {
        return this.groups.reduce((n, g) => n + g.equations.length, 0);
    }
}
