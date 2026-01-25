// Author: Dustin Etts
// polari-platform-angular/src/app/models/stateSpace/operationStates.ts

/**
 * Operation State Classes for State-Space Visual Programming
 *
 * Provides visual programming constructs for common operations:
 * - VariableAssignment: Assign values to variables
 * - FunctionCall: Call functions/methods
 * - ReturnStatement: Return values from state flows
 * - LogOutput: Debug/log output
 * - BreakStatement: Break out of loops
 * - ContinueStatement: Skip to next iteration
 *
 * Each operation integrates with the state-space system for visual wiring.
 */

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

/**
 * LogOutput - Debug/log output
 *
 * Equivalent to: console.log(message, ...values)
 *
 * Usage in state-space:
 * - Configure log message template
 * - Wire values to interpolate
 */
export class LogOutput implements OperationStateBase {
  id: string;
  displayName: string;

  // Log configuration
  logLevel: 'debug' | 'info' | 'warn' | 'error' = 'info';
  messageTemplate: string = '';
  values: ValueSource[] = [];

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
   * Add a value to log
   */
  addValue(valueSource: ValueSource): void {
    this.values.push(valueSource);
  }

  /**
   * Execute the log
   */
  execute(context: Record<string, any>): Record<string, any> {
    try {
      // Resolve values
      const resolvedValues = this.values.map(vs => {
        switch (vs.sourceType) {
          case 'literal': return vs.value;
          case 'variable': return context[vs.variableName!];
          case 'slot': return context[`__slot_${vs.slotId}`];
          default: return null;
        }
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
        case 'debug': console.debug(message, ...resolvedValues); break;
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
      variables: ['logLevel', 'messageTemplate', 'values']
    };
  }

  toJSON(): object {
    return {
      id: this.id,
      displayName: this.displayName,
      type: 'LogOutput',
      logLevel: this.logLevel,
      messageTemplate: this.messageTemplate,
      values: this.values
    };
  }

  static fromJSON(json: any): LogOutput {
    const op = new LogOutput(json.displayName, json.messageTemplate);
    op.id = json.id;
    op.logLevel = json.logLevel || 'info';
    op.values = json.values || [];
    return op;
  }
}

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

export function createFunctionCall(functionName: string, args: any[] = [], displayName?: string): FunctionCall {
  const op = new FunctionCall(displayName || `${functionName}()`, functionName);
  args.forEach(arg => op.addLiteralArgument(arg));
  return op;
}

export function createReturn(value: any, displayName?: string): ReturnStatement {
  const op = new ReturnStatement(displayName || `return ${value}`);
  op.setReturnValue(value);
  return op;
}

export function createLog(message: string, level: 'debug' | 'info' | 'warn' | 'error' = 'info'): LogOutput {
  const op = new LogOutput(`Log: ${message.substring(0, 20)}...`, message);
  op.logLevel = level;
  return op;
}

// --- Type Guards ---

export function isVariableAssignment(op: OperationStateBase): op is VariableAssignment {
  return 'variableName' in op && 'valueSource' in op && 'isDeclare' in op;
}

export function isFunctionCall(op: OperationStateBase): op is FunctionCall {
  return 'functionName' in op && 'arguments' in op;
}

export function isReturnStatement(op: OperationStateBase): op is ReturnStatement {
  return 'valueSource' in op && !('variableName' in op) && !('functionName' in op);
}

export function isLogOutput(op: OperationStateBase): op is LogOutput {
  return 'logLevel' in op && 'messageTemplate' in op;
}

export function isBreakStatement(op: OperationStateBase): op is BreakStatement {
  return op.displayName === 'Break' || ('toSQL' in op && (op as any).toSQL() === 'BREAK;');
}

export function isContinueStatement(op: OperationStateBase): op is ContinueStatement {
  return op.displayName === 'Continue' || ('toSQL' in op && (op as any).toSQL() === 'CONTINUE;');
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
