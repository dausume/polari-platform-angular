// Author: Dustin Etts
// polari-platform-angular/src/app/components/custom-no-code/states/break-statement/break-statement.model.ts

import { OperationStateBase } from '../../_shared/operation-state-base';

/**
 * BreakStatement - Break out of a loop
 *
 * Equivalent to: break
 */
export class BreakStatement implements OperationStateBase {
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

  constructor(displayName: string = 'Break') {
    this.id = this.generateId();
    this.displayName = displayName;
  }

  private generateId(): string {
    return 'break_' + Math.random().toString(36).substring(2, 11);
  }

  execute(): { shouldBreak: true } {
    this.isExecuted = true;
    return { shouldBreak: true };
  }

  toSQL(): string {
    return 'BREAK;';
  }

  getStateSpaceConfig() {
    return {
      className: 'BreakStatement',
      isStateSpaceObject: this.isStateSpaceObject,
      eventMethods: [
        {
          methodName: 'execute',
          displayName: 'Execute Break',
          description: 'Break out of current loop',
          category: 'Control Flow',
          inputParams: [],
          output: { type: 'object', displayName: 'Break Signal' }
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
      type: 'BreakStatement'
    };
  }

  static fromJSON(json: any): BreakStatement {
    const op = new BreakStatement(json.displayName);
    op.id = json.id;
    return op;
  }
}

// --- Type Guards ---

export function isBreakStatement(op: OperationStateBase): op is BreakStatement {
  return op.displayName === 'Break' || ('toSQL' in op && (op as any).toSQL() === 'BREAK;');
}
