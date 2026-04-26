// Author: Dustin Etts
// polari-platform-angular/src/app/components/custom-no-code/states/_shared/loop-state-base.ts

/**
 * Loop State base types and parser.
 * Shared building blocks for ForLoop, WhileLoop, ForEachLoop.
 */

import { ForLoop } from '../for-loop/for-loop.model';
import { WhileLoop } from '../while-loop/while-loop.model';
import { ForEachLoop } from '../for-each-loop/for-each-loop.model';

/**
 * Base interface for all loop states
 */
export interface LoopStateBase {
  id: string;
  displayName: string;
  isStateSpaceObject: boolean;
  stateSpaceDisplayFields: string[];
  stateSpaceFieldsPerRow: 1 | 2;

  // Visual positioning in state-space
  stateLocationX?: number;
  stateLocationY?: number;

  // Loop control
  maxIterations: number; // Safety limit to prevent infinite loops
  currentIteration: number;
  isRunning: boolean;
  isComplete: boolean;
}

/**
 * Loop execution result
 */
export interface LoopExecutionResult {
  completed: boolean;
  iterations: number;
  results: any[];
  error?: string;
}

/**
 * Parse a loop from JSON based on type
 */
export function parseLoopFromJSON(json: any): ForLoop | WhileLoop | ForEachLoop {
  switch (json.type) {
    case 'ForLoop':
      return ForLoop.fromJSON(json);
    case 'WhileLoop':
      return WhileLoop.fromJSON(json);
    case 'ForEachLoop':
      return ForEachLoop.fromJSON(json);
    default:
      throw new Error(`Unknown loop type: ${json.type}`);
  }
}
