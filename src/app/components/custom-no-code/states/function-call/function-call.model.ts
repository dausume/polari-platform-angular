// Author: Dustin Etts
// polari-platform-angular/src/app/components/custom-no-code/states/function-call/function-call.model.ts

import { OperationStateBase, ValueSource } from '../_shared/operation-state-base';

/**
 * FunctionCall - Call a function or method
 *
 * Equivalent to: result = functionName(arg1, arg2, ...)
 *
 * Usage in state-space:
 * - Configure function name or method path
 * - Wire input slots to arguments
 * - Wire output slot from return value
 */
export class FunctionCall implements OperationStateBase {
  id: string;
  displayName: string;

  // Function configuration
  functionName: string = '';
  objectPath?: string; // For method calls: object.method
  arguments: ValueSource[] = [];
  resultVariableName?: string; // Where to store the result

  // Execution state
  isExecuted: boolean = false;
  executionResult?: any;
  executionError?: string;

  // State-space configuration
  isStateSpaceObject: boolean = true;
  stateSpaceDisplayFields: string[] = ['displayName', 'functionName'];
  stateSpaceFieldsPerRow: 1 | 2 = 1;

  constructor(displayName: string = 'Function Call', functionName: string = '') {
    this.id = this.generateId();
    this.displayName = displayName;
    this.functionName = functionName;
  }

  private generateId(): string {
    return 'funccall_' + Math.random().toString(36).substring(2, 11);
  }

  /**
   * Add a literal argument
   */
  addLiteralArgument(value: any): void {
    this.arguments.push({ sourceType: 'literal', value });
  }

  /**
   * Add a variable argument
   */
  addVariableArgument(variableName: string): void {
    this.arguments.push({ sourceType: 'variable', value: null, variableName });
  }

  /**
   * Add a slot-connected argument
   */
  addSlotArgument(slotId: string): void {
    this.arguments.push({ sourceType: 'slot', value: null, slotId });
  }

  /**
   * Clear all arguments
   */
  clearArguments(): void {
    this.arguments = [];
  }

  /**
   * Execute the function call
   */
  execute(context: Record<string, any>, functions: Record<string, Function>): Record<string, any> {
    try {
      // Resolve arguments
      const resolvedArgs = this.arguments.map(arg => {
        switch (arg.sourceType) {
          case 'literal': return arg.value;
          case 'variable': return context[arg.variableName!];
          case 'slot': return context[`__slot_${arg.slotId}`];
          default: return null;
        }
      });

      // Get the function
      let fn: Function | undefined;

      if (this.objectPath) {
        // Method call: navigate to object.method
        const parts = this.objectPath.split('.');
        let obj: any = context;
        for (const part of parts) {
          obj = obj?.[part];
        }
        fn = obj?.[this.functionName];
      } else {
        // Direct function call
        fn = functions[this.functionName] || context[this.functionName];
      }

      if (typeof fn !== 'function') {
        throw new Error(`Function '${this.functionName}' not found`);
      }

      // Execute
      const result = fn.apply(context, resolvedArgs);
      this.executionResult = result;
      this.isExecuted = true;

      // Store result if variable name specified
      if (this.resultVariableName) {
        return { ...context, [this.resultVariableName]: result };
      }

      return context;
    } catch (error) {
      this.executionError = error instanceof Error ? error.message : String(error);
      this.isExecuted = true;
      return context;
    }
  }

  /**
   * Generate SQL function call
   */
  toSQL(): string {
    const args = this.arguments.map(arg => {
      switch (arg.sourceType) {
        case 'literal':
          if (arg.value === null) return 'NULL';
          if (typeof arg.value === 'number') return String(arg.value);
          if (typeof arg.value === 'boolean') return arg.value ? '1' : '0';
          return `'${String(arg.value).replace(/'/g, "''")}'`;
        case 'variable':
          return `@${arg.variableName}`;
        default:
          return 'NULL';
      }
    }).join(', ');

    const funcCall = this.objectPath
      ? `${this.objectPath}.${this.functionName}(${args})`
      : `${this.functionName}(${args})`;

    if (this.resultVariableName) {
      return `SET @${this.resultVariableName} = ${funcCall};`;
    }

    return `EXEC ${funcCall};`;
  }

  /**
   * Get state-space configuration
   */
  getStateSpaceConfig() {
    return {
      className: 'FunctionCall',
      isStateSpaceObject: this.isStateSpaceObject,
      eventMethods: [
        {
          methodName: 'execute',
          displayName: 'Execute Call',
          description: 'Call the function with arguments',
          category: 'Functions',
          inputParams: [
            { name: 'context', displayName: 'Context', type: 'object', isRequired: true },
            { name: 'functions', displayName: 'Available Functions', type: 'object', isRequired: true }
          ],
          output: { type: 'object', displayName: 'Updated Context' }
        }
      ],
      displayFields: this.stateSpaceDisplayFields,
      fieldsPerRow: this.stateSpaceFieldsPerRow,
      variables: ['functionName', 'objectPath', 'arguments', 'resultVariableName']
    };
  }

  toJSON(): object {
    return {
      id: this.id,
      displayName: this.displayName,
      type: 'FunctionCall',
      functionName: this.functionName,
      objectPath: this.objectPath,
      arguments: this.arguments,
      resultVariableName: this.resultVariableName
    };
  }

  static fromJSON(json: any): FunctionCall {
    const op = new FunctionCall(json.displayName, json.functionName);
    op.id = json.id;
    op.objectPath = json.objectPath;
    op.arguments = json.arguments || [];
    op.resultVariableName = json.resultVariableName;
    return op;
  }
}

// --- Factory Functions ---

export function createFunctionCall(functionName: string, args: any[] = [], displayName?: string): FunctionCall {
  const op = new FunctionCall(displayName || `${functionName}()`, functionName);
  args.forEach(arg => op.addLiteralArgument(arg));
  return op;
}

// --- Type Guards ---

export function isFunctionCall(op: OperationStateBase): op is FunctionCall {
  return 'functionName' in op && 'arguments' in op;
}
