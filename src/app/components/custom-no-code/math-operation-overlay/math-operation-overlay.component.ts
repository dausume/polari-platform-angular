// Author: Claude
// Custom overlay component for MathOperation state
// Allows performing basic math operations: add, subtract, multiply, divide, modulo

import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, ElementRef } from '@angular/core';
import {
  ValueSourceConfig,
  createDefaultValueSourceConfig,
  getSourceLabel
} from '../../../models/stateSpace/conditionalChain';
import { AvailableInput, SourceObjectField } from '../value-source-selector/value-source-selector.component';

/**
 * Math operation types
 */
export type MathOperationType = 'add' | 'subtract' | 'multiply' | 'divide' | 'modulo';

/**
 * Math operation configuration
 */
export interface MathOperationConfig {
  operationType: MathOperationType;
  leftOperand: ValueSourceConfig;
  rightOperand: ValueSourceConfig;
  resultTarget: 'solution_field' | 'new_variable';
  resultFieldPath: string;
  resultVariableName: string;
}


/**
 * MathOperationOverlayComponent provides an interface for configuring
 * basic math operations in the no-code visual programming system.
 */
@Component({
  standalone: false,
  selector: 'math-operation-overlay',
  templateUrl: './math-operation-overlay.component.html',
  styleUrls: ['./math-operation-overlay.component.css']
})
export class MathOperationOverlayComponent implements OnInit, OnDestroy {

  // Position and size (from StateOverlayManager)
  @Input() x: number = 0;
  @Input() y: number = 0;
  @Input() width: number = 100;
  @Input() height: number = 100;

  // State identification
  @Input() stateName: string = '';
  @Input() boundClassName: string = 'MathOperation';

  // Available inputs from connected states
  @Input() availableInputs: AvailableInput[] = [];

  // Source Object fields (with "self." prefix paths)
  @Input() sourceObjectFields: SourceObjectField[] = [];

  // Bound field values from the state instance
  @Input() boundObjectFieldValues: { [key: string]: any } | null = null;

  // Events
  @Output() operationChanged = new EventEmitter<MathOperationConfig>();
  @Output() fieldValuesChanged = new EventEmitter<{ [key: string]: any }>();
  @Output() fullViewRequested = new EventEmitter<{ x: number; y: number; stateName: string }>();
  @Output() statePageRequested = new EventEmitter<{ stateName: string }>();

  // Current operation configuration
  config: MathOperationConfig = {
    operationType: 'add',
    leftOperand: createDefaultValueSourceConfig('direct_assignment'),
    rightOperand: createDefaultValueSourceConfig('direct_assignment'),
    resultTarget: 'solution_field',
    resultFieldPath: '',
    resultVariableName: ''
  };

  // Operation options
  operations: { value: MathOperationType; label: string; symbol: string }[] = [
    { value: 'add', label: 'Add', symbol: '+' },
    { value: 'subtract', label: 'Subtract', symbol: '-' },
    { value: 'multiply', label: 'Multiply', symbol: '×' },
    { value: 'divide', label: 'Divide', symbol: '÷' },
    { value: 'modulo', label: 'Modulo', symbol: '%' }
  ];

  // Size mode flags
  isCompact: boolean = false;
  isSmall: boolean = false;

  // Popup state for value source editing
  activePopup: 'left' | 'right' | null = null;
  popupPosition: { top: number; left: number } = { top: 0, left: 0 };

  // Two-step result field selection state (matches operand "From Object" pattern:
  // Step 1: select object like "self", Step 2: select field from that object)
  resultObjectName: string = '';

  constructor(private elementRef: ElementRef) {}

  ngOnInit(): void {
    this.updateSizeMode();
    this.initializeFromInputs();
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
    if (this.boundObjectFieldValues) {
      const bofv = this.boundObjectFieldValues;

      if (bofv['operationType']) {
        this.config.operationType = bofv['operationType'] as MathOperationType;
      }

      if (bofv['leftOperand']) {
        this.config.leftOperand = bofv['leftOperand'];
      } else if (bofv['leftValue'] !== undefined) {
        this.config.leftOperand = {
          sourceType: 'direct_assignment',
          directValue: bofv['leftValue'],
          directValueType: 'int'
        };
      }

      if (bofv['rightOperand']) {
        this.config.rightOperand = bofv['rightOperand'];
      } else if (bofv['rightValue'] !== undefined) {
        this.config.rightOperand = {
          sourceType: 'direct_assignment',
          directValue: bofv['rightValue'],
          directValueType: 'int'
        };
      }

      if (bofv['resultTarget']) {
        this.config.resultTarget = bofv['resultTarget'];
      }

      if (bofv['resultFieldPath']) {
        if (!this.config.resultTarget) {
          this.config.resultTarget = 'solution_field';
        }
        this.config.resultFieldPath = bofv['resultFieldPath'];
        // Extract object name from path (e.g., "self.sum_result" → "self")
        const dotIdx = this.config.resultFieldPath.indexOf('.');
        if (dotIdx > 0) {
          this.resultObjectName = this.config.resultFieldPath.substring(0, dotIdx);
        }
      }

      if (bofv['resultVariableName']) {
        if (!bofv['resultFieldPath'] && !bofv['resultTarget']) {
          this.config.resultTarget = 'new_variable';
        }
        this.config.resultVariableName = bofv['resultVariableName'];
      }
    }
  }

  /**
   * Handle operation type change
   */
  onOperationChange(operationType: MathOperationType): void {
    this.config.operationType = operationType;
    this.emitChange();
  }

