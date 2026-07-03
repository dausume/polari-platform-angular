// Author: Dustin Etts
// solution-invocation.model.ts
//
// SolutionInvocation — run another solution as a single reusable state
// (the composition primitive: "re-wrap a solution into a more generic
// state"). The invoked solution's CONTRACT (declared inputs/returns on
// its SolutionDefinition.contract_json) is the whole interface; its
// internals stay its own. The callee runs in a fresh context seeded only
// with the mapped inputs — no caller-context leakage — and its outputs
// bind back into the caller per resultBindings. Recursion is allowed and
// depth-guarded by the engine (MAX_INVOCATION_DEPTH).

import { OperationStateBase, ValueSource } from '../../_shared/operation-state-base';

export interface SolutionInputMapping {
  /** The callee's input parameter name. */
  param: string;
  /** Caller-side value source resolved into that parameter. */
  valueSource: ValueSource | any;
}

export interface SolutionResultBinding {
  /** 'return' = the callee's ReturnValue; anything else reads the
   *  callee's final context by name (e.g. a ValidationResult output). */
  output: string;
  /** Caller context variable the output lands in. */
  contextVar: string;
}

export class SolutionInvocation implements OperationStateBase {
  id: string;
  displayName: string;

  /** Name of the SolutionDefinition to invoke. */
  solutionRef: string = '';
  inputMappings: SolutionInputMapping[] = [];
  resultBindings: SolutionResultBinding[] = [];

  // Execution state
  isExecuted: boolean = false;
  executionResult?: any;
  executionError?: string;

  // State-space configuration
  isStateSpaceObject: boolean = true;
  stateSpaceDisplayFields: string[] = ['displayName', 'solutionRef'];
  stateSpaceFieldsPerRow: 1 | 2 = 1;

  constructor(displayName: string = 'Invoke Solution', solutionRef: string = '') {
    this.id = this.generateId();
    this.displayName = displayName;
    this.solutionRef = solutionRef;
  }

  private generateId(): string {
    return 'solinv_' + Math.random().toString(36).substring(2, 11);
  }

  toJSON(): any {
    return {
      stateClass: 'SolutionInvocation',
      id: this.id,
      displayName: this.displayName,
      solutionRef: this.solutionRef,
      inputMappings: this.inputMappings,
      resultBindings: this.resultBindings,
    };
  }

  static fromJSON(json: any): SolutionInvocation {
    const s = new SolutionInvocation(json.displayName, json.solutionRef);
    if (json.id) s.id = json.id;
    s.inputMappings = json.inputMappings || [];
    s.resultBindings = json.resultBindings || [];
    return s;
  }
}

export function createSolutionInvocation(
  solutionRef: string,
  displayName?: string,
): SolutionInvocation {
  return new SolutionInvocation(displayName || `Invoke ${solutionRef}`, solutionRef);
}
