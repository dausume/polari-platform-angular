import {
    ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, Input, Output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';

import { SharedCrudModule } from '@components/shared/shared-crud.module';
import {
    LatexEditDialogComponent, LatexEditDialogResult,
} from '@components/shared/latex-edit-dialog/latex-edit-dialog';
import {
    EquationSelectorDialogComponent, EquationSelectorDialogResult,
} from '@components/shared/equation-selector-dialog/equation-selector-dialog';
import { MatrixElement } from '@models/matrices/MatrixDefinition';

/**
 * Sub-component of the Matrix Element Modifier: renders the data-entry field
 * matching the element's kind.
 *   - number   → reuses the shared `editable-number-cell` (compacted for grids)
 *   - equation → a LaTeX pill + two clearly-labelled actions: "LaTeX" (opens
 *                the shared LatexEditDialog) and "Saved" (EquationSelectorDialog)
 *   - matrix   → a dropdown of existing matrices
 * Free symbols in equation cells are bound from the Test tab's runtime
 * bindings, so there's no per-cell bindings field. Emits a fresh element on
 * every change so OnPush parents update.
 */
@Component({
    standalone: true,
    selector: 'matrix-element-entry',
    imports: [
        CommonModule, FormsModule, MatIconModule, MatButtonModule, MatTooltipModule,
        MatDialogModule, SharedCrudModule,
    ],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <ng-container [ngSwitch]="element.kind">
            <!-- number -->
            <div *ngSwitchCase="'number'" class="number-wrap">
                <editable-number-cell
                    mode="edit"
                    [value]="element.value ?? 0"
                    [decimalPlaces]="6"
                    (valueChange)="patch({ value: toNumber($event) })">
                </editable-number-cell>
            </div>

            <!-- equation -->
            <div *ngSwitchCase="'equation'" class="equation-wrap">
                <span class="latex-pill mono"
                      [class.is-empty]="isEquationEmpty"
                      [matTooltip]="equationTooltip">
                    {{ equationLabel }}
                </span>
                <button mat-stroked-button class="eq-action" (click)="openLatex()"
                        matTooltip="Define / edit LaTeX with the symbol palette">
                    <mat-icon>functions</mat-icon> LaTeX
                </button>
                <button mat-stroked-button class="eq-action" (click)="pickSaved()"
                        matTooltip="Reference a saved equation">
                    <mat-icon>library_books</mat-icon> Saved
                </button>
            </div>

            <!-- matrix -->
            <div *ngSwitchCase="'matrix'" class="matrix-wrap">
                <select class="matrix-select"
                        [ngModel]="element.matrixRef || ''"
                        (ngModelChange)="patch({ matrixRef: $event })">
                    <option value="">— pick matrix —</option>
                    <option *ngFor="let n of matrixOptions" [value]="n">{{ n }}</option>
                </select>
            </div>
        </ng-container>
    `,
    styles: [`
        :host { display: block; width: 100%; }

        /* number — compact the reused editable-number-cell so it sits cleanly
           in a grid (drop the form-field subscript, tighten the infix). */
        .number-wrap { width: 100%; }
        .number-wrap ::ng-deep .editable-number-cell { width: 100%; }
        .number-wrap ::ng-deep .mat-mdc-form-field-subscript-wrapper { display: none; }
        .number-wrap ::ng-deep .mat-mdc-text-field-wrapper { background: white; }
        .number-wrap ::ng-deep .mat-mdc-form-field-infix {
            min-height: 34px; padding-top: 6px; padding-bottom: 6px; width: auto;
        }
        .number-wrap ::ng-deep .edit-field { width: 100%; }

        /* equation */
        .equation-wrap {
            display: flex;
            align-items: center;
            gap: 6px;
            width: 100%;
        }
        .latex-pill {
            flex: 1 1 auto;
            min-width: 0;
            padding: 6px 10px;
            border: 1px solid #b9d6f6;
            border-radius: 6px;
            background: #eef5ff;
            color: #0d47a1;
            font-size: 12px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        .latex-pill.is-empty { color: #90a4c4; font-style: italic; }
        .eq-action {
            flex: 0 0 auto;
            min-width: 0;
            height: 30px;
            line-height: 30px;
            padding: 0 10px;
            font-size: 11px;
        }
        .eq-action ::ng-deep .mat-icon {
            font-size: 16px; width: 16px; height: 16px; margin-right: 2px;
            vertical-align: middle;
        }

        /* matrix */
        .matrix-wrap { width: 100%; }
        .matrix-select {
            width: 100%;
            padding: 7px 8px;
            border: 1px solid var(--border-light, #d6d9df);
            border-radius: 6px;
            background: white;
            font-size: 12px;
            color: #0d47a1;
        }
        .matrix-select:focus { outline: none; border-color: #1976d2; }

        .mono { font-family: monospace; }
    `]
})
export class MatrixElementEntryComponent {
    @Input() element: MatrixElement = { kind: 'number', value: 0 };
    @Input() matrixOptions: string[] = [];
    @Output() elementChange = new EventEmitter<MatrixElement>();

    constructor(private dialog: MatDialog, private cdr: ChangeDetectorRef) {}

    get isEquationEmpty(): boolean {
        return !this.element.equationRef && !(this.element.latex || '').trim();
    }

    get equationLabel(): string {
        if (this.element.equationRef) return 'ƒ ' + this.element.equationRef;
        const l = (this.element.latex || '').trim();
        return l ? l : 'no equation set';
    }

    get equationTooltip(): string {
        if (this.element.equationRef) return `Saved equation: ${this.element.equationRef}`;
        return this.element.latex ? `LaTeX: ${this.element.latex}` : 'Click LaTeX or Saved to set this element';
    }

    toNumber(v: any): number {
        const n = Number(v);
        return isFinite(n) ? n : 0;
    }

    patch(partial: Partial<MatrixElement>): void {
        this.elementChange.emit({ ...this.element, ...partial });
    }

    openLatex(): void {
        const ref = this.dialog.open(LatexEditDialogComponent, {
            width: '880px', maxWidth: '95vw', maxHeight: '90vh', autoFocus: true,
            panelClass: 'state-overlay-picker-popup-panel',
            data: {
                latex: this.element.latex || '',
                title: 'Edit Element Equation',
                subtitle: 'Use the symbol palette to insert math notation. Free symbols bind from the Test tab.',
            },
        });
        ref.afterClosed().subscribe((r: LatexEditDialogResult | undefined) => {
            if (r?.action === 'save') {
                this.patch({ latex: r.latex || '', equationRef: undefined });
                this.cdr.markForCheck();
            }
        });
    }

    pickSaved(): void {
        const ref = this.dialog.open(EquationSelectorDialogComponent, {
            width: '640px', maxWidth: '95vw', maxHeight: '85vh',
            panelClass: 'state-overlay-picker-popup-panel',
            data: { title: 'Select an equation', subtitle: 'Reference a saved EquationDefinition.' },
        });
        ref.afterClosed().subscribe((r: EquationSelectorDialogResult | undefined) => {
            if (r?.action === 'select' && r.equationName) {
                this.patch({ equationRef: r.equationName, latex: undefined });
                this.cdr.markForCheck();
            }
        });
    }
}
