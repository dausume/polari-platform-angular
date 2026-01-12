// dict-view.component.ts
import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

export interface DictViewData {
  value: { [key: string]: any };
  columnName: string;
}

@Component({
  selector: 'dict-view',
  templateUrl: './dict-view.html',
  styleUrls: ['./dict-view.css']
})
export class DictViewComponent {
  constructor(
    public dialogRef: MatDialogRef<DictViewComponent>,
    @Inject(MAT_DIALOG_DATA) public data: DictViewData
  ) {}

  /**
   * Close the dialog
   */
  close(): void {
    this.dialogRef.close();
  }

  /**
   * Get all keys from the dictionary
   */
  getKeys(): string[] {
    if (!this.data.value || typeof this.data.value !== 'object') {
      return [];
    }
    return Object.keys(this.data.value);
  }

  /**
   * Get the type of a value for display
   */
  getValueType(value: any): string {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (Array.isArray(value)) return 'array';
    return typeof value;
  }

  /**
   * Format value for display
   */
  formatValue(value: any): string {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (typeof value === 'object') {
      return JSON.stringify(value, null, 2);
    }
    return String(value);
  }

  /**
   * Check if value is a complex object
   */
  isComplexObject(value: any): boolean {
    return value !== null && typeof value === 'object';
  }
}
