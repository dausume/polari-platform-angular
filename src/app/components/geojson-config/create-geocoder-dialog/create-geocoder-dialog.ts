import { Component, Inject } from '@angular/core';
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
import {
    GeocoderType, GeocoderProvider, GeocoderDefinition
} from '@models/geojson/GeocoderDefinition';
import { GeocoderDefinitionService } from '@services/geojson/geocoder-definition.service';

export interface CreateGeocoderDialogData {
    preselectedType?: GeocoderType;
}

export interface CreateGeocoderDialogResult {
    id: string;
    name: string;
    type: GeocoderType;
    provider: GeocoderProvider;
}

@Component({
    standalone: true,
    selector: 'create-geocoder-dialog',
    template: `
        <h2 mat-dialog-title>Create Geocoder</h2>
        <mat-dialog-content>
            <div class="type-section">
                <div class="field-label">Geocoder Type</div>
                <mat-button-toggle-group [(value)]="type" (change)="onTypeChange()" class="full-width">
                    <mat-button-toggle value="self-hosted">Self-Hosted</mat-button-toggle>
                    <mat-button-toggle value="web-limited">Web API (Rate-Limited)</mat-button-toggle>
                </mat-button-toggle-group>
            </div>

            <mat-form-field appearance="outline" class="full-width">
                <mat-label>Provider</mat-label>
                <mat-select [(value)]="provider" (selectionChange)="onProviderChange()">
                    <mat-option *ngIf="type === 'self-hosted'" value="pelias">Pelias (Self-Hosted)</mat-option>
                    <mat-option *ngIf="type === 'web-limited'" value="nominatim">Nominatim (OpenStreetMap)</mat-option>
                    <mat-option *ngIf="type === 'web-limited'" value="google-maps">Google Maps</mat-option>
                </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline" class="full-width">
                <mat-label>Name</mat-label>
                <input matInput [(ngModel)]="name" placeholder="e.g. Local Pelias, Nominatim Free" required>
            </mat-form-field>

            <mat-form-field appearance="outline" class="full-width">
                <mat-label>Base URL</mat-label>
                <input matInput [(ngModel)]="baseUrl" [placeholder]="getUrlPlaceholder()">
                <mat-hint>{{ getUrlHint() }}</mat-hint>
            </mat-form-field>

            <mat-form-field *ngIf="provider === 'google-maps'" appearance="outline" class="full-width">
                <mat-label>API Key</mat-label>
                <input matInput [(ngModel)]="apiKey" placeholder="Your Google Maps API key">
            </mat-form-field>

            <mat-form-field *ngIf="type === 'web-limited'" appearance="outline" class="full-width">
                <mat-label>Rate Limit (requests/sec)</mat-label>
                <input matInput type="number" [(ngModel)]="rateLimit" min="1" step="1">
                <mat-hint>Max requests per second to this provider</mat-hint>
            </mat-form-field>

            <div *ngIf="saving" class="saving-row">
                <mat-spinner diameter="20"></mat-spinner>
                <span>Creating geocoder...</span>
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
        MatFormFieldModule, MatInputModule, MatSelectModule, MatIconModule, MatProgressSpinnerModule
    ]
})
export class CreateGeocoderDialogComponent {
    type: GeocoderType = 'self-hosted';
    provider: GeocoderProvider = 'pelias';
    name = '';
    baseUrl = '';
    apiKey = '';
    rateLimit: number | null = null;
    saving = false;
    error = '';

    constructor(
        @Inject(MAT_DIALOG_DATA) public data: CreateGeocoderDialogData | null,
        private dialogRef: MatDialogRef<CreateGeocoderDialogComponent>,
        private geocoderService: GeocoderDefinitionService
    ) {
        if (data?.preselectedType) {
            this.type = data.preselectedType;
        }
        this.applyDefaults();
    }

    onTypeChange(): void {
        this.provider = this.type === 'self-hosted' ? 'pelias' : 'nominatim';
        this.applyDefaults();
    }

    onProviderChange(): void {
        this.applyDefaults();
    }

    private applyDefaults(): void {
        this.baseUrl = GeocoderDefinition.defaultBaseUrl(this.provider);
        this.rateLimit = GeocoderDefinition.defaultRateLimit(this.provider);
        this.apiKey = '';
    }

    getUrlPlaceholder(): string {
        return GeocoderDefinition.defaultBaseUrl(this.provider);
    }

    getUrlHint(): string {
        switch (this.provider) {
            case 'pelias': return 'URL of your self-hosted Pelias API';
            case 'nominatim': return 'Nominatim API endpoint';
            case 'google-maps': return 'Google Geocoding API endpoint';
            default: return '';
        }
    }

    canCreate(): boolean {
        return !this.saving && this.name.trim().length > 0 && this.baseUrl.trim().length > 0;
    }

    create(): void {
        if (!this.canCreate()) return;
        this.saving = true;
        this.error = '';

        this.geocoderService.createDefinition(
            this.name.trim(),
            this.type,
            this.provider,
            this.baseUrl.trim(),
            this.apiKey.trim(),
            this.rateLimit
        ).subscribe({
            next: (result: any) => {
                this.saving = false;
                const created: CreateGeocoderDialogResult = {
                    id: result?.id || '',
                    name: this.name.trim(),
                    type: this.type,
                    provider: this.provider
                };
                this.dialogRef.close(created);
            },
            error: (err: any) => {
                this.saving = false;
                this.error = err?.error?.error || err?.statusText || 'Failed to create geocoder.';
                console.error('[CreateGeocoderDialog] Error:', err);
            }
        });
    }
}
