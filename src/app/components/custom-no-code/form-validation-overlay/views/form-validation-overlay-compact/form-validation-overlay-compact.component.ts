// Author: Dustin Etts
// Mid tier (60-140px): header + enabled/total badge + condensed field chips (enable toggle only).

import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormValidationField } from '../../form-validation-overlay.types';

@Component({
  standalone: false,
  selector: 'form-validation-overlay-compact',
  templateUrl: './form-validation-overlay-compact.component.html',
  styleUrls: ['./form-validation-overlay-compact.component.css']
})
export class FormValidationOverlayCompactComponent {
  @Input() displayName: string = 'Validate Form Fields';
  @Input() fields: FormValidationField[] = [];
  @Input() enabledCount: number = 0;

  @Output() fieldToggled = new EventEmitter<FormValidationField>();

  onFieldToggle(field: FormValidationField, event: Event): void {
    event.stopPropagation();
    this.fieldToggled.emit(field);
  }

  stopPropagation(event: Event): void {
    event.stopPropagation();
  }
}
