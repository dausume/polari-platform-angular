// Author: Dustin Etts
// value-source-selector.component.ts
//
// Composes the shared `value-binding-shell` + branch sub-components to render
// the existing source-selection UI. Public API (Inputs/Outputs and the
// ValueSourceConfig shape) is unchanged so the existing call sites
// (math-operation, conditional-chain, return-value, variable-assignment,
// log-output) keep working without modification.
//
// Internally we map between the persisted ValueSourceType vocabulary
// ('from_input', 'from_source_object', 'from_dataset', 'direct_assignment')
// and the shell's BranchKind vocabulary ('from_upstream', 'from_object',
// 'from_dataset', 'literal'). The persisted token names are kept stable so
// no migration of saved no-code solutions or code-gen logic is needed.

import { Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges } from '@angular/core';
import { ValueSourceConfig, ValueSourceType } from '@models/stateSpace';
import {
    BranchKind,
    SelectorMode,
    ValueTypeTag,
} from '../value-binding/branch-types';
import { LiteralBranchValue } from '../value-binding/branches/literal-branch.component';
import { FromUpstreamValue } from '../value-binding/branches/from-upstream-branch.component';
import { FromObjectValue } from '../value-binding/branches/from-object-branch.component';
import {
    AvailableDataset,
    FromDatasetValue,
} from '../value-binding/branches/from-dataset-branch.component';

/**
 * Available input variable from a connected state
 */
export interface AvailableInput {
    slotIndex: number;
    variableName: string;
    type: string;
    sourceStateName?: string;
    label?: string;
}

/**
 * Available field from the source object (self)
 */
export interface SourceObjectField {
    path: string;
    type: string;
    displayName?: string;
}

/** Persisted source-type ↔ shell branch-kind mapping. */
const PERSISTED_TO_BRANCH: Record<ValueSourceType, BranchKind> = {
    'from_input': 'from_upstream',
    'from_source_object': 'from_object',
    'from_dataset': 'from_dataset',
    'direct_assignment': 'literal',
};
const BRANCH_TO_PERSISTED: Record<BranchKind, ValueSourceType | null> = {
    'from_upstream': 'from_input',
    'from_object': 'from_source_object',
    'from_dataset': 'from_dataset',
    'literal': 'direct_assignment',
    'parameter': null, // not exposed by the source selector
};

/** The branches this selector advertises in the shell's dropdown. */
const SOURCE_ALLOWED_BRANCHES: BranchKind[] = [
    'from_upstream',
    'from_object',
    'from_dataset',
    'literal',
];

@Component({
    standalone: false,
    selector: 'app-value-source-selector',
    templateUrl: './value-source-selector.component.html',
    styleUrls: ['./value-source-selector.component.css'],
})
export class ValueSourceSelectorComponent implements OnInit, OnChanges {

    @Input() config: ValueSourceConfig = {
        sourceType: 'from_input',
        inputSlotIndex: 0,
    };

    @Input() availableInputs: AvailableInput[] = [];
    @Input() sourceObjectFields: SourceObjectField[] = [];
    @Input() availableDatasets: AvailableDataset[] = [];

    @Input() label: string = 'Value';
    @Input() compact: boolean = false;
    @Input() disabled: boolean = false;

    /** Show the "Data Source Selection" header pill (popup contexts opt in). */
    @Input() showHeader: boolean = false;

    @Output() configChange = new EventEmitter<ValueSourceConfig>();

    // ── Local state, sliced from config and rebuilt for the active branch ──

    activeBranch: BranchKind | '' = '';
    readonly mode: SelectorMode = 'source';
    readonly allowedBranches = SOURCE_ALLOWED_BRANCHES;

    // Per-branch state (only the slice for the active branch is meaningful).
    inputSlotIndex = 0;
    inputVariableName = '';
    objectPath = '';
    datasetId = '';
    datasetFieldPath = '';
    directValue: any = '';
    directValueType: ValueTypeTag = 'str';

    ngOnInit(): void {
        this.syncFromConfig();
    }

    ngOnChanges(changes: SimpleChanges): void {
        if (changes['config'] && !changes['config'].firstChange) {
            this.syncFromConfig();
        }
    }

    private syncFromConfig(): void {
        if (!this.config) return;
        const persisted = this.config.sourceType || 'from_input';
        this.activeBranch = PERSISTED_TO_BRANCH[persisted] ?? '';

        switch (persisted) {
            case 'from_input':
                this.inputSlotIndex = this.config.inputSlotIndex ?? 0;
                this.inputVariableName = this.config.inputVariableName || '';
                break;
            case 'from_source_object':
                this.objectPath = this.config.sourceObjectPath || '';
                break;
            case 'from_dataset':
                this.datasetId = this.config.datasetId || '';
                this.datasetFieldPath = this.config.datasetFieldPath || '';
                break;
            case 'direct_assignment':
                this.directValue = this.config.directValue ?? '';
                this.directValueType = (this.config.directValueType as ValueTypeTag) || 'str';
                break;
        }
    }

    // ── Shell event ────────────────────────────────────────────────────────

    onBranchChange(kind: BranchKind): void {
        this.activeBranch = kind;
        this.emitFromActive();
    }

    // ── Branch sub-component events ────────────────────────────────────────

    onLiteralChange(v: LiteralBranchValue): void {
        this.directValue = v.value;
        this.directValueType = v.valueType;
        this.emitFromActive();
    }

    onUpstreamChange(v: FromUpstreamValue): void {
        this.inputSlotIndex = v.slotIndex;
        this.inputVariableName = v.variableName;
        this.emitFromActive();
    }

    onObjectChange(v: FromObjectValue): void {
        this.objectPath = v.objectPath;
        this.emitFromActive();
    }

    onDatasetChange(v: FromDatasetValue): void {
        this.datasetId = v.datasetId;
        this.datasetFieldPath = v.fieldPath;
        this.emitFromActive();
    }

    // ── Emit ───────────────────────────────────────────────────────────────

    private emitFromActive(): void {
        if (!this.activeBranch) return;
        const persisted = BRANCH_TO_PERSISTED[this.activeBranch as BranchKind];
        if (!persisted) return;

        const out: ValueSourceConfig = { sourceType: persisted };
        switch (persisted) {
            case 'from_input':
                out.inputSlotIndex = this.inputSlotIndex;
                out.inputVariableName = this.inputVariableName;
                break;
            case 'from_source_object':
                out.sourceObjectPath = this.objectPath;
                break;
            case 'from_dataset':
                out.datasetId = this.datasetId;
                out.datasetFieldPath = this.datasetFieldPath;
                break;
            case 'direct_assignment':
                out.directValue = this.directValue;
                out.directValueType = this.directValueType;
                break;
        }
        this.configChange.emit(out);
    }
}
