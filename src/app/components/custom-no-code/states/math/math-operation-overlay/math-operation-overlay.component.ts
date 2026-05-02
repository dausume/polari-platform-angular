// Author: Dustin Etts
// Base overlay for the MathOperation state.
//
// Owns operation config + value-source popup state. Routes rendering to a sized
// sub-view (tiny / compact / full) based on the host rect width and renders the
// popup at root level so it floats above the canvas regardless of which sub-view
// triggered it.
//
// Convention: see states/_shared/state-overlay/README.md.

import { Component, Input, Output, EventEmitter, OnInit, OnDestroy } from '@angular/core';
import {
  ValueSourceConfig,
  createDefaultValueSourceConfig,
  getSourceLabel
} from '@models/stateSpace';
import { SizeTier, resolveSizeTier } from '../../_shared/state-overlay/size-tier';
import { AvailableInput, SourceObjectField } from '../../../shared/value-source-selector/value-source-selector.component';
import {
  MathOperationConfig,
  MathOperationOption,
  MathOperationPopupRequest,
  MathOperationPopupSide,
  MathOperationType
} from './math-operation-overlay.types';

export {
  MathOperationConfig,
  MathOperationType
} from './math-operation-overlay.types';

@Component({
  standalone: false,
  selector: 'math-operation-overlay',
  templateUrl: './math-operation-overlay.component.html',
  styleUrls: ['./math-operation-overlay.component.css']
})
export class MathOperationOverlayComponent implements OnInit, OnDestroy {
  // Standard overlay inputs (see _shared/state-overlay/README.md)
  @Input() x: number = 0;
  @Input() y: number = 0;
  @Input() width: number = 100;
  @Input() height: number = 100;
  @Input() stateName: string = '';
  @Input() boundClassName: string = 'MathOperation';
  @Input() boundObjectFieldValues: { [key: string]: any } | null = null;

  // State-specific inputs
  @Input() availableInputs: AvailableInput[] = [];
  @Input() sourceObjectFields: SourceObjectField[] = [];

  // Standard overlay outputs
  @Output() fieldValuesChanged = new EventEmitter<{ [key: string]: any }>();
  @Output() popupRequested = new EventEmitter<void>();
  @Output() fullViewRequested = new EventEmitter<{ x: number; y: number; stateName: string }>();
  @Output() statePageRequested = new EventEmitter<{ stateName: string }>();

  // State-specific outputs
  @Output() operationChanged = new EventEmitter<MathOperationConfig>();

  config: MathOperationConfig = {
    operationType: 'add',
    leftOperand: createDefaultValueSourceConfig('direct_assignment'),
    rightOperand: createDefaultValueSourceConfig('direct_assignment'),
    resultTarget: 'solution_field',
    resultFieldPath: '',
    resultVariableName: ''
  };

  operations: MathOperationOption[] = [
    { value: 'add', label: 'Add', symbol: '+' },
    { value: 'subtract', label: 'Subtract', symbol: '-' },
    { value: 'multiply', label: 'Multiply', symbol: '×' },
    { value: 'divide', label: 'Divide', symbol: '÷' },
    { value: 'modulo', label: 'Modulo', symbol: '%' }
  ];

  sizeTier: SizeTier = 'full';

  /** This state has a custom popup view (see ./popup/). Drives the expand button in sub-views. */
  hasPopupView: boolean = true;

  // Popup state — owned by base, rendered at root regardless of which sub-view triggered it
  activePopup: MathOperationPopupSide | null = null;
  popupPosition: { top: number; left: number } = { top: 0, left: 0 };

  // ValueSourceConfig for the result target (reuses the same interface as operands)
  resultSourceConfig: ValueSourceConfig = { sourceType: 'from_source_object' };

  // Legacy two-step state kept for backwards compat with existing data
  resultObjectName: string = '';

  ngOnInit(): void {
    this.sizeTier = resolveSizeTier(this.width);
    this.initializeFromInputs();
  }

  ngOnDestroy(): void {}

