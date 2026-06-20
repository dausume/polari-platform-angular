import { ChangeDetectorRef, Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import {
    MatDialog, MatDialogModule, MatDialogRef, MAT_DIALOG_DATA,
} from '@angular/material/dialog';

import { MatrixD3ViewComponent, MatrixLaunchRequest } from './matrix-d3-view.component';
import { MatrixDefinitionService } from '@services/matrix/matrix-definition.service';
import { MatrixDefinitionRecord } from '@models/matrices/MatrixDefinition';

export interface MatrixViewerDialogData {
    name: string;
    /** Ancestor matrix names (root → parent of this one). */
    ancestry?: string[];
}

/**
 * Dialog that renders a matrix by name via the D3 Matrix View. Matrix-typed
 * cells inside re-launch this same dialog (recursively), passing an extended
 * ancestry chain so the D3 view blocks cycles instead of looping forever.
 */
@Component({
    standalone: true,
    selector: 'matrix-viewer-dialog',
    imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule, MatrixD3ViewComponent],
    template: `
        <h2 mat-dialog-title class="title">
            <mat-icon>grid_on</mat-icon> {{ data.name }}
        </h2>
        <mat-dialog-content>
            <p *ngIf="loading" class="muted">Loading…</p>
            <p *ngIf="error" class="err">{{ error }}</p>
            <matrix-d3-view *ngIf="record"
                [record]="record"
                [ancestry]="ancestry"
                (launchMatrix)="onLaunch($event)">
            </matrix-d3-view>
        </mat-dialog-content>
        <mat-dialog-actions align="end">
            <button mat-button mat-dialog-close>Close</button>
        </mat-dialog-actions>
    `,
    styles: [`
        .title { display: flex; align-items: center; gap: 8px; }
        .title mat-icon { color: #1976d2; }
        .muted { color: #8a94a6; }
        .err { color: #b71c1c; }
    `]
})
export class MatrixViewerDialogComponent implements OnInit {
    record: MatrixDefinitionRecord | null = null;
    ancestry: string[] = [];
    loading = true;
    error = '';

    constructor(
        @Inject(MAT_DIALOG_DATA) public data: MatrixViewerDialogData,
        private dialogRef: MatDialogRef<MatrixViewerDialogComponent>,
        private dialog: MatDialog,
        private svc: MatrixDefinitionService,
        private cdr: ChangeDetectorRef,
    ) {}

    ngOnInit(): void {
        this.ancestry = this.data.ancestry || [];
        this.svc.getByName(this.data.name).subscribe({
            next: rec => { this.record = rec; this.loading = false; this.cdr.markForCheck(); },
            error: err => {
                this.error = `Could not load '${this.data.name}': ${err?.message || err}`;
                this.loading = false; this.cdr.markForCheck();
            },
        });
    }

    onLaunch(req: MatrixLaunchRequest): void {
        if (req.ancestry.includes(req.ref)) return;   // cycle guard (defensive)
        this.dialog.open(MatrixViewerDialogComponent, {
            width: 'auto', maxWidth: '95vw', maxHeight: '90vh',
            data: { name: req.ref, ancestry: req.ancestry },
        });
    }
}
