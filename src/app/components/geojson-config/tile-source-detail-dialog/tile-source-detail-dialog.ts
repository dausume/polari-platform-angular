import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDividerModule } from '@angular/material/divider';
import { TileSourceDefinition } from '@models/geojson/TileSourceDefinition';
import { TileSourceDefinitionService } from '@services/geojson/tile-source-definition.service';

export interface TileSourceDetailDialogData {
    tileSourceId: string;
}

@Component({
    standalone: true,
    selector: 'tile-source-detail-dialog',
    template: `
        <h2 mat-dialog-title>
            <mat-icon class="title-icon">{{ definition?.type === 's3-bucket' ? 'cloud' : 'dns' }}</mat-icon>
            Tile Source Details
        </h2>
        <mat-dialog-content>
            <div *ngIf="loading" class="loading-row">
                <mat-spinner diameter="24"></mat-spinner>
                <span>Loading tile source...</span>
            </div>

            <div *ngIf="loadError" class="error-row">
                <mat-icon>warning</mat-icon>
                <span>{{ loadError }}</span>
            </div>

            <ng-container *ngIf="definition && !loading">
                <div class="type-section">
                    <div class="field-label">Source Type</div>
                    <mat-button-toggle-group [(value)]="definition.type" class="full-width">
                        <mat-button-toggle value="tileserver">TileServer - mbTiles</mat-button-toggle>
                        <mat-button-toggle value="s3-bucket">S3 Bucket - pmTiles</mat-button-toggle>
                    </mat-button-toggle-group>
                </div>

                <mat-form-field appearance="outline" class="full-width">
                    <mat-label>Name</mat-label>
                    <input matInput [(ngModel)]="definition.name">
                </mat-form-field>

                <mat-form-field appearance="outline" class="full-width">
                    <mat-label>{{ definition.type === 's3-bucket' ? 'PMTiles URL' : 'Tile URL Pattern' }}</mat-label>
                    <input matInput [(ngModel)]="definition.url">
                    <mat-hint *ngIf="definition.type !== 's3-bucket'">
                        Use &#123;z&#125;, &#123;x&#125;, &#123;y&#125; placeholders
                    </mat-hint>
                </mat-form-field>

                <mat-form-field appearance="outline" class="full-width">
                    <mat-label>Attribution / Citation</mat-label>
                    <textarea matInput [(ngModel)]="definition.attribution" rows="2"></textarea>
                </mat-form-field>

                <mat-divider></mat-divider>

                <div class="field-label">Default View (Optional)</div>
                <div class="center-fields">
                    <mat-form-field appearance="outline" class="half-width">
                        <mat-label>Default Lng</mat-label>
                        <input matInput type="number" [ngModel]="definition.defaultCenter?.[0] ?? null"
                               (ngModelChange)="onDefaultLngChange($event)" step="0.001">
                    </mat-form-field>
                    <mat-form-field appearance="outline" class="half-width">
                        <mat-label>Default Lat</mat-label>
                        <input matInput type="number" [ngModel]="definition.defaultCenter?.[1] ?? null"
                               (ngModelChange)="onDefaultLatChange($event)" step="0.001">
                    </mat-form-field>
                </div>
                <mat-form-field appearance="outline" class="full-width">
                    <mat-label>Default Zoom</mat-label>
                    <input matInput type="number" [(ngModel)]="definition.defaultZoom" min="0" max="24" step="0.5">
                </mat-form-field>

                <div *ngIf="saving" class="loading-row">
                    <mat-spinner diameter="20"></mat-spinner>
                    <span>Saving...</span>
                </div>
                <div *ngIf="saveError" class="error-row">
                    <mat-icon>warning</mat-icon>
                    <span>{{ saveError }}</span>
                </div>
            </ng-container>
        </mat-dialog-content>
        <mat-dialog-actions align="end">
            <button mat-button color="warn" (click)="deleteSource()" [disabled]="saving || loading || deleting"
                    *ngIf="definition">
                <mat-icon>delete</mat-icon> Delete
            </button>
            <span class="spacer"></span>
            <button mat-button [mat-dialog-close]="null" [disabled]="saving">Close</button>
            <button mat-flat-button color="primary" (click)="save()" [disabled]="!canSave()"
                    *ngIf="definition">
                Save
            </button>
        </mat-dialog-actions>
    `,
    styles: [`
        mat-dialog-content { display: flex; flex-direction: column; gap: 8px; min-width: 420px; }
        .full-width { width: 100%; }
        .half-width { width: 48%; display: inline-block; margin-right: 4%; }
        .half-width:last-child { margin-right: 0; }
        .type-section { margin-bottom: 8px; }
        .field-label { font-size: 13px; font-weight: 500; color: #444; margin: 8px 0 6px 0; }
        .center-fields { display: flex; gap: 4%; }
        .loading-row { display: flex; align-items: center; gap: 8px; color: #666; font-size: 13px; padding: 8px 0; }
        .error-row { display: flex; align-items: center; gap: 6px; color: #e15759; font-size: 13px; }
        .spacer { flex: 1; }
        .title-icon { vertical-align: middle; margin-right: 6px; }
        mat-dialog-actions { display: flex; }
    `],
    imports: [
        CommonModule, FormsModule, MatDialogModule, MatButtonModule, MatButtonToggleModule,
        MatFormFieldModule, MatInputModule, MatIconModule, MatProgressSpinnerModule, MatDividerModule
    ]
})
export class TileSourceDetailDialogComponent implements OnInit {
    definition: TileSourceDefinition | null = null;
    loading = true;
    loadError = '';
    saving = false;
    saveError = '';
    deleting = false;