  /**
   * Handle left operand change
   */
  onLeftOperandChange(config: ValueSourceConfig): void {
    this.config.leftOperand = config;
    this.emitChange();
  }

  /**
   * Handle right operand change
   */
  onRightOperandChange(config: ValueSourceConfig): void {
    this.config.rightOperand = config;
    this.emitChange();
  }

  /**
   * Handle result target change
   */
  onResultTargetChange(target: 'solution_field' | 'new_variable'): void {
    this.config.resultTarget = target;
    if (target === 'solution_field') {
      this.config.resultVariableName = '';
    } else {
      this.config.resultFieldPath = '';
    }
    this.emitChange();
  }

  /**
   * Get unique object names from sourceObjectFields for the result target selector.
   * e.g., ["self.num_a", "self.num_b"] → ["self"]
   * Matches the "From Object" pattern in ValueSourceSelector.
   */
  getUniqueResultObjectNames(): string[] {
    const names = new Set<string>();
    for (const field of this.sourceObjectFields) {
      const dotIndex = field.path.indexOf('.');
      if (dotIndex > 0) {
        names.add(field.path.substring(0, dotIndex));
      }
    }
    return Array.from(names);
  }

  /**
   * Get fields belonging to the selected result object (e.g., all "self.*" fields)
   */
  getFieldsForResultObject(): SourceObjectField[] {
    if (!this.resultObjectName) return [];
    const prefix = this.resultObjectName + '.';
    return this.sourceObjectFields.filter(f => f.path.startsWith(prefix));
  }

  /**
   * Get display name for a field (strip object prefix, e.g., "self.sum_result" → "sum_result")
   */
  getFieldDisplayName(field: SourceObjectField): string {
    return field.displayName || field.path.split('.').slice(1).join('.');
  }

  /**
   * Handle result object selection change (Step 1 of two-step result field selection)
   */
  onResultObjectChange(objectName: string): void {
    this.resultObjectName = objectName;
    // Clear field path when object changes
    this.config.resultFieldPath = '';
  }

  /**
   * Handle result field path change (Step 2 of two-step result field selection)
   */
  onResultFieldChange(fieldPath: string): void {
    this.config.resultFieldPath = fieldPath;
    this.emitChange();
  }

  /**
   * Handle result variable name change
   */
  onResultVariableChange(name: string): void {
    this.config.resultVariableName = name;
    this.emitChange();
  }

  /**
   * Open value source popup
   */
  openPopup(event: MouseEvent, side: 'left' | 'right'): void {
    event.stopPropagation();
    event.preventDefault();

    const target = event.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();

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
    this.activePopup = side;
  }

  /**
   * Close popup
   */
  closePopup(): void {
    this.activePopup = null;
  }

  /**
   * Get current popup config
   */
  getPopupConfig(): ValueSourceConfig {
    if (this.activePopup === 'left') {
      return this.config.leftOperand;
    } else if (this.activePopup === 'right') {
      return this.config.rightOperand;
    }
    return createDefaultValueSourceConfig('direct_assignment');
  }

  /**
   * Handle popup config change
   */
  onPopupConfigChange(config: ValueSourceConfig): void {
    if (this.activePopup === 'left') {
      this.onLeftOperandChange(config);
    } else if (this.activePopup === 'right') {
      this.onRightOperandChange(config);
    }
  }

  /**
   * Get display text for operand
   */
  getOperandDisplayText(config: ValueSourceConfig): string {
    return getSourceLabel(config) || '(select)';
  }

  /**
   * Get operation symbol
   */
  getOperationSymbol(): string {
    const op = this.operations.find(o => o.value === this.config.operationType);
    return op?.symbol || '+';
  }

  /**
   * Get result target name
   */
  getResultTargetName(): string {
    if (this.config.resultTarget === 'solution_field') {
      const field = this.sourceObjectFields.find(f => f.path === this.config.resultFieldPath);
      return field?.displayName || this.config.resultFieldPath || '(select)';
    }
    return this.config.resultVariableName || '(enter name)';
  }

  /**
   * Get preview expression
   */
  getPreviewExpression(): string {
    const left = this.getOperandDisplayText(this.config.leftOperand);
    const right = this.getOperandDisplayText(this.config.rightOperand);
    const symbol = this.getOperationSymbol();
    const result = this.getResultTargetName();
    return `${result} = ${left} ${symbol} ${right}`;
  }

  /**
   * Emit configuration change
   */
  private emitChange(): void {
    this.operationChanged.emit(this.config);

    const fieldValues: { [key: string]: any } = {
      displayName: this.getDisplayName(),
      operationType: this.config.operationType,
      leftOperand: this.config.leftOperand,
      rightOperand: this.config.rightOperand,
      resultTarget: this.config.resultTarget,
      resultFieldPath: this.config.resultFieldPath,
      resultVariableName: this.config.resultVariableName
    };
    this.fieldValuesChanged.emit(fieldValues);
  }

  /**
   * Get display name for the state
   */
  getDisplayName(): string {
    const op = this.operations.find(o => o.value === this.config.operationType);
    return op?.label || 'Math Operation';
  }

  /**
   * Stop event propagation
   */
  onOverlayClick(event: MouseEvent): void {
    event.stopPropagation();
    event.preventDefault();
  }

  onMouseDown(event: MouseEvent): void {
    event.stopPropagation();
  }

  onContextMenu(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.fullViewRequested.emit({
      x: event.clientX,
      y: event.clientY,
      stateName: this.stateName
    });
  }

  toggleEditMode(): void {}

  forceUpdateSizeMode(): void {
    this.updateSizeMode();
  }
}
