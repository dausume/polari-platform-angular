import { Component, Input, Output, EventEmitter } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { DisplayDataSource } from '@models/dashboards/DisplayStateDefinition';
import {
  InstancePickerDialogComponent,
  InstancePickerDialogData,
  InstancePickerDialogResult
} from '@components/shared/instance-picker-dialog/instance-picker-dialog';
import { ClassTypingService } from '@services/class-typing-service';

@Component({
  standalone: false,
  selector: 'display-instance-source-config',
  templateUrl: 'instance-source-config.html',
  styleUrls: ['./instance-source-config.css']
})
export class InstanceSourceConfigComponent {

  @Input() dataSource!: DisplayDataSource;
  @Output() configChange = new EventEmitter<void>();

  constructor(
    private dialog: MatDialog,
    private typingService: ClassTypingService
  ) {}

  get hasClassName(): boolean {
    return !!this.dataSource.className;
  }

  get hasDefaultInstance(): boolean {
    return !!this.dataSource.defaultInstanceId;
  }

  get hasMockInstance(): boolean {
    return !!this.dataSource.mockInstance;
  }

  openInstancePicker(): void {
    if (!this.dataSource.className) return;

    const typing = this.typingService.getClassPolyTyping(this.dataSource.className);
    const displayName = typing?.displayClassName || this.dataSource.className;

    const dialogData: InstancePickerDialogData = {
      className: this.dataSource.className,
      classDisplayName: displayName,
      multiple: false,
      selectedIds: this.dataSource.defaultInstanceId ? [this.dataSource.defaultInstanceId] : []
    };

    const dialogRef = this.dialog.open(InstancePickerDialogComponent, {
      width: '720px',
      maxHeight: '80vh',
      data: dialogData
    });

    dialogRef.afterClosed().subscribe((result: InstancePickerDialogResult) => {
      if (result?.action === 'select') {
        this.dataSource.defaultInstanceId = result.selectedIds?.[0] || undefined;
        this.emitChange();
      }
    });
  }

  clearDefaultInstance(): void {
    this.dataSource.defaultInstanceId = undefined;
    this.emitChange();
  }

  onMockToggle(enabled: boolean): void {
    this.dataSource.mockInstance = enabled ? {} : undefined;
    this.emitChange();
  }

  onDefaultInstanceIdChange(): void {
    this.emitChange();
  }

  private emitChange(): void {
    this.configChange.emit();
  }
}
