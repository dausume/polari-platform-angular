// Author: Dustin Etts
// value-potential-selector.component.ts
//
// Sibling of `value-source-selector` operating in `mode='potential'`.
// Used at design time (e.g. on an equation's variable bindings) to declare
// the *shape* of inputs a binding should receive — not pick a concrete live
// source. Output is a `DataPotentialDefinition` carrying type metadata only.
//
// Composes the same shell + branch sub-components as the source selector
// but advertises a different branch set (no upstream-variable branch; adds
// the parameter branch). When the equation is later dropped into a state
// space, a value-source-selector fills each declared potential.

import { Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges } from '@angular/core';
import {
    BranchKind,
    DataPotentialDefinition,
    DataPotentialKind,
    POTENTIAL_ALLOWED_BRANCHES,
    SelectorMode,
    ValueTypeTag,
    createDefaultPotential,
} from '../value-binding/branch-types';
import { LiteralBranchValue } from '../value-binding/branches/literal-branch.component';
import { FromObjectValue } from '../value-binding/branches/from-object-branch.component';
import {
    AvailableDataset,
    FromDatasetValue,
} from '../value-binding/branches/from-dataset-branch.component';
import { ParameterBranchValue } from '../value-binding/branches/parameter-branch.component';
import { SourceObjectField } from '../value-source-selector/value-source-selector.component';

@Component({
    standalone: false,
    selector: 'app-value-potential-selector',
    templateUrl: './value-potential-selector.component.html',
    styleUrls: ['./value-potential-selector.component.css'],
})
export class ValuePotentialSelectorComponent implements OnInit, OnChanges {

    @Input() definition: DataPotentialDefinition = createDefaultPotential();

    /** Reused from source selector — supplies the class names available for
     *  `from_object` potential declarations. */
    @Input() sourceObjectFields: SourceObjectField[] = [];

    /** Optional — supplies dataset ids for `from_dataset` potentials. */
    @Input() availableDatasets: AvailableDataset[] = [];

    @Input() label: string = 'Potential';
    @Input() compact: boolean = false;
    @Input() disabled: boolean = false;
    @Input() showHeader: boolean = false;

    @Output() definitionChange = new EventEmitter<DataPotentialDefinition>();

    activeBranch: BranchKind | '' = '';
    readonly mode: SelectorMode = 'potential';
    readonly allowedBranches = POTENTIAL_ALLOWED_BRANCHES;

    // Per-branch state
    valueType: ValueTypeTag = 'float';
    objectPath: string = '';
    datasetId: string = '';
    parameterName: string = '';

    ngOnInit(): void {
        this.syncFromDefinition();
    }

    ngOnChanges(changes: SimpleChanges): void {
        if (changes['definition'] && !changes['definition'].firstChange) {
            this.syncFromDefinition();
        }
    }

    private syncFromDefinition(): void {
        const d = this.definition || createDefaultPotential();
        this.activeBranch = d.kind as BranchKind;

        switch (d.kind) {
            case 'literal':
                this.valueType = (d.valueType as ValueTypeTag) || 'float';
                break;
            case 'from_object':
                this.objectPath = d.className || '';
                break;
            case 'from_dataset':
                this.datasetId = d.datasetId || '';
                break;
            case 'parameter':
                this.parameterName = d.parameterName || '';
                this.valueType = (d.valueType as ValueTypeTag) || 'float';
                break;
        }
    }

    onBranchChange(kind: BranchKind): void {
        // Defensive: only the four potential branches are valid here. The
        // shell already filters, but a future caller could pass a broader
        // allowedBranches list.
        if (!this.allowedBranches.includes(kind)) return;
        this.activeBranch = kind;
        this.emitFromActive();
    }

    onLiteralChange(v: LiteralBranchValue): void {
        this.valueType = v.valueType;
        this.emitFromActive();
    }

    onObjectChange(v: FromObjectValue): void {
        // Top-level object name == class identifier in potential mode.
        this.objectPath = (v.objectPath || '').split('.')[0];
        this.emitFromActive();
    }

    onDatasetChange(v: FromDatasetValue): void {
        this.datasetId = v.datasetId;
        this.emitFromActive();
    }

    onParameterChange(v: ParameterBranchValue): void {
        this.parameterName = v.parameterName;
        this.valueType = v.parameterType;
        this.emitFromActive();
    }

    private emitFromActive(): void {
        if (!this.activeBranch) return;
        const kind = this.activeBranch as DataPotentialKind;
        const out: DataPotentialDefinition = { kind };
        switch (kind) {
            case 'literal':
                out.valueType = this.valueType;
                break;
            case 'from_object':
                out.className = this.objectPath;
                break;
            case 'from_dataset':
                out.datasetId = this.datasetId;
                break;
            case 'parameter':
                out.parameterName = this.parameterName;
                out.valueType = this.valueType;
                break;
        }
        this.definitionChange.emit(out);
    }
}
