// Author: Dustin Etts
// Full-page popup for the MathOperation state. Opened via MatDialog from the canvas
// when the user clicks the expand button on the inline overlay.
//
// Convention: see states/_shared/state-overlay/README.md (popup view contract).

import { Component, EventEmitter, Inject, OnInit, Output } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import {
  ValueSourceConfig,
  createDefaultValueSourceConfig,
  getSourceLabel
} from '@models/stateSpace';
import { AvailableInput, SourceObjectField } from '../../../../shared/value-source-selector/value-source-selector.component';
import {
  MathOperationConfig,
  MathOperationOption,
  MathOperationPopupSide,
  MathOperationType
} from '../math-operation-overlay.types';

export interface MathOperationOverlayPopupData {
  stateName: string;
  boundObjectFieldValues: { [key: string]: any };
  availableInputs: AvailableInput[];
  sourceObjectFields: SourceObjectField[];
}

@Component({
  standalone: false,
  selector: 'math-operation-overlay-popup',
  templateUrl: './math-operation-overlay-popup.component.html',
  styleUrls: ['./math-operation-overlay-popup.component.css']
})
export class MathOperationOverlayPopupComponent implements OnInit {
  @Output() fieldValuesChanged = new EventEmitter<{ [key: string]: any }>();

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

  activeEditor: MathOperationPopupSide | null = null;
  resultSourceConfig: ValueSourceConfig = { sourceType: 'from_source_object' };

  availableInputs: AvailableInput[] = [];
  sourceObjectFields: SourceObjectField[] = [];

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: MathOperationOverlayPopupData,
    private dialogRef: MatDialogRef<MathOperationOverlayPopupComponent>
  ) {
    this.availableInputs = data.availableInputs || [];
    this.sourceObjectFields = data.sourceObjectFields || [];
  }

  ngOnInit(): void {
    this.initializeFromData();
  }

  private initializeFromData(): void {
    const bofv = this.data.boundObjectFieldValues || {};

    if (bofv['operationType']) {
      this.config.operationType = bofv['operationType'] as MathOperationType;
    }
    if (bofv['leftOperand']) {
      this.config.leftOperand = bofv['leftOperand'];
    }
    if (bofv['rightOperand']) {
      this.config.rightOperand = bofv['rightOperand'];
    }
    if (bofv['resultTarget']) {
      this.config.resultTarget = bofv['resultTarget'];
    }
    if (bofv['resultFieldPath']) {
      this.config.resultFieldPath = bofv['resultFieldPath'];
      this.resultSourceConfig = {
        sourceType: 'from_source_object',
        sourceObjectPath: this.config.resultFieldPath
      };
    }
    if (bofv['resultVariableName']) {
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

  onResultSourceChange(config: ValueSourceConfig): void {
    this.resultSourceConfig = config;
    if (config.sourceType === 'from_source_object' && config.sourceObjectPath) {
      this.config.resultTarget = 'solution_field';
      this.config.resultFieldPath = config.sourceObjectPath;
      this.config.resultVariableName = config.sourceObjectPath.split('.').pop() || '';
    } else if (config.sourceType === 'direct_assignment') {
      this.config.resultTarget = 'new_variable';
      this.config.resultVariableName = config.directValue || '';
      this.config.resultFieldPath = '';
    }
    this.emitChange();
  }

  setActiveEditor(side: MathOperationPopupSide | null): void {
    this.activeEditor = this.activeEditor === side ? null : side;
  }

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
    return `${this.getResultTargetName()} = ${left} ${this.getOperationSymbol()} ${right}`;
  }

  close(): void {
    this.dialogRef.close();
  }

  private emitChange(): void {
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
