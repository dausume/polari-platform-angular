// date-cell.component.ts
import { Component, Input } from '@angular/core';

@Component({
  standalone: false,
  selector: 'date-cell',
  templateUrl: `date-cell.html`,
  styleUrls: ['./date-cell.css']
})
export class DateCellComponent {
  @Input() value: any = '';
  @Input() columnName: string = '';
  @Input() type: string = 'date';
  @Input() editable: boolean = false;

  /**
   * Get display value for date/datetime
   */
  getDisplayValue(): string {
    if (this.value === null || this.value === undefined) {
      return '-';
    }

    try {
      const date = new Date(this.value);

      if (isNaN(date.getTime())) {
        return String(this.value);
      }

      // Format based on type
      if (this.type?.toLowerCase() === 'datetime') {
        return date.toLocaleString();
      }

      return date.toLocaleDateString();
    } catch (error) {
      return String(this.value);
    }
  }

  /**
   * Get time component for datetime
   */
  getTimeValue(): string {
    if (this.type?.toLowerCase() !== 'datetime') {
      return '';
    }

    try {
      const date = new Date(this.value);
      if (isNaN(date.getTime())) {
        return '';
      }
      return date.toLocaleTimeString();
    } catch (error) {
      return '';
    }
  }
}