    constructor(
        @Inject(MAT_DIALOG_DATA) public data: TileSourceDetailDialogData,
        private dialogRef: MatDialogRef<TileSourceDetailDialogComponent>,
        private tileSourceService: TileSourceDefinitionService
    ) {}

    ngOnInit(): void {
        this.tileSourceService.loadDefinition(this.data.tileSourceId).subscribe({
            next: (def) => {
                this.definition = def;
                this.loading = false;
            },
            error: (err) => {
                this.loading = false;
                this.loadError = 'Failed to load tile source details.';
                console.error('[TileSourceDetailDialog] Load error:', err);
            }
        });
    }

    onDefaultLngChange(value: number | string): void {
        if (!this.definition) return;
        const num = typeof value === 'string' ? parseFloat(value) : value;
        if (value === null || value === '' || isNaN(num)) {
            if (this.definition.defaultCenter) this.definition.defaultCenter[0] = 0;
            return;
        }
        if (!this.definition.defaultCenter) this.definition.defaultCenter = [0, 0];
        this.definition.defaultCenter[0] = num;
    }

    onDefaultLatChange(value: number | string): void {
        if (!this.definition) return;
        const num = typeof value === 'string' ? parseFloat(value) : value;
        if (value === null || value === '' || isNaN(num)) {
            if (this.definition.defaultCenter) this.definition.defaultCenter[1] = 0;
            return;
        }
        if (!this.definition.defaultCenter) this.definition.defaultCenter = [0, 0];
        this.definition.defaultCenter[1] = num;
    }

    canSave(): boolean {
        return !!this.definition && !this.saving && !this.loading && !this.deleting
            && this.definition.name.trim().length > 0;
    }

    save(): void {
        if (!this.definition || !this.canSave()) return;
        this.saving = true;
        this.saveError = '';

        this.tileSourceService.saveDefinition(this.definition).subscribe({
            next: () => {
                this.saving = false;
                this.dialogRef.close({ action: 'saved' });
            },
            error: (err) => {
                this.saving = false;
                this.saveError = err?.error?.error || 'Failed to save.';
                console.error('[TileSourceDetailDialog] Save error:', err);
            }
        });
    }

    deleteSource(): void {
        if (!this.definition) return;
        this.deleting = true;

        this.tileSourceService.deleteDefinition(this.definition.id).subscribe({
            next: () => {
                this.deleting = false;
                this.dialogRef.close({ action: 'deleted', id: this.definition!.id });
            },
            error: (err) => {
                this.deleting = false;
                this.saveError = err?.error?.error || 'Failed to delete.';
                console.error('[TileSourceDetailDialog] Delete error:', err);
            }
        });
    }
}
