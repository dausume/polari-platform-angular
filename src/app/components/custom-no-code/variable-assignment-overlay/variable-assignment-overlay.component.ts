// Author: Claude
// Custom overlay component for VariableAssignment state
// Allows defining custom variables and assigning values to Solution Object fields

import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, ElementRef } from '@angular/core';
import {
  ValueSource,
  VariableDataType,
  VariableAssignment
} from '../../../models/stateSpace/operationStates';
import {
  ValueSourceConfig,
  ValueSourceType,
  createDefaultValueSourceConfig,
  getSourceLabel
} from '../../../models/stateSpace/conditionalChain';
import { AvailableInput, SourceObjectField } from '../value-source-selector/value-source-selector.component';

/**
 * Extended interface for solution object fields with additional metadata
 */
export interface SolutionObjectFieldExtended {
  name: string;
  displayName: string;
  type: string;
  path: string;
  description?: string;
}

/**
 * Assignment target type - where the value is being assigned
 */
export type AssignmentTargetType = 'new_variable' | 'solution_object_field' | 'existing_variable';

/**
 * Interface for assignment configuration
 */
export interface AssignmentConfig {
  targetType: AssignmentTargetType;
  // For new_variable
  variableName: string;
  dataType: VariableDataType;
  isDeclare: boolean;
  isConst: boolean;
  // For solution_object_field
  solutionFieldPath: string;
  // Value configuration
  valueSource: ValueSourceConfig;
}

/**
 * VariableAssignmentOverlayComponent provides an interface for configuring
 * variable assignments in the no-code visual programming system.
 *
 * Supports:
 * - Creating new custom variables
 * - Assigning values to Solution Object fields (e.g., num_a, num_b)
 * - Various value sources (literal, variable, expression, slot)
 */
@Component({
  selector: 'variable-assignment-overlay',
  templateUrl: './variable-assignment-overlay.component.html',
  styleUrls: ['./variable-assignment-overlay.component.css']
})
export class VariableAssignmentOverlayComponent implements OnInit, OnDestroy {

  // Position and size (from StateOverlayManager)
  @Input() x: number = 0;
  @Input() y: number = 0;
  @Input() width: number = 100;
  @Input() height: number = 100;

  // State identification
  @Input() stateName: string = '';
  @Input() boundClassName: string = 'VariableAssignment';

  // Available input fields from connected states
  @Input() availableInputs: AvailableInput[] = [];

  // Solution Object fields for assignment targets
  @Input() solutionObjectFields: SolutionObjectFieldExtended[] = [];

  // Existing variables in scope (from context)
  @Input() existingVariables: { name: string; type: string; source: string }[] = [];

  // Current assignment configuration
  @Input() currentConfig: AssignmentConfig | null = null;

  // Bound field values from the state instance
  @Input() boundObjectFieldValues: { [key: string]: any } | null = null;

  // Events
  @Output() assignmentChanged = new EventEmitter<AssignmentConfig>();
  @Output() fieldValuesChanged = new EventEmitter<{ [key: string]: any }>();
  @Output() newVariableCreated = new EventEmitter<{ name: string; type: string }>();

  // Current assignment configuration
  config: AssignmentConfig = {
    targetType: 'solution_object_field',
    variableName: '',
    dataType: 'any',
    isDeclare: true,
    isConst: false,
    solutionFieldPath: '',
    valueSource: createDefaultValueSourceConfig('direct_assignment')
  };

  // Data types for dropdown
  dataTypes: { value: VariableDataType; label: string }[] = [
    { value: 'string', label: 'String' },
    { value: 'number', label: 'Number' },
    { value: 'boolean', label: 'Boolean' },
    { value: 'date', label: 'Date' },
    { value: 'array', label: 'Array' },
    { value: 'object', label: 'Object' },
    { value: 'any', label: 'Any' }
  ];

  // Target type options
  targetTypes: { value: AssignmentTargetType; label: string; icon: string }[] = [
    { value: 'solution_object_field', label: 'Solution Field', icon: 'apartment' },
    { value: 'new_variable', label: 'New Variable', icon: 'add_circle' },
    { value: 'existing_variable', label: 'Existing Variable', icon: 'data_object' }
  ];

