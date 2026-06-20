import { ChangeDetectorRef, Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import {
    MatDialogModule, MatDialogRef, MAT_DIALOG_DATA,
} from '@angular/material/dialog';

import { MatrixElementModifierComponent } from '@components/matrices/matrix-element-modifier/matrix-element-modifier.component';
import { MatrixDefinitionService } from '@services/matrix/matrix-definition.service';
import {
    MatrixDefinitionRecord, MatrixElement, elementCountForShape, makeMatrixElement, toMatrixElements,
} from '@models/matrices/MatrixDefinition';

export interface MatrixEditDialogData { name: string; }

/**
 * Quick-edit popup for a matrix — reuses the SAME per-cell
 * `matrix-element-modifier` grid as the Matrices tab. Loads the matrix by
 * name, lets you edit cell values/types, and saves. Shape is read-only here
 * (use the Matrices tab to resize). Closes with `true` when saved so the
 * caller can refresh.
 */
@Component({
    standalone: true,
    selector: 'matrix-edit-dialog',
    imports: [
        CommonModule, MatDialogModule, MatButtonModule, MatIconModule,
        MatProgressSpinnerModule, MatrixElementModifierComponent,
    ],
    template: `
        <h2 mat-dialog-title class="title">
            <mat-icon>grid_on</mat-icon> Edit {{ data.name }}
            <span class="shape mono" *ngIf="record">[{{ record.shape.join(' × ') }}]</span>
        </h2>
        <mat-dialog-content>
            <div class="loading" *ngIf="busy">
                <mat-progress-spinner diameter="20" mode="indeterminate"></mat-progress-spinner>
            </div>
            <p class="err" *ngIf="error">{{ error }}</p>

            <ng-container *ngIf="record && supported">
                <table class="grid" *ngIf="isGrid">
                    <tr *ngFor="let r of gridRows; trackBy: trackByIndex">
                        <td *ngFor="let c of gridCols; trackBy: trackByIndex">
                            <matrix-element-modifier
                                [element]="cellAt(flatIndex(r, c))"
                                [matrixOptions]="matrixOptions"
                                (elementChange)="setCell(flatIndex(r, c), $event)">
                            </matrix-element-modifier>
                        </td>
                    </tr>
                </table>
                <div class="flat" *ngIf="!isGrid">
                    <div class="flat-cell" *ngFor="let i of flatIndices; trackBy: trackByIndex">
                        <span class="idx mono">{{ i }}</span>
                        <matrix-element-modifier
                            [element]="cellAt(i)"
                            [matrixOptions]="matrixOptions"
                            (elementChange)="setCell(i, $event)">
                        </matrix-element-modifier>
                    </div>
                </div>
            </ng-container>
            <p class="muted" *ngIf="record && !supported">
                This matrix isn't a 1-D/2-D grid — edit it on the Matrices tab.
            </p>
        </mat-dialog-content>
        <mat-dialog-actions align="end">
            <button mat-button mat-dialog-close>Cancel</button>
            <button mat-flat-button color="primary" [disabled]="busy || !record" (click)="save()">
                <mat-icon>save</mat-icon> Save
            </button>
        </mat-dialog-actions>
    `,
    styles: [`
        .title { display: flex; align-items: center; gap: 8px; }
        .title mat-icon { color: #1976d2; }
        .shape { font-size: 12px; color: #8a94a6; }
        .loading { padding: 20px; display: flex; justify-content: center; }
        .err { color: #b71c1c; }
        .grid { border-collapse: separate; border-spacing: 8px; }
        .grid td { padding: 0; min-width: 300px; }
        .flat { display: flex; flex-direction: column; gap: 8px; }
        .flat-cell { display: flex; align-items: center; gap: 8px; }
        .idx { width: 26px; text-align: right; color: #90a4c4; }
        .mono { font-family: monospace; }
        .muted { color: #8a94a6; }
    `]
})
export class MatrixEditDialogComponent implements OnInit {
    record: MatrixDefinitionRecord | null = null;
    matrixOptions: string[] = [];
    busy = true;
    error = '';
    supported = false;

    constructor(
        @Inject(MAT_DIALOG_DATA) public data: MatrixEditDialogData,
        private dialogRef: MatDialogRef<MatrixEditDialogComponent>,
        private svc: MatrixDefinitionService,
        private cdr: ChangeDetectorRef,
    ) {}

    ngOnInit(): void {
        this.svc.list$.subscribe(items => {
            this.matrixOptions = items.map(i => i.name).filter(n => n !== this.data.name);
            this.cdr.markForCheck();
        });
        this.svc.refreshList();
        this.svc.getByName(this.data.name).subscribe({
            next: rec => {
                if (rec.shape.length === 1 || rec.shape.length === 2) {
                    rec.values = toMatrixElements(rec.values, rec.elementType,
                        elementCountForShape(rec.shape));
                    rec.elementType = 'mixed';
                    this.supported = true;
                }
                this.record = rec;
                this.busy = false;
                this.cdr.markForCheck();
            },
            error: err => { this.error = `Load failed: ${err?.message || err}`; this.busy = false; this.cdr.markForCheck(); },
        });
    }

    get isGrid(): boolean { return !!this.record && this.record.shape.length === 2; }
    get gridRows(): number[] { return this.record ? Array.from({ length: this.record.shape[0] }, (_, i) => i) : []; }
    get gridCols(): number[] { return this.record ? Array.from({ length: this.record.shape[1] }, (_, i) => i) : []; }
    get flatIndices(): number[] { return this.record ? this.record.values.map((_, i) => i) : []; }
    flatIndex(r: number, c: number): number { return r * (this.record!.shape[1] || 1) + c; }

    cellAt(i: number): MatrixElement {
        return (this.record!.values[i] as MatrixElement) || makeMatrixElement('number');
    }
    setCell(i: number, el: MatrixElement): void { if (this.record) this.record.values[i] = el; }

    save(): void {
        if (!this.record) return;
        this.busy = true;
        this.svc.save(this.record).subscribe({
            next: () => this.dialogRef.close(true),
            error: err => { this.error = `Save failed: ${err?.message || err}`; this.busy = false; this.cdr.markForCheck(); },
        });
    }

    trackByIndex(i: number): number { return i; }
}
