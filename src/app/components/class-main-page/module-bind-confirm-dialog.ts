import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

export interface ModuleBindConfirmData {
  className: string;
  moduleName: string;
  moduleId: string;
  isUnbinding: boolean;
}

export interface ModuleBindConfirmResult {
  confirmed: boolean;
  writeToModule: boolean;
}

@Component({
  standalone: true,
  selector: 'module-bind-confirm-dialog',
  template: `
    <h2 mat-dialog-title>
      <mat-icon>{{ data.isUnbinding ? 'link_off' : 'link' }}</mat-icon>
      {{ data.isUnbinding ? 'Unbind from Module' : 'Bind to Module' }}
    </h2>
    <mat-dialog-content>
      <p *ngIf="!data.isUnbinding">
        This will bind <strong>{{ data.className }}</strong> to the
        <strong>{{ data.moduleName }}</strong> module.
      </p>
      <p *ngIf="!data.isUnbinding" class="write-notice">
        <mat-icon class="notice-icon">edit_note</mat-icon>
        The class definition will be written as a Python file into the module's source directory.
        The module's registration and init files will be updated automatically.
      </p>
      <p *ngIf="data.isUnbinding">
        This will unbind <strong>{{ data.className }}</strong> from
        <strong>{{ data.moduleName }}</strong>. The class will become an unbound framework class.
        Existing source files in the module will not be deleted.
      </p>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="cancel()">Cancel</button>
      <button mat-raised-button [color]="data.isUnbinding ? 'warn' : 'primary'" (click)="confirm()">
        {{ data.isUnbinding ? 'Unbind' : 'Bind & Write to Module' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    h2 { display: flex; align-items: center; gap: 8px; }
    .write-notice {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      padding: 12px;
      background: #fff3e0;
      border-radius: 6px;
      border: 1px solid #ffe0b2;
      color: #e65100;
      font-size: 13px;
      margin-top: 12px;
    }
    .notice-icon { color: #f57c00; flex-shrink: 0; margin-top: 2px; }
    mat-dialog-content { min-width: 400px; }
  `],
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule]
})
export class ModuleBindConfirmDialogComponent {
  constructor(
    public dialogRef: MatDialogRef<ModuleBindConfirmDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: ModuleBindConfirmData
  ) {}

  cancel(): void {
    this.dialogRef.close({ confirmed: false, writeToModule: false });
  }

  confirm(): void {
    this.dialogRef.close({ confirmed: true, writeToModule: !this.data.isUnbinding });
  }
}
