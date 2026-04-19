// Author: Dustin Etts
// Overlay component for FormValidation state in the no-code editor.
// Shows the linked form, its fields, and the dynamically generated validation output slots.

import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { FormValidationField } from '../../../models/stateSpace/formValidation';

@Component({
  standalone: false,
  selector: 'form-validation-overlay',
  templateUrl: './form-validation-overlay.component.html',
  styleUrls: ['./form-validation-overlay.component.css']
})
export class FormValidationOverlayComponent implements OnInit {
  @Input() x: number = 0;
  @Input() y: number = 0;
  @Input() width: number = 100;
  @Input() height: number = 100;

  @Input() stateName: string = '';
  @Input() boundObjectFieldValues: { [key: string]: any } = {};

  /** Available class names to bind the form to */
  @Input() availableClasses: { className: string; displayName: string; fields: { name: string; displayName: string; type: string }[] }[] = [];

  @Output() fieldValuesChanged = new EventEmitter<{ [key: string]: any }>();
  @Output() slotsChanged = new EventEmitter<FormValidationField[]>();

  displayName: string = 'Validate Form Fields';
  formReference: string = '';
  boundClassName: string = '';
  fields: FormValidationField[] = [];
  isCompact: boolean = false;

  ngOnInit(): void {
    this.displayName = this.boundObjectFieldValues['displayName'] || 'Validate Form Fields';
    this.formReference = this.boundObjectFieldValues['formReference'] || '';
    this.boundClassName = this.boundObjectFieldValues['boundClassName'] || '';
    this.fields = this.boundObjectFieldValues['fields'] || [];
    this.isCompact = this.width < 120;
  }

  onBoundClassChange(className: string): void {
    this.boundClassName = className;
    const selectedClass = this.availableClasses.find(c => c.className === className);
    if (selectedClass) {
      // Auto-generate one output slot per field
      this.fields = selectedClass.fields.map((field, index) => ({
        fieldName: field.name,
        displayName: field.displayName || field.name,
        fieldType: field.type,
        outputSlotIndex: index + 1 // slot 0 is "allValid"
      }));
    } else {
      this.fields = [];
    }
    this.emitChanges();
  }

  onFormReferenceChange(value: string): void {
    this.formReference = value;
    this.emitChanges();
  }

  onDisplayNameChange(value: string): void {
    this.displayName = value;
    this.emitChanges();
  }

  private emitChanges(): void {
    const updated = {
      ...this.boundObjectFieldValues,
      displayName: this.displayName,
      formReference: this.formReference,
      boundClassName: this.boundClassName,
      fields: this.fields
    };
    this.fieldValuesChanged.emit(updated);
    this.slotsChanged.emit(this.fields);
  }
}
