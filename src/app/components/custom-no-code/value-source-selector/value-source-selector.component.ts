// Author: Dustin Etts
// polari-platform-angular/src/app/components/custom-no-code/value-source-selector/value-source-selector.component.ts
// Reusable component for selecting value sources in conditional chains and log outputs

import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { ValueSourceConfig, ValueSourceType } from '../../../models/stateSpace/conditionalChain';

/**
 * Available input variable from a connected state
 */
export interface AvailableInput {
  slotIndex: number;
  variableName: string;
  type: string;
  sourceStateName?: string;
  label?: string;
}

/**
 * Available field from the source object (self)
 */
export interface SourceObjectField {
  path: string;
  type: string;
  displayName?: string;
}

/**
 * ValueSourceSelectorComponent - Reusable component for selecting value sources.
 *
 * Supports three source types:
 * 1. From Input - Select from available input variables connected to the state
 * 2. From Source Object - Select from properties of the source object (self)
 * 3. Direct Assignment - Enter a literal value with type
 */
@Component({
  selector: 'app-value-source-selector',
  templateUrl: './value-source-selector.component.html',
  styleUrls: ['./value-source-selector.component.css']
})
export class ValueSourceSelectorComponent implements OnInit, OnChanges {

  // Current configuration
  @Input() config: ValueSourceConfig = {
    sourceType: 'from_input',
    inputSlotIndex: 0
  };

  // Available inputs from connected states
  @Input() availableInputs: AvailableInput[] = [];

  // Available fields from the source object
  @Input() sourceObjectFields: SourceObjectField[] = [];

  // Label for this selector (e.g., "Left Side", "Right Side")
  @Input() label: string = 'Value';

  // Whether to show in compact mode
  @Input() compact: boolean = false;

  // Whether the selector is disabled
  @Input() disabled: boolean = false;

  // Event emitted when configuration changes
  @Output() configChange = new EventEmitter<ValueSourceConfig>();

  // Source type options
  sourceTypeOptions: { value: ValueSourceType; label: string; icon: string }[] = [
    { value: 'from_input', label: 'From Input', icon: 'input' },
    { value: 'from_source_object', label: 'From Object', icon: 'account_tree' },
    { value: 'direct_assignment', label: 'Direct Value', icon: 'edit' }
  ];

  // Direct value type options
  directValueTypes: { value: string; label: string }[] = [
    { value: 'int', label: 'Integer' },
    { value: 'float', label: 'Float' },
    { value: 'str', label: 'String' },
    { value: 'bool', label: 'Boolean' }
  ];

  // Local state for form values
  // Start with empty string (no selection) - will be cast as needed
  selectedSourceType: ValueSourceType | '' = '';
  selectedInputIndex: number = 0;
  selectedInputVariable: string = '';
  selectedObjectPath: string = '';
  directValue: string = '';
  directValueType: 'int' | 'str' | 'bool' | 'float' = 'str';

