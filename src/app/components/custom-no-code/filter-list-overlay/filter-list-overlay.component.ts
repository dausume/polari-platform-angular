// Author: Dustin Etts
// Custom overlay component for FilterList state with visual filter builder

import { Component, Input, Output, EventEmitter, OnInit, OnDestroy } from '@angular/core';
import { ConditionalChainLink, LogicalOperator } from '../../../models/stateSpace/conditionalChain';
import { ConditionType, CONDITION_TYPE_OPTIONS } from '../../../models/stateSpace/conditionTypeOptions';

/**
 * Filter type options
 */
export type FilterType = 'byType' | 'byCondition' | 'byIndex' | 'custom';

/**
 * A visual representation of a filter condition
 */
export interface VisualFilterLink {
  id: string;
  fieldName: string;
  conditionType: ConditionType;
  conditionValue: string;
  conditionValueEnd?: string;
  logicalOperator: LogicalOperator;
}

/**
 * FilterListOverlayComponent provides a visual interface for building
 * list filter conditions in the no-code visual programming system.
 */
@Component({
  selector: 'filter-list-overlay',
  templateUrl: './filter-list-overlay.component.html',
  styleUrls: ['./filter-list-overlay.component.css']
})
export class FilterListOverlayComponent implements OnInit, OnDestroy {

  // Position and size (from StateOverlayManager)
  @Input() x: number = 0;
  @Input() y: number = 0;
  @Input() width: number = 100;
  @Input() height: number = 100;

  // State identification
  @Input() stateName: string = '';
  @Input() boundClassName: string = 'FilterList';

  // Filter configuration
  @Input() filterType: FilterType = 'byCondition';
  @Input() objectType: string = '';
  @Input() displayName: string = 'Filter';

  // Available input fields from connected states (for dropdown)
  @Input() availableInputFields: { name: string; type: string; source: string }[] = [];

  // Current filter conditions
  @Input() filterConditions: ConditionalChainLink[] = [];

  // Slot configuration
  @Input() inputSlotCount: number = 1;
  @Input() allowDynamicInputs: boolean = true;
  @Input() maxInputSlots: number = 0; // 0 = unlimited

  // Events
  @Output() filterChanged = new EventEmitter<{
    filterType: FilterType;
    objectType: string;
    conditions: ConditionalChainLink[];
  }>();
  @Output() displayNameChanged = new EventEmitter<string>();
  @Output() addInputSlot = new EventEmitter<void>();

  // Visual filter builder data
  visualFilters: VisualFilterLink[] = [];

  // Available options for dropdowns
  conditionTypes = CONDITION_TYPE_OPTIONS;
  logicalOperators: { value: LogicalOperator; label: string }[] = [
    { value: 'AND', label: 'AND' },
    { value: 'OR', label: 'OR' }
  ];

  filterTypes: { value: FilterType; label: string; icon: string }[] = [
    { value: 'byCondition', label: 'By Condition', icon: 'filter_alt' },
    { value: 'byType', label: 'By Type', icon: 'category' },
    { value: 'byIndex', label: 'By Index', icon: 'format_list_numbered' },
    { value: 'custom', label: 'Custom', icon: 'code' }
  ];

  // Size mode flags
  isCompact: boolean = false;
  isSmall: boolean = false;

  ngOnInit(): void {
    this.updateSizeMode();
    this.initializeFromFilterConditions();
  }

  ngOnDestroy(): void {}

  /**
   * Update size mode based on dimensions
   */
  private updateSizeMode(): void {
    const minDimension = Math.min(this.width, this.height);
    this.isCompact = minDimension < 100;
    this.isSmall = minDimension < 150;
  }

  /**
   * Initialize visual filters from input conditions
   */
  private initializeFromFilterConditions(): void {
    this.visualFilters = this.filterConditions.map(link => ({
      id: link.id,
      fieldName: link.fieldName,
      conditionType: link.conditionType,
      conditionValue: String(link.conditionValue ?? ''),
      conditionValueEnd: link.conditionValueEnd ? String(link.conditionValueEnd) : undefined,
      logicalOperator: link.logicalOperator
    }));
  }

