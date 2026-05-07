// Author: Dustin Etts
// parameter-branch.component.ts
//
// Potential-only branch: declare a named, typed runtime parameter that the
// hosting state-space (or external caller) is expected to supply. This is
// pure shape — no concrete value lives here. Source selectors don't expose
// this branch because at runtime a parameter has already been resolved into
// one of the concrete branches (upstream variable, object field, etc).

import { Component, EventEmitter, Input, Output } from '@angular/core';
import { ValueTypeTag } from '../branch-types';

export interface ParameterBranchValue {
    parameterName: string;
    parameterType: ValueTypeTag;
}

@Component({
    standalone: false,
    selector: 'app-parameter-branch',
    templateUrl: './parameter-branch.component.html',
    styleUrls: ['./parameter-branch.component.css'],
})
export class ParameterBranchComponent {

    @Input() parameterName: string = '';
    @Input() parameterType: ValueTypeTag = 'float';
    @Input() disabled: boolean = false;

    @Output() selectionChange = new EventEmitter<ParameterBranchValue>();

    readonly typeOptions: { value: ValueTypeTag; label: string }[] = [
        { value: 'int',   label: 'Integer' },
        { value: 'float', label: 'Float' },
        { value: 'str',   label: 'String' },
        { value: 'bool',  label: 'Boolean' },
    ];

    onNameChange(name: string): void {
        this.parameterName = name;
        this.emit();
    }

    onTypeChange(type: ValueTypeTag): void {
        this.parameterType = type;
        this.emit();
    }

    private emit(): void {
        this.selectionChange.emit({
            parameterName: this.parameterName,
            parameterType: this.parameterType,
        });
    }
}
