// string-cell.component.ts
import { Component, Input } from '@angular/core';

@Component({
  selector: 'string-cell',
  templateUrl: `string-cell.html`,
  styleUrls: ['./string-cell.css']
})
export class StringCellComponent {
  @Input() value: any = '';
  @Input() columnName: string = '';
  @Input() editable: boolean = false;

  /**
   * Get display value for string cell
   */
  getDisplayValue(): string {
    if (this.value === null || this.value === undefined) {
      return '-';
    }
    return String(this.value);
  }
}