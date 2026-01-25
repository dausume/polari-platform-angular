// Author: Dustin Etts
// polari-platform-angular/src/app/models/stateSpace/loopStates.ts

/**
 * Loop State Classes for State-Space Visual Programming
 *
 * Provides visual programming constructs for common loop patterns:
 * - ForLoop: Traditional indexed loop (for i = 0; i < n; i++)
 * - WhileLoop: Condition-based loop
 * - ForEachLoop: Collection iteration
 *
 * Each loop integrates with the ConditionalChain for condition evaluation
 * and can generate SQL-compatible iteration logic where applicable.
 */

import { ConditionalChain, createConditionLink } from './conditionalChain';
import { ConditionType } from './conditionTypeOptions';

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
 * ForLoop - Traditional indexed for loop
 *
 * Equivalent to: for (let i = start; condition(i); i += step) { body }
 *
 * Usage in state-space:
 * - Configure start, end, step values
 * - Connect to body states that execute each iteration
 * - Access current index via iteratorVariable
 */
export class ForLoop implements LoopStateBase {
  id: string;
  displayName: string;

  // Iterator configuration
  iteratorVariable: string = 'i';
  startValue: number = 0;
  endValue: number = 10;
  stepValue: number = 1;

  // Condition for loop continuation (auto-generated or custom)
  condition: ConditionalChain;
  useCustomCondition: boolean = false;

  // Loop state
  maxIterations: number = 10000;
  currentIteration: number = 0;
  currentIndex: number = 0;
  isRunning: boolean = false;
  isComplete: boolean = false;

  // State-space configuration
  isStateSpaceObject: boolean = true;
  stateSpaceDisplayFields: string[] = ['displayName', 'iteratorVariable', 'startValue', 'endValue'];
  stateSpaceFieldsPerRow: 1 | 2 = 2;

  constructor(displayName: string = 'For Loop', start: number = 0, end: number = 10, step: number = 1) {
    this.id = this.generateId();
    this.displayName = displayName;
    this.startValue = start;
    this.endValue = end;
    this.stepValue = step;

    // Create default condition: i < endValue
    this.condition = new ConditionalChain('Loop Condition');
    this.updateDefaultCondition();
  }

  private generateId(): string {
    return 'forloop_' + Math.random().toString(36).substring(2, 11);
  }

  /**
   * Update the default condition based on current configuration
   */
  private updateDefaultCondition(): void {
    if (!this.useCustomCondition) {
      this.condition.clear();
      const operator: ConditionType = this.stepValue > 0 ? 'lessThan' : 'greaterThan';
      this.condition.pushCondition(
        createConditionLink(this.iteratorVariable, operator, this.endValue)
      );
    }
  }

  /**
   * Initialize the loop for execution
   */
  initialize(): void {
    this.currentIndex = this.startValue;
    this.currentIteration = 0;
    this.isRunning = true;
    this.isComplete = false;
  }

  /**
   * Check if the loop should continue
   */
  shouldContinue(): boolean {
    if (this.currentIteration >= this.maxIterations) {
      return false;
    }

    const context = { [this.iteratorVariable]: this.currentIndex };
    return this.condition.evaluate(context);
  }

  /**
   * Advance to the next iteration
   */
  advance(): void {
    this.currentIndex += this.stepValue;
    this.currentIteration++;
  }

  /**
   * Complete the loop
   */
  complete(): void {
    this.isRunning = false;
    this.isComplete = true;
  }

