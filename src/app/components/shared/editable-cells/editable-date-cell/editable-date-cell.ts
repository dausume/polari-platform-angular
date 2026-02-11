// editable-date-cell.ts
import { Component, Input } from '@angular/core';
import { BaseEditableCell } from '../base-editable-cell';

@Component({
  standalone: false,
  selector: 'editable-date-cell',
  templateUrl: 'editable-date-cell.html',
  styleUrls: ['./editable-date-cell.css']
})
export class EditableDateCellComponent extends BaseEditableCell {
  @Input() includeTime: boolean = false;
  @Input() dateFormat: string = 'short';
  @Input() minDate: Date | null = null;
  @Input() maxDate: Date | null = null;

  getDisplayValue(): string {
    if (this.value === null || this.value === undefined || this.value === '') {
      return '-';
    }

    try {
      const date = new Date(this.value);
      if (isNaN(date.getTime())) {
        return String(this.value);
      }

      if (this.includeTime) {
        return date.toLocaleString(undefined, {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
      } else {
        return date.toLocaleDateString(undefined, {
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        });
      }
    } catch (e) {
      return String(this.value);
    }
  }

  /**
   * Get the date value for the datepicker
   */
  get dateValue(): Date | null {
    if (!this.control.value) {
      return null;
    }
    const date = new Date(this.control.value);
    return isNaN(date.getTime()) ? null : date;
  }

  /**
   * Handle date selection
   */
  onDateChange(event: any): void {
    const date = event.value;
    if (date) {
      // Preserve time if includeTime is true and we have a previous value
      if (this.includeTime && this.control.value) {
        const oldDate = new Date(this.control.value);
        if (!isNaN(oldDate.getTime())) {
          date.setHours(oldDate.getHours());
          date.setMinutes(oldDate.getMinutes());
          date.setSeconds(oldDate.getSeconds());
        }
      }
      this.control.setValue(date.toISOString());
      this.valueChange.emit(date.toISOString());
    } else {
      this.control.setValue(null);
      this.valueChange.emit(null);
    }
  }

  /**
   * Handle time change (when includeTime is true)
   */
  onTimeChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const [hours, minutes] = input.value.split(':').map(Number);

    if (this.dateValue) {
      const newDate = new Date(this.dateValue);
      newDate.setHours(hours || 0);
      newDate.setMinutes(minutes || 0);
      this.control.setValue(newDate.toISOString());
      this.valueChange.emit(newDate.toISOString());
    }
  }

  /**
   * Get time string for time input
   */
  get timeString(): string {
    if (!this.dateValue) {
      return '';
    }
    const hours = this.dateValue.getHours().toString().padStart(2, '0');
    const minutes = this.dateValue.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  /**
   * Clear the date
   */
  clearDate(): void {
    this.control.setValue(null);
    this.valueChange.emit(null);
  }
}
