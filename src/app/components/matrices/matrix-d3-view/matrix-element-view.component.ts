import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

import { KatexDisplayComponent } from '@components/shared/katex-display/katex-display.component';
import { MatrixGridCellComponent } from '@components/shared/matrix-grid-cell/matrix-grid-cell.component';
import { MatrixElement } from '@models/matrices/MatrixDefinition';

/**
 * Read-only pretty display of one matrix element — the overlay embedded at each
 * cell of the D3 Matrix View.
 *   - number   → formatted value
 *   - equation → ONLY the rendered math notation (KaTeX), same as the LaTeX
 *                editor preview. For a saved-equation ref the parent resolves
 *                its LaTeX and passes it in via `equationLatex`.
 *   - matrix   → a launch button that opens a viewer of the sub-matrix (or a
 *                cycle marker when opening it would recurse infinitely)
 */
@Component({
    standalone: true,
    selector: 'matrix-element-view',
    imports: [CommonModule, MatIconModule, MatTooltipModule, KatexDisplayComponent, MatrixGridCellComponent],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <ng-container [ngSwitch]="element.kind">
            <span *ngSwitchCase="'number'" class="num">
                <matrix-grid-cell [value]="element.value ?? 0"></matrix-grid-cell>
            </span>

            <ng-container *ngSwitchCase="'equation'">
                <katex-display *ngIf="latexToShow; else noEq" [latex]="latexToShow" [displayMode]="false">
                </katex-display>
                <ng-template #noEq><span class="empty">·</span></ng-template>
            </ng-container>

            <ng-container *ngSwitchCase="'matrix'">
                <span *ngIf="!element.matrixRef" class="empty">—</span>
                <span *ngIf="element.matrixRef && matrixIsCycle" class="cycle"
                      matTooltip="Recursive reference — opening this would loop">
                    <mat-icon>sync_problem</mat-icon>{{ element.matrixRef }}
                </span>
                <button *ngIf="element.matrixRef && !matrixIsCycle" class="launch" type="button"
                        (click)="launch.emit(element.matrixRef!)"
                        matTooltip="Open this matrix in a viewer">
                    <mat-icon class="grid">grid_on</mat-icon>
                    <span class="ref">{{ element.matrixRef }}</span>
                    <mat-icon class="open">open_in_new</mat-icon>
                </button>
            </ng-container>
        </ng-container>
    `,
    styles: [`
        :host { display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; overflow: hidden; }
        .num { font-family: monospace; font-size: 14px; color: #14233f; }
        .empty { color: #b0bbcb; }
        .launch {
            display: inline-flex; align-items: center; gap: 4px;
            padding: 5px 8px; border: 1px solid #b6e0c0; border-radius: 999px;
            background: #e8f5ec; color: #1e6f3b; font-size: 11px; font-weight: 600;
            cursor: pointer; max-width: 100%;
        }
        .launch:hover { background: #d9eede; }
        .launch .ref { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .launch mat-icon { font-size: 15px; width: 15px; height: 15px; }
        .launch .open { opacity: 0.7; }
        .cycle {
            display: inline-flex; align-items: center; gap: 4px;
            padding: 4px 8px; border-radius: 999px;
            background: #fdecea; color: #b71c1c; font-size: 11px; font-weight: 600;
        }
        .cycle mat-icon { font-size: 15px; width: 15px; height: 15px; }
    `]
})
export class MatrixElementViewComponent {
    @Input() element: MatrixElement = { kind: 'number', value: 0 };
    /** Resolved LaTeX for an equation-ref cell (parent supplies). */
    @Input() equationLatex = '';
    /** True when this matrix cell's ref is an ancestor (would recurse). */
    @Input() matrixIsCycle = false;
    /** Emits the referenced matrix name to open its viewer. */
    @Output() launch = new EventEmitter<string>();

    get latexToShow(): string {
        return (this.element.latex || '').trim() || (this.equationLatex || '').trim();
    }
}
