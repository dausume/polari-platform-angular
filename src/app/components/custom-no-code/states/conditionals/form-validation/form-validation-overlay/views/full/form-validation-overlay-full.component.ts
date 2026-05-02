// Author: Dustin Etts
// Full tier (>= 140px): display name input + per-field toggle/required/debounce controls + aggregation summary.

import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormValidationField } from '../../form-validation-overlay.types';

@Component({
  standalone: false,
  selector: 'form-validation-overlay-full',
  templateUrl: './form-validation-overlay-full.component.html',
  styleUrls: ['./form-validation-overlay-full.component.css']
})
export class FormValidationOverlayFullComponent {
  @Input() displayName: string = 'Validate Form Fields';
  @Input() fields: FormValidationField[] = [];
  @Input() enabledCount: number = 0;
  @Input() requiredCount: number = 0;
  @Input() hasPopupView: boolean = false;

  @Output() displayNameChanged = new EventEmitter<string>();
  @Output() fieldToggled = new EventEmitter<FormValidationField>();
  @Output() fieldRequiredToggled = new EventEmitter<FormValidationField>();
  @Output() fieldDebounceChanged = new EventEmitter<{ field: FormValidationField; value: string }>();
  @Output() expandClicked = new EventEmitter<void>();

  onExpand(event: Event): void {
    event.stopPropagation();
    this.expandClicked.emit();
  }

  onDisplayNameChange(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.displayNameChanged.emit(value);
  }

  onFieldToggle(field: FormValidationField, event: Event): void {
    event.stopPropagation();
    this.fieldToggled.emit(field);
  }

  onFieldRequiredToggle(field: FormValidationField, event: Event): void {
    event.stopPropagation();
    this.fieldRequiredToggled.emit(field);
  }

  onFieldDebounceChange(field: FormValidationField, event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.fieldDebounceChanged.emit({ field, value });
  }
}
