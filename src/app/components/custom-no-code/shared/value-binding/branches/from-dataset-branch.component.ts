// Author: Dustin Etts
// from-dataset-branch.component.ts
//
// Renders the "pick a dataset (+ optional field path)" UI. Logically distinct
// from `from-object-branch` because a dataset is a *collection* of rows, not
// a single instance — downstream code-gen treats it differently (iteration
// vs. scalar access).
//
// Same correctness rules as from-object-branch:
//   1. @Input `datasetId`/`fieldPath` are read-only; we mirror to local state.
//   2. The Field option list is cached (see `fieldOptions`) to avoid the
//      *ngFor-on-method-call race that snaps `<select>` back to "Choose…".

import { Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { SelectorMode } from '../branch-types';
import {
    DataSetSelectorDialogComponent,
    DataSetSelectorDialogResult,
} from '@components/shared/dataset-selector-dialog/dataset-selector-dialog';

export interface AvailableDataset {
    /** Stable identifier (used in code-gen). */
    id: string;
    /** Human-readable label. */
    name?: string;
    /** Source class the dataset is built on (used for the picker subtitle). */
    sourceClass?: string;
    /** Optional field schema for inline-dropdown field picking. */
    fields?: { name: string; type: string }[];
}

export interface FromDatasetValue {
    datasetId: string;
    fieldPath: string;
}

@Component({
    standalone: false,
    selector: 'app-from-dataset-branch',
    templateUrl: './from-dataset-branch.component.html',
    styleUrls: ['./from-dataset-branch.component.css'],
})
export class FromDatasetBranchComponent implements OnInit, OnChanges {

    @Input() mode: SelectorMode = 'source';
    /** Read-only — never mutated locally. */
    @Input() datasetId: string = '';
    @Input() fieldPath: string = '';
    @Input() availableDatasets: AvailableDataset[] = [];
    @Input() disabled: boolean = false;

    @Output() selectionChange = new EventEmitter<FromDatasetValue>();

    /** Local mirrors of @Inputs. Templates and event handlers bind here. */
    selectedDatasetId: string = '';
    selectedFieldPath: string = '';
    selectedDatasetName: string = '';
    selectedSourceClass: string = '';

    /** Cached field options (see class-level note). */
    fieldOptions: { name: string; type: string }[] = [];

    constructor(private dialog: MatDialog) {}

    ngOnInit(): void {
        this.syncFromInputs();
        this.recomputeFieldOptions();
    }

    ngOnChanges(changes: SimpleChanges): void {
        if ('datasetId' in changes || 'fieldPath' in changes || 'availableDatasets' in changes) {
            this.syncFromInputs();
            this.recomputeFieldOptions();
        }
    }

    private syncFromInputs(): void {
        this.selectedDatasetId = this.datasetId || '';
        this.selectedFieldPath = this.fieldPath || '';
        if (!this.selectedDatasetId) {
            this.selectedDatasetName = '';
            this.selectedSourceClass = '';
            return;
        }
        const match = this.availableDatasets.find(d => d.id === this.selectedDatasetId);
        if (match) {
            this.selectedDatasetName = match.name || match.id;
            this.selectedSourceClass = match.sourceClass || '';
        } else if (!this.selectedDatasetName) {
            // Fall back to the id when we don't have richer metadata yet.
            this.selectedDatasetName = this.selectedDatasetId;
        }
    }

    private recomputeFieldOptions(): void {
        const ds = this.availableDatasets.find(d => d.id === this.selectedDatasetId);
        this.fieldOptions = ds?.fields ? [...ds.fields] : [];
    }

    trackByFieldName(_: number, f: { name: string; type: string }): string { return f.name; }

    // ── Dialog flow ───────────────────────────────────────────────────────

    openDatasetPicker(): void {
        if (this.disabled) return;
        const ref = this.dialog.open(DataSetSelectorDialogComponent, {
            width: '520px',
            data: {
                title: this.mode === 'potential' ? 'Pick DataSet shape' : 'Pick DataSet',
                subtitle: this.mode === 'potential'
                    ? 'Declare the dataset this binding will consume at runtime.'
                    : 'Choose a dataset to read values from.',
            },
        });
        ref.afterClosed().subscribe((r: DataSetSelectorDialogResult | undefined) => {
            if (r?.action === 'select' && r.datasetId) {
                const switching = this.selectedDatasetId !== r.datasetId;
                this.selectedDatasetId = r.datasetId;
                this.selectedDatasetName = r.datasetName || r.datasetId;
                this.selectedSourceClass = r.sourceClass || '';
                if (switching && this.mode === 'source') this.selectedFieldPath = '';
                this.recomputeFieldOptions();
                this.emit();
            }
        });
    }

    clearDataset(): void {
        this.selectedDatasetId = '';
        this.selectedFieldPath = '';
        this.selectedDatasetName = '';
        this.selectedSourceClass = '';
        this.recomputeFieldOptions();
        this.emit();
    }

    // ── Field picker (source mode only) ───────────────────────────────────

    onFieldChange(path: string): void {
        this.selectedFieldPath = path;
        this.emit();
    }

    private emit(): void {
        this.selectionChange.emit({
            datasetId: this.selectedDatasetId,
            fieldPath: this.selectedFieldPath,
        });
    }
}
