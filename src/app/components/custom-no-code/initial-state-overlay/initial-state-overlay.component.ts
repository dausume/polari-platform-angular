// Author: Dustin Etts
// Custom overlay component for InitialState types
// Displays the Solution Object information and provides trigger type selector

import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, OnChanges, SimpleChanges } from '@angular/core';
import { InitialStateTriggerType, getAvailableInitialStateTypes } from '@models/stateSpace/initialStates';
import { TargetRuntime } from '@models/noCode/mock-NCS-data';
import { StateSpaceClassRegistry } from '@models/stateSpace/stateSpaceClassRegistry';

/**
 * Solution Object field definition
 */
export interface SolutionField {
  name: string;
  displayName: string;
  type: string;
  defaultValue?: any;
  description?: string;
}

/**
 * Trigger type option for dropdown display
 */
export interface TriggerTypeOption {
  type: InitialStateTriggerType;
  label: string;
  icon: string;
  color: string;
}

/**
 * InitialStateOverlayComponent displays the Solution Object context
 * and provides a trigger type selector for changing initial state type.
 */
@Component({
  standalone: false,
  selector: 'initial-state-overlay',
  templateUrl: './initial-state-overlay.component.html',
  styleUrls: ['./initial-state-overlay.component.css']
})
export class InitialStateOverlayComponent implements OnInit, OnDestroy, OnChanges {

  // Position and size (from StateOverlayManager)
  @Input() x: number = 0;
  @Input() y: number = 0;
  @Input() width: number = 100;
  @Input() height: number = 100;

  // State identification
  @Input() stateName: string = '';
  @Input() boundClassName: string = 'DirectInvocation';

  // Solution information
  @Input() solutionName: string = '';
  @Input() solutionClassName: string = '';
  @Input() solutionDescription: string = '';

  // Solution Object fields
  @Input() solutionFields: SolutionField[] = [];

  // Input parameters defined for this initial state
  @Input() inputParams: { name: string; type: string; description?: string }[] = [];

  // Trigger type management
  @Input() currentTriggerType: InitialStateTriggerType = 'direct_invocation';
  @Input() targetRuntime: TargetRuntime = 'python_backend';
  @Output() triggerTypeChanged = new EventEmitter<InitialStateTriggerType>();

  // Bound field values for type-specific fields
  @Input() boundObjectFieldValues: { [key: string]: any } = {};
  @Output() fieldValueChanged = new EventEmitter<{ fieldName: string; value: any }>();

  // Available trigger type options (computed from runtime)
  triggerTypeOptions: TriggerTypeOption[] = [];

  // Whether the trigger type dropdown is open
  showTypeSelector: boolean = false;

  // Size mode flags
  isCompact: boolean = false;
  isSmall: boolean = false;

  // Scroll state for field list
  showAllFields: boolean = false;
  maxVisibleFields: number = 4;

  private registry = StateSpaceClassRegistry.getInstance();

  ngOnInit(): void {
    this.updateSizeMode();
    this.updateTriggerTypeOptions();
  }

