import { Component, ViewChild } from '@angular/core';
import { FormControl, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { VariableModifierComponent } from './variable-modifier/variable-modifier';
import { RuntimeConfigService } from '@services/runtime-config.service';

@Component({
  standalone: false,
  selector: 'create-new-class',
  templateUrl: 'create-new-class.html',
  styleUrls: ['./create-new-class.css']
})
export class CreateNewClassComponent {

  @ViewChild(VariableModifierComponent) variableModifier!: VariableModifierComponent;

  className = ""
  classNameControl = new FormControl('', [Validators.required]);

  classDisplayName = ""
  classDisplayNameControl = new FormControl();

  // State-space configuration
  isStateSpaceObject = true;  // Default to true for new classes
  stateSpaceFieldsPerRow = 1;

  // Status messages
  saveStatus: 'idle' | 'saving' | 'success' | 'error' = 'idle';
  saveMessage = '';

  constructor(
    private http: HttpClient,
    private runtimeConfig: RuntimeConfigService
  ) {}

  ngOnInit()
  {
    // console.log("In create new class ngOnInit");
  }

  saveClass()
  {
    // Validate class name
    if (this.classNameControl.invalid || !this.className.trim()) {
      this.saveStatus = 'error';
      this.saveMessage = 'Class name is required';
      return;
    }

    // Check for circular inheritance errors before saving
    if (this.variableModifier.hasInheritanceErrors()) {
      this.saveStatus = 'error';
      this.saveMessage = 'Cannot save: circular inheritance detected. Please fix Parent Reference variables.';
      return;
    }

    this.saveStatus = 'saving';
    this.saveMessage = 'Creating class...';

    // Map frontend types to backend types
    const typeMap: Record<string, string> = {
      'String': 'str',
      'Integer': 'int',
      'Decimal': 'float',
      'List': 'list',
      'Dictionary': 'dict',
      'Reference': 'reference',
      'Parent Reference': 'parent_reference',
      'Unique Identifier - Alphanumeric': 'str',
      'Numeric Index': 'int'
    };

    // Build variables array from VariableModifierComponent
    const variables = this.variableModifier.variableConfigDefs.map(varDef => ({
      varName: varDef.varName,
      varDisplayName: varDef.varDisplayName,
      varType: typeMap[varDef.varType] || 'str',
      isIdentifier: varDef.soleIdentifier || varDef.jointIdentifier,
      isUnique: varDef.isUnique,
      refClass: varDef.varRefClass
    }));

    // Build inheritsFrom dict from Parent Reference variables
    const inheritsFrom: Record<string, string> = {};
    for (const varDef of this.variableModifier.variableConfigDefs) {
      if (varDef.varType === 'Parent Reference' && varDef.varRefClass && varDef.varName) {
        inheritsFrom[varDef.varName] = varDef.varRefClass;
      }
    }

    // Build the payload
    const payload: any = {
      className: this.className.trim(),
      classDisplayName: this.classDisplayName.trim() || this.className.trim(),
      variables: variables,
      // State-space configuration
      isStateSpaceObject: this.isStateSpaceObject,
      stateSpaceFieldsPerRow: this.stateSpaceFieldsPerRow,
      // Default display fields to all variables
      stateSpaceDisplayFields: this.isStateSpaceObject ? variables.map(v => v.varName) : []
    };

    // Include inheritsFrom if there are parent references
    if (Object.keys(inheritsFrom).length > 0) {
      payload.inheritsFrom = inheritsFrom;
    }

    // console.log('Creating class with payload:', payload);

    const backendUrl = this.runtimeConfig.getBackendBaseUrl();

    this.http.post<any>(`${backendUrl}/createClass`, payload).subscribe({
      next: (response) => {
        // console.log('Class created successfully:', response);
        this.saveStatus = 'success';
        this.saveMessage = `Class "${response.className}" created successfully! API endpoint: ${response.apiEndpoint}`;
      },
      error: (error) => {
        console.error('Failed to create class:', error);
        this.saveStatus = 'error';
        this.saveMessage = error.error?.error || 'Failed to create class. Please try again.';
      }
    });
  }

  addVar()
  {
    // console.log("adding variable");
  }

}
