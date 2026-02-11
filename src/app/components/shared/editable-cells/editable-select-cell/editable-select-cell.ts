// editable-select-cell.ts
import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { BaseEditableCell } from '../base-editable-cell';
import { SelectOption } from '../../models/crud-config.models';

@Component({
  standalone: false,
  selector: 'editable-select-cell',
  templateUrl: 'editable-select-cell.html',
  styleUrls: ['./editable-select-cell.css']
})
export class EditableSelectCellComponent extends BaseEditableCell implements OnChanges {
  @Input() override options: SelectOption[] = [];
  @Input() multiple: boolean = false;
  @Input() searchable: boolean = false;
  @Input() clearable: boolean = true;
  @Input() refClassName: string = '';

  filteredOptions: SelectOption[] = [];
  searchQuery: string = '';

  override ngOnChanges(changes: SimpleChanges): void {
    super.ngOnChanges(changes);
    if (changes['options']) {
      this.filteredOptions = [...this.options];
    }
  }

  getDisplayValue(): string {
    if (this.value === null || this.value === undefined || this.value === '') {
      return '-';
    }

    if (this.multiple && Array.isArray(this.value)) {
      const labels = this.value.map(v => this.getLabelForValue(v)).filter(l => l);
      return labels.length > 0 ? labels.join(', ') : '-';
    }

    return this.getLabelForValue(this.value) || String(this.value);
  }

  /**
   * Get the label for a given value
   */
  private getLabelForValue(value: any): string {
    const option = this.options.find(opt => opt.value === value);
    return option?.label || '';
  }

  /**
   * Handle selection change
   */
  onSelectionChange(event: any): void {
    const value = event.value;
    this.control.setValue(value);
    this.valueChange.emit(value);
  }

  /**
   * Clear the selection
   */
  clearSelection(): void {
    this.control.setValue(this.multiple ? [] : null);
    this.valueChange.emit(this.multiple ? [] : null);
  }

  /**
   * Filter options based on search query
   */
  filterOptions(): void {
    if (!this.searchQuery.trim()) {
      this.filteredOptions = [...this.options];
      return;
    }

    const query = this.searchQuery.toLowerCase();
    this.filteredOptions = this.options.filter(opt =>
      opt.label.toLowerCase().includes(query)
    );
  }

  /**
   * Clear search and reset options
   */
  clearSearch(): void {
    this.searchQuery = '';
    this.filteredOptions = [...this.options];
  }

  /**
   * Check if an option is selected (for multiple select)
   */
  isSelected(value: any): boolean {
    if (this.multiple && Array.isArray(this.control.value)) {
      return this.control.value.includes(value);
    }
    return this.control.value === value;
  }

  /**
   * Get selected option for display
   */
  get selectedOption(): SelectOption | null {
    if (!this.control.value || this.multiple) {
      return null;
    }
    return this.options.find(opt => opt.value === this.control.value) || null;
  }

  /**
   * Get selected options for multiple select
   */
  get selectedOptions(): SelectOption[] {
    if (!this.control.value || !this.multiple || !Array.isArray(this.control.value)) {
      return [];
    }
    return this.options.filter(opt => this.control.value.includes(opt.value));
  }
}
