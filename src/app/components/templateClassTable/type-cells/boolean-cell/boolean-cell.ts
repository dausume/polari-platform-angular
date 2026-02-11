// boolean-cell.component.ts
import { Component, Input } from '@angular/core';

@Component({
  standalone: false,
  selector: 'boolean-cell',
  templateUrl: `boolean-cell.html`,
  styleUrls: ['./boolean-cell.css']
})
export class BooleanCellComponent {
  @Input() value: any = '';
  @Input() columnName: string = '';
  @Input() editable: boolean = false;

  /**
   * Get boolean value
   */
  getBooleanValue(): boolean | null {
    if (this.value === null || this.value === undefined) {
      return null;
    }
    return Boolean(this.value);
  }

  /**
   * Get display text for boolean
   */
  getDisplayText(): string {
    const boolValue = this.getBooleanValue();
    if (boolValue === null) {
      return '-';
    }
    return boolValue ? 'Yes' : 'No';
  }
}
