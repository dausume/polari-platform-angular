// editable-string-cell.ts
import { Component, Input } from '@angular/core';
import { ValidatorFn, Validators } from '@angular/forms';
import { BaseEditableCell } from '../base-editable-cell';

@Component({
  standalone: false,
  selector: 'editable-string-cell',
  templateUrl: 'editable-string-cell.html',
  styleUrls: ['./editable-string-cell.css']
})
export class EditableStringCellComponent extends BaseEditableCell {
  @Input() maxLength: number = 0;
  @Input() minLength: number = 0;
  @Input() pattern: string = '';
  @Input() multiline: boolean = false;
  @Input() rows: number = 3;

  getDisplayValue(): string {
    if (this.value === null || this.value === undefined || this.value === '') {
      return '-';
    }
    return String(this.value);
  }

  protected override getValidators(): ValidatorFn[] {
    const validators: ValidatorFn[] = [];

    if (this.maxLength > 0) {
      validators.push(Validators.maxLength(this.maxLength));
    }

    if (this.minLength > 0) {
      validators.push(Validators.minLength(this.minLength));
    }

    if (this.pattern) {
      validators.push(Validators.pattern(this.pattern));
    }

    return validators;
  }

  protected override getCustomErrorMessage(): string {
    if (this.control.hasError('maxlength')) {
      const error = this.control.getError('maxlength');
      return `Maximum ${error.requiredLength} characters allowed`;
    }
    if (this.control.hasError('minlength')) {
      const error = this.control.getError('minlength');
      return `Minimum ${error.requiredLength} characters required`;
    }
    if (this.control.hasError('pattern')) {
      return 'Invalid format';
    }
    return super.getCustomErrorMessage();
  }
}
