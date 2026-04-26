// Author: Dustin Etts
// polari-platform-angular/src/app/components/custom-no-code/states/for-loop/for-loop.model.ts

import { ConditionalChain, createConditionLink } from '../conditional-chain/conditional-chain.model';
import { ConditionType } from '../_shared/condition-type-options';
import { LoopStateBase, LoopExecutionResult } from '../_shared/loop-state-base';

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

// --- Type Guards ---

export function isForLoop(loop: LoopStateBase): loop is ForLoop {
  return 'iteratorVariable' in loop && 'startValue' in loop && 'endValue' in loop;
}
