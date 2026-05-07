// Author: Dustin Etts
// from-upstream-branch.component.ts
//
// Renders the "pick a variable from a connected upstream input slot" UI.
// Source-only: potential selectors don't expose this branch (you can't
// declare a potential as "comes from input slot 2" — that's a binding,
// not a shape).

import { Component, EventEmitter, Input, Output } from '@angular/core';
import { AvailableInput } from '../../value-source-selector/value-source-selector.component';

export interface FromUpstreamValue {
    slotIndex: number;
    variableName: string;
}

@Component({
    standalone: false,
    selector: 'app-from-upstream-branch',
    templateUrl: './from-upstream-branch.component.html',
    styleUrls: ['./from-upstream-branch.component.css'],
})
export class FromUpstreamBranchComponent {

    @Input() slotIndex: number = 0;
    @Input() variableName: string = '';
    @Input() availableInputs: AvailableInput[] = [];
    @Input() disabled: boolean = false;

    @Output() selectionChange = new EventEmitter<FromUpstreamValue>();

    onSelectionChange(key: string): void {
        const [slotPart, namePart] = (key || '').split(':');
        if (slotPart == null || namePart == null) return;
        this.slotIndex = parseInt(slotPart, 10) || 0;
        this.variableName = namePart;
        this.selectionChange.emit({ slotIndex: this.slotIndex, variableName: this.variableName });
    }

    inputKey(input: AvailableInput): string {
        return `${input.slotIndex}:${input.variableName}`;
    }

    selectedKey(): string {
        return `${this.slotIndex}:${this.variableName}`;
    }
}
