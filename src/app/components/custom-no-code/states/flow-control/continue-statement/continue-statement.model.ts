// Author: Dustin Etts
// polari-platform-angular/src/app/components/custom-no-code/states/continue-statement/continue-statement.model.ts

import { OperationStateBase } from '../../_shared/operation-state-base';

/**
 * ContinueStatement - Skip to next iteration
 *
 * Equivalent to: continue
 */
export class ContinueStatement implements OperationStateBase {
  id: string;
  displayName: string;

  // Execution state
  isExecuted: boolean = false;
  executionResult?: any;
  executionError?: string;

  // State-space configuration
  isStateSpaceObject: boolean = true;
  stateSpaceDisplayFields: string[] = ['displayName'];
  stateSpaceFieldsPerRow: 1 | 2 = 1;

  constructor(displayName: string = 'Continue') {
    this.id = this.generateId();
    this.displayName = displayName;
  }

  private generateId(): string {
    return 'continue_' + Math.random().toString(36).substring(2, 11);
  }

  execute(): { shouldContinue: true } {
    this.isExecuted = true;
    return { shouldContinue: true };
  }

  toSQL(): string {
    return 'CONTINUE;';
  }

  getStateSpaceConfig() {
    return {
      className: 'ContinueStatement',
      isStateSpaceObject: this.isStateSpaceObject,
      eventMethods: [
        {
          methodName: 'execute',
          displayName: 'Execute Continue',
          description: 'Skip to next loop iteration',
          category: 'Control Flow',
          inputParams: [],
          output: { type: 'object', displayName: 'Continue Signal' }
        }
      ],
      displayFields: this.stateSpaceDisplayFields,
      fieldsPerRow: this.stateSpaceFieldsPerRow,
      variables: []
    };
  }

  toJSON(): object {
    return {
      id: this.id,
      displayName: this.displayName,
      type: 'ContinueStatement'
    };
  }

  static fromJSON(json: any): ContinueStatement {
    const op = new ContinueStatement(json.displayName);
    op.id = json.id;
    return op;
  }
}

// --- Type Guards ---

export function isContinueStatement(op: OperationStateBase): op is ContinueStatement {
  return op.displayName === 'Continue' || ('toSQL' in op && (op as any).toSQL() === 'CONTINUE;');
}
