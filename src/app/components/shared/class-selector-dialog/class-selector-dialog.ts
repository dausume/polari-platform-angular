// class-selector-dialog.ts
import { Component, Inject, OnInit } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { ClassTypingService } from '@services/class-typing-service';
import { ObjectCategory } from '@models/navComponent';

export interface ClassSelectorDialogData {
  /** Title shown at the top of the dialog */
  title?: string;
  /** Optional subtitle/description */
  subtitle?: string;
}

export interface ClassSelectorDialogResult {
  action: 'select' | 'cancel';
  className?: string;
  displayName?: string;
}

interface ClassEntry {
  className: string;
  displayName: string;
  category: ObjectCategory;
}

interface CategoryGroup {
  key: ObjectCategory;
  label: string;
  icon: string;
  classes: ClassEntry[];
  expanded: boolean;
}

@Component({
  standalone: false,
  selector: 'class-selector-dialog',
  templateUrl: 'class-selector-dialog.html',
  styleUrls: ['./class-selector-dialog.css']
})
export class ClassSelectorDialogComponent implements OnInit {
  categoryGroups: CategoryGroup[] = [];

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: ClassSelectorDialogData,
    private dialogRef: MatDialogRef<ClassSelectorDialogComponent>,
    private typingService: ClassTypingService
  ) {}

  ngOnInit(): void {
    this.buildCategoryGroups();
  }

  private buildCategoryGroups(): void {
    const classEntries: ClassEntry[] = [];

    // Gather all classes from the typing service
    const polyVarTyping = this.typingService.polyVarTyping;
    if (polyVarTyping) {
      Object.keys(polyVarTyping).forEach(clsName => {
        const classTyping = this.typingService.getClassPolyTyping(clsName);
        const displayName = classTyping?.displayClassName || clsName;

        // Get category from apiConfigCategoryMap (authoritative) or classPolyTyping
        const category: ObjectCategory =
          this.typingService.apiConfigCategoryMap.get(clsName)
          ?? classTyping?.getObjectCategory()
          ?? 'custom';

        classEntries.push({ className: clsName, displayName, category });
      });
    }

    // Build category groups in display order
    const groupDefs: { key: ObjectCategory; label: string; icon: string }[] = [
      { key: 'custom', label: 'Custom Objects', icon: 'widgets' },
      { key: 'framework', label: 'Framework Objects', icon: 'settings' },
      { key: 'materials_science', label: 'Material Science Objects', icon: 'science' }
    ];

    this.categoryGroups = groupDefs
      .map(def => ({
        ...def,
        classes: classEntries
          .filter(c => c.category === def.key)
          .sort((a, b) => a.displayName.localeCompare(b.displayName)),
        expanded: def.key === 'custom' // Auto-expand custom
      }))
      .filter(g => g.classes.length > 0);

    // If only one group, expand it
    if (this.categoryGroups.length === 1) {
      this.categoryGroups[0].expanded = true;
    }
  }

  toggleGroup(group: CategoryGroup): void {
    group.expanded = !group.expanded;
  }

  selectClass(entry: ClassEntry): void {
    this.dialogRef.close({
      action: 'select',
      className: entry.className,
      displayName: entry.displayName
    } as ClassSelectorDialogResult);
  }

  onCancel(): void {
    this.dialogRef.close({ action: 'cancel' } as ClassSelectorDialogResult);
  }
}
