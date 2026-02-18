import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDividerModule } from '@angular/material/divider';
import { GeocoderDefinition, GeocoderType, GeocoderProvider } from '@models/geojson/GeocoderDefinition';
import { GeocoderDefinitionService } from '@services/geojson/geocoder-definition.service';
import { GeocoderService } from '@services/geojson/geocoder.service';

export interface GeocoderDetailDialogData {
    geocoderId: string;
}

@Component({
    standalone: true,
    selector: 'geocoder-detail-dialog',
    template: `
        <h2 mat-dialog-title>
            <mat-icon class="title-icon">{{ definition?.type === 'self-hosted' ? 'dns' : 'public' }}</mat-icon>
            Geocoder Details
        </h2>
        <mat-dialog-content>
            <div *ngIf="loading" class="loading-row">
                <mat-spinner diameter="24"></mat-spinner>
                <span>Loading geocoder...</span>
            </div>

            <div *ngIf="loadError" class="error-row">
                <mat-icon>warning</mat-icon>
                <span>{{ loadError }}</span>
            </div>

            <ng-container *ngIf="definition && !loading">
                <div class="type-section">
                    <div class="field-label">Geocoder Type</div>
                    <mat-button-toggle-group [(value)]="definition.type" class="full-width"
                                             (change)="onTypeChange()">
                        <mat-button-toggle value="self-hosted">Self-Hosted</mat-button-toggle>
                        <mat-button-toggle value="web-limited">Web API (Rate-Limited)</mat-button-toggle>
                    </mat-button-toggle-group>
                </div>

                <mat-form-field appearance="outline" class="full-width">
                    <mat-label>Provider</mat-label>
                    <mat-select [(value)]="definition.provider" (selectionChange)="onProviderChange()">
                        <mat-option *ngIf="definition.type === 'self-hosted'" value="pelias">Pelias</mat-option>
                        <mat-option *ngIf="definition.type === 'web-limited'" value="nominatim">Nominatim</mat-option>
                        <mat-option *ngIf="definition.type === 'web-limited'" value="google-maps">Google Maps</mat-option>
                    </mat-select>
                </mat-form-field>

                <mat-form-field appearance="outline" class="full-width">
                    <mat-label>Name</mat-label>
                    <input matInput [(ngModel)]="definition.name">
                </mat-form-field>

                <mat-form-field appearance="outline" class="full-width">
                    <mat-label>Base URL</mat-label>
                    <input matInput [(ngModel)]="definition.baseUrl">
                </mat-form-field>

                <mat-form-field *ngIf="definition.provider === 'google-maps'" appearance="outline" class="full-width">
                    <mat-label>API Key</mat-label>
                    <input matInput [(ngModel)]="definition.apiKey">
                </mat-form-field>

                <mat-form-field *ngIf="definition.type === 'web-limited'" appearance="outline" class="full-width">
                    <mat-label>Rate Limit (requests/sec)</mat-label>
                    <input matInput type="number" [(ngModel)]="definition.rateLimit" min="1">
                </mat-form-field>

                <mat-divider></mat-divider>

                <div class="test-section">
                    <button mat-stroked-button (click)="testConnection()" [disabled]="testing"
                            class="full-width">
                        <mat-icon>wifi_tethering</mat-icon>
                        {{ testing ? 'Testing...' : 'Test Connection' }}
                    </button>
                    <div *ngIf="testResult" class="test-result" [class.test-success]="testSuccess" [class.test-fail]="!testSuccess">
                        <mat-icon>{{ testSuccess ? 'check_circle' : 'error' }}</mat-icon>
                        <span>{{ testResult }}</span>
                    </div>
                </div>

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
            <button mat-button color="warn" (click)="deleteGeocoder()" [disabled]="saving || loading || deleting"
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
        .type-section { margin-bottom: 8px; }
        .field-label { font-size: 13px; font-weight: 500; color: #444; margin: 8px 0 6px 0; }
        .loading-row { display: flex; align-items: center; gap: 8px; color: #666; font-size: 13px; padding: 8px 0; }
        .error-row { display: flex; align-items: center; gap: 6px; color: #e15759; font-size: 13px; }
        .spacer { flex: 1; }
        .title-icon { vertical-align: middle; margin-right: 6px; }
        mat-dialog-actions { display: flex; }
        .test-section { margin: 8px 0; }
        .test-result { display: flex; align-items: center; gap: 6px; font-size: 13px; margin-top: 8px; }
        .test-success { color: #4caf50; }
        .test-fail { color: #e15759; }
    `],
    imports: [
        CommonModule, FormsModule, MatDialogModule, MatButtonModule, MatButtonToggleModule,
        MatFormFieldModule, MatInputModule, MatSelectModule, MatIconModule,
        MatProgressSpinnerModule, MatDividerModule
    ]
})
export class GeocoderDetailDialogComponent implements OnInit {
    definition: GeocoderDefinition | null = null;
    loading = true;
    loadError = '';
    saving = false;
    saveError = '';
    deleting = false;
    testing = false;
    testResult = '';
    testSuccess = false;

