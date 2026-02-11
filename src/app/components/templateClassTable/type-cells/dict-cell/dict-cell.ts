// dict-cell.component.ts
import { Component, Input } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { DictViewComponent } from '../dict-view/dict-view';

@Component({
  standalone: false,
  selector: 'dict-cell',
  templateUrl: `dict-cell.html`,
  styleUrls: ['./dict-cell.css']
})
export class DictCellComponent {
  @Input() value: any = '';
  @Input() columnName: string = '';
  @Input() editable: boolean = false;

  constructor(private dialog: MatDialog) {}

  /**
   * Unwrap polariDict/dict from backend format
   * Backend returns: [{ "polariDict": {...} }] or [{ "dict": {...} }]
   */
  private unwrapValue(): { [key: string]: any } {
    if (!this.value) return {};

    // Check for polariDict wrapper: [{ "polariDict": {...} }]
    if (Array.isArray(this.value) && this.value.length > 0) {
      const firstItem = this.value[0];
      if (firstItem && typeof firstItem === 'object') {
        if (firstItem.polariDict && typeof firstItem.polariDict === 'object') {
          return firstItem.polariDict;
        }
        if (firstItem.dict && typeof firstItem.dict === 'object') {
          return firstItem.dict;
        }
      }
    }

    // Already an object
    if (typeof this.value === 'object' && !Array.isArray(this.value)) {
      return this.value;
    }

    return {};
  }

  /**
   * Get display value for dict/object
   */
  getDisplayValue(): string {
    const unwrapped = this.unwrapValue();
    const keys = Object.keys(unwrapped);

    if (keys.length === 0) {
      return '-';
    }

    return `{${keys.length} keys}`;
  }

  /**
   * Get key count
   */
  getKeyCount(): number {
    return Object.keys(this.unwrapValue()).length;
  }

  /**
   * Open popup to view dictionary details
   */
  openDictView(): void {
    const unwrapped = this.unwrapValue();

    if (Object.keys(unwrapped).length === 0) {
      return;
    }

    this.dialog.open(DictViewComponent, {
      width: '600px',
      maxHeight: '80vh',
      data: {
        value: unwrapped,
        columnName: this.columnName
      }
    });
  }
}
