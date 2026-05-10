// editable-equation-cell.ts
//
// Editor cell for `equation`-typed fields. Shows a clickable pill displaying
// the rendered LaTeX (or "(empty)") that opens the LatexEditDialog. On save,
// emits the new LaTeX as the form value.

import { Component, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { BaseEditableCell } from '../base-editable-cell';
import {
    LatexEditDialogComponent,
    LatexEditDialogResult,
} from '@components/shared/latex-edit-dialog/latex-edit-dialog';

@Component({
    standalone: false,
    selector: 'editable-equation-cell',
    templateUrl: 'editable-equation-cell.html',
    styleUrls: ['./editable-equation-cell.css'],
})
export class EditableEquationCellComponent extends BaseEditableCell implements OnInit {

    constructor(private dialog: MatDialog) {
        super();
    }

    override ngOnInit(): void {
        super.ngOnInit();
        // Open the dialog automatically when this cell starts in edit/create mode.
        if (this.mode === 'create' || this.mode === 'edit') {
            queueMicrotask(() => this.openEditor());
        }
    }

    /** Display value for the read-mode pill — shows the raw LaTeX (a future
     *  enhancement would render it inline via KaTeX, but raw text keeps the
     *  cell scannable in dense tables). */
    getDisplayValue(): string {
        const v = this.value;
        if (v === null || v === undefined || v === '') return '(empty)';
        const s = String(v);
        return s.length > 40 ? s.substring(0, 40) + '…' : s;
    }

    openEditor(): void {
        if (this.disabled) return;
        const ref = this.dialog.open(LatexEditDialogComponent, {
            width: '880px',
            maxWidth: '95vw',
            maxHeight: '90vh',
            autoFocus: true,
            // Sits above any state-popup that may have spawned this cell editor.
            panelClass: 'state-overlay-picker-popup-panel',
            data: {
                latex: this.value || '',
                title: this.displayName || 'Edit Equation',
                subtitle: 'Use the symbol palette on the right to insert math notation.',
            },
        });
        ref.afterClosed().subscribe((r: LatexEditDialogResult | undefined) => {
            if (r?.action === 'save') {
                this.value = r.latex || '';
                this.control.setValue(this.value);
                this.valueChange.emit(this.value);
                this.editCompleted.emit(this.value);
            } else {
                this.editCancelled.emit();
            }
        });
    }
}
