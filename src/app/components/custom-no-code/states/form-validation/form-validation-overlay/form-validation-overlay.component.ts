// Author: Dustin Etts
// Base overlay component for FormValidation state in the no-code editor.
// Owns field-list state and auto-detection logic; delegates rendering to
// sized sub-views (tiny / compact / full) based on the host rect width.

import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import {
  FormValidationField,
  FormValidationOverlaySizeTier,
  UpstreamField,
  resolveSizeTier
} from './form-validation-overlay.types';

export { UpstreamField };

@Component({
  standalone: false,
  selector: 'form-validation-overlay',
  templateUrl: './form-validation-overlay.component.html',
  styleUrls: ['./form-validation-overlay.component.css']
})
export class FormValidationOverlayComponent implements OnInit, OnChanges {
  @Input() x: number = 0;
  @Input() y: number = 0;
  @Input() width: number = 100;
  @Input() height: number = 100;

  @Input() stateName: string = '';
  @Input() solutionName: string = '';
  @Input() boundObjectFieldValues: { [key: string]: any } = {};

  /** Fields auto-detected from the upstream state (FormSubscription or initial state) */
  @Input() upstreamFields: UpstreamField[] = [];

  @Output() fieldValuesChanged = new EventEmitter<{ [key: string]: any }>();
  @Output() slotsChanged = new EventEmitter<FormValidationField[]>();

  displayName: string = 'Validate Form Fields';
  fields: FormValidationField[] = [];
  sizeTier: FormValidationOverlaySizeTier = 'full';

  get enabledCount(): number {
    return this.fields.filter(f => f.enabled).length;
  }

  get requiredCount(): number {
    return this.fields.filter(f => f.enabled && f.required).length;
  }

  ngOnInit(): void {
    this.displayName = this.boundObjectFieldValues['displayName'] || 'Validate Form Fields';
    this.sizeTier = resolveSizeTier(this.width);
    this.initializeFields();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['upstreamFields'] && !changes['upstreamFields'].firstChange) {
      this.initializeFields();
    }
    if (changes['width']) {
      this.sizeTier = resolveSizeTier(this.width);
    }
  }

  /**
   * Keep the size tier in sync when the host rect is resized externally
   * (e.g. the StateOverlayManager updating dimensions on zoom/pan).
   */
  forceUpdateSizeMode(): void {
    this.sizeTier = resolveSizeTier(this.width);
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
