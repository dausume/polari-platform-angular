// Author: Dustin Etts
// polari-platform-angular/src/app/components/custom-no-code/states/variable-assignment/variable-assignment.model.ts

import { OperationStateBase, ValueSource, VariableDataType } from '../_shared/operation-state-base';

/**
 * VariableAssignment - Assign a value to a variable
 *
 * Equivalent to: variableName = value
 *
 * Usage in state-space:
 * - Configure target variable name
 * - Configure value source (literal, variable, expression, or input slot)
 * - Optionally declare new variable with type
 */
export class VariableAssignment implements OperationStateBase {
  id: string;
  displayName: string;

  // Assignment configuration
  variableName: string = '';
  dataType: VariableDataType = 'any';
  valueSource: ValueSource = { sourceType: 'literal', value: null };

  // Declaration options
  isDeclare: boolean = false;
  isConst: boolean = false;

  // Execution state
  isExecuted: boolean = false;
  executionResult?: any;
  executionError?: string;

  // State-space configuration
  isStateSpaceObject: boolean = true;
  stateSpaceDisplayFields: string[] = ['displayName', 'variableName', 'dataType'];
  stateSpaceFieldsPerRow: 1 | 2 = 2;

  constructor(displayName: string = 'Variable Assignment', variableName: string = '') {
    this.id = this.generateId();
    this.displayName = displayName;
    this.variableName = variableName;
  }

  private generateId(): string {
    return 'varassign_' + Math.random().toString(36).substring(2, 11);
  }

  /**
   * Set value from literal
   */
  setLiteralValue(value: any): void {
    this.valueSource = { sourceType: 'literal', value };
  }

  /**
   * Set value from another variable
   */
  setVariableValue(sourceVariableName: string): void {
    this.valueSource = { sourceType: 'variable', value: null, variableName: sourceVariableName };
  }

  /**
   * Set value from expression
   */
  setExpressionValue(expression: string): void {
    this.valueSource = { sourceType: 'expression', value: null, expression };
  }

  /**
   * Set value from input slot
   */
  setSlotValue(slotId: string): void {
    this.valueSource = { sourceType: 'slot', value: null, slotId };
  }

  /**
   * Execute the assignment
   */
  execute(context: Record<string, any>): Record<string, any> {
    try {
      let value: any;

      switch (this.valueSource.sourceType) {
        case 'literal':
          value = this.valueSource.value;
          break;
        case 'variable':
          value = context[this.valueSource.variableName!];
          break;
        case 'expression':
          // Simple expression evaluation (limited for safety)
          value = this.evaluateExpression(this.valueSource.expression!, context);
          break;
        case 'slot':
          value = context[`__slot_${this.valueSource.slotId}`];
          break;
        default:
          value = null;
      }

      // Type coercion if specified
      value = this.coerceType(value, this.dataType);

      this.executionResult = value;
      this.isExecuted = true;

      return { ...context, [this.variableName]: value };
    } catch (error) {
      this.executionError = error instanceof Error ? error.message : String(error);
      this.isExecuted = true;
      return context;
    }
  }

