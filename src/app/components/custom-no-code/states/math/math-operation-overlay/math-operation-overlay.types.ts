// Author: Dustin Etts
// State-specific types for the math-operation overlay and its sub-views.
// Size-tier types live in _shared/state-overlay/size-tier — see that file for the convention.

import { ValueSourceConfig } from '@models/stateSpace';

export type MathOperationType = 'add' | 'subtract' | 'multiply' | 'divide' | 'modulo';

export interface MathOperationConfig {
  operationType: MathOperationType;
  leftOperand: ValueSourceConfig;
  rightOperand: ValueSourceConfig;
  resultTarget: 'solution_field' | 'new_variable';
  resultFieldPath: string;
  resultVariableName: string;
}

export interface MathOperationOption {
  value: MathOperationType;
  label: string;
  symbol: string;
}

export type MathOperationPopupSide = 'left' | 'right' | 'result';

export interface MathOperationPopupRequest {
  side: MathOperationPopupSide;
  event: MouseEvent;
}