  forceUpdateSizeMode(): void {
    this.sizeTier = resolveSizeTier(this.width);
  }

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
        const dotIdx = this.config.resultFieldPath.indexOf('.');
        if (dotIdx > 0) {
          this.resultObjectName = this.config.resultFieldPath.substring(0, dotIdx);
        }
        this.resultSourceConfig = {
          sourceType: 'from_source_object',
          sourceObjectPath: this.config.resultFieldPath
        };
      }

      if (bofv['resultVariableName']) {
        if (!bofv['resultFieldPath'] && !bofv['resultTarget']) {
          this.config.resultTarget = 'new_variable';
        }
        this.config.resultVariableName = bofv['resultVariableName'];
        if (this.config.resultTarget === 'new_variable') {
          this.resultSourceConfig = {
            sourceType: 'direct_assignment',
            directValue: this.config.resultVariableName,
            directValueType: 'str'
          };
        }
      }
    }
  }

  onOperationChange(operationType: MathOperationType): void {
    this.config.operationType = operationType;
    this.emitChange();
  }

  onLeftOperandChange(config: ValueSourceConfig): void {
    this.config.leftOperand = config;
    this.emitChange();
  }

  onRightOperandChange(config: ValueSourceConfig): void {
    this.config.rightOperand = config;
    this.emitChange();
  }

  onPopupRequested(req: MathOperationPopupRequest): void {
    this.openPopup(req.event, req.side);
  }

  onExpandClicked(): void {
    this.popupRequested.emit();
  }

  private openPopup(event: MouseEvent, side: MathOperationPopupSide): void {
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

  closePopup(): void {
    this.activePopup = null;
  }

  getPopupConfig(): ValueSourceConfig {
    if (this.activePopup === 'left') {
      return this.config.leftOperand;
    } else if (this.activePopup === 'right') {
      return this.config.rightOperand;
    } else if (this.activePopup === 'result') {
      return this.resultSourceConfig;
    }
    return createDefaultValueSourceConfig('direct_assignment');
  }

  onPopupConfigChange(config: ValueSourceConfig): void {
    if (this.activePopup === 'left') {
      this.onLeftOperandChange(config);
    } else if (this.activePopup === 'right') {
      this.onRightOperandChange(config);
    } else if (this.activePopup === 'result') {
      this.resultSourceConfig = config;
      if (config.sourceType === 'from_source_object' && config.sourceObjectPath) {
        this.config.resultTarget = 'solution_field';
        this.config.resultFieldPath = config.sourceObjectPath;
        this.config.resultVariableName = config.sourceObjectPath.split('.').pop() || '';
        const dotIdx = config.sourceObjectPath.indexOf('.');
        if (dotIdx > 0) {
          this.resultObjectName = config.sourceObjectPath.substring(0, dotIdx);
        }
      } else if (config.sourceType === 'direct_assignment') {
        this.config.resultTarget = 'new_variable';
        this.config.resultVariableName = config.directValue || '';
        this.config.resultFieldPath = '';
      }
      this.emitChange();
    }
  }

  // ==================== Display helpers (passed down to sub-views) ====================

  getOperandDisplayText(config: ValueSourceConfig): string {
    return getSourceLabel(config) || '(select)';
  }

  getOperationSymbol(): string {
    const op = this.operations.find(o => o.value === this.config.operationType);
    return op?.symbol || '+';
  }

  getResultTargetName(): string {
    if (this.config.resultTarget === 'solution_field') {
      const field = this.sourceObjectFields.find(f => f.path === this.config.resultFieldPath);
      return field?.displayName || this.config.resultFieldPath || '(select)';
    }
    return this.config.resultVariableName || '(enter name)';
  }

  getPreviewExpression(): string {
    const left = this.getOperandDisplayText(this.config.leftOperand);
    const right = this.getOperandDisplayText(this.config.rightOperand);
    const symbol = this.getOperationSymbol();
    const result = this.getResultTargetName();
    return `${result} = ${left} ${symbol} ${right}`;
  }

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

  private getDisplayName(): string {
    const op = this.operations.find(o => o.value === this.config.operationType);
    return op?.label || 'Math Operation';
  }

}