  /**
   * Change filter type
   */
  onFilterTypeChange(type: FilterType): void {
    this.filterType = type;
    this.emitFilterChange();
  }

  /**
   * Change object type
   */
  onObjectTypeChange(value: string): void {
    this.objectType = value;
    this.emitFilterChange();
  }

  /**
   * Add a new filter condition at the bottom
   */
  addFilterCondition(): void {
    const newFilter: VisualFilterLink = {
      id: 'filter_' + Math.random().toString(36).substring(2, 11),
      fieldName: this.availableInputFields.length > 0 ? this.availableInputFields[0].name : '',
      conditionType: 'equals',
      conditionValue: '',
      logicalOperator: 'AND'
    };
    this.visualFilters.push(newFilter);
    this.emitFilterChange();
  }

  /**
   * Remove a filter condition
   */
  removeFilterCondition(index: number): void {
    this.visualFilters.splice(index, 1);
    this.emitFilterChange();
  }

  /**
   * Update a filter's field
   */
  onFieldChange(index: number, field: keyof VisualFilterLink, value: any): void {
    if (this.visualFilters[index]) {
      (this.visualFilters[index] as any)[field] = value;
      this.emitFilterChange();
    }
  }

  /**
   * Get condition types that require two values (BETWEEN)
   */
  requiresSecondValue(conditionType: ConditionType): boolean {
    return conditionType === 'between' || conditionType === 'notBetween';
  }

  /**
   * Get condition types that don't require any value (IS NULL, etc.)
   */
  requiresNoValue(conditionType: ConditionType): boolean {
    return conditionType === 'isNull' || conditionType === 'isNotNull' ||
           conditionType === 'isTrue' || conditionType === 'isFalse';
  }

  /**
   * Emit filter change event
   */
  private emitFilterChange(): void {
    const conditions: ConditionalChainLink[] = this.visualFilters.map(vf => ({
      id: vf.id,
      displayName: `${vf.fieldName} ${vf.conditionType} ${vf.conditionValue}`,
      fieldName: vf.fieldName,
      conditionType: vf.conditionType,
      conditionValue: vf.conditionValue,
      conditionValueEnd: vf.conditionValueEnd,
      logicalOperator: vf.logicalOperator,
      isStateSpaceObject: true
    }));

    this.filterChanged.emit({
      filterType: this.filterType,
      objectType: this.objectType,
      conditions
    });
  }

  /**
   * Get display label for condition type
   */
  getConditionTypeLabel(conditionType: ConditionType): string {
    const option = this.conditionTypes.find(ct => ct.value === conditionType);
    return option?.displayName || conditionType;
  }

  /**
   * Extract value from input/select event target
   */
  getEventTargetValue(event: Event): string {
    return (event.target as HTMLInputElement | HTMLSelectElement).value;
  }

  /**
   * Get icon for current filter type
   */
  getFilterTypeIcon(): string {
    const ft = this.filterTypes.find(f => f.value === this.filterType);
    return ft?.icon || 'filter_list';
  }

  /**
   * Force update size mode (called externally)
   */
  forceUpdateSizeMode(): void {
    this.updateSizeMode();
  }

  /**
   * Check if more input slots can be added
   */
  canAddInput(): boolean {
    if (!this.allowDynamicInputs) return false;
    if (this.maxInputSlots === 0) return true; // unlimited
    return this.inputSlotCount < this.maxInputSlots;
  }

  /**
   * Request to add a new input slot
   */
  requestAddInputSlot(): void {
    if (this.canAddInput()) {
      this.addInputSlot.emit();
    }
  }

  /**
   * Toggle edit mode (for compatibility with default overlay)
   * Custom overlays are always in edit mode, so this is a no-op
   */
  toggleEditMode(): void {
    // Custom overlays are always interactive, no toggle needed
  }

  /**
   * Stop event propagation to prevent triggering D3 drag behavior
   */
  onOverlayClick(event: MouseEvent): void {
    event.stopPropagation();
    event.preventDefault();
  }

  /**
   * Handle mousedown to prevent drag from starting
   */
  onMouseDown(event: MouseEvent): void {
    event.stopPropagation();
  }
}
