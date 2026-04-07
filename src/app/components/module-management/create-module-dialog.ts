import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';

export interface ModuleClassField {
  name: string;
  type: string;
}

export interface ModuleClassDef {
  className: string;
  fields: ModuleClassField[];
}

export interface CreateModuleDialogResult {
  name: string;
  description: string;
  classes: ModuleClassDef[];
}

@Component({
  standalone: true,
  selector: 'create-module-dialog',
  template: `
    <h2 mat-dialog-title>Create New Module</h2>
    <mat-dialog-content>

      <mat-form-field appearance="outline" class="full-width">
        <mat-label>Module Name</mat-label>
        <input matInput [(ngModel)]="name" placeholder="e.g. Experiment Tracker" required>
        <mat-hint>Human-readable name for the module</mat-hint>
      </mat-form-field>

      <mat-form-field appearance="outline" class="full-width">
        <mat-label>Description</mat-label>
        <textarea matInput [(ngModel)]="description" rows="2" placeholder="What does this module do?"></textarea>
      </mat-form-field>

      <mat-divider></mat-divider>

      <div class="classes-section">
        <div class="section-header">
          <h3>Classes</h3>
          <button mat-stroked-button type="button" (click)="addClass()">
            <mat-icon>add</mat-icon> Add Class
          </button>
        </div>

        <div *ngFor="let cls of classes; let ci = index" class="class-block">
          <div class="class-header">
            <mat-form-field appearance="outline" class="class-name-field">
              <mat-label>Class Name</mat-label>
              <input matInput [(ngModel)]="cls.className" placeholder="e.g. Experiment" required>
              <mat-hint>PascalCase identifier</mat-hint>
            </mat-form-field>
            <button mat-icon-button color="warn" (click)="removeClass(ci)" *ngIf="classes.length > 1" title="Remove class">
              <mat-icon>delete</mat-icon>
            </button>
          </div>

          <div class="fields-section">
            <div *ngFor="let field of cls.fields; let fi = index" class="field-row">
              <mat-form-field appearance="outline" class="field-name">
                <mat-label>Field Name</mat-label>
                <input matInput [(ngModel)]="field.name" placeholder="e.g. title">
              </mat-form-field>
              <mat-form-field appearance="outline" class="field-type">
                <mat-label>Type</mat-label>
                <mat-select [(ngModel)]="field.type">
                  <mat-option *ngFor="let t of fieldTypes" [value]="t">{{ t }}</mat-option>
                </mat-select>
              </mat-form-field>
              <button mat-icon-button color="warn" (click)="removeField(ci, fi)" *ngIf="cls.fields.length > 1" title="Remove field">
                <mat-icon>remove_circle_outline</mat-icon>
              </button>
            </div>
            <button mat-stroked-button type="button" (click)="addField(ci)" class="add-field-btn">
              <mat-icon>add</mat-icon> Add Field
            </button>
          </div>

          <mat-divider *ngIf="ci < classes.length - 1"></mat-divider>
        </div>
      </div>

    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-raised-button color="primary" [disabled]="!isValid()" (click)="confirm()">
        Create Module
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    mat-dialog-content {
      min-width: 550px;
      max-height: 60vh;
    }
    .full-width {
      width: 100%;
      margin-bottom: 8px;
    }
    .classes-section {
      margin-top: 16px;
    }
    .section-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
    }
    .section-header h3 {
      margin: 0;
    }
    .class-block {
      margin-bottom: 16px;
      padding: 12px;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      background: #fafafa;
    }
    .class-header {
      display: flex;
      align-items: flex-start;
      gap: 8px;
    }
    .class-name-field {
      flex: 1;
    }
    .fields-section {
      margin-left: 16px;
      margin-top: 8px;
    }
    .field-row {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      margin-bottom: 4px;
    }
    .field-name {
      flex: 2;
    }
    .field-type {
      flex: 1;
      min-width: 100px;
    }
    .add-field-btn {
      margin-top: 4px;
      margin-bottom: 8px;
    }
  `],
  imports: [
    CommonModule, FormsModule, MatDialogModule, MatFormFieldModule,
    MatInputModule, MatButtonModule, MatSelectModule, MatIconModule, MatDividerModule
  ]
})
export class CreateModuleDialogComponent {
  name = '';
  description = '';
  classes: ModuleClassDef[] = [
    { className: '', fields: [{ name: '', type: 'str' }] }
  ];

  fieldTypes = ['str', 'int', 'float', 'bool', 'list', 'dict'];

  constructor(private dialogRef: MatDialogRef<CreateModuleDialogComponent>) {}

  addClass(): void {
    this.classes.push({ className: '', fields: [{ name: '', type: 'str' }] });
  }

  removeClass(index: number): void {
    this.classes.splice(index, 1);
  }

  addField(classIndex: number): void {
    this.classes[classIndex].fields.push({ name: '', type: 'str' });
  }

  removeField(classIndex: number, fieldIndex: number): void {
    this.classes[classIndex].fields.splice(fieldIndex, 1);
  }

  isValid(): boolean {
    if (!this.name.trim()) return false;
    if (this.classes.length === 0) return false;

    for (const cls of this.classes) {
      if (!cls.className.trim()) return false;
      if (cls.fields.length === 0) return false;
      const hasValidField = cls.fields.some(f => f.name.trim().length > 0);
      if (!hasValidField) return false;
    }
    return true;
  }

  confirm(): void {
    // Filter out empty fields
    const result: CreateModuleDialogResult = {
      name: this.name.trim(),
      description: this.description.trim(),
      classes: this.classes.map(cls => ({
        className: cls.className.trim(),
        fields: cls.fields.filter(f => f.name.trim().length > 0).map(f => ({
          name: f.name.trim(),
          type: f.type
        }))
      })).filter(cls => cls.className && cls.fields.length > 0)
    };

    this.dialogRef.close(result);
  }
}