  /**
   * Simple expression evaluation
   */
  private evaluateExpression(expression: string, context: Record<string, any>): any {
    // Replace variable references with context values
    let evalExpr = expression;
    for (const [key, value] of Object.entries(context)) {
      const regex = new RegExp(`\\b${key}\\b`, 'g');
      evalExpr = evalExpr.replace(regex, JSON.stringify(value));
    }

    // Only allow safe expressions (basic math and string ops)
    if (/[^0-9+\-*/%().\s"']/.test(evalExpr.replace(/true|false|null/g, ''))) {
      throw new Error('Expression contains unsafe characters');
    }

    return Function(`"use strict"; return (${evalExpr})`)();
  }

  /**
   * Coerce value to specified type
   */
  private coerceType(value: any, type: VariableDataType): any {
    if (type === 'any' || value === null || value === undefined) {
      return value;
    }

    switch (type) {
      case 'string':
        return String(value);
      case 'number':
        return Number(value);
      case 'boolean':
        return Boolean(value);
      case 'date':
        return new Date(value);
      case 'array':
        return Array.isArray(value) ? value : [value];
      case 'object':
        return typeof value === 'object' ? value : { value };
      default:
        return value;
    }
  }

  /**
   * Generate SQL assignment
   */
  toSQL(): string {
    const declare = this.isDeclare ? 'DECLARE ' : 'SET ';
    const prefix = this.isDeclare ? '@' : '@';
    let valueSQL: string;

    switch (this.valueSource.sourceType) {
      case 'literal':
        valueSQL = this.valueToSQL(this.valueSource.value);
        break;
      case 'variable':
        valueSQL = `@${this.valueSource.variableName}`;
        break;
      case 'expression':
        valueSQL = this.valueSource.expression || 'NULL';
        break;
      default:
        valueSQL = 'NULL';
    }

    if (this.isDeclare) {
      const sqlType = this.getSQLType(this.dataType);
      return `DECLARE ${prefix}${this.variableName} ${sqlType} = ${valueSQL};`;
    }

    return `SET ${prefix}${this.variableName} = ${valueSQL};`;
  }

  private valueToSQL(value: any): string {
    if (value === null || value === undefined) return 'NULL';
    if (typeof value === 'number') return String(value);
    if (typeof value === 'boolean') return value ? '1' : '0';
    return `'${String(value).replace(/'/g, "''")}'`;
  }

  private getSQLType(type: VariableDataType): string {
    switch (type) {
      case 'string': return 'NVARCHAR(MAX)';
      case 'number': return 'FLOAT';
      case 'boolean': return 'BIT';
      case 'date': return 'DATETIME';
      default: return 'NVARCHAR(MAX)';
    }
  }

  /**
   * Get state-space configuration
   */
  getStateSpaceConfig() {
    return {
      className: 'VariableAssignment',
      isStateSpaceObject: this.isStateSpaceObject,
      eventMethods: [
        {
          methodName: 'execute',
          displayName: 'Execute Assignment',
          description: 'Assign value to variable',
          category: 'Variables',
          inputParams: [
            { name: 'context', displayName: 'Context', type: 'object', isRequired: true }
          ],
          output: { type: 'object', displayName: 'Updated Context' }
        }
      ],
      displayFields: this.stateSpaceDisplayFields,
      fieldsPerRow: this.stateSpaceFieldsPerRow,
      variables: ['variableName', 'dataType', 'valueSource', 'isDeclare', 'isConst']
    };
  }

  toJSON(): object {
    return {
      id: this.id,
      displayName: this.displayName,
      type: 'VariableAssignment',
      variableName: this.variableName,
      dataType: this.dataType,
      valueSource: this.valueSource,
      isDeclare: this.isDeclare,
      isConst: this.isConst
    };
  }

  static fromJSON(json: any): VariableAssignment {
    const op = new VariableAssignment(json.displayName, json.variableName);
    op.id = json.id;
    op.dataType = json.dataType || 'any';
    op.valueSource = json.valueSource || { sourceType: 'literal', value: null };
    op.isDeclare = json.isDeclare || false;
    op.isConst = json.isConst || false;
    return op;
  }
}

// --- Factory Functions ---

export function createAssignment(variableName: string, value: any, displayName?: string): VariableAssignment {
  const op = new VariableAssignment(displayName || `${variableName} = ${value}`, variableName);
  op.setLiteralValue(value);
  return op;
}

export function createDeclaration(
  variableName: string,
  dataType: VariableDataType,
  initialValue?: any,
  displayName?: string
): VariableAssignment {
  const op = new VariableAssignment(displayName || `let ${variableName}: ${dataType}`, variableName);
  op.isDeclare = true;
  op.dataType = dataType;
  if (initialValue !== undefined) {
    op.setLiteralValue(initialValue);
  }
  return op;
}

// --- Type Guards ---

export function isVariableAssignment(op: OperationStateBase): op is VariableAssignment {
  return 'variableName' in op && 'valueSource' in op && 'isDeclare' in op;
}
