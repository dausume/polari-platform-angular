// Author: Dustin Etts
// Base overlay for the FormValidation state.
//
// Owns field-list state and upstream auto-detection; routes rendering to a sized
// sub-view (tiny / compact / full) based on the host rect width.
//
// Convention: see states/_shared/state-overlay/README.md.

import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { StateOverlayBase } from '../../../_shared/state-overlay/state-overlay-base';
import {
  FormValidationField,
  UpstreamField
} from './form-validation-overlay.types';

export { UpstreamField };

@Component({
  standalone: false,
  selector: 'form-validation-overlay',
  templateUrl: './form-validation-overlay.component.html',
  styleUrls: ['./form-validation-overlay.component.css']
})
export class FormValidationOverlayComponent extends StateOverlayBase implements OnInit, OnChanges {
  // State-specific inputs (standard inputs come from StateOverlayBase)
  @Input() solutionName: string = '';
  @Input() boundObjectFieldValues: { [key: string]: any } = {};
  /** Fields auto-detected from the upstream state (FormSubscription or initial state) */
  @Input() upstreamFields: UpstreamField[] = [];

  // State-specific outputs (popupRequested comes from base)
  @Output() fieldValuesChanged = new EventEmitter<{ [key: string]: any }>();
  @Output() slotsChanged = new EventEmitter<FormValidationField[]>();

  displayName: string = 'Validate Form Fields';
  fields: FormValidationField[] = [];

  // hasPopupView inherited as `false` from base — flip to true once popup/ is wired.

  get enabledCount(): number {
    return this.fields.filter(f => f.enabled).length;
  }

  get requiredCount(): number {
    return this.fields.filter(f => f.enabled && f.required).length;
  }

  override ngOnInit(): void {
    super.ngOnInit();
    this.displayName = this.boundObjectFieldValues['displayName'] || 'Validate Form Fields';
    this.initializeFields();
  }

  override ngOnChanges(changes: SimpleChanges): void {
    super.ngOnChanges(changes);
    if (changes['upstreamFields'] && !changes['upstreamFields'].firstChange) {
      this.initializeFields();
    }
  }

  onExpandClicked(): void {
    this.popupRequested.emit();
  }

  private initializeFields(): void {
    const savedFields: FormValidationField[] = this.boundObjectFieldValues['fields'] || [];
    const savedByName = new Map(savedFields.map(f => [f.fieldName, f]));

    if (this.upstreamFields.length > 0) {
      this.fields = this.upstreamFields.map((uf, index) => {
        const saved = savedByName.get(uf.fieldName);
        return {
          fieldName: uf.fieldName,
          displayName: uf.displayName,
          fieldType: uf.fieldType,
          outputSlotIndex: index + 2,
          enabled: saved?.enabled ?? true,
          required: saved?.required ?? uf.required,
          debounceMs: saved?.debounceMs ?? 300
        };
      });
    } else if (savedFields.length > 0) {
      this.fields = savedFields;
    }
  }

  onDisplayNameChange(value: string): void {
    this.displayName = value;
    this.emitChanges();
  }

  onFieldToggle(field: FormValidationField): void {
    field.enabled = !field.enabled;
    this.reindexFields();
    this.emitChanges();
  }

  onFieldRequiredToggle(field: FormValidationField): void {
    field.required = !field.required;
    this.emitChanges();
  }

  onFieldDebounceChange(payload: { field: FormValidationField; value: string }): void {
    payload.field.debounceMs = parseInt(payload.value, 10) || 300;
    this.emitChanges();
  }

  /**
   * Re-assign output slot indices for enabled fields only.
   * Slot 0 = input, Slot 1 = All Valid, Slot 2+ = enabled fields.
   */
  private reindexFields(): void {
    let slotIndex = 2;
    for (const field of this.fields) {
      if (field.enabled) {
        field.outputSlotIndex = slotIndex++;
      } else {
        field.outputSlotIndex = -1;
      }
    }
  }

  private emitChanges(): void {
    const updated = {
      ...this.boundObjectFieldValues,
      displayName: this.displayName,
      fields: this.fields
    };
    this.fieldValuesChanged.emit(updated);
    this.slotsChanged.emit(this.fields);
  }
}
