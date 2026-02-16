import { Component, ViewChild, AfterViewInit, Inject } from '@angular/core';
import { FormControl } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { RuntimeConfigService } from '@services/runtime-config.service';
import { VariableModifierComponent } from '@components/create-new-class/variable-modifier/variable-modifier';

@Component({
  standalone: false,
  selector: 'edit-class-dialog',
  templateUrl: 'edit-class-dialog.html',
  styleUrls: ['./edit-class-dialog.css']
})
export class EditClassDialogComponent implements AfterViewInit {

  @ViewChild(VariableModifierComponent) variableModifier!: VariableModifierComponent;

  className: string;
  classDisplayName: string;
  classDisplayNameControl = new FormControl();
  saveStatus: 'idle' | 'saving' | 'success' | 'error' = 'idle';
  saveMessage = '';

  constructor(
    private http: HttpClient,
    private runtimeConfig: RuntimeConfigService,
    private dialogRef: MatDialogRef<EditClassDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { className: string, displayName: string, variables: any[] }
  ) {
    this.className = data.className;
    this.classDisplayName = data.displayName || data.className;
  }

  ngAfterViewInit() {
    if (this.data.variables && this.data.variables.length > 0) {
      this.variableModifier.loadVariableDefinitions(this.data.variables);
    }
  }

  saveChanges() {
    this.saveStatus = 'saving';
    this.saveMessage = 'Saving changes...';

    const typeMap: Record<string, string> = {
      'String': 'str',
      'Integer': 'int',
      'Decimal': 'float',
      'List': 'list',
      'Dictionary': 'dict',
      'Reference': 'reference',
      'Unique Identifier - Alphanumeric': 'str',
      'Numeric Index': 'int'
    };

    const variables = this.variableModifier.variableConfigDefs.map(varDef => ({
      varName: varDef.varName,
      varDisplayName: varDef.varDisplayName,
      varType: typeMap[varDef.varType] || 'str',
      isIdentifier: varDef.soleIdentifier || varDef.jointIdentifier,
      isUnique: varDef.isUnique,
      refClass: varDef.varRefClass
    }));

    const payload = {
      className: this.className,
      classDisplayName: this.classDisplayName.trim() || this.className,
      variables: variables
    };

    const backendUrl = this.runtimeConfig.getBackendBaseUrl();

    this.http.put<any>(`${backendUrl}/createClass`, payload).subscribe({
      next: (response) => {
        console.log('Class updated successfully:', response);
        this.saveStatus = 'success';
        this.saveMessage = `Class "${this.className}" updated successfully!`;
        // Close dialog after short delay to show success message
        setTimeout(() => this.dialogRef.close(true), 800);
      },
      error: (error) => {
        console.error('Failed to update class:', error);
        this.saveStatus = 'error';
        this.saveMessage = error.error?.error || 'Failed to update class. Please try again.';
      }
    });
  }

  cancel() {
    this.dialogRef.close(false);
  }
}
