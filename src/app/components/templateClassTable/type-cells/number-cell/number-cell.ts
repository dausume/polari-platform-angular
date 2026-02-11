// number-cell.component.ts
import { Component, Input } from '@angular/core';

@Component({
  standalone: true,
  selector: 'number-cell',
  templateUrl: `number-cell.html`,
  styleUrls: ['./number-cell.css']
})
export class NumberCellComponent {
  @Input() value: any = '';
  @Input() columnName: string = '';
  @Input() type: string = 'int';
  @Input() editable: boolean = false;

  /**
  * Get display value for number cell
  */
  getDisplayValue(): string {
    if (this.value === null || this.value === undefined) {
      return '-';
    }

    const numValue = Number(this.value);
    if (isNaN(numValue)) {
      return String(this.value);
    }

    // Format floats with 2 decimal places, integers as-is
    if (this.type?.toLowerCase() === 'float') {
      return numValue.toFixed(2);
    }

    return numValue.toString();
  }
}
