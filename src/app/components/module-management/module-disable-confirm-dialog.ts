import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

export interface ModuleDisableConfirmData {
  moduleName: string;
  moduleId: string;
  classCount: number;
  instanceCount: number;
}

@Component({
  standalone: true,
  selector: 'module-disable-confirm-dialog',
  template: `
    <h2 mat-dialog-title>
      <mat-icon class="warning-icon">warning</mat-icon>
      Disable {{ data.moduleName }}?
    </h2>
    <mat-dialog-content>
      <p>Disabling this module will <strong>permanently purge</strong> all associated data:</p>
      <ul>
        <li>{{ data.instanceCount }} instance{{ data.instanceCount !== 1 ? 's' : '' }} across {{ data.classCount }} class{{ data.classCount !== 1 ? 'es' : '' }}</li>
        <li>Database tables will be dropped</li>
        <li>API routes will be deactivated</li>
        <li>Object typing registrations will be removed</li>
      </ul>
      <p class="warning-notice">This action cannot be undone. You can re-enable the module later, but all existing data will be lost.</p>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button [mat-dialog-close]="false">Cancel</button>
      <button mat-flat-button color="warn" [mat-dialog-close]="true">Disable &amp; Purge Data</button>
    </mat-dialog-actions>
  `,
  styles: [`
    .warning-icon {
      color: #f44336;
      vertical-align: middle;
      margin-right: 8px;
    }
    ul {
      margin: 12px 0;
      padding-left: 20px;
    }
    li {
      margin-bottom: 4px;
    }
    .warning-notice {
      background: #fff3e0;
      border-left: 4px solid #ff9800;
      padding: 8px 12px;
      margin-top: 12px;
      font-size: 13px;
    }
  `],
  imports: [
    CommonModule, MatDialogModule, MatButtonModule, MatIconModule
  ]
})
export class ModuleDisableConfirmDialogComponent {
  constructor(
    @Inject(MAT_DIALOG_DATA) public data: ModuleDisableConfirmData,
    private dialogRef: MatDialogRef<ModuleDisableConfirmDialogComponent>
  ) {}
}
