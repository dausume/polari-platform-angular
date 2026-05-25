// Author: Dustin Etts
// polari-platform-angular/src/app/components/custom-no-code/states/_shared/operation-state-base.ts

/**
 * Operation State base types and parser.
 * Shared building blocks for VariableAssignment, FunctionCall, ReturnStatement,
 * LogOutput, BreakStatement, ContinueStatement.
 */

import { VariableAssignment } from '../variables/variable-assignment/variable-assignment.model';
import { FunctionCall } from '../variables/function-call/function-call.model';
import { ReturnStatement } from '../end-states/return-statement/return-statement.model';
import { LogOutput } from '../debug/log-output/log-output.model';
import { BreakStatement } from '../flow-control/break-statement/break-statement.model';
import { ContinueStatement } from '../flow-control/continue-statement/continue-statement.model';

/**
 * Data types supported for variables.
 *
 * `equation` is a first-class type for variables that hold a LaTeX
 * expression (NOT the numeric result of evaluating one — that's the
 * `from_latex` value-source kind, which produces a number). When a
 * variable's type is `equation`, the value source carries the literal
 * LaTeX string; downstream states can pass it to a CalculusOperation
 * for evaluation, or display it via KaTeX. Mirrors the `equation`
 * field type already registered in PolariFieldType.
 *
 * `float` and `int` are aliases for `number` retained for parity with
 * the backend's polyTyping vocabulary (where simulation field types
 * arrive as 'float' / 'int') so the dropdown can faithfully reflect
 * the Python-side type.
 */
export type VariableDataType =
  | 'string'
  | 'number'
  | 'int'
  | 'float'
  | 'boolean'
  | 'date'
  | 'array'
  | 'object'
  | 'equation'
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
