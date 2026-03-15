// object-cell.component.ts
import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import {
  InstancePickerDialogComponent,
  InstancePickerDialogData,
  InstancePickerDialogResult
} from '@components/shared/instance-picker-dialog/instance-picker-dialog';

@Component({
  standalone: true,
  selector: 'object-cell',
  templateUrl: `object-cell.html`,
  styleUrls: ['./object-cell.css'],
  imports: [CommonModule]
})
export class ObjectCellComponent {
  @Input() value: any = '';
  @Input() columnName: string = '';
  @Input() editable: boolean = false;
  /** The class name of the referenced type (for picker) */
  @Input() refClassName: string = '';
  /** Whether this is a multi-select reference list */
  @Input() multiple: boolean = false;

  /** Optional override display config ID for the "view instance" button */
  @Input() displayOverrideId: string = '';

  @Output() valueChange = new EventEmitter<any>();
  /** Emitted when the user clicks the "view instance display" button */
  @Output() viewInstanceDisplay = new EventEmitter<{ refClassName: string; instanceId: string; displayOverrideId: string }>();

  constructor(private router: Router, private dialog: MatDialog) {}

  /**
   * Unwrap the object reference from backend format
   * Backend returns: ["CLASS-ClassName-REFERENCE", [{ "tuple": [[...]] }]]
   */
  private unwrapValue(): any {
    if (!this.value) return null;

    // Check for array format: ["CLASS-...-REFERENCE", [...]]
    if (Array.isArray(this.value) && this.value.length >= 2) {
      const refString = this.value[0];
      const tupleData = this.value[1];

      if (typeof refString === 'string' && refString.includes('CLASS-') && refString.includes('-REFERENCE')) {
        // Extract class name from reference string
        const match = refString.match(/CLASS-(.+)-REFERENCE/);
        const className = match ? match[1] : 'unknown';

        // Extract ID from tuple data if available
        let objectId = null;
        if (Array.isArray(tupleData) && tupleData.length > 0) {
          const tupleObj = tupleData[0];
          if (tupleObj && tupleObj.tuple && Array.isArray(tupleObj.tuple)) {
            // Find id or name tuple
            for (const item of tupleObj.tuple) {
              if (Array.isArray(item) && item.length > 0 && item[0].tuple) {
                const [key, value] = item[0].tuple;
                if (key === 'id' && value) {
                  objectId = value;
                  break;
                } else if (key === 'name' && !objectId) {
                  objectId = value;
                }
              }
            }
          }
        }

        return { className, objectId };
      }
    }

    // Fallback to object format
    return this.value;
  }

  /**
   * Get the effective class name (from value or input)
   */
  getClassName(): string {
    if (this.refClassName) return this.refClassName;

    const unwrapped = this.unwrapValue();
    if (!unwrapped) return 'unknown';
    if (unwrapped.className) return unwrapped.className;
    if (unwrapped.class) return unwrapped.class;
    return 'object';
  }

  /**
   * Get the object ID for display
   */
  getObjectId(): string {
    const unwrapped = this.unwrapValue();

    if (!unwrapped) return '-';

    if (unwrapped.objectId !== undefined && unwrapped.objectId !== null) {
      return String(unwrapped.objectId);
    }
    if (unwrapped.id) {
      return String(unwrapped.id);
    }
    if (unwrapped._id) {
      return String(unwrapped._id);
    }
    if (unwrapped._instanceId) {
      return String(unwrapped._instanceId);
    }

    // If the value is a simple string (just an ID)
    if (typeof this.value === 'string' && this.value) {
      return this.value;
    }

    return '-';
  }

  /**
   * Navigate to the object's class page
   */
  navigateToObject(): void {
    const className = this.getClassName();
    if (className && className !== 'unknown' && className !== 'object') {
      this.router.navigate([`/class/${className}`]);
    }
  }

  /**
   * Check if navigation is available
   */
  canNavigate(): boolean {
    const className = this.getClassName();
    return className !== 'unknown' && className !== 'object';
  }

  /**
   * Open the instance picker dialog (edit mode)
   */
  openPicker(): void {
    if (!this.editable) return;

    const className = this.getClassName();
    if (!className || className === 'unknown' || className === 'object') return;

    // Determine current selection for pre-fill
    const currentId = this.getObjectId();
    const selectedIds = currentId && currentId !== '-' ? [currentId] : [];

    const dialogData: InstancePickerDialogData = {
      className,
      multiple: this.multiple,
      selectedIds
    };

    const dialogRef = this.dialog.open(InstancePickerDialogComponent, {
      data: dialogData,
      width: '800px',
      maxHeight: '80vh'
    });

    dialogRef.afterClosed().subscribe((result: InstancePickerDialogResult) => {
      if (result?.action === 'select') {
        if (this.multiple) {
          this.valueChange.emit(result.selectedIds || []);
        } else {
          this.valueChange.emit(result.selectedIds?.[0] || null);
        }
      }
    });
  }

  /** Whether the cell has a value to display */
  hasValue(): boolean {
    return this.value !== null && this.value !== undefined && this.value !== '';
  }

  /** Whether the "view instance display" button should be shown */
  canViewDisplay(): boolean {
    const className = this.getClassName();
    const objectId = this.getObjectId();
    return className !== 'unknown' && className !== 'object' && objectId !== '-';
  }

  /** Emit event to open the instance's default display */
  onViewInstanceDisplay(event: MouseEvent): void {
    event.stopPropagation();
    const refClassName = this.getClassName();
    const instanceId = this.getObjectId();
    if (refClassName && instanceId !== '-') {
      this.viewInstanceDisplay.emit({
        refClassName,
        instanceId,
        displayOverrideId: this.displayOverrideId || ''
      });
    }
  }
}
