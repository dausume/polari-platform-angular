// object-cell.component.ts
import { Component, Input } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'object-cell',
  templateUrl: `object-cell.html`,
  styleUrls: ['./object-cell.css']
})
export class ObjectCellComponent {
  @Input() value: any = '';
  @Input() columnName: string = '';
  @Input() editable: boolean = false;

  constructor(private router: Router) {}

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
   * Get the object class name from value
   */
  getClassName(): string {
    const unwrapped = this.unwrapValue();

    if (!unwrapped) return 'unknown';

    if (unwrapped.className) {
      return unwrapped.className;
    }
    if (unwrapped.class) {
      return unwrapped.class;
    }

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
}
