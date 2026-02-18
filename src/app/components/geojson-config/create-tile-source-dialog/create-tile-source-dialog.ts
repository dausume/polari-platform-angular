import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TileSourceType } from '@models/geojson/GeoJsonConfigData';
import { TileSourceDefinitionService } from '@services/geojson/tile-source-definition.service';

export interface CreateTileSourceDialogData {
    preselectedType?: TileSourceType;
}

export interface CreateTileSourceDialogResult {
    id: string;
    name: string;
    type: TileSourceType;
}

@Component({
    standalone: true,
    selector: 'create-tile-source-dialog',
    template: `
        <h2 mat-dialog-title>Create Tile Source</h2>
        <mat-dialog-content>
            <div class="type-section">
                <div class="field-label">Source Type</div>
                <mat-button-toggle-group [(value)]="type" class="full-width">
                    <mat-button-toggle value="tileserver">TileServer - mbTiles</mat-button-toggle>
                    <mat-button-toggle value="s3-bucket">S3 Bucket - pmTiles</mat-button-toggle>
                </mat-button-toggle-group>
            </div>

            <mat-form-field appearance="outline" class="full-width">
                <mat-label>Name</mat-label>
                <input matInput [(ngModel)]="name" placeholder="e.g. OpenStreetMap, My Custom Tiles" required>
            </mat-form-field>

            <mat-form-field appearance="outline" class="full-width">
                <mat-label>{{ type === 's3-bucket' ? 'PMTiles URL' : 'Tile URL Pattern' }}</mat-label>
                <input matInput [(ngModel)]="url"
                       [placeholder]="type === 's3-bucket'
                         ? 'https://bucket.s3.amazonaws.com/tiles.pmtiles'
                         : 'https://tile.example.com/{z}/{x}/{y}.png'">
                <mat-hint *ngIf="type !== 's3-bucket'">
                    Use &#123;z&#125;, &#123;x&#125;, &#123;y&#125; placeholders for tile coordinates
                </mat-hint>
            </mat-form-field>

            <mat-form-field appearance="outline" class="full-width">
                <mat-label>Attribution / Citation</mat-label>
                <textarea matInput [(ngModel)]="attribution" rows="2"
                          placeholder="&copy; Data Provider"></textarea>
                <mat-hint>HTML allowed for links</mat-hint>
            </mat-form-field>

            <div *ngIf="saving" class="saving-row">
                <mat-spinner diameter="20"></mat-spinner>
                <span>Creating tile source...</span>
            </div>
            <div *ngIf="error" class="error-row">
                <mat-icon>warning</mat-icon>
                <span>{{ error }}</span>
            </div>
        </mat-dialog-content>
        <mat-dialog-actions align="end">
            <button mat-button [mat-dialog-close]="null" [disabled]="saving">Cancel</button>
            <button mat-flat-button color="primary" [disabled]="!canCreate()" (click)="create()">Create</button>
        </mat-dialog-actions>
    `,
    styles: [`
        mat-dialog-content { display: flex; flex-direction: column; gap: 8px; min-width: 400px; }
        .full-width { width: 100%; }
        .type-section { margin-bottom: 8px; }
        .field-label { font-size: 13px; font-weight: 500; color: #444; margin-bottom: 6px; }
        .saving-row { display: flex; align-items: center; gap: 8px; color: #666; font-size: 13px; }
        .error-row { display: flex; align-items: center; gap: 6px; color: #e15759; font-size: 13px; }
    `],
    imports: [
        CommonModule, FormsModule, MatDialogModule, MatButtonModule, MatButtonToggleModule,
        MatFormFieldModule, MatInputModule, MatIconModule, MatProgressSpinnerModule
    ]
})
export class CreateTileSourceDialogComponent {
    type: TileSourceType = 'tileserver';
    name = '';
    url = '';
    attribution = '';
    saving = false;
    error = '';

    constructor(
        @Inject(MAT_DIALOG_DATA) public data: CreateTileSourceDialogData | null,
        private dialogRef: MatDialogRef<CreateTileSourceDialogComponent>,
        private tileSourceService: TileSourceDefinitionService
    ) {
        if (data?.preselectedType) {
            this.type = data.preselectedType;
        }
    }

    canCreate(): boolean {
        return !this.saving && this.name.trim().length > 0 && this.url.trim().length > 0;
    }

    create(): void {
        if (!this.canCreate()) return;
        this.saving = true;
        this.error = '';

        this.tileSourceService.createDefinition(
            this.name.trim(),
            this.type,
            this.url.trim(),
            this.attribution.trim()
        ).subscribe({
            next: (result: any) => {
                this.saving = false;
                const created: CreateTileSourceDialogResult = {
                    id: result?.id || '',
                    name: this.name.trim(),
                    type: this.type
                };
                this.dialogRef.close(created);
            },
            error: (err: any) => {
                this.saving = false;
                this.error = err?.error?.error || err?.statusText || 'Failed to create tile source.';
                console.error('[CreateTileSourceDialog] Error:', err);
            }
        });
    }
}
