// list-cell.component.ts
import { Component, Input } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { ListViewComponent } from '../list-view/list-view';

@Component({
  selector: 'list-cell',
  templateUrl: `list-cell.html`,
  styleUrls: ['./list-cell.css']
})
export class ListCellComponent {
  @Input() value: any = '';
  @Input() columnName: string = '';
  @Input() editable: boolean = false;

  constructor(private dialog: MatDialog) {}

  /**
   * Unwrap polariList from backend format
   * Backend returns: [{ "polariList": [...] }]
   */
  private unwrapValue(): any[] {
    if (!this.value) return [];

    // Check for polariList wrapper: [{ "polariList": [...] }]
    if (Array.isArray(this.value) && this.value.length > 0) {
      const firstItem = this.value[0];
      if (firstItem && typeof firstItem === 'object' && firstItem.polariList) {
        return Array.isArray(firstItem.polariList) ? firstItem.polariList : [];
      }
    }

    // Already an array
    if (Array.isArray(this.value)) {
      return this.value;
    }

    return [];
  }

  /**
   * Get display value for list/array
   */
  getDisplayValue(): string {
    const unwrapped = this.unwrapValue();

    if (unwrapped.length === 0) {
      return '-';
    }

    return `[${unwrapped.length} items]`;
  }

  /**
   * Get item count
   */
  getItemCount(): number {
    return this.unwrapValue().length;
  }

  /**
   * Open popup to view list details
   */
  openListView(): void {
    const unwrapped = this.unwrapValue();

    if (unwrapped.length === 0) {
      return;
    }

    this.dialog.open(ListViewComponent, {
      width: '600px',
      maxHeight: '80vh',
      data: {
        value: unwrapped,
        columnName: this.columnName
      }
    });
  }
}
