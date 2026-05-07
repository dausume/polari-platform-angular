// Author: Dustin Etts
// Operation Selector / Reference popup.
//
// Combines two functions in one MatDialog:
//   1. Reference  — browse every supported operation organized by category,
//                   read its description, see example LaTeX, and learn about
//                   each input field's purpose + implications.
//   2. Selector   — click "Select" on any operation to choose it as the
//                   active operationType for the equation being edited.
//
// Reuses the same accordion / search-bar pattern as the symbol palette
// sidebar so the UX is consistent.

import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import {
    OPERATION_REFERENCE,
    OPERATION_CATEGORIES,
    OperationReferenceEntry,
} from '@models/equations/operation-reference';
import { EquationOperationType } from '@models/equations/EquationDefinition';

export interface OperationReferencePopupData {
    /** Currently-selected operation. Highlighted in the list as "selected". */
    currentOperation: EquationOperationType | null;
}

interface OperationCategoryGroup {
    name: string;
    icon: string;
    description: string;
    entries: OperationReferenceEntry[];
}

@Component({
    standalone: false,
    selector: 'app-operation-reference-popup',
    templateUrl: './operation-reference-popup.component.html',
    styleUrls: ['./operation-reference-popup.component.scss']
})
export class OperationReferencePopupComponent {
    query: string = '';
    expanded: { [name: string]: boolean } = {};

    constructor(
        @Inject(MAT_DIALOG_DATA) public data: OperationReferencePopupData,
        private dialogRef: MatDialogRef<OperationReferencePopupComponent, EquationOperationType>
    ) {
        // Open the category that contains the currently-selected op so the user
        // sees their pick on launch.
        if (data?.currentOperation) {
            const cat = OPERATION_REFERENCE.find(e => e.operation === data.currentOperation)?.category;
            if (cat) this.expanded[cat] = true;
        } else {
            // Default: open the first two categories.
            OPERATION_CATEGORIES.slice(0, 2).forEach(c => this.expanded[c.name] = true);
        }
    }

    /** Operations grouped by category, in the order defined by OPERATION_CATEGORIES. */
    get groupedOperations(): OperationCategoryGroup[] {
        return OPERATION_CATEGORIES.map(cat => ({
            ...cat,
            entries: OPERATION_REFERENCE.filter(e => e.category === cat.name),
        })).filter(g => g.entries.length > 0);
    }

    /** Flat search results when query is non-empty. */
    get filteredEntries(): OperationReferenceEntry[] {
        const q = this.query.trim().toLowerCase();
        if (!q) return [];
        return OPERATION_REFERENCE.filter(e =>
            e.label.toLowerCase().includes(q) ||
            e.description.toLowerCase().includes(q) ||
            e.latexPatterns.some(p => p.toLowerCase().includes(q)) ||
            e.inputs.some(i =>
                i.label.toLowerCase().includes(q) ||
                i.description.toLowerCase().includes(q)
            )
        );
    }

    isSelected(entry: OperationReferenceEntry): boolean {
        return entry.operation === this.data?.currentOperation;
    }

    toggleCategory(name: string): void {
        this.expanded[name] = !this.expanded[name];
    }

    isExpanded(name: string): boolean {
        return !!this.expanded[name];
    }

    selectOperation(entry: OperationReferenceEntry): void {
        this.dialogRef.close(entry.operation);
    }

    clearSearch(): void {
        this.query = '';
    }

    close(): void {
        this.dialogRef.close();
    }

    trackByOp(_: number, e: OperationReferenceEntry): string {
        return e.operation;
    }

    trackByCategory(_: number, g: OperationCategoryGroup): string {
        return g.name;
    }
}
