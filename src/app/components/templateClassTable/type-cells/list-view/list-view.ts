// list-view.component.ts
import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

export interface ListViewData {
  value: any[];
  columnName: string;
}

@Component({
  selector: 'list-view',
  templateUrl: './list-view.html',
  styleUrls: ['./list-view.css']
})
export class ListViewComponent {
  constructor(
    public dialogRef: MatDialogRef<ListViewComponent>,
    @Inject(MAT_DIALOG_DATA) public data: ListViewData
  ) {}

  /**
   * Close the dialog
   */
  close(): void {
    this.dialogRef.close();
  }

  /**
   * Get the type of an item for display
   */
  getItemType(item: any): string {
    if (item === null) return 'null';
    if (item === undefined) return 'undefined';
    if (Array.isArray(item)) return 'array';
    return typeof item;
  }

  /**
   * Format item for display
   */
  formatItem(item: any): string {
    if (item === null) return 'null';
    if (item === undefined) return 'undefined';
    if (typeof item === 'object') {
      return JSON.stringify(item, null, 2);
    }
    return String(item);
  }

  /**
   * Check if item is a complex object
   */
  isComplexObject(item: any): boolean {
    return item !== null && typeof item === 'object';
  }
}
