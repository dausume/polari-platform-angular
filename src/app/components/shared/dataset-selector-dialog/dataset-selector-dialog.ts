// dataset-selector-dialog.ts
// Pop-up picker for DataSet definitions. Mirrors the ClassSelectorDialog
// pattern but groups by `source_class` (the underlying object class each
// dataset is built on) and exposes a search that matches across both the
// dataset *name* and the *source class*. Returns a single chosen dataset.
//
// Usage:
//   const ref = this.dialog.open(DataSetSelectorDialogComponent, {
//     width: '520px',
//     data: { title, subtitle, restrictToSourceClass? },
//   });
//   ref.afterClosed().subscribe((r: DataSetSelectorDialogResult) => { ... });

import { Component, Inject, OnDestroy, OnInit } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { Subscription } from 'rxjs';
import { DataSetDefinitionService } from '@services/dataset/dataset-definition.service';
import { DataSetDefinitionSummary } from '@models/datasets/NamedDataSetConfig';

export interface DataSetSelectorDialogData {
    /** Title shown at the top of the dialog */
    title?: string;
    /** Optional subtitle/description */
    subtitle?: string;
    /** Optional: limit results to datasets built on this source class. */
    restrictToSourceClass?: string;
}

export interface DataSetSelectorDialogResult {
    action: 'select' | 'cancel';
    datasetId?: string;
    datasetName?: string;
    sourceClass?: string;
}

interface DataSetGroup {
    sourceClass: string;
    datasets: DataSetDefinitionSummary[];
    expanded: boolean;
}

@Component({
    standalone: false,
    selector: 'dataset-selector-dialog',
    templateUrl: './dataset-selector-dialog.html',
    styleUrls: ['./dataset-selector-dialog.css'],
})
export class DataSetSelectorDialogComponent implements OnInit, OnDestroy {

    /** Search text — matches both dataset name and source class. */
    query: string = '';

    /** All datasets retrieved from the service, post-restriction filter. */
    private all: DataSetDefinitionSummary[] = [];

    /** Groups derived from `all` (or `filtered`, when search is active). */
    groups: DataSetGroup[] = [];

    loading: boolean = false;

    private subs: Subscription[] = [];

    constructor(
        @Inject(MAT_DIALOG_DATA) public data: DataSetSelectorDialogData,
        private dialogRef: MatDialogRef<DataSetSelectorDialogComponent>,
        private datasetService: DataSetDefinitionService,
    ) {}

    ngOnInit(): void {
        this.loading = true;
        this.subs.push(
            this.datasetService.allConfigList$.subscribe(list => {
                this.all = (list || []).filter(d => {
                    if (!this.data?.restrictToSourceClass) return true;
                    return (d.source_class || '') === this.data.restrictToSourceClass;
                });
                this.rebuildGroups();
                this.loading = false;
            }),
        );
        // Force a fetch in case the cache is empty (e.g. dialog opened cold).
        this.datasetService.fetchAllConfigs();
    }

    ngOnDestroy(): void {
        this.subs.forEach(s => s.unsubscribe());
    }

    onSearch(value: string): void {
        this.query = value;
        this.rebuildGroups();
    }

    clearSearch(): void {
        this.query = '';
        this.rebuildGroups();
    }

    toggleGroup(g: DataSetGroup): void {
        g.expanded = !g.expanded;
    }

    select(d: DataSetDefinitionSummary): void {
        this.dialogRef.close({
            action: 'select',
            datasetId: d.id,
            datasetName: d.name,
            sourceClass: d.source_class,
        } as DataSetSelectorDialogResult);
    }

    onCancel(): void {
        this.dialogRef.close({ action: 'cancel' } as DataSetSelectorDialogResult);
    }

    /** Bucket datasets by source_class, applying the active search query. */
    private rebuildGroups(): void {
        const q = (this.query || '').trim().toLowerCase();
        const matching = q
            ? this.all.filter(d => {
                const name = (d.name || '').toLowerCase();
                const klass = (d.source_class || '').toLowerCase();
                return name.includes(q) || klass.includes(q);
            })
            : this.all;

        const map = new Map<string, DataSetDefinitionSummary[]>();
        for (const d of matching) {
            const k = d.source_class || 'Unassigned';
            if (!map.has(k)) map.set(k, []);
            map.get(k)!.push(d);
        }

        // Sort each group's datasets by name; sort group keys alphabetically.
        const out: DataSetGroup[] = [];
        const sortedKeys = Array.from(map.keys()).sort((a, b) => a.localeCompare(b));
        for (const k of sortedKeys) {
            out.push({
                sourceClass: k,
                datasets: map.get(k)!.sort((a, b) => (a.name || '').localeCompare(b.name || '')),
                // Auto-expand all groups when searching so matches are visible at a glance.
                expanded: q.length > 0 || map.size <= 3,
            });
        }
        this.groups = out;
    }

    get totalShown(): number {
        return this.groups.reduce((n, g) => n + g.datasets.length, 0);
    }
}
