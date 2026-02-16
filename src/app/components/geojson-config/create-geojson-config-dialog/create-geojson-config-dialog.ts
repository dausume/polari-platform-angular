import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

export interface CreateGeoJsonConfigDialogData {
  name?: string;
  description?: string;
}

@Component({
  standalone: true,
  selector: 'create-geojson-config-dialog',
  template: `
    <h2 mat-dialog-title>Create GeoJSON Map Configuration</h2>
    <mat-dialog-content>
      <mat-form-field appearance="outline" class="full-width">
        <mat-label>Configuration Name</mat-label>
        <input matInput [(ngModel)]="name" placeholder="My Map Config" required>
      </mat-form-field>
      <mat-form-field appearance="outline" class="full-width">
        <mat-label>Description</mat-label>
        <textarea matInput [(ngModel)]="description" placeholder="Optional description" rows="3"></textarea>
      </mat-form-field>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button [mat-dialog-close]="null">Cancel</button>
      <button mat-flat-button color="primary" [disabled]="!name.trim()" (click)="confirm()">Create</button>
    </mat-dialog-actions>
  `,
  styles: [`
    .full-width { width: 100%; }
    mat-dialog-content { display: flex; flex-direction: column; gap: 8px; min-width: 360px; }
  `],
  imports: [
    CommonModule, FormsModule, MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule
  ]
})
export class CreateGeoJsonConfigDialogComponent {
  name: string = '';
  description: string = '';

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: CreateGeoJsonConfigDialogData | null,
    private dialogRef: MatDialogRef<CreateGeoJsonConfigDialogComponent>
  ) {
    if (data) {
      this.name = data.name || '';
      this.description = data.description || '';
    }
  }

  confirm(): void {
    if (this.name?.trim()) {
      this.dialogRef.close({ name: this.name.trim(), description: this.description.trim() });
    }
  }
}
