import { Component, Input, Output, EventEmitter } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { DisplayDataSource, ClassDataSourceSubType } from '@models/dashboards/DisplayStateDefinition';
import {
  ClassSelectorDialogComponent,
  ClassSelectorDialogResult
} from '@components/shared/class-selector-dialog/class-selector-dialog';
import { ClassTypingService } from '@services/class-typing-service';

@Component({
  standalone: false,
  selector: 'display-data-source-config',
  templateUrl: 'data-source-config.html',
  styleUrls: ['./data-source-config.css']
})
export class DataSourceConfigComponent {

  @Input() dataSource!: DisplayDataSource;
  @Input() availableSolutions: { name: string }[] = [];
  @Output() dataSourceChange = new EventEmitter<void>();
  @Output() remove = new EventEmitter<void>();

  constructor(
    private dialog: MatDialog,
    private typingService: ClassTypingService
  ) {}

  // ==================== Display Helpers ====================

  get sourceIcon(): string {
    switch (this.dataSource.sourceType) {
      case 'class': return 'storage';
      case 'solution': return 'play_circle';
      case 'static': return 'data_object';
      default: return 'help_outline';
    }
  }

  get title(): string {
    return this.dataSource.label || 'Untitled';
  }

  get classDisplayName(): string {
    if (!this.dataSource.className) return '';
    const typing = this.typingService.getClassPolyTyping(this.dataSource.className);
    return typing?.displayClassName || this.dataSource.className;
  }

  // ==================== Source Type ====================

  onSourceTypeChange(): void {
    // Reset sub-fields when top-level source type changes
    if (this.dataSource.sourceType === 'class') {
      this.dataSource.classSubType = this.dataSource.classSubType || 'all-instances';
    } else {
      this.dataSource.classSubType = undefined;
      this.dataSource.className = undefined;
      this.dataSource.defaultInstanceId = undefined;
      this.dataSource.mockInstance = undefined;
      this.dataSource.staticVarType = undefined;
      this.dataSource.staticVarRefClass = undefined;
      this.dataSource.staticVarValue = undefined;
    }
    this.emitChange();
  }

  // ==================== Class Selection ====================

  openClassSelector(): void {
    const dialogRef = this.dialog.open(ClassSelectorDialogComponent, {
      width: '480px',
      data: {
        title: 'Select Data Source Class',
        subtitle: 'Choose the class to load data from'
      }
    });

    dialogRef.afterClosed().subscribe((result: ClassSelectorDialogResult) => {
      if (result?.action === 'select' && result.className) {
        this.dataSource.className = result.className;
        // Clear instance-specific fields when class changes
        this.dataSource.defaultInstanceId = undefined;
        this.dataSource.mockInstance = undefined;
        this.emitChange();
      }
    });
  }

  clearClass(): void {
    this.dataSource.className = undefined;
    this.dataSource.defaultInstanceId = undefined;
    this.dataSource.mockInstance = undefined;
    this.emitChange();
  }

  // ==================== Class Sub-Type ====================

  onSubTypeChange(): void {
    const subType = this.dataSource.classSubType;

    // Clear fields irrelevant to the new sub-type
    if (subType === 'all-instances') {
      this.dataSource.defaultInstanceId = undefined;
      this.dataSource.mockInstance = undefined;
      this.dataSource.staticVarType = undefined;
      this.dataSource.staticVarRefClass = undefined;
      this.dataSource.staticVarValue = undefined;
    } else if (subType === 'row-instance') {
      this.dataSource.staticVarType = undefined;
      this.dataSource.staticVarRefClass = undefined;
      this.dataSource.staticVarValue = undefined;
    } else if (subType === 'static-data') {
      this.dataSource.defaultInstanceId = undefined;
      this.dataSource.mockInstance = undefined;
    }

    this.emitChange();
  }

  // ==================== Child Component Callbacks ====================

  onChildChange(): void {
    this.emitChange();
  }

  onRemove(): void {
    this.remove.emit();
  }

  // ==================== Internal ====================

  private emitChange(): void {
    this.dataSourceChange.emit();
  }
}
