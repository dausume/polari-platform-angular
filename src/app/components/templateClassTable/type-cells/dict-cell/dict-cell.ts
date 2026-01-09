// dict-cell.component.ts
import { Component, Input } from '@angular/core';

@Component({
  selector: 'dict-cell',
  templateUrl: `dict-cell.html`,
  styleUrls: ['./dict-cell.css']
})
export class DictCellComponent {
  @Input() value: any = '';
  @Input() columnName: string = '';
  @Input() editable: boolean = false;

  /**
   * Get display value for dict/object
   */
  getDisplayValue(): string {
    if (this.value === null || this.value === undefined) {
      return '-';
    }

    if (typeof this.value === 'object' && !Array.isArray(this.value)) {
      const keys = Object.keys(this.value);
      return `{${keys.length} keys}`;
    }

    return String(this.value);
  }

  /**
   * Get key count
   */
  getKeyCount(): number {
    if (typeof this.value === 'object' && !Array.isArray(this.value)) {
      return Object.keys(this.value).length;
    }
    return 0;
  }
}
