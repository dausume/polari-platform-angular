// Author: Dustin Etts
// polari-platform-angular/src/app/models/stateSpace/formValidation.ts

/**
 * FormValidation - A state-space configuration object that introspects a form's
 * fields and generates one output slot per field for individual validation logic.
 *
 * Specific to FormSubscription flows (typescript_frontend only).
 *
 * Usage in state-space:
 * - Placed after a FormSubscription initial state
 * - Receives formData as input
 * - Dynamically generates output slots based on the linked form's field definitions
 * - Each output slot carries a single field value to its own validation branch
 * - An "allValid" output slot aggregates all field validation results
 */

/**
 * Represents a single form field that will get its own validation output slot
 */
export interface FormValidationField {
  /** Field name from the form definition */
  fieldName: string;
  /** Display name for the output slot label */
  displayName: string;
  /** Data type of the field (str, int, bool, etc.) */
  fieldType: string;
  /** Index of the generated output slot for this field */
  outputSlotIndex: number;
}

/**
 * FormValidation state-space configuration object.
 * Stored as boundObjectFieldValues in the solution definition JSON.
 */
export class FormValidation {
  type = 'FormValidation';
  /** Display name shown on the state node */
  displayName: string;
  /** Description of what this validation step does */
  description: string;
  /** Reference to the form this validation is bound to (form display item ID or name) */
  formReference: string;
  /** The bound class name whose fields define the form */
  boundClassName: string;
  /** Dynamically generated field list — each becomes an output slot */
  fields: FormValidationField[];

  constructor(
    displayName: string = 'Validate Form Fields',
    description: string = 'Route each form field to its own validation logic',
    formReference: string = '',
    boundClassName: string = '',
    fields: FormValidationField[] = []
  ) {
    this.displayName = displayName;
    this.description = description;
    this.formReference = formReference;
    this.boundClassName = boundClassName;
    this.fields = fields;
  }
}
