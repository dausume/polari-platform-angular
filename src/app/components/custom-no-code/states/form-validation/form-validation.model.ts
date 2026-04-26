// Author: Dustin Etts
// polari-platform-angular/src/app/components/custom-no-code/states/form-validation/form-validation.model.ts

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
  /** Whether this field has an active validation output slot */
  enabled: boolean;
  /** Whether this field must pass for "All Valid" to fire */
  required: boolean;
  /** Debounce delay in ms before validation triggers after input (default 300) */
  debounceMs: number;
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
  /** Dynamically generated field list — each becomes an output slot */
  fields: FormValidationField[];

  constructor(
    displayName: string = 'Validate Form Fields',
    description: string = 'Route each form field to its own validation logic',
    fields: FormValidationField[] = []
  ) {
    this.displayName = displayName;
    this.description = description;
    this.fields = fields;
  }
}
