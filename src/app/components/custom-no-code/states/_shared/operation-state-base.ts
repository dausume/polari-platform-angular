// Author: Dustin Etts
// polari-platform-angular/src/app/components/custom-no-code/states/_shared/operation-state-base.ts

/**
 * Operation State base types and parser.
 * Shared building blocks for VariableAssignment, FunctionCall, ReturnStatement,
 * LogOutput, BreakStatement, ContinueStatement.
 */

import { VariableAssignment } from '../variable-assignment/variable-assignment.model';
import { FunctionCall } from '../function-call/function-call.model';
import { ReturnStatement } from '../return-statement/return-statement.model';
import { LogOutput } from '../log-output/log-output.model';
import { BreakStatement } from '../break-statement/break-statement.model';
import { ContinueStatement } from '../continue-statement/continue-statement.model';

/**
 * Data types supported for variables
 */
export type VariableDataType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'date'
  | 'array'
  | 'object'
  | 'any'
  | 'null';

/**
 * Base interface for all operation states
 */
export interface OperationStateBase {
  id: string;
  displayName: string;
  isStateSpaceObject: boolean;
  stateSpaceDisplayFields: string[];
  stateSpaceFieldsPerRow: 1 | 2;

  // Visual positioning in state-space
  stateLocationX?: number;
  stateLocationY?: number;

  // Execution state
  isExecuted: boolean;
  executionResult?: any;
  executionError?: string;
}

/**
 * Value source - where a value comes from
 */
export interface ValueSource {
  sourceType: 'literal' | 'variable' | 'expression' | 'slot';
  value: any;
  variableName?: string;
  expression?: string;
  slotId?: string;
}

/**
 * Parse operation from JSON
 */
export function parseOperationFromJSON(json: any): OperationStateBase {
  switch (json.type) {
    case 'VariableAssignment': return VariableAssignment.fromJSON(json);
    case 'FunctionCall': return FunctionCall.fromJSON(json);
    case 'ReturnStatement': return ReturnStatement.fromJSON(json);
    case 'LogOutput': return LogOutput.fromJSON(json);
    case 'BreakStatement': return BreakStatement.fromJSON(json);
    case 'ContinueStatement': return ContinueStatement.fromJSON(json);
    default: throw new Error(`Unknown operation type: ${json.type}`);
  }
}
