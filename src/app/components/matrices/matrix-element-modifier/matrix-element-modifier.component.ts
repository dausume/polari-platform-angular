import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

import { MatrixElementTypeSelectorComponent } from './matrix-element-type-selector.component';
import { MatrixElementEntryComponent } from './matrix-element-entry.component';
import { MatrixElement, MatrixElementKind, makeMatrixElement } from '@models/matrices/MatrixDefinition';

/**
 * Matrix Element Modifier — edits one matrix element. Two sub-components:
 * a type selector (number / equation / matrix) and a kind-reactive entry
 * field. Changing the kind resets the element to a fresh default of that kind;
 * editing the entry emits the updated element. Reuses overlay-style dialogs
 * (LaTeX editor, equation picker) via the entry component.
 */
@Component({
    standalone: true,
    selector: 'matrix-element-modifier',
    imports: [CommonModule, MatrixElementTypeSelectorComponent, MatrixElementEntryComponent],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <div class="modifier">
            <matrix-element-type-selector
                class="modifier-type"
                [kind]="element.kind"
                (kindChange)="onKindChange($event)">
            </matrix-element-type-selector>
            <div class="modifier-entry">
                <matrix-element-entry
                    [element]="element"
                    [matrixOptions]="matrixOptions"
                    (elementChange)="elementChange.emit($event)">
                </matrix-element-entry>
            </div>
        </div>
    `,
    styles: [`
        .modifier {
            display: flex;
            align-items: stretch;
            border: 1px solid var(--border-light, #e0e3e9);
            border-radius: 8px;
            background: white;
            overflow: hidden;
            box-shadow: 0 1px 2px rgba(16, 42, 90, 0.04);
        }
        .modifier-type { flex: 0 0 auto; display: flex; }
        .modifier-entry {
            flex: 1 1 auto;
            min-width: 0;
            display: flex;
            align-items: center;
            padding: 5px 7px;
        }
    `]
})
export class MatrixElementModifierComponent {
    @Input() element: MatrixElement = { kind: 'number', value: 0 };
    @Input() matrixOptions: string[] = [];
    @Output() elementChange = new EventEmitter<MatrixElement>();

    onKindChange(kind: MatrixElementKind): void {
        if (kind === this.element.kind) return;
        this.elementChange.emit(makeMatrixElement(kind));
    }
}
