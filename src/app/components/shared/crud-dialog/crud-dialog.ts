// crud-dialog.ts
import { Component, Inject, OnInit, OnDestroy } from '@angular/core';
import { FormGroup, FormControl, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { HttpClient } from '@angular/common/http';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { RuntimeConfigService } from '@services/runtime-config.service';
import {
  CrudDialogData,
  CrudDialogResult,
  VariableDefinition,
  getCellTypeForDataType,
  SelectOption
} from '../models/crud-config.models';

@Component({
  selector: 'crud-dialog',
  templateUrl: 'crud-dialog.html',
  styleUrls: ['./crud-dialog.css']
})
export class CrudDialogComponent implements OnInit, OnDestroy {
  form: FormGroup;
  isSubmitting: boolean = false;
  submitError: string | null = null;

  private destroy$ = new Subject<void>();

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: CrudDialogData,
    private dialogRef: MatDialogRef<CrudDialogComponent>,
    private http: HttpClient,
    private runtimeConfig: RuntimeConfigService
  ) {
    this.form = new FormGroup({});
  }

  ngOnInit(): void {
    this.buildForm();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Build the form dynamically based on schema
   */
  private buildForm(): void {
    this.data.schema.forEach(varDef => {
      // Skip hidden fields
      if (this.data.hiddenFields?.includes(varDef.varName)) {
        return;
      }

      // Get initial value
      let initialValue = this.data.instance?.[varDef.varName];
      if (initialValue === undefined) {
        initialValue = this.getDefaultValue(varDef.varType);
      }

      // Build validators
      const validators: any[] = [];
      if (varDef.required) {
        validators.push(Validators.required);
      }

      // Create the control
      const control = new FormControl(initialValue, validators);

      // Disable if read-only
      if (this.data.readOnlyFields?.includes(varDef.varName)) {
        control.disable();
      }

      this.form.addControl(varDef.varName, control);
    });
  }

  /**
   * Get default value for a type
   */
  private getDefaultValue(varType: string): any {
    const defaults: Record<string, any> = {
      'str': '',
      'string': '',
      'int': 0,
      'integer': 0,
      'float': 0,
      'number': 0,
      'bool': false,
      'boolean': false,
      'list': [],
      'dict': {},
      'date': null,
      'datetime': null,
      'reference': null
    };
    return defaults[varType?.toLowerCase()] ?? '';
  }

  /**
   * Get the cell type for a variable
   */
  getCellType(varDef: VariableDefinition): string {
    return getCellTypeForDataType(varDef.varType);
  }

  /**
   * Get options for a select field
   */
  getOptions(varDef: VariableDefinition): SelectOption[] {
    return varDef.options || [];
  }

  /**
   * Check if a field is read-only
   */
  isReadOnly(varName: string): boolean {
    return this.data.readOnlyFields?.includes(varName) || false;
  }

  /**
   * Check if a field is hidden
   */
  isHidden(varName: string): boolean {
    return this.data.hiddenFields?.includes(varName) || false;
  }

  /**
   * Get visible fields
   */
  get visibleFields(): VariableDefinition[] {
    return this.data.schema.filter(v => !this.isHidden(v.varName));
  }

  /**
   * Handle form submission
   */
  onSubmit(): void {
    if (this.form.invalid) {
      // Mark all fields as touched to show validation errors
      Object.keys(this.form.controls).forEach(key => {
        this.form.get(key)?.markAsTouched();
      });
      return;
    }

    this.isSubmitting = true;
    this.submitError = null;

    const formData = this.form.getRawValue();
    const backendUrl = this.runtimeConfig.getBackendBaseUrl();

    console.log('[CrudDialog] Submitting form:', {
      mode: this.data.mode,
      className: this.data.className,
      formData: formData,
      formDataStringified: JSON.stringify(formData),
      url: `${backendUrl}/${this.data.className}`
    });

    if (this.data.mode === 'create') {
      // Backend expects multipart form data with initParamSets field
      // containing a JSON array of parameter sets
      const multipartData = new FormData();
      multipartData.append('initParamSets', JSON.stringify([formData]));

      console.log('[CrudDialog] Sending multipart data with initParamSets:', [formData]);
      console.log('[CrudDialog] initParamSets JSON:', JSON.stringify([formData]));

      // POST to create new instance
      this.http.post(`${backendUrl}/${this.data.className}`, multipartData)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (response: any) => {
            console.log('[CrudDialog] Create success - raw response:', response);
            this.isSubmitting = false;

            // IMPORTANT: Multiple backend response data formats co-exist and are used
            // interchangeably. Each format must be detected and coerced to extract
            // the actual instance data. Supported formats:
            //   Format A: { className: { instanceId: instanceData } } - dict keyed by ID
            //   Format B: { className: [{ class, varsLimited, data: [instanceData] }] } - getJSONdictForClass format
            //   Format C: { className: [instanceData, ...] } - direct array of instances
            let createdInstance = response;

            if (response && this.data.className && response[this.data.className]) {
              const classData = response[this.data.className];
              console.log('[CrudDialog] classData:', classData);
              console.log('[CrudDialog] classData type:', typeof classData, 'isArray:', Array.isArray(classData));

              // Format B & C: Array-based formats
              if (Array.isArray(classData) && classData.length > 0) {
                const firstItem = classData[0];
                console.log('[CrudDialog] firstItem:', firstItem);

                // Format B: Nested structure with { class, varsLimited, data: [...] }
                if (firstItem.data && Array.isArray(firstItem.data) && firstItem.data.length > 0) {
                  createdInstance = firstItem.data[0];
                  console.log('[CrudDialog] Format B - Extracted from data array:', createdInstance);
                }
                // Format C: Direct array of instance objects (fallback)
                else if (typeof firstItem === 'object' && !firstItem.data) {
                  createdInstance = firstItem;
                  console.log('[CrudDialog] Format C - Direct instance in array:', createdInstance);
                }
              }
              // Format A: Dictionary keyed by instance ID (non-array object)
              else if (typeof classData === 'object' && !Array.isArray(classData)) {
                const instanceIds = Object.keys(classData);
                if (instanceIds.length > 0) {
                  createdInstance = classData[instanceIds[0]];
                  console.log('[CrudDialog] Format A - Extracted by instance ID:', createdInstance);
                }
              }
            }

            console.log('[CrudDialog] Final instance data:', createdInstance);
            console.log('[CrudDialog] Final instance keys:', Object.keys(createdInstance || {}));

            this.dialogRef.close({
              action: 'save',
              data: createdInstance
            } as CrudDialogResult);
          },
          error: (error) => {
            this.isSubmitting = false;
            this.submitError = error.error?.error || 'Failed to create instance';
            console.error('[CrudDialog] Create failed:', error);
            console.error('[CrudDialog] Error details:', {
              status: error.status,
              statusText: error.statusText,
              errorBody: error.error,
              url: error.url
            });
          }
        });
    } else {
      // PUT to update existing instance
      // Polari backend expects multipart form data with:
      // - polariId: the instance ID
      // - updateData: JSON object with fields to update
      const instanceId = this.getInstanceId(this.data.instance);
      if (!instanceId) {
        this.submitError = 'Cannot update: Unable to determine instance ID';
        this.isSubmitting = false;
        return;
      }

      // Build multipart form data in Polari's expected format
      const multipartData = new FormData();
      multipartData.append('polariId', instanceId);
      multipartData.append('updateData', JSON.stringify(formData));

      console.log('[CrudDialog] Sending update with polariId:', instanceId, 'updateData:', formData);

      this.http.put(`${backendUrl}/${this.data.className}`, multipartData)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (response) => {
            this.isSubmitting = false;
            // Return the updated data (merge form data with response if available)
            const updatedData = response || { ...this.data.instance, ...formData };
            this.dialogRef.close({
              action: 'save',
              data: updatedData,
              changes: this.getChangedFields()
            } as CrudDialogResult);
          },
          error: (error) => {
            this.isSubmitting = false;
            this.submitError = error.error?.error || 'Failed to update instance';
            console.error('Update failed:', error);
          }
        });
    }
  }

  /**
   * Get fields that have changed
   */
  private getChangedFields(): Record<string, { oldValue: any; newValue: any }> {
    const changes: Record<string, { oldValue: any; newValue: any }> = {};
    const formData = this.form.getRawValue();

    Object.keys(formData).forEach(key => {
      const oldValue = this.data.instance?.[key];
      const newValue = formData[key];
      if (oldValue !== newValue) {
        changes[key] = { oldValue, newValue };
      }
    });

    return changes;
  }

  /**
   * Extract instance ID from instance data.
   * Checks multiple common ID field names.
   */
  private getInstanceId(instance: any): string | undefined {
    if (!instance) return undefined;
    const idFields = ['id', '_instanceId', '_id', 'Id', 'ID', 'instanceId'];
    for (const field of idFields) {
      if (instance[field] !== undefined && instance[field] !== null) {
        return String(instance[field]);
      }
    }
    console.warn('[CrudDialog] Could not find ID in instance. Available fields:', Object.keys(instance));
    return undefined;
  }

  /**
   * Handle cancel
   */
  onCancel(): void {
    this.dialogRef.close({ action: 'cancel' } as CrudDialogResult);
  }

  /**
   * Handle delete (only in edit mode)
   * Polari backend expects multipart form data with targetInstance field
   * containing a query dict to identify the instance (e.g., {"id": "someId"})
   */
  onDelete(): void {
    if (this.data.mode !== 'edit') {
      return;
    }

    this.isSubmitting = true;
    this.submitError = null;

    const backendUrl = this.runtimeConfig.getBackendBaseUrl();
    const instanceId = this.getInstanceId(this.data.instance);

    if (!instanceId) {
      this.submitError = 'Cannot delete: Unable to determine instance ID';
      this.isSubmitting = false;
      return;
    }

    // Build multipart form data in Polari's expected format
    // The backend expects a targetInstance field with a query dict
    const multipartData = new FormData();
    multipartData.append('targetInstance', JSON.stringify({ id: instanceId }));

    console.log('[CrudDialog] Sending delete with targetInstance:', { id: instanceId });

    // Note: HttpClient doesn't support body with DELETE by default,
    // so we use POST with a custom header or use the request method
    this.http.request('DELETE', `${backendUrl}/${this.data.className}`, {
      body: multipartData
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.isSubmitting = false;
          this.dialogRef.close({
            action: 'delete',
            data: this.data.instance
          } as CrudDialogResult);
        },
        error: (error) => {
          this.isSubmitting = false;
          this.submitError = error.error?.error || 'Failed to delete instance';
          console.error('Delete failed:', error);
        }
      });
  }

  /**
   * Handle field value change
   */
  onFieldChange(fieldName: string, value: any): void {
    this.form.get(fieldName)?.setValue(value);
  }

  /**
   * Get the dialog title
   */
  get dialogTitle(): string {
    const action = this.data.mode === 'create' ? 'Create' : 'Edit';
    return `${action} ${this.data.classDisplayName || this.data.className}`;
  }
}
