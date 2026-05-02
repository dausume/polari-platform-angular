// Author: Dustin Etts
// polari-platform-angular/src/app/components/custom-no-code/states/while-loop/while-loop.model.ts

import { ConditionalChain, createConditionLink } from '../../conditionals/conditional-chain/conditional-chain.model';
import { ConditionType } from '../../_shared/condition-type-options';
import { LoopStateBase, LoopExecutionResult } from '../../_shared/loop-state-base';

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

// --- Factory Functions ---

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

// --- Type Guards ---

export function isWhileLoop(loop: LoopStateBase): loop is WhileLoop {
  return 'condition' in loop && !('iteratorVariable' in loop) && !('itemVariable' in loop);
}
