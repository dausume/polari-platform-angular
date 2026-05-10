// equation-cell.ts
//
// Display cell for `equation`-typed fields. Renders the LaTeX value via
// KaTeX inline. Falls back to a `<code>` block when the LaTeX fails to
// parse (soft validation — never breaks the table).

import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { KatexDisplayComponent } from '@components/shared/katex-display/katex-display.component';

@Component({
    standalone: true,
    selector: 'equation-cell',
    imports: [CommonModule, KatexDisplayComponent],
    template: `
        <div class="equation-cell">
            <katex-display *ngIf="value"
                           [latex]="value"
                           [displayMode]="false"
                           placeholder="-">
            </katex-display>
            <span *ngIf="!value" class="empty">-</span>
        </div>
    `,
    styles: [`
        .equation-cell {
            display: flex;
            align-items: center;
            min-height: 24px;
            font-size: 13px;
        }
        .empty {
            color: var(--text-tertiary, #888);
        }
    `],
})
export class EquationCellComponent {
    @Input() value: any = '';
    @Input() columnName: string = '';
    @Input() editable: boolean = false;
}
