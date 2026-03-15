// crud-dialog.ts
import { Component, Inject, OnInit, OnDestroy } from '@angular/core';
import { FormGroup, FormControl, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialog } from '@angular/material/dialog';
import { HttpClient } from '@angular/common/http';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { RuntimeConfigService } from '@services/runtime-config.service';
import { ClassTypingService } from '@services/class-typing-service';
import {
  CrudDialogData,
  CrudDialogResult,
  VariableDefinition,
  ParentClassSchema,
  getCellTypeForDataType,
  SelectOption
} from '../models/crud-config.models';
import {
  InstancePickerDialogComponent,
  InstancePickerDialogData,
  InstancePickerDialogResult
} from '../instance-picker-dialog/instance-picker-dialog';
import {
  ClassSelectorDialogComponent,
  ClassSelectorDialogResult
} from '../class-selector-dialog/class-selector-dialog';

@Component({
  standalone: false,
  selector: 'crud-dialog',
  templateUrl: 'crud-dialog.html',
  styleUrls: ['./crud-dialog.css']
})
export class CrudDialogComponent implements OnInit, OnDestroy {
  form: FormGroup;
  isSubmitting: boolean = false;
  submitError: string | null = null;

  private destroy$ = new Subject<void>();

  /** Display labels for selected references keyed by field name */
  refDisplayLabels: Record<string, string> = {};

  /** Parent class entries for multi-inheritance form sections */
  parentClassEntries: ParentClassSchema[] = [];

  /** Tracks which form fields belong to which parent class */
  private parentFieldMap: Map<string, string> = new Map(); // prefixed field name -> parent class name

  /** Per-parent mode: true = create inline (default), false = reference existing */
  parentCreateMode: Map<string, boolean> = new Map(); // parent className -> is creating inline

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: CrudDialogData,
    private dialogRef: MatDialogRef<CrudDialogComponent>,
    private dialog: MatDialog,
    private http: HttpClient,
    private runtimeConfig: RuntimeConfigService,
    private typingService: ClassTypingService
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
    console.log('[CrudDialog] buildForm called. mode:', this.data.mode,
      'parentSchemas:', this.data.parentSchemas,
      'schema fields:', this.data.schema.map(s => `${s.varName}(${s.varType})`),
      'hiddenFields:', this.data.hiddenFields);
    // Build parent class sections first (for multi-inheritance)
    if (this.data.parentSchemas && this.data.parentSchemas.length > 0 && this.data.mode === 'create') {
      for (const parentSchema of this.data.parentSchemas) {
        // Filter out 'id' from parent fields (auto-generated)
        const visibleFields = parentSchema.fields.filter(f => f.varName !== 'id');

        this.parentClassEntries.push({
          ...parentSchema,
          fields: visibleFields
        });

        // Default to inline creation mode
        this.parentCreateMode.set(parentSchema.className, true);

        // Add a hidden reference control for "reference existing" mode
        this.form.addControl(`_parentRef_${parentSchema.className}`, new FormControl(null));

        // Add each parent field to the form with a prefix to avoid collisions
        for (const field of visibleFields) {
          const prefixedName = `_parent_${parentSchema.className}_${field.varName}`;
          const initialValue = this.getDefaultValue(field.varType);
          const validators: any[] = [];
          if (field.required) {
            validators.push(Validators.required);
          }
          this.form.addControl(prefixedName, new FormControl(initialValue, validators));
          this.parentFieldMap.set(prefixedName, parentSchema.className);
        }
      }
    }

    // Build the child's own fields
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
      'reference': null,
      'referencelist': [],
      'reference list': [],
      'reference_list': []
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
   * Open the instance picker dialog for a reference field
   */
  openReferencePicker(varDef: VariableDefinition): void {
    const cellType = this.getCellType(varDef);
    const isMultiple = cellType === 'referenceList';

    // Get the referenced class name from multiple sources:
    // 1. Explicit refClass on the schema variable definition
    // 2. CLASS-ClassName-REFERENCE pattern in varType
    // 3. Fallback: look up refClass from the typing service's variablePolyTyping data
    let className = varDef.refClass || '';
    if (!className && varDef.varType) {
      const match = varDef.varType.match(/^CLASS-(.+)-REFERENCE$/);
      if (match) className = match[1];
    }
    if (!className && this.data.className) {
      // Try to get refClass from the typing service's variable typing data
      const classTyping = this.typingService.getClassPolyTyping(this.data.className);
      if (classTyping?.completeVariableTypingData) {
        const varTyping = classTyping.completeVariableTypingData[varDef.varName];
        if (varTyping?.refClass) {
          className = varTyping.refClass;
        }
      }
    }
    if (!className) {
      // Final fallback: show class selector so user can pick which class to browse
      this.showClassSelectorForReference(varDef, isMultiple);
      return;
    }

    this.openReferencePickerWithClass(varDef, className, isMultiple);
  }

