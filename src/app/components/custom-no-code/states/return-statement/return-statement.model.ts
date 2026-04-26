// Author: Dustin Etts
// polari-platform-angular/src/app/components/custom-no-code/states/return-statement/return-statement.model.ts

import { OperationStateBase, ValueSource } from '../_shared/operation-state-base';

/**
 * ReturnStatement - Return a value from the current flow
 *
 * Equivalent to: return value
 *
 * Usage in state-space:
 * - Configure return value source
 * - Terminates current state flow execution
 */
export class ReturnStatement implements OperationStateBase {
  id: string;
  displayName: string;

  // Return configuration
  valueSource: ValueSource = { sourceType: 'literal', value: null };

  // Execution state
  isExecuted: boolean = false;
  executionResult?: any;
  executionError?: string;

  // State-space configuration
  isStateSpaceObject: boolean = true;
  stateSpaceDisplayFields: string[] = ['displayName'];
  stateSpaceFieldsPerRow: 1 | 2 = 1;

  constructor(displayName: string = 'Return') {
    this.id = this.generateId();
    this.displayName = displayName;
  }

  private generateId(): string {
    return 'return_' + Math.random().toString(36).substring(2, 11);
  }

  /**
   * Set return value
   */
  setReturnValue(value: any): void {
    this.valueSource = { sourceType: 'literal', value };
  }

  /**
   * Set return from variable
   */
  setReturnVariable(variableName: string): void {
    this.valueSource = { sourceType: 'variable', value: null, variableName };
  }

  /**
   * Execute the return
   */
  execute(context: Record<string, any>): { value: any; shouldReturn: true } {
    let value: any;

    switch (this.valueSource.sourceType) {
      case 'literal':
        value = this.valueSource.value;
        break;
      case 'variable':
        value = context[this.valueSource.variableName!];
        break;
      case 'slot':
        value = context[`__slot_${this.valueSource.slotId}`];
        break;
      default:
        value = null;
    }

    this.executionResult = value;
    this.isExecuted = true;

    return { value, shouldReturn: true };
  }

  /**
   * Generate SQL RETURN statement
   */
  toSQL(): string {
    let valueSQL: string;

    switch (this.valueSource.sourceType) {
      case 'literal':
        if (this.valueSource.value === null) valueSQL = 'NULL';
        else if (typeof this.valueSource.value === 'number') valueSQL = String(this.valueSource.value);
        else valueSQL = `'${String(this.valueSource.value).replace(/'/g, "''")}'`;
        break;
      case 'variable':
        valueSQL = `@${this.valueSource.variableName}`;
        break;
      default:
        valueSQL = 'NULL';
    }

    return `RETURN ${valueSQL};`;
  }

  getStateSpaceConfig() {
    return {
      className: 'ReturnStatement',
      isStateSpaceObject: this.isStateSpaceObject,
      eventMethods: [
        {
          methodName: 'execute',
          displayName: 'Execute Return',
          description: 'Return value and exit flow',
          category: 'Control Flow',
          inputParams: [
            { name: 'context', displayName: 'Context', type: 'object', isRequired: true }
          ],
          output: { type: 'any', displayName: 'Return Value' }
        }
      ],
      displayFields: this.stateSpaceDisplayFields,
      fieldsPerRow: this.stateSpaceFieldsPerRow,
      variables: ['valueSource']
    };
  }

  toJSON(): object {
    return {
      id: this.id,
      displayName: this.displayName,
      type: 'ReturnStatement',
      valueSource: this.valueSource
    };
  }

  static fromJSON(json: any): ReturnStatement {
    const op = new ReturnStatement(json.displayName);
    op.id = json.id;
    op.valueSource = json.valueSource || { sourceType: 'literal', value: null };
    return op;
  }
}

// --- Factory Functions ---

export function createReturn(value: any, displayName?: string): ReturnStatement {
  const op = new ReturnStatement(displayName || `return ${value}`);
  op.setReturnValue(value);
  return op;
}

// --- Type Guards ---

export function isReturnStatement(op: OperationStateBase): op is ReturnStatement {
  return 'valueSource' in op && !('variableName' in op) && !('functionName' in op);
}