    constructor(
        @Inject(MAT_DIALOG_DATA) public data: GeocoderDetailDialogData,
        private dialogRef: MatDialogRef<GeocoderDetailDialogComponent>,
        private geocoderDefService: GeocoderDefinitionService,
        private geocoderService: GeocoderService
    ) {}

    ngOnInit(): void {
        this.geocoderDefService.loadDefinition(this.data.geocoderId).subscribe({
            next: (def) => {
                this.definition = def;
                this.loading = false;
            },
            error: (err) => {
                this.loading = false;
                this.loadError = 'Failed to load geocoder details.';
                console.error('[GeocoderDetailDialog] Load error:', err);
            }
        });
    }

    onTypeChange(): void {
        if (!this.definition) return;
        this.definition.provider = this.definition.type === 'self-hosted' ? 'pelias' : 'nominatim';
        this.onProviderChange();
    }

    onProviderChange(): void {
        if (!this.definition) return;
        this.definition.baseUrl = GeocoderDefinition.defaultBaseUrl(this.definition.provider);
        this.definition.rateLimit = GeocoderDefinition.defaultRateLimit(this.definition.provider);
        this.definition.apiKey = '';
    }

    testConnection(): void {
        if (!this.definition) return;
        this.testing = true;
        this.testResult = '';
        this.testSuccess = false;

        this.geocoderService.forwardGeocode('test', this.definition.id).subscribe({
            next: (results) => {
                this.testing = false;
                this.testSuccess = true;
                this.testResult = `Connected successfully. ${results.length} result(s) returned.`;
            },
            error: (err) => {
                this.testing = false;
                this.testSuccess = false;
                this.testResult = err?.message || err?.statusText || 'Connection failed.';
            }
        });
    }

    canSave(): boolean {
        return !!this.definition && !this.saving && !this.loading && !this.deleting
            && this.definition.name.trim().length > 0;
    }

    save(): void {
        if (!this.definition || !this.canSave()) return;
        this.saving = true;
        this.saveError = '';

        this.geocoderDefService.saveDefinition(this.definition).subscribe({
            next: () => {
                this.saving = false;
                this.dialogRef.close({ action: 'saved' });
            },
            error: (err) => {
                this.saving = false;
                this.saveError = err?.error?.error || 'Failed to save.';
                console.error('[GeocoderDetailDialog] Save error:', err);
            }
        });
    }

    deleteGeocoder(): void {
        if (!this.definition) return;
        this.deleting = true;

        this.geocoderDefService.deleteDefinition(this.definition.id).subscribe({
            next: () => {
                this.deleting = false;
                this.dialogRef.close({ action: 'deleted', id: this.definition!.id });
            },
            error: (err) => {
                this.deleting = false;
                this.saveError = err?.error?.error || 'Failed to delete.';
                console.error('[GeocoderDetailDialog] Delete error:', err);
            }
        });
    }
}
