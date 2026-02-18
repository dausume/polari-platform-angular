import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDividerModule } from '@angular/material/divider';
import { GeolocationService } from '@services/geojson/geolocation.service';
import { AddressSearchComponent } from '@components/geojson-config/address-search/address-search';
import { GeocoderResult } from '@models/geojson/GeocoderDefinition';

@Component({
  standalone: true,
  selector: 'geolocation-dialog',
  template: `
    <h2 mat-dialog-title>Set Your Location</h2>
    <mat-dialog-content>

      <!-- Auto-detect section -->
      <div class="detect-section">
        <button mat-raised-button color="primary" (click)="detectLocation()" [disabled]="detecting">
          <mat-icon>my_location</mat-icon>
          Use My Location
        </button>
        <mat-spinner *ngIf="detecting" diameter="24"></mat-spinner>
        <div *ngIf="detectError" class="detect-error">
          <mat-icon>warning</mat-icon>
          <span>{{ detectError }}</span>
        </div>
      </div>

      <div class="divider-row">
        <mat-divider></mat-divider>
        <span class="divider-text">or search by address</span>
        <mat-divider></mat-divider>
      </div>

      <!-- Address search section -->
      <address-search (resultSelected)="onAddressSelected($event)"></address-search>

      <div class="divider-row">
        <mat-divider></mat-divider>
        <span class="divider-text">or enter manually</span>
        <mat-divider></mat-divider>
      </div>

      <!-- Manual entry section -->
      <div class="manual-section">
        <mat-form-field appearance="outline" class="coord-field">
          <mat-label>Latitude</mat-label>
          <input matInput type="number" [(ngModel)]="manualLat" placeholder="e.g. 40.7128" step="any">
        </mat-form-field>
        <mat-form-field appearance="outline" class="coord-field">
          <mat-label>Longitude</mat-label>
          <input matInput type="number" [(ngModel)]="manualLng" placeholder="e.g. -74.0060" step="any">
        </mat-form-field>
        <button mat-stroked-button color="primary" (click)="useManual()" [disabled]="!isManualValid()">
          <mat-icon>place</mat-icon>
          Use Manual Coordinates
        </button>
      </div>

    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button [mat-dialog-close]="null">Cancel</button>
    </mat-dialog-actions>
  `,
  styles: [`
    mat-dialog-content { display: flex; flex-direction: column; gap: 12px; min-width: 360px; }
    .detect-section { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
    .detect-error { display: flex; align-items: center; gap: 6px; color: #e15759; font-size: 13px; }
    .divider-row { display: flex; align-items: center; gap: 12px; margin: 8px 0; }
    .divider-row mat-divider { flex: 1; }
    .divider-text { color: #888; font-size: 13px; white-space: nowrap; }
    .manual-section { display: flex; flex-direction: column; gap: 8px; }
    .coord-field { width: 100%; }
  `],
  imports: [
    CommonModule, FormsModule, MatDialogModule, MatButtonModule,
    MatFormFieldModule, MatInputModule, MatIconModule, MatProgressSpinnerModule,
    MatDividerModule, AddressSearchComponent
  ]
})
export class GeolocationDialogComponent {
  detecting = false;
  detectError = '';
  manualLat: number | null = null;
  manualLng: number | null = null;

  constructor(
    private dialogRef: MatDialogRef<GeolocationDialogComponent>,
    private geolocationService: GeolocationService
  ) {}

  detectLocation(): void {
    this.detecting = true;
    this.detectError = '';
    this.geolocationService.detectLocation().subscribe({
      next: (loc) => {
        this.detecting = false;
        this.dialogRef.close(loc);
      },
      error: (err) => {
        this.detecting = false;
        if (err?.code === 1) {
          this.detectError = 'Location access denied. Please allow location access or enter coordinates manually.';
        } else if (err?.code === 3) {
          this.detectError = 'Location request timed out. Try again or enter coordinates manually.';
        } else {
          this.detectError = 'Could not detect location. Please enter coordinates manually.';
        }
      }
    });
  }

  onAddressSelected(result: GeocoderResult): void {
    const loc = { lng: result.lng, lat: result.lat };
    this.geolocationService.setManualLocation(loc.lat, loc.lng);
    this.dialogRef.close(loc);
  }

  isManualValid(): boolean {
    return this.manualLat !== null && this.manualLng !== null
      && !isNaN(this.manualLat) && !isNaN(this.manualLng)
      && this.manualLat >= -90 && this.manualLat <= 90
      && this.manualLng >= -180 && this.manualLng <= 180;
  }

  useManual(): void {
    if (this.isManualValid()) {
      const loc = { lng: this.manualLng!, lat: this.manualLat! };
      this.geolocationService.setManualLocation(loc.lat, loc.lng);
      this.dialogRef.close(loc);
    }
  }
}
