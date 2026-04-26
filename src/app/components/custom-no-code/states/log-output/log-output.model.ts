// Author: Dustin Etts
// polari-platform-angular/src/app/components/custom-no-code/states/log-output/log-output.model.ts

import { OperationStateBase, ValueSource } from '../_shared/operation-state-base';

/**
 * Types of value sources for log output variables (matching conditionalChain.ts)
 */
export type LogOutputValueSourceType = 'from_input' | 'from_source_object' | 'direct_assignment';

/**
 * Configuration for a single variable to log
 */
export interface LogOutputVariable {
  /** The type of source for this variable */
  sourceType: LogOutputValueSourceType;

  /** Variable name when from_input - the variable name from the input slot */
  variableName?: string;

  /** When from_input - which input slot index to read from */
  inputSlotIndex?: number;

  /** When from_source_object - the property path (e.g., "self.order_id") */
  sourceObjectPath?: string;

  /** Optional format string for this variable (e.g., "{}" or "{:.2f}") */
  formatString?: string;

  /** Optional label/description for this variable in the UI */
  label?: string;
}

/**
 * LogOutput - Debug/log output
 *
 * Equivalent to: console.log(message, ...values)
 *
 * Usage in state-space:
 * - Configure log message template
 * - Wire values to interpolate
 * - Select specific variables from inputs to log
 */
export class LogOutput implements OperationStateBase {
  id: string;
  displayName: string;

  // Log configuration
  logLevel: 'debug' | 'info' | 'warn' | 'error' = 'info';
  messageTemplate: string = '';
  values: ValueSource[] = [];

  // NEW: Structured variables to log (replaces simple values array)
  logVariables: LogOutputVariable[] = [];

  // Execution state
  isExecuted: boolean = false;
  executionResult?: string;
  executionError?: string;

  // State-space configuration
  isStateSpaceObject: boolean = true;
  stateSpaceDisplayFields: string[] = ['displayName', 'logLevel', 'messageTemplate'];
  stateSpaceFieldsPerRow: 1 | 2 = 1;

  constructor(displayName: string = 'Log Output', message: string = '') {
    this.id = this.generateId();
    this.displayName = displayName;
    this.messageTemplate = message;
  }

  private generateId(): string {
    return 'log_' + Math.random().toString(36).substring(2, 11);
  }

  /**
   * Add a value to log (legacy API)
   */
  addValue(valueSource: ValueSource): void {
    this.values.push(valueSource);
  }

  /**
   * Add a structured log variable (new API)
   */
  addLogVariable(logVar: LogOutputVariable): void {
    this.logVariables.push(logVar);
  }

  /**
   * Remove a log variable by index
   */
  removeLogVariable(index: number): void {
    if (index >= 0 && index < this.logVariables.length) {
      this.logVariables.splice(index, 1);
    }
  }

  /**
   * Clear all log variables
   */
  clearLogVariables(): void {
    this.logVariables = [];
  }

  /**
   * Execute the log
   */
  execute(context: Record<string, any>): Record<string, any> {
    try {
      // Resolve values from both legacy values array and new logVariables array
      const resolvedValues: any[] = [];

      // First, resolve legacy values
      this.values.forEach(vs => {
        switch (vs.sourceType) {
          case 'literal': resolvedValues.push(vs.value); break;
          case 'variable': resolvedValues.push(context[vs.variableName!]); break;
          case 'slot': resolvedValues.push(context[`__slot_${vs.slotId}`]); break;
          default: resolvedValues.push(null);
        }
      });

      // Then resolve new logVariables
      this.logVariables.forEach(lv => {
        const value = this.resolveLogVariable(lv, context);
        resolvedValues.push(value);
      });

      // Format message (replace {0}, {1}, etc.)
      let message = this.messageTemplate;
      resolvedValues.forEach((val, idx) => {
        message = message.replace(new RegExp(`\\{${idx}\\}`, 'g'), String(val));
      });

      // Also replace variable names directly
      for (const [key, value] of Object.entries(context)) {
        message = message.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value));
      }