  ngOnDestroy(): void {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['targetRuntime']) {
      this.updateTriggerTypeOptions();
    }
    if (changes['width'] || changes['height']) {
      this.updateSizeMode();
    }
  }

  /**
   * Build the list of available trigger type options from the runtime
   */
  private updateTriggerTypeOptions(): void {
    const availableTypes = getAvailableInitialStateTypes(this.targetRuntime);
    this.triggerTypeOptions = availableTypes.map(type => {
      const metadata = this.getMetadataForTriggerType(type);
      return {
        type,
        label: metadata?.displayName || this.getTriggerTypeLabel(type),
        icon: metadata?.icon || 'play_circle',
        color: metadata?.color || '#4CAF50'
      };
    });
  }

  /**
   * Get registry metadata for a trigger type
   */
  private getMetadataForTriggerType(type: InitialStateTriggerType) {
    const classNameMap: { [key in InitialStateTriggerType]: string } = {
      'direct_invocation': 'DirectInvocation',
      'form_subscription': 'FormSubscription',
      'logic_flow_entry': 'LogicFlowEntry',
      'backend_state_change': 'BackendStateChange'
    };
    return this.registry.getClass(classNameMap[type]);
  }

  /**
   * Fallback labels for trigger types
   */
  private getTriggerTypeLabel(type: InitialStateTriggerType): string {
    const labels: { [key in InitialStateTriggerType]: string } = {
      'direct_invocation': 'Direct Invocation',
      'form_subscription': 'Form Subscription',
      'logic_flow_entry': 'Logic Flow Entry',
      'backend_state_change': 'Backend State Change'
    };
    return labels[type];
  }

  /**
   * Get the current trigger type option
   */
  getCurrentTriggerOption(): TriggerTypeOption | undefined {
    return this.triggerTypeOptions.find(opt => opt.type === this.currentTriggerType);
  }

  /**
   * Handle trigger type selection from dropdown
   */
  onTriggerTypeChange(newType: InitialStateTriggerType): void {
    if (newType !== this.currentTriggerType) {
      this.currentTriggerType = newType;
      this.triggerTypeChanged.emit(newType);
    }
    this.showTypeSelector = false;
  }

  /**
   * Toggle the trigger type selector dropdown
   */
  toggleTypeSelector(event: MouseEvent): void {
    event.stopPropagation();
    event.preventDefault();
    this.showTypeSelector = !this.showTypeSelector;
  }

  /**
   * Handle field value change for type-specific fields
   */
  onFieldValueChange(fieldName: string, value: any): void {
    this.fieldValueChanged.emit({ fieldName, value });
  }

  /**
   * Update size mode based on dimensions
   */
  private updateSizeMode(): void {
    const minDimension = Math.min(this.width, this.height);
    this.isCompact = minDimension < 100;
    this.isSmall = minDimension < 150;

    // Adjust visible fields based on size
    if (this.isCompact) {
      this.maxVisibleFields = 2;
    } else if (this.isSmall) {
      this.maxVisibleFields = 3;
    } else {
      this.maxVisibleFields = 4;
    }
  }

  /**
   * Get fields to display (limited unless expanded)
   */
  getVisibleFields(): SolutionField[] {
    if (this.showAllFields || this.solutionFields.length <= this.maxVisibleFields) {
      return this.solutionFields;
    }
    return this.solutionFields.slice(0, this.maxVisibleFields);
  }

  /**
   * Check if there are more fields than visible
   */
  hasMoreFields(): boolean {
    return this.solutionFields.length > this.maxVisibleFields && !this.showAllFields;
  }

  /**
   * Get count of hidden fields
   */
  getHiddenFieldCount(): number {
    return this.solutionFields.length - this.maxVisibleFields;
  }

  /**
   * Toggle showing all fields
   */
  toggleShowAllFields(): void {
    this.showAllFields = !this.showAllFields;
  }

  /**
   * Get type badge color based on type
   */
  getTypeBadgeClass(type: string): string {
    const lowerType = type.toLowerCase();
    if (lowerType === 'int' || lowerType === 'number' || lowerType === 'float') {
      return 'type-number';
    }
    if (lowerType === 'str' || lowerType === 'string') {
      return 'type-string';
    }
    if (lowerType === 'bool' || lowerType === 'boolean') {
      return 'type-bool';
    }
    if (lowerType.includes('array') || lowerType.includes('list')) {
      return 'type-array';
    }
    return 'type-default';
  }

  /**
   * Stop event propagation for overlay interaction
   */
  onOverlayClick(event: MouseEvent): void {
    event.stopPropagation();
    event.preventDefault();
    // Close the type selector if clicking outside it
    this.showTypeSelector = false;
  }

  onMouseDown(event: MouseEvent): void {
    event.stopPropagation();
  }

  /**
   * Toggle edit mode (for compatibility)
   */
  toggleEditMode(): void {
    // Handled via trigger type selector
  }

  /**
   * Force update size mode (called externally)
   */
  forceUpdateSizeMode(): void {
    this.updateSizeMode();
  }
}