  /**
   * Show a class selector dialog when refClass is unknown, then open the instance picker.
   * This handles legacy classes created before refClass metadata was stored.
   */
  private showClassSelectorForReference(varDef: VariableDefinition, isMultiple: boolean): void {
    const selectorRef = this.dialog.open(ClassSelectorDialogComponent, {
      data: {
        title: 'Select Referenced Class',
        subtitle: `Choose which class "${varDef.varDisplayName}" references`
      },
      width: '480px',
      maxHeight: '70vh',
      panelClass: 'instance-picker-overlay',
      autoFocus: false
    });

    selectorRef.afterClosed().subscribe((result: ClassSelectorDialogResult) => {
      if (result?.action === 'select' && result.className) {
        // Cache the selection so future clicks don't ask again
        varDef.refClass = result.className;
        this.openReferencePickerWithClass(varDef, result.className, isMultiple);
      }
    });
  }

  /**
   * Open the instance picker with a known class name.
   * Extracted to be reusable from both openReferencePicker and onRefClassSelected.
   */
  private openReferencePickerWithClass(varDef: VariableDefinition, className: string, isMultiple: boolean): void {
    const typing = this.typingService.getClassPolyTyping(className);
    const displayName = typing?.displayClassName || className;

    const currentValue = this.form.get(varDef.varName)?.value;
    let selectedIds: string[] = [];
    if (isMultiple && Array.isArray(currentValue)) {
      selectedIds = currentValue.map((v: any) => String(v));
    } else if (currentValue) {
      selectedIds = [String(currentValue)];
    }

    const dialogData: InstancePickerDialogData = {
      className,
      classDisplayName: displayName,
      multiple: isMultiple,
      selectedIds
    };

    const dialogRef = this.dialog.open(InstancePickerDialogComponent, {
      data: dialogData,
      width: '800px',
      maxHeight: '80vh',
      panelClass: 'instance-picker-overlay',
      autoFocus: false
    });

    dialogRef.afterClosed().subscribe((result: InstancePickerDialogResult) => {
      if (result?.action === 'select') {
        if (isMultiple) {
          const ids = result.selectedIds || [];
          this.form.get(varDef.varName)?.setValue(ids);
          this.refDisplayLabels[varDef.varName] = ids.length > 0
            ? `${ids.length} selected`
            : '';
        } else {
          const id = result.selectedIds?.[0] || null;
          this.form.get(varDef.varName)?.setValue(id);
          this.refDisplayLabels[varDef.varName] = id
            ? this.getRefLabel(result.selected)
            : '';
        }
      }
    });
  }

  /**
   * Get a display label for a reference value
   */
  getRefDisplayLabel(varDef: VariableDefinition): string {
    if (this.refDisplayLabels[varDef.varName]) {
      return this.refDisplayLabels[varDef.varName];
    }
    const value = this.form.get(varDef.varName)?.value;
    if (!value) return '';
    if (Array.isArray(value)) return `${value.length} selected`;
    return String(value);
  }

  private getRefLabel(instance: any): string {
    if (!instance) return '';
    for (const field of ['name', 'title', 'displayName', 'label']) {
      if (instance[field]) return `${instance[field]}`;
    }
    const idFields = ['id', '_instanceId', '_id'];
    for (const field of idFields) {
      if (instance[field] !== undefined) return String(instance[field]);
    }
    return '';
  }

  /**
   * Clear a reference field value
   */
  clearReference(varDef: VariableDefinition): void {
    const cellType = this.getCellType(varDef);
    const isMultiple = cellType === 'referenceList';
    this.form.get(varDef.varName)?.setValue(isMultiple ? [] : null);
    delete this.refDisplayLabels[varDef.varName];
  }

  /**
   * Toggle a parent entry between inline-create mode and reference-existing mode.
   */
  toggleParentMode(parentClassName: string): void {
    const current = this.parentCreateMode.get(parentClassName) ?? true;
    this.parentCreateMode.set(parentClassName, !current);
  }

  /**
   * Check if a parent entry is in inline-create mode.
   */
  isParentCreating(parentClassName: string): boolean {
    return this.parentCreateMode.get(parentClassName) ?? true;
  }

  /**
   * Open the instance picker for a parent in "reference existing" mode.
   */
  openParentReferencePicker(parentEntry: ParentClassSchema): void {
    const typing = this.typingService.getClassPolyTyping(parentEntry.className);
    const displayName = typing?.displayClassName || parentEntry.displayName;

    const refControlName = `_parentRef_${parentEntry.className}`;
    const currentValue = this.form.get(refControlName)?.value;
    const selectedIds: string[] = currentValue ? [String(currentValue)] : [];

    const dialogData: InstancePickerDialogData = {
      className: parentEntry.className,
      classDisplayName: displayName,
      multiple: false,
      selectedIds
    };

    const dialogRef = this.dialog.open(InstancePickerDialogComponent, {
      data: dialogData,
      width: '800px',
      maxHeight: '80vh',
      panelClass: 'instance-picker-overlay',
      autoFocus: false
    });

    dialogRef.afterClosed().subscribe((result: InstancePickerDialogResult) => {
      if (result?.action === 'select') {
        const id = result.selectedIds?.[0] || null;
        this.form.get(refControlName)?.setValue(id);
        this.refDisplayLabels[refControlName] = id
          ? this.getRefLabel(result.selected)
          : '';
      }
    });
  }

