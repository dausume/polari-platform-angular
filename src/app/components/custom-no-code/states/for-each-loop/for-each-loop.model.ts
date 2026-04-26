// Author: Dustin Etts
// polari-platform-angular/src/app/components/custom-no-code/states/for-each-loop/for-each-loop.model.ts

import { ConditionalChain } from '../conditional-chain/conditional-chain.model';
import { LoopStateBase, LoopExecutionResult } from '../_shared/loop-state-base';

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
 * Create a for-each loop for a collection
 */
export function createForEachLoop(
  itemVariable: string = 'item',
  displayName?: string
): ForEachLoop {
  return new ForEachLoop(displayName || `For Each ${itemVariable}`, itemVariable);
}

// --- Type Guards ---

export function isForEachLoop(loop: LoopStateBase): loop is ForEachLoop {
  return 'itemVariable' in loop && 'collection' in loop;
}