      this.executionResult = message;
      this.isExecuted = true;

      // Actual log output
      switch (this.logLevel) {
        // case 'debug': console.debug(message, ...resolvedValues); break;
        case 'info': console.info(message, ...resolvedValues); break;
        case 'warn': console.warn(message, ...resolvedValues); break;
        case 'error': console.error(message, ...resolvedValues); break;
      }

      return context;
    } catch (error) {
      this.executionError = error instanceof Error ? error.message : String(error);
      this.isExecuted = true;
      return context;
    }
  }

  /**
   * Resolve a LogOutputVariable to its actual value
   */
  private resolveLogVariable(logVar: LogOutputVariable, context: Record<string, any>): any {
    switch (logVar.sourceType) {
      case 'from_input':
        if (logVar.variableName) {
          return context[logVar.variableName];
        }
        if (logVar.inputSlotIndex !== undefined) {
          return context[`__input_${logVar.inputSlotIndex}`];
        }
        return undefined;

      case 'from_source_object':
        if (logVar.sourceObjectPath) {
          return this.resolveObjectPath(logVar.sourceObjectPath, context);
        }
        return undefined;

      case 'direct_assignment':
        return logVar.variableName; // Use variableName as literal for direct assignment

      default:
        return undefined;
    }
  }

  /**
   * Resolve a dot-notation object path
   */
  private resolveObjectPath(path: string, context: Record<string, any>): any {
    const parts = path.split('.');
    let current: any = context;

    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined;
      }
      current = current[part];
    }

    return current;
  }

  /**
   * Generate SQL PRINT statement
   */
  toSQL(): string {
    // Replace {variableName} with @variableName for SQL
    let message = this.messageTemplate;
    for (const vs of this.values) {
      if (vs.sourceType === 'variable' && vs.variableName) {
        message = message.replace(new RegExp(`\\{${vs.variableName}\\}`, 'g'), `' + CAST(@${vs.variableName} AS NVARCHAR(MAX)) + '`);
      }
    }
    return `PRINT '${message.replace(/'/g, "''")}';`;
  }

  getStateSpaceConfig() {
    return {
      className: 'LogOutput',
      isStateSpaceObject: this.isStateSpaceObject,
      eventMethods: [
        {
          methodName: 'execute',
          displayName: 'Execute Log',
          description: 'Output log message',
          category: 'Debug',
          inputParams: [
            { name: 'context', displayName: 'Context', type: 'object', isRequired: true }
          ],
          output: { type: 'object', displayName: 'Context (unchanged)' }
        }
      ],
      displayFields: this.stateSpaceDisplayFields,
      fieldsPerRow: this.stateSpaceFieldsPerRow,
      variables: ['logLevel', 'messageTemplate', 'values', 'logVariables']
    };
  }

  toJSON(): object {
    return {
      id: this.id,
      displayName: this.displayName,
      type: 'LogOutput',
      logLevel: this.logLevel,
      messageTemplate: this.messageTemplate,
      values: this.values,
      logVariables: this.logVariables
    };
  }

  static fromJSON(json: any): LogOutput {
    const op = new LogOutput(json.displayName, json.messageTemplate);
    op.id = json.id;
    op.logLevel = json.logLevel || 'info';
    op.logVariables = json.logVariables || [];
    op.values = json.values || [];
    return op;
  }
}

// --- Factory Functions ---

export function createLog(message: string, level: 'debug' | 'info' | 'warn' | 'error' = 'info'): LogOutput {
  const op = new LogOutput(`Log: ${message.substring(0, 20)}...`, message);
  op.logLevel = level;
  return op;
}

// --- Type Guards ---

export function isLogOutput(op: OperationStateBase): op is LogOutput {
  return 'logLevel' in op && 'messageTemplate' in op;
}
