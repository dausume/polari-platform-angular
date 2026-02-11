// editable-number-cell.ts
import { Component, Input } from '@angular/core';
import { ValidatorFn, Validators } from '@angular/forms';
import { BaseEditableCell } from '../base-editable-cell';

@Component({
  standalone: false,
  selector: 'editable-number-cell',
  templateUrl: 'editable-number-cell.html',
  styleUrls: ['./editable-number-cell.css']
})
export class EditableNumberCellComponent extends BaseEditableCell {
  @Input() min: number | null = null;
  @Input() max: number | null = null;
  @Input() step: number = 1;
  @Input() decimalPlaces: number = 2;
  @Input() isInteger: boolean = false;
  @Input() prefix: string = '';
  @Input() suffix: string = '';

  getDisplayValue(): string {
    if (this.value === null || this.value === undefined || this.value === '') {
      return '-';
    }

    let displayValue: string;
    const numValue = Number(this.value);

    if (isNaN(numValue)) {
      return String(this.value);
    }

    if (this.isInteger) {
      displayValue = Math.round(numValue).toString();
    } else {
      displayValue = numValue.toFixed(this.decimalPlaces);
    }

    // Add prefix/suffix for display
    let result = displayValue;
    if (this.prefix) {
      result = this.prefix + result;
    }
    if (this.suffix) {
      result = result + this.suffix;
    }

    return result;
  }

  protected override getValidators(): ValidatorFn[] {
    const validators: ValidatorFn[] = [];

    if (this.min !== null) {
      validators.push(Validators.min(this.min));
    }

    if (this.max !== null) {
      validators.push(Validators.max(this.max));
    }

    // Add pattern validator for integer-only
    if (this.isInteger) {
      validators.push(Validators.pattern(/^-?\d+$/));
    }

    return validators;
  }

  protected override getCustomErrorMessage(): string {
    if (this.control.hasError('min')) {
      const error = this.control.getError('min');
      return `Minimum value is ${error.min}`;
    }
    if (this.control.hasError('max')) {
      const error = this.control.getError('max');
      return `Maximum value is ${error.max}`;
    }
    if (this.control.hasError('pattern') && this.isInteger) {
      return 'Must be a whole number';
    }
    return super.getCustomErrorMessage();
  }

  /**
   * Handle input to ensure only valid number characters
   */
  onInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    let value = input.value;

    // Allow negative sign, digits, and decimal point (if not integer)
    if (this.isInteger) {
      value = value.replace(/[^-\d]/g, '');
    } else {
      value = value.replace(/[^-\d.]/g, '');
      // Ensure only one decimal point
      const parts = value.split('.');
      if (parts.length > 2) {
        value = parts[0] + '.' + parts.slice(1).join('');
      }
    }

    // Ensure negative sign is only at the start
    if (value.includes('-')) {
      const hasNegative = value.startsWith('-');
      value = value.replace(/-/g, '');
      if (hasNegative) {
        value = '-' + value;
      }
    }

    if (value !== input.value) {
      this.control.setValue(value);
    }
  }
}
