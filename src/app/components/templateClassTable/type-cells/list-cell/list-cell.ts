// list-cell.component.ts
import { Component, Input } from '@angular/core';

@Component({
  selector: 'list-cell',
  templateUrl: `list-cell.html`,
  styleUrls: ['./list-cell.css']
})
export class ListCellComponent {
  @Input() value: any = '';
  @Input() columnName: string = '';
  @Input() editable: boolean = false;

  /**
   * Get display value for list/array
   */
  getDisplayValue(): string {
    if (this.value === null || this.value === undefined) {
      return '-';
    }

    if (Array.isArray(this.value)) {
      return `[${this.value.length} items]`;
    }

    return String(this.value);
  }

  /**
   * Get item count
   */
  getItemCount(): number {
    if (Array.isArray(this.value)) {
      return this.value.length;
    }
    return 0;
  }
}