  /**
   * Clear the selected parent reference.
   */
  clearParentReference(parentClassName: string): void {
    const refControlName = `_parentRef_${parentClassName}`;
    this.form.get(refControlName)?.setValue(null);
    delete this.refDisplayLabels[refControlName];
  }

  /**
   * Get display label for a parent reference.
   */
  getParentRefDisplayLabel(parentClassName: string): string {
    const refControlName = `_parentRef_${parentClassName}`;
    if (this.refDisplayLabels[refControlName]) {
      return this.refDisplayLabels[refControlName];
    }
    const value = this.form.get(refControlName)?.value;
    return value ? String(value) : '';
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

    // console.log('[CrudDialog] Submitting form:', {
      // mode: this.data.mode,
      // className: this.data.className,
      // formData: formData,
      // formDataStringified: JSON.stringify(formData),
      // url: `${backendUrl}/${this.data.className}`
    // });

    if (this.data.mode === 'create') {
      // Restructure form data for multi-inheritance: extract parent fields into _parentData
      let submitData = formData;
      if (this.parentClassEntries.length > 0) {
        const parentData: Record<string, Record<string, any>> = {};
        const parentRefs: Record<string, string> = {};
        const childData: Record<string, any> = {};

        for (const [key, value] of Object.entries(formData)) {
          // Skip parent ref controls (handled separately)
          if (key.startsWith('_parentRef_')) continue;

          const parentClass = this.parentFieldMap.get(key);
          if (parentClass) {
            // Only include inline fields if in create mode for this parent
            if (this.isParentCreating(parentClass)) {
              const originalName = key.replace(`_parent_${parentClass}_`, '');
              if (!parentData[parentClass]) parentData[parentClass] = {};
              parentData[parentClass][originalName] = value;
            }
          } else {
            childData[key] = value;
          }
        }

        // For parents in "reference existing" mode, include the reference ID
        for (const parentEntry of this.parentClassEntries) {
          if (!this.isParentCreating(parentEntry.className)) {
            const refValue = this.form.get(`_parentRef_${parentEntry.className}`)?.value;
            if (refValue) {
              // Pass the existing reference ID under the variable name
              parentRefs[parentEntry.varName] = refValue;
            }
          }
        }

        submitData = {
          ...childData,
          ...(Object.keys(parentData).length > 0 ? { _parentData: parentData } : {}),
          ...(Object.keys(parentRefs).length > 0 ? { _parentRefs: parentRefs } : {})
        };
      }

      // Backend expects multipart form data with initParamSets field
      // containing a JSON array of parameter sets
      const multipartData = new FormData();
      multipartData.append('initParamSets', JSON.stringify([submitData]));

      // console.log('[CrudDialog] Sending multipart data with initParamSets:', [formData]);
      // console.log('[CrudDialog] initParamSets JSON:', JSON.stringify([formData]));

      // POST to create new instance
      this.http.post(`${backendUrl}/${this.data.className}`, multipartData)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (response: any) => {
            // console.log('[CrudDialog] Create success - raw response:', response);
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
              // console.log('[CrudDialog] classData:', classData);
              // console.log('[CrudDialog] classData type:', typeof classData, 'isArray:', Array.isArray(classData));

              // Format B & C: Array-based formats
              if (Array.isArray(classData) && classData.length > 0) {
                const firstItem = classData[0];
                // console.log('[CrudDialog] firstItem:', firstItem);

                // Format B: Nested structure with { class, varsLimited, data: [...] }
                if (firstItem.data && Array.isArray(firstItem.data) && firstItem.data.length > 0) {
                  createdInstance = firstItem.data[0];
                  // console.log('[CrudDialog] Format B - Extracted from data array:', createdInstance);
                }
                // Format C: Direct array of instance objects (fallback)
                else if (typeof firstItem === 'object' && !firstItem.data) {
                  createdInstance = firstItem;
                  // console.log('[CrudDialog] Format C - Direct instance in array:', createdInstance);
                }
              }
              // Format A: Dictionary keyed by instance ID (non-array object)
              else if (typeof classData === 'object' && !Array.isArray(classData)) {
                const instanceIds = Object.keys(classData);
                if (instanceIds.length > 0) {
                  createdInstance = classData[instanceIds[0]];
                  // console.log('[CrudDialog] Format A - Extracted by instance ID:', createdInstance);
                }
              }
            }

            // console.log('[CrudDialog] Final instance data:', createdInstance);
            // console.log('[CrudDialog] Final instance keys:', Object.keys(createdInstance || {}));

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

      // console.log('[CrudDialog] Sending update with polariId:', instanceId, 'updateData:', formData);

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

    // console.log('[CrudDialog] Sending delete with targetInstance:', { id: instanceId });

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
   * Get the prefixed form control name for a parent field
   */
  getParentFieldName(parentClassName: string, fieldName: string): string {
    return `_parent_${parentClassName}_${fieldName}`;
  }

  /**
   * Get the dialog title
   */
  get dialogTitle(): string {
    const action = this.data.mode === 'create' ? 'Create' : 'Edit';
    return `${action} ${this.data.classDisplayName || this.data.className}`;
  }
}