  /**
   * Execute the loop with a callback for each iteration
   */
  execute(bodyCallback: (index: number, iteration: number) => any): LoopExecutionResult {
    const results: any[] = [];
    this.initialize();

    try {
      while (this.shouldContinue()) {
        const result = bodyCallback(this.currentIndex, this.currentIteration);
        results.push(result);
        this.advance();
      }
      this.complete();

      return {
        completed: true,
        iterations: this.currentIteration,
        results
      };
    } catch (error) {
      this.complete();
      return {
        completed: false,
        iterations: this.currentIteration,
        results,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Generate SQL-compatible loop representation (for stored procedures)
   */
  toSQL(bodySQL: string): string {
    return `
DECLARE @${this.iteratorVariable} INT = ${this.startValue};
WHILE @${this.iteratorVariable} ${this.stepValue > 0 ? '<' : '>'} ${this.endValue}
BEGIN
    ${bodySQL}
    SET @${this.iteratorVariable} = @${this.iteratorVariable} + ${this.stepValue};
END
    `.trim();
  }

  /**
   * Get state-space configuration
   */
  getStateSpaceConfig() {
    return {
      className: 'ForLoop',
      isStateSpaceObject: this.isStateSpaceObject,
      eventMethods: [
        {
          methodName: 'execute',
          displayName: 'Execute Loop',
          description: 'Run the for loop with body callback',
          category: 'Control Flow',
          inputParams: [
            { name: 'bodyCallback', displayName: 'Body Function', type: 'function', isRequired: true }
          ],
          output: { type: 'LoopExecutionResult', displayName: 'Result' }
        },
        {
          methodName: 'shouldContinue',
          displayName: 'Check Condition',
          description: 'Check if loop should continue',
          category: 'Control Flow',
          inputParams: [],
          output: { type: 'boolean', displayName: 'Continue' }
        }
      ],
      displayFields: this.stateSpaceDisplayFields,
      fieldsPerRow: this.stateSpaceFieldsPerRow,
      variables: ['iteratorVariable', 'startValue', 'endValue', 'stepValue', 'currentIndex']
    };
  }

  /**
   * Serialize to JSON
   */
  toJSON(): object {
    return {
      id: this.id,
      displayName: this.displayName,
      type: 'ForLoop',
      iteratorVariable: this.iteratorVariable,
      startValue: this.startValue,
      endValue: this.endValue,
      stepValue: this.stepValue,
      maxIterations: this.maxIterations,
      useCustomCondition: this.useCustomCondition,
      condition: this.condition.toJSON()
    };
  }

  /**
   * Create from JSON
   */
  static fromJSON(json: any): ForLoop {
    const loop = new ForLoop(json.displayName, json.startValue, json.endValue, json.stepValue);
    loop.id = json.id;
    loop.iteratorVariable = json.iteratorVariable || 'i';
    loop.maxIterations = json.maxIterations || 10000;
    loop.useCustomCondition = json.useCustomCondition || false;
    if (json.condition) {
      loop.condition = ConditionalChain.fromJSON(json.condition);
    }
    return loop;
  }
}

/**
 * WhileLoop - Condition-based loop
 *
 * Equivalent to: while (condition) { body }
 *
 * Usage in state-space:
 * - Configure condition using ConditionalChain
 * - Connect to body states that execute while condition is true
 */
export class WhileLoop implements LoopStateBase {
  id: string;
  displayName: string;

  // Condition for loop continuation
  condition: ConditionalChain;

  // Loop state
  maxIterations: number = 10000;
  currentIteration: number = 0;
  isRunning: boolean = false;
  isComplete: boolean = false;

  // State-space configuration
  isStateSpaceObject: boolean = true;
  stateSpaceDisplayFields: string[] = ['displayName', 'maxIterations'];
  stateSpaceFieldsPerRow: 1 | 2 = 1;

  constructor(displayName: string = 'While Loop', condition?: ConditionalChain) {
    this.id = this.generateId();
    this.displayName = displayName;
    this.condition = condition || new ConditionalChain('Loop Condition');
  }

  private generateId(): string {
    return 'whileloop_' + Math.random().toString(36).substring(2, 11);
  }

  /**
   * Initialize the loop for execution
   */
  initialize(): void {
    this.currentIteration = 0;
    this.isRunning = true;
    this.isComplete = false;
  }

  /**
   * Check if the loop should continue
   */
  shouldContinue(context: Record<string, any>): boolean {
    if (this.currentIteration >= this.maxIterations) {
      return false;
    }
    return this.condition.evaluate(context);
  }

  /**
   * Advance iteration counter
   */
  advance(): void {
    this.currentIteration++;
  }

  /**
   * Complete the loop
   */
  complete(): void {
    this.isRunning = false;
    this.isComplete = true;
  }

  /**
   * Execute the loop with a callback for each iteration
   * The callback should return the updated context for the next condition check
   */
  execute(
    initialContext: Record<string, any>,
    bodyCallback: (context: Record<string, any>, iteration: number) => Record<string, any>
  ): LoopExecutionResult {
    const results: any[] = [];
    let context = { ...initialContext };
    this.initialize();

    try {
      while (this.shouldContinue(context)) {
        context = bodyCallback(context, this.currentIteration);
        results.push({ ...context });
        this.advance();
      }
      this.complete();

      return {
        completed: true,
        iterations: this.currentIteration,
        results
      };
    } catch (error) {
      this.complete();
      return {
        completed: false,
        iterations: this.currentIteration,
        results,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Generate SQL-compatible loop representation
   */
  toSQL(bodySQL: string, tableAlias?: string): string {
    const conditionSQL = this.condition.toSQL(tableAlias);
    return `
WHILE ${conditionSQL}
BEGIN
    ${bodySQL}
END
    `.trim();
  }

  /**
   * Get state-space configuration
   */
  getStateSpaceConfig() {
    return {
      className: 'WhileLoop',
      isStateSpaceObject: this.isStateSpaceObject,
      eventMethods: [
        {
          methodName: 'execute',
          displayName: 'Execute Loop',
          description: 'Run the while loop with body callback',
          category: 'Control Flow',
          inputParams: [
            { name: 'initialContext', displayName: 'Initial Context', type: 'object', isRequired: true },
            { name: 'bodyCallback', displayName: 'Body Function', type: 'function', isRequired: true }
          ],
          output: { type: 'LoopExecutionResult', displayName: 'Result' }
        },
        {
          methodName: 'shouldContinue',
          displayName: 'Check Condition',
          description: 'Check if loop should continue',
          category: 'Control Flow',
          inputParams: [
            { name: 'context', displayName: 'Context', type: 'object', isRequired: true }
          ],
          output: { type: 'boolean', displayName: 'Continue' }
        }
      ],
      displayFields: this.stateSpaceDisplayFields,
      fieldsPerRow: this.stateSpaceFieldsPerRow,
      variables: ['displayName', 'maxIterations', 'currentIteration', 'condition']
    };
  }

  /**
   * Serialize to JSON
   */
  toJSON(): object {
    return {
      id: this.id,
      displayName: this.displayName,
      type: 'WhileLoop',
      maxIterations: this.maxIterations,
      condition: this.condition.toJSON()
    };
  }

  /**
   * Create from JSON
   */
  static fromJSON(json: any): WhileLoop {
    const condition = json.condition ? ConditionalChain.fromJSON(json.condition) : undefined;
    const loop = new WhileLoop(json.displayName, condition);
    loop.id = json.id;
    loop.maxIterations = json.maxIterations || 10000;
    return loop;
  }
}

/**
 * ForEachLoop - Collection iteration loop
 *
 * Equivalent to: for (const item of collection) { body }
 *
 * Usage in state-space:
 * - Configure collection source (array, query result, etc.)
 * - Connect to body states that execute for each item
 * - Access current item via itemVariable
 */
export class ForEachLoop implements LoopStateBase {
  id: string;
  displayName: string;

  // Iterator configuration
  itemVariable: string = 'item';
  indexVariable: string = 'index';
  collectionVariable: string = 'collection';

  // The collection to iterate (can be set dynamically)
  collection: any[] = [];

  // Optional filter condition (applied before iteration)
  filterCondition?: ConditionalChain;

  // Loop state
  maxIterations: number = 10000;
  currentIteration: number = 0;
  currentItem: any = null;
  currentIndex: number = 0;
  isRunning: boolean = false;
  isComplete: boolean = false;

  // State-space configuration
  isStateSpaceObject: boolean = true;
  stateSpaceDisplayFields: string[] = ['displayName', 'itemVariable', 'collectionVariable'];
  stateSpaceFieldsPerRow: 1 | 2 = 2;

  constructor(displayName: string = 'For Each Loop', itemVariable: string = 'item') {
    this.id = this.generateId();
    this.displayName = displayName;
    this.itemVariable = itemVariable;
  }

  private generateId(): string {
    return 'foreachloop_' + Math.random().toString(36).substring(2, 11);
  }

  /**
   * Set the collection to iterate
   */
  setCollection(collection: any[]): void {
    this.collection = collection;
  }

  /**
   * Add a filter condition (items must pass to be iterated)
   */
  setFilterCondition(condition: ConditionalChain): void {
    this.filterCondition = condition;
  }

  /**
   * Get filtered collection based on condition
   */
  private getFilteredCollection(): any[] {
    if (!this.filterCondition) {
      return this.collection;
    }

    return this.collection.filter(item => {
      const context = { [this.itemVariable]: item };
      return this.filterCondition!.evaluate(context);
    });
  }

  /**
   * Initialize the loop for execution
   */
  initialize(): void {
    this.currentIndex = 0;
    this.currentIteration = 0;
    this.currentItem = null;
    this.isRunning = true;
    this.isComplete = false;
  }

  /**
   * Check if there are more items to process
   */
  hasNext(): boolean {
    const filtered = this.getFilteredCollection();
    return this.currentIndex < filtered.length && this.currentIteration < this.maxIterations;
  }

  /**
   * Get the next item and advance
   */
  next(): any {
    const filtered = this.getFilteredCollection();
    if (this.currentIndex < filtered.length) {
      this.currentItem = filtered[this.currentIndex];
      this.currentIndex++;
      this.currentIteration++;
      return this.currentItem;
    }
    return undefined;
  }

  /**
   * Complete the loop
   */
  complete(): void {
    this.isRunning = false;
    this.isComplete = true;
  }

  /**
   * Execute the loop with a callback for each item
   */
  execute(
    collection: any[],
    bodyCallback: (item: any, index: number) => any
  ): LoopExecutionResult {
    this.setCollection(collection);
    const results: any[] = [];
    this.initialize();

    try {
      const filtered = this.getFilteredCollection();

      while (this.hasNext()) {
        const item = this.next();
        const result = bodyCallback(item, this.currentIndex - 1);
        results.push(result);
      }
      this.complete();

      return {
        completed: true,
        iterations: this.currentIteration,
        results
      };
    } catch (error) {
      this.complete();
      return {
        completed: false,
        iterations: this.currentIteration,
        results,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Generate SQL cursor-based iteration (for stored procedures)
   */
  toSQL(bodySQL: string, sourceTable: string, tableAlias?: string): string {
    const alias = tableAlias || 'cur';
    const filterSQL = this.filterCondition ? `WHERE ${this.filterCondition.toSQL(alias)}` : '';

    return `
DECLARE ${this.itemVariable}_cursor CURSOR FOR
    SELECT * FROM ${sourceTable} ${alias}
    ${filterSQL};

OPEN ${this.itemVariable}_cursor;

FETCH NEXT FROM ${this.itemVariable}_cursor INTO @${this.itemVariable};

WHILE @@FETCH_STATUS = 0
BEGIN
    ${bodySQL}
    FETCH NEXT FROM ${this.itemVariable}_cursor INTO @${this.itemVariable};
END

CLOSE ${this.itemVariable}_cursor;
DEALLOCATE ${this.itemVariable}_cursor;
    `.trim();
  }

  /**
   * Get state-space configuration
   */
  getStateSpaceConfig() {
    return {
      className: 'ForEachLoop',
      isStateSpaceObject: this.isStateSpaceObject,
      eventMethods: [
        {
          methodName: 'execute',
          displayName: 'Execute Loop',
          description: 'Iterate over collection with body callback',
          category: 'Control Flow',
          inputParams: [
            { name: 'collection', displayName: 'Collection', type: 'array', isRequired: true },
            { name: 'bodyCallback', displayName: 'Body Function', type: 'function', isRequired: true }
          ],
          output: { type: 'LoopExecutionResult', displayName: 'Result' }
        },
        {
          methodName: 'hasNext',
          displayName: 'Has Next',
          description: 'Check if more items exist',
          category: 'Control Flow',
          inputParams: [],
          output: { type: 'boolean', displayName: 'Has Next' }
        },
        {
          methodName: 'next',
          displayName: 'Get Next',
          description: 'Get and advance to next item',
          category: 'Control Flow',
          inputParams: [],
          output: { type: 'any', displayName: 'Current Item' }
        }
      ],
      displayFields: this.stateSpaceDisplayFields,
      fieldsPerRow: this.stateSpaceFieldsPerRow,
      variables: ['itemVariable', 'indexVariable', 'collectionVariable', 'currentItem', 'currentIndex']
    };
  }

  /**
   * Serialize to JSON
   */
  toJSON(): object {
    return {
      id: this.id,
      displayName: this.displayName,
      type: 'ForEachLoop',
      itemVariable: this.itemVariable,
      indexVariable: this.indexVariable,
      collectionVariable: this.collectionVariable,
      maxIterations: this.maxIterations,
      filterCondition: this.filterCondition?.toJSON()
    };
  }

  /**
   * Create from JSON
   */
  static fromJSON(json: any): ForEachLoop {
    const loop = new ForEachLoop(json.displayName, json.itemVariable);
    loop.id = json.id;
    loop.indexVariable = json.indexVariable || 'index';
    loop.collectionVariable = json.collectionVariable || 'collection';
    loop.maxIterations = json.maxIterations || 10000;
    if (json.filterCondition) {
      loop.filterCondition = ConditionalChain.fromJSON(json.filterCondition);
    }
    return loop;
  }
}

// --- Factory Functions ---

/**
 * Create a simple for loop (0 to n)
 */
export function createSimpleForLoop(endValue: number, displayName?: string): ForLoop {
  return new ForLoop(displayName || `Loop 0 to ${endValue}`, 0, endValue, 1);
}

/**
 * Create a range for loop (start to end with step)
 */
export function createRangeForLoop(
  start: number,
  end: number,
  step: number = 1,
  displayName?: string
): ForLoop {
  return new ForLoop(displayName || `Loop ${start} to ${end}`, start, end, step);
}

/**
 * Create a while loop with a simple condition
 */
export function createSimpleWhileLoop(
  fieldName: string,
  conditionType: ConditionType,
  conditionValue: any,
  displayName?: string
): WhileLoop {
  const condition = new ConditionalChain('Loop Condition');
  condition.pushCondition(createConditionLink(fieldName, conditionType, conditionValue));
  return new WhileLoop(displayName || `While ${fieldName} ${conditionType} ${conditionValue}`, condition);
}

/**
 * Create a for-each loop for a collection
 */
export function createForEachLoop(
  itemVariable: string = 'item',
  displayName?: string
): ForEachLoop {
  return new ForEachLoop(displayName || `For Each ${itemVariable}`, itemVariable);
}

// --- Type Guards ---

export function isForLoop(loop: LoopStateBase): loop is ForLoop {
  return 'iteratorVariable' in loop && 'startValue' in loop && 'endValue' in loop;
}

export function isWhileLoop(loop: LoopStateBase): loop is WhileLoop {
  return 'condition' in loop && !('iteratorVariable' in loop) && !('itemVariable' in loop);
}

export function isForEachLoop(loop: LoopStateBase): loop is ForEachLoop {
  return 'itemVariable' in loop && 'collection' in loop;
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