  // Size mode flags
  isCompact: boolean = false;
  isSmall: boolean = false;

  // Popup state for value source editing
  valuePopupVisible: boolean = false;
  popupPosition: { top: number; left: number } = { top: 0, left: 0 };

  // Variable name validation
  variableNameError: string = '';
  isVariableNameUnique: boolean = true;
  private lastEmittedVariableName: string = '';

  constructor(private elementRef: ElementRef) {}

  ngOnInit(): void {
    this.updateSizeMode();
    this.initializeFromInputs();

    // If we initialized with a new variable, validate and emit
    if (this.config.targetType === 'new_variable' && this.config.variableName) {
      this.validateVariableName(this.config.variableName);
    }
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
   * Initialize configuration from input data
   */
  private initializeFromInputs(): void {
    if (this.currentConfig) {
      this.config = { ...this.currentConfig };
    } else if (this.boundObjectFieldValues) {
      // Initialize from bound field values
      const bofv = this.boundObjectFieldValues;

      // Check if we're assigning to a solution field or declaring a variable
      if (bofv['variableName']) {
        // Check if this variable name matches a solution field
        const matchingSolutionField = this.solutionObjectFields.find(
          f => f.path === bofv['variableName'] || f.name === bofv['variableName'] || f.displayName === bofv['variableName']
        );

        if (matchingSolutionField) {
          this.config.targetType = 'solution_object_field';
          this.config.solutionFieldPath = matchingSolutionField.path;
        } else {
          this.config.targetType = 'new_variable';
          this.config.variableName = bofv['variableName'];
        }
      }

      if (bofv['dataType']) {
        this.config.dataType = bofv['dataType'] as VariableDataType;
      }

      // Initialize value source from the stored value
      if (bofv['value'] !== undefined && bofv['value'] !== null) {
        const value = bofv['value'];
        // Try to detect if it's an expression or literal
        if (typeof value === 'string' && /[+\-*\/]/.test(value)) {
          // Looks like an expression
          this.config.valueSource = {
            sourceType: 'direct_assignment',
            directValue: value,
            directValueType: 'str'
          };
        } else {
          this.config.valueSource = {
            sourceType: 'direct_assignment',
            directValue: value,
            directValueType: this.inferValueType(value)
          };
        }
      }
    }
  }

  /**
   * Infer value type from a value
   */
  private inferValueType(value: any): 'str' | 'int' | 'float' | 'bool' {
    if (typeof value === 'boolean') return 'bool';
    if (typeof value === 'number') {
      return Number.isInteger(value) ? 'int' : 'float';
    }
    return 'str';
  }

  /**
   * Handle target type change
   */
  onTargetTypeChange(targetType: AssignmentTargetType): void {
    this.config.targetType = targetType;

    // Reset relevant fields based on target type
    if (targetType === 'solution_object_field') {
      this.config.variableName = '';
      // Pre-select first solution field if available
      if (this.solutionObjectFields.length > 0 && !this.config.solutionFieldPath) {
        this.config.solutionFieldPath = this.solutionObjectFields[0].path;
      }
    } else if (targetType === 'new_variable') {
      this.config.solutionFieldPath = '';
      this.config.isDeclare = true;
    } else if (targetType === 'existing_variable') {
      this.config.solutionFieldPath = '';
      this.config.isDeclare = false;
      // Pre-select first existing variable if available
      if (this.existingVariables.length > 0 && !this.config.variableName) {
        this.config.variableName = this.existingVariables[0].name;
      }
    }

    this.emitChange();
  }

  /**
   * Handle solution field selection
   */
  onSolutionFieldChange(fieldPath: string): void {
    this.config.solutionFieldPath = fieldPath;

    // Update data type based on field type
    const field = this.solutionObjectFields.find(f => f.path === fieldPath);
    if (field) {
      this.config.dataType = this.mapTypeToDataType(field.type);
    }

    this.emitChange();
  }

  /**
   * Map field type string to VariableDataType
   */
  private mapTypeToDataType(typeStr: string): VariableDataType {
    const lowerType = typeStr.toLowerCase();
    if (lowerType === 'int' || lowerType === 'number' || lowerType === 'float') {
      return 'number';
    }
    if (lowerType === 'str' || lowerType === 'string') {
      return 'string';
    }
    if (lowerType === 'bool' || lowerType === 'boolean') {
      return 'boolean';
    }
    if (lowerType === 'date' || lowerType === 'datetime') {
      return 'date';
    }
    if (lowerType.includes('array') || lowerType.includes('list')) {
      return 'array';
    }
    if (lowerType === 'object' || lowerType === 'dict') {
      return 'object';
    }
    return 'any';
  }

  /**
   * Handle variable name change
   */
  onVariableNameChange(name: string): void {
    this.config.variableName = name;

    // Validate the variable name for new variables
    if (this.config.targetType === 'new_variable') {
      this.validateVariableName(name);
    }

    this.emitChange();
  }

  /**
   * Validate that the variable name is unique and valid
   */
  private validateVariableName(name: string): void {
    this.variableNameError = '';
    this.isVariableNameUnique = true;

    if (!name || name.trim() === '') {
      this.variableNameError = 'Variable name is required';
      this.isVariableNameUnique = false;
      return;
    }

    // Check for valid identifier format
    const validIdentifier = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
    if (!validIdentifier.test(name)) {
      this.variableNameError = 'Invalid name. Use letters, numbers, and underscores only. Start with a letter or underscore.';
      this.isVariableNameUnique = false;
      return;
    }

    // Check against existing variables in context
    const isDuplicate = this.existingVariables.some(
      v => v.name.toLowerCase() === name.toLowerCase()
    );

    if (isDuplicate) {
      this.variableNameError = `Variable "${name}" already exists in context`;
      this.isVariableNameUnique = false;
      return;
    }

    // Check against solution object fields
    const isSolutionField = this.solutionObjectFields.some(
      f => f.name.toLowerCase() === name.toLowerCase() ||
           f.path.toLowerCase() === name.toLowerCase()
    );

    if (isSolutionField) {
      this.variableNameError = `"${name}" conflicts with a solution field name`;
      this.isVariableNameUnique = false;
      return;
    }

    // Name is valid and unique - emit the new variable creation event
    // Only emit if this is a different variable than last time
    if (name !== this.lastEmittedVariableName) {
      this.lastEmittedVariableName = name;
      this.emitNewVariableCreated();
    }
  }

  /**
   * Emit new variable created event for context update
   */
  private emitNewVariableCreated(): void {
    if (this.config.targetType === 'new_variable' &&
        this.isVariableNameUnique &&
        this.config.variableName.trim()) {
      console.log('[VariableAssignment] Emitting newVariableCreated:', {
        name: this.config.variableName,
        type: this.config.dataType,
        stateName: this.stateName
      });
      this.newVariableCreated.emit({
        name: this.config.variableName,
        type: this.config.dataType
      });
    } else {
      console.log('[VariableAssignment] NOT emitting - conditions not met:', {
        targetType: this.config.targetType,
        isVariableNameUnique: this.isVariableNameUnique,
        variableName: this.config.variableName
      });
    }
  }

  /**
   * Handle data type change
   */
  onDataTypeChange(dataType: VariableDataType): void {
    this.config.dataType = dataType;
    this.emitChange();

    // Re-emit new variable if we have a valid variable name
    if (this.config.targetType === 'new_variable' && this.isVariableNameUnique && this.config.variableName.trim()) {
      this.emitNewVariableCreated();
    }
  }

  /**
   * Handle const toggle
   */
  onConstToggle(): void {
    this.config.isConst = !this.config.isConst;
    this.emitChange();
  }

  /**
   * Handle value source change from popup
   */
  onValueSourceChange(config: ValueSourceConfig): void {
    this.config.valueSource = config;
    this.emitChange();
  }

  /**
   * Open the value source popup
   */
  openValuePopup(event: MouseEvent): void {
    event.stopPropagation();
    event.preventDefault();

    const target = event.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();

    // Position popup below the clicked button
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const popupEstimatedWidth = 400;
    const popupEstimatedHeight = 150;

    let top = rect.bottom + 4;
    let left = rect.left;

    if (left + popupEstimatedWidth > viewportWidth - 10) {
      left = Math.max(10, viewportWidth - popupEstimatedWidth - 10);
    }

    if (top + popupEstimatedHeight > viewportHeight - 10) {
      top = rect.top - popupEstimatedHeight - 4;
    }

    this.popupPosition = { top, left };
    this.valuePopupVisible = true;
  }

  /**
   * Close the value source popup
   */
  closeValuePopup(): void {
    this.valuePopupVisible = false;
  }

  /**
   * Get display text for current value source
   */
  getValueDisplayText(): string {
    return getSourceLabel(this.config.valueSource);
  }

  /**
   * Emit configuration change
   */
  private emitChange(): void {
    this.assignmentChanged.emit(this.config);

    // Also emit as bound field values for state persistence
    const fieldValues: { [key: string]: any } = {
      displayName: this.getDisplayName(),
      variableName: this.getTargetName(),
      dataType: this.config.dataType,
      value: this.getValueString(),
      description: this.getDescription()
    };
    this.fieldValuesChanged.emit(fieldValues);
  }

  /**
   * Get the target name for the assignment
   */
  getTargetName(): string {
    if (this.config.targetType === 'solution_object_field') {
      return this.config.solutionFieldPath;
    }
    return this.config.variableName;
  }

  /**
   * Get display name for the state
   */
  getDisplayName(): string {
    const target = this.getTargetName();
    const value = getSourceLabel(this.config.valueSource);
    if (this.config.targetType === 'new_variable' && this.config.isDeclare) {
      return `let ${target} = ${value}`;
    }
    return `${target} = ${value}`;
  }

  /**
   * Get value as string for storage
   */
  private getValueString(): any {
    if (this.config.valueSource.sourceType === 'direct_assignment') {
      return this.config.valueSource.directValue;
    }
    return getSourceLabel(this.config.valueSource);
  }

  /**
   * Get description for the state
   */
  private getDescription(): string {
    if (this.config.targetType === 'solution_object_field') {
      const field = this.solutionObjectFields.find(f => f.path === this.config.solutionFieldPath);
      return field?.description || `Assign value to ${this.config.solutionFieldPath}`;
    }
    if (this.config.targetType === 'new_variable') {
      return `Declare ${this.config.isConst ? 'constant' : 'variable'} ${this.config.variableName}`;
    }
    return `Assign value to ${this.config.variableName}`;
  }

  /**
   * Get selected field display name
   */
  getSelectedFieldDisplayName(): string {
    const field = this.solutionObjectFields.find(f => f.path === this.config.solutionFieldPath);
    return field?.displayName || this.config.solutionFieldPath || '(select field)';
  }

  /**
   * Convert solution object fields to SourceObjectField format for value-source-selector
   */
  getSourceObjectFieldsForSelector(): SourceObjectField[] {
    return this.solutionObjectFields.map(f => ({
      path: f.path,
      type: f.type,
      displayName: f.displayName
    }));
  }

  /**
   * Stop event propagation for overlay interaction
   */
  onOverlayClick(event: MouseEvent): void {
    event.stopPropagation();
    event.preventDefault();
  }

  onMouseDown(event: MouseEvent): void {
    event.stopPropagation();
  }

  /**
   * Toggle edit mode (for compatibility)
   */
  toggleEditMode(): void {
    // Custom overlays are always interactive
  }

  /**
   * Force update size mode (called externally)
   */
  forceUpdateSizeMode(): void {
    this.updateSizeMode();
  }

  /**
   * Handle document click to close popup
   */
  onDocumentClick(event: MouseEvent): void {
    if (this.valuePopupVisible) {
      const target = event.target as HTMLElement;
      const popup = this.elementRef.nativeElement.querySelector('.value-popup');
      const isInsidePopup = popup && popup.contains(target);
      const isValueButton = target.closest('.value-display-btn');

      if (!isInsidePopup && !isValueButton) {
        this.closeValuePopup();
      }
    }
  }
}