  ngOnInit(): void {
    this.syncFromConfig();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['config'] && !changes['config'].firstChange) {
      this.syncFromConfig();
    }
  }

  /**
   * Sync local state from input config
   */
  private syncFromConfig(): void {
    if (!this.config) return;

    this.selectedSourceType = this.config.sourceType || 'from_input';

    switch (this.selectedSourceType) {
      case 'from_input':
        this.selectedInputIndex = this.config.inputSlotIndex ?? 0;
        this.selectedInputVariable = this.config.inputVariableName || '';
        break;
      case 'from_source_object':
        this.selectedObjectPath = this.config.sourceObjectPath || '';
        break;
      case 'direct_assignment':
        this.directValue = this.config.directValue !== undefined ? String(this.config.directValue) : '';
        this.directValueType = this.config.directValueType || 'int';
        break;
    }
  }

  /**
   * Handle source type selection change
   */
  onSourceTypeChange(newType: ValueSourceType | ''): void {
    this.selectedSourceType = newType;
    if (newType) {
      this.emitConfigChange();
    }
  }

  /**
   * Handle input variable selection change
   */
  onInputChange(inputKey: string): void {
    // inputKey format: "slotIndex:variableName"
    const parts = inputKey.split(':');
    if (parts.length >= 2) {
      this.selectedInputIndex = parseInt(parts[0], 10);
      this.selectedInputVariable = parts[1];
    }
    this.emitConfigChange();
  }

  /**
   * Handle source object path selection change
   */
  onObjectPathChange(path: string): void {
    this.selectedObjectPath = path;
    this.emitConfigChange();
  }

  /**
   * Handle direct value change
   */
  onDirectValueChange(value: string): void {
    this.directValue = value;
    this.emitConfigChange();
  }

  /**
   * Handle direct value type change
   */
  onDirectValueTypeChange(type: string): void {
    this.directValueType = type as 'int' | 'str' | 'bool' | 'float';
    this.emitConfigChange();
  }

  /**
   * Emit the updated configuration
   */
  private emitConfigChange(): void {
    // Don't emit if no source type selected
    if (!this.selectedSourceType) {
      return;
    }

    const newConfig: ValueSourceConfig = {
      sourceType: this.selectedSourceType as ValueSourceType
    };

    switch (this.selectedSourceType) {
      case 'from_input':
        newConfig.inputSlotIndex = this.selectedInputIndex;
        newConfig.inputVariableName = this.selectedInputVariable;
        break;
      case 'from_source_object':
        newConfig.sourceObjectPath = this.selectedObjectPath;
        break;
      case 'direct_assignment':
        newConfig.directValue = this.parseDirectValue(this.directValue, this.directValueType);
        newConfig.directValueType = this.directValueType;
        break;
    }

    this.configChange.emit(newConfig);
  }

  /**
   * Parse direct value to the appropriate type
   */
  private parseDirectValue(value: string, type: string): any {
    switch (type) {
      case 'int':
        return parseInt(value, 10) || 0;
      case 'float':
        return parseFloat(value) || 0.0;
      case 'bool':
        return value.toLowerCase() === 'true' || value === '1';
      case 'str':
      default:
        return value;
    }
  }

  /**
   * Get the key for an available input (for selection matching)
   */
  getInputKey(input: AvailableInput): string {
    return `${input.slotIndex}:${input.variableName}`;
  }

  /**
   * Get the currently selected input key
   */
  getSelectedInputKey(): string {
    return `${this.selectedInputIndex}:${this.selectedInputVariable}`;
  }

  /**
   * Get display text for the current configuration
   */
  getDisplayText(): string {
    switch (this.selectedSourceType) {
      case 'from_input':
        if (this.selectedInputVariable) {
          return this.selectedInputVariable;
        }
        return `input[${this.selectedInputIndex}]`;
      case 'from_source_object':
        const path = this.selectedObjectPath || '';
        if (path.startsWith('self.')) {
          return `Object.${path.substring(5)}`;
        }
        return path ? `Object.${path}` : 'Object.(?)';
      case 'direct_assignment':
        if (this.directValue !== undefined && this.directValue !== '') {
          return `[${this.directValueType}] ${this.directValue}`;
        }
        return `[${this.directValueType}] (empty)`;
      default:
        return '(not selected)';
    }
  }

  /**
   * Check if the selection is complete (all required fields filled)
   */
  hasCompleteSelection(): boolean {
    if (!this.selectedSourceType) {
      return false;
    }

    switch (this.selectedSourceType) {
      case 'from_input':
        return !!this.selectedInputVariable;
      case 'from_source_object':
        return !!this.selectedObjectPath;
      case 'direct_assignment':
        return this.directValue !== undefined && this.directValue !== '';
      default:
        return false;
    }
  }

  /**
   * Get placeholder text for value input based on type
   */
  getValuePlaceholder(): string {
    switch (this.directValueType) {
      case 'int':
        return 'e.g., 42';
      case 'float':
        return 'e.g., 3.14';
      case 'str':
        return 'e.g., hello';
      case 'bool':
        return 'true or false';
      default:
        return 'Enter value...';
    }
  }

  /**
   * Stop event propagation (prevent drag behavior)
   */
  onInteractionStart(event: Event): void {
    event.stopPropagation();
  }
}
