// editable-boolean-cell.ts
import { Component, Input } from '@angular/core';
import { BaseEditableCell } from '../base-editable-cell';

@Component({
  selector: 'editable-boolean-cell',
  templateUrl: 'editable-boolean-cell.html',
  styleUrls: ['./editable-boolean-cell.css']
})
export class EditableBooleanCellComponent extends BaseEditableCell {
  @Input() trueLabel: string = 'Yes';
  @Input() falseLabel: string = 'No';
  @Input() useToggle: boolean = true;

  getDisplayValue(): string {
    if (this.value === null || this.value === undefined) {
      return '-';
    }
    return this.value ? this.trueLabel : this.falseLabel;
  }

  /**
   * Toggle the boolean value
   */
  toggle(): void {
    if (this.disabled) {
      return;
    }
    const newValue = !this.control.value;
    this.control.setValue(newValue);
    this.valueChange.emit(newValue);
  }

  /**
   * Get the current boolean value
   */
  get booleanValue(): boolean {
    return !!this.control.value;
  }
}
