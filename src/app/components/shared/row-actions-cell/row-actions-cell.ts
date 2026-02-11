// row-actions-cell.ts
import { Component, Input, Output, EventEmitter } from '@angular/core';
import { RowActionsConfig, DEFAULT_ROW_ACTIONS_CONFIG, CustomAction, RowActionEvent } from '../models/crud-config.models';

@Component({
  standalone: false,
  selector: 'row-actions-cell',
  templateUrl: 'row-actions-cell.html',
  styleUrls: ['./row-actions-cell.css']
})
export class RowActionsCellComponent {
  @Input() config: RowActionsConfig = DEFAULT_ROW_ACTIONS_CONFIG;
  @Input() rowData: any;
  @Input() rowId: string = '';
  @Input() rowIndex: number = 0;
  @Input() isEditing: boolean = false;
  @Input() isSaving: boolean = false;
  @Input() isDirty: boolean = false;
  @Input() isValid: boolean = true;
  @Input() compact: boolean = false;

  @Output() edit = new EventEmitter<RowActionEvent>();
  @Output() delete = new EventEmitter<RowActionEvent>();
  @Output() save = new EventEmitter<RowActionEvent>();
  @Output() cancel = new EventEmitter<RowActionEvent>();
  @Output() customAction = new EventEmitter<{ action: CustomAction; event: RowActionEvent }>();

  showDeleteConfirm: boolean = false;

  /**
   * Handle edit button click
   */
  onEdit(): void {
    if (this.config.editMode === 'inline' || this.config.editMode === 'both') {
      this.edit.emit(this.createEvent('edit'));
    } else {
      // Popup mode - also emit edit to open dialog
      this.edit.emit(this.createEvent('edit'));
    }
  }

  /**
   * Handle delete button click
   */
  onDelete(): void {
    if (this.config.confirmDelete) {
      this.showDeleteConfirm = true;
    } else {
      this.confirmDelete();
    }
  }

  /**
   * Confirm deletion
   */
  confirmDelete(): void {
    this.showDeleteConfirm = false;
    this.delete.emit(this.createEvent('delete'));
  }

  /**
   * Cancel deletion
   */
  cancelDelete(): void {
    this.showDeleteConfirm = false;
  }

  /**
   * Handle save button click
   */
  onSave(): void {
    if (this.isValid) {
      this.save.emit(this.createEvent('save'));
    }
  }

  /**
   * Handle cancel button click
   */
  onCancel(): void {
    this.cancel.emit(this.createEvent('cancel'));
  }

  /**
   * Handle custom action click
   */
  onCustomAction(action: CustomAction): void {
    if (!action.disabled) {
      this.customAction.emit({
        action,
        event: this.createEvent(action.name)
      });
    }
  }

  /**
   * Create a row action event
   */
  private createEvent(action: string): RowActionEvent {
    return {
      action,
      rowData: this.rowData,
      rowIndex: this.rowIndex,
      rowId: this.rowId
    };
  }

  /**
   * Check if edit is enabled
   */
  get canEdit(): boolean {
    return this.config.enableEdit && !this.isEditing && !this.isSaving;
  }

  /**
   * Check if delete is enabled
   */
  get canDelete(): boolean {
    return this.config.enableDelete && !this.isSaving;
  }

  /**
   * Check if save is enabled
   */
  get canSave(): boolean {
    return this.isEditing && this.isDirty && this.isValid && !this.isSaving;
  }

  /**
   * Check if cancel is enabled
   */
  get canCancel(): boolean {
    return this.isEditing && !this.isSaving;
  }

  /**
   * Get visible custom actions
   */
  get visibleCustomActions(): CustomAction[] {
    return (this.config.customActions || []).filter(a => !a.hidden);
  }
}
