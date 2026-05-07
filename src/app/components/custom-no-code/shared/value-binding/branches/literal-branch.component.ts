// Author: Dustin Etts
// literal-branch.component.ts
//
// Renders the type-dropdown + value-input pair for the `literal` branch.
// Used by both `value-source-selector` (concrete value) and
// `value-potential-selector` (placeholder describing expected type).
//
// In `mode='potential'` the value input is hidden — only the type matters.

import { Component, EventEmitter, Input, Output } from '@angular/core';
import { SelectorMode, ValueTypeTag } from '../branch-types';

export interface LiteralBranchValue {
    value: any;
    valueType: ValueTypeTag;
}

@Component({
    standalone: false,
    selector: 'app-literal-branch',
    templateUrl: './literal-branch.component.html',
    styleUrls: ['./literal-branch.component.css'],
})
export class LiteralBranchComponent {

    @Input() mode: SelectorMode = 'source';
    @Input() value: any = '';
    @Input() valueType: ValueTypeTag = 'str';
    @Input() disabled: boolean = false;

    @Output() selectionChange = new EventEmitter<LiteralBranchValue>();

    readonly typeOptions: { value: ValueTypeTag; label: string }[] = [
        { value: 'int',   label: 'Integer' },
        { value: 'float', label: 'Float' },
        { value: 'str',   label: 'String' },
        { value: 'bool',  label: 'Boolean' },
    ];

    onValueChange(raw: string): void {
        this.value = raw;
        this.emit();
    }

    onTypeChange(type: ValueTypeTag): void {
        this.valueType = type;
        this.emit();
    }

    private emit(): void {
        this.selectionChange.emit({
            value: this.parseValue(this.value, this.valueType),
            valueType: this.valueType,
        });
    }

    private parseValue(raw: any, type: ValueTypeTag): any {
        if (this.mode === 'potential') return undefined;
        const s = raw == null ? '' : String(raw);
        switch (type) {
            case 'int':   return parseInt(s, 10) || 0;
            case 'float': return parseFloat(s) || 0.0;
            case 'bool':  return s.toLowerCase() === 'true' || s === '1';
            case 'str':
            default:      return s;
        }
    }

    placeholder(): string {
        switch (this.valueType) {
            case 'int':   return 'e.g., 42';
            case 'float': return 'e.g., 3.14';
            case 'str':   return 'e.g., hello';
            case 'bool':  return 'true or false';
            default:      return 'Enter value...';
        }
    }
}
