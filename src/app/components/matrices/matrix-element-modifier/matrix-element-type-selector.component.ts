import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import {
    MATRIX_ELEMENT_KINDS,
    MATRIX_ELEMENT_KIND_LABELS,
    MatrixElementKind,
} from '@models/matrices/MatrixDefinition';

/**
 * Sub-component of the Matrix Element Modifier: selects what KIND a matrix
 * element is (number / equation / matrix). Emits the chosen kind; the sibling
 * entry component reacts by showing the matching data-entry field.
 */
@Component({
    standalone: true,
    selector: 'matrix-element-type-selector',
    imports: [CommonModule, FormsModule],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <select class="kind-select" [ngModel]="kind" (ngModelChange)="kindChange.emit($event)"
                [attr.aria-label]="'Element kind'">
            <option *ngFor="let k of kinds" [value]="k">{{ kindLabels[k] }}</option>
        </select>
    `,
    styles: [`
        :host { display: flex; }
        .kind-select {
            border: none;
            border-right: 1px solid var(--border-light, #e0e3e9);
            background: #f3f7fc;
            font-size: 11px;
            font-weight: 600;
            letter-spacing: 0.02em;
            padding: 0 8px;
            color: #0d47a1;
            cursor: pointer;
        }
        .kind-select:hover { background: #e8f1fc; }
        .kind-select:focus { outline: none; background: #e3f2fd; }
    `]
})
export class MatrixElementTypeSelectorComponent {
    @Input() kind: MatrixElementKind = 'number';
    @Output() kindChange = new EventEmitter<MatrixElementKind>();

    readonly kinds = MATRIX_ELEMENT_KINDS;
    readonly kindLabels = MATRIX_ELEMENT_KIND_LABELS;
}
