// Author: Dustin Etts
// polari-platform-angular/src/app/models/stateSpace/stateSpaceClassRegistry.ts

/**
 * State-Space Class Registry
 *
 * Central registry for all state-space enabled classes available in the visual programming system.
 * Provides metadata, configuration, and factory methods for creating state instances.
 *
 * This acts as a mock/frontend representation of the backend polyTypedObject registry
 * filtered to only include isStateSpaceObject=true classes.
 */

import { ConditionalChain, ConditionalChainLink, createConditionLink, createNestedConditionGroup } from './conditionalChain';
import { ConditionType, CONDITION_TYPE_OPTIONS, CONDITION_OPTIONS_BY_CATEGORY, getConditionOptionsForType } from './conditionTypeOptions';
import { ForLoop, WhileLoop, ForEachLoop, createSimpleForLoop, createRangeForLoop, createSimpleWhileLoop, createForEachLoop } from './loopStates';
import { VariableAssignment, FunctionCall, ReturnStatement, LogOutput, BreakStatement, ContinueStatement, createAssignment, createDeclaration, createFunctionCall, createReturn, createLog } from './operationStates';

/**
 * State-space class category for UI organization
 */
export type StateSpaceCategory =
  | 'Control Flow'
  | 'Conditionals'
  | 'Loops'
  | 'Data'
  | 'Debug'
  | 'Custom';

/**
 * State-space event method definition
 */
export interface StateSpaceEventMethod {
  methodName: string;
  displayName: string;
  description: string;
  category: string;
  inputParams: {
    name: string;
    displayName: string;
    type: string;
    isRequired: boolean;
    defaultValue?: any;
  }[];
  output: {
    type: string;
    displayName: string;
  };
}

/**
 * Default slot configuration for a state-space class
 */
export interface SlotConfigurationTemplate {
  // Number of input slots to create by default
  defaultInputCount: number;
  // Number of output slots to create by default
  defaultOutputCount: number;
  // Whether additional input slots can be added dynamically
  allowDynamicInputs: boolean;
  // Whether additional output slots can be added dynamically
  allowDynamicOutputs: boolean;
  // Maximum number of input slots allowed (0 = unlimited)
  maxInputSlots: number;
  // Maximum number of output slots allowed (0 = unlimited)
  maxOutputSlots: number;
  // Type of data expected on input slots
  inputType?: string;
  // Type of data produced by output slots
  outputType?: string;
  // Labels for default input slots
  inputLabels?: string[];
  // Labels for default output slots
  outputLabels?: string[];
}

/**
 * State-space class metadata
 */
export interface StateSpaceClassMetadata {
  className: string;
  displayName: string;
  description: string;
  category: StateSpaceCategory;
  icon?: string; // Material icon name
  color?: string; // Hex color for the class

  // State-space configuration
  isStateSpaceObject: boolean;
  stateSpaceDisplayFields: string[];
  stateSpaceFieldsPerRow: 1 | 2;

  // Built-in flag - true for system classes (Control Flow, Loops, etc.)
  // User-defined classes and Solutions as Definitions will have this as false
  isBuiltIn: boolean;

  // Special state type - for InitialState and EndState
  specialStateType?: 'initial' | 'end' | 'solution';

  // For solution-based definitions, the source solution name
  sourceSolutionName?: string;

  // Default slot configuration for this class
  slotConfiguration?: SlotConfigurationTemplate;

  // Available event methods
  eventMethods: StateSpaceEventMethod[];

  // Variables/fields on this class
  variables: {
    name: string;
    displayName: string;
    type: string;
    isEditable: boolean;
    defaultValue?: any;
  }[];

  // Factory function to create new instance
  factory: () => any;
}

/**
 * State-Space Class Registry
 *
 * Singleton registry providing access to all state-space classes
 */
export class StateSpaceClassRegistry {
  private static instance: StateSpaceClassRegistry;
  private classes: Map<string, StateSpaceClassMetadata> = new Map();

  private constructor() {
    this.registerBuiltInClasses();
  }

  static getInstance(): StateSpaceClassRegistry {
    if (!StateSpaceClassRegistry.instance) {
      StateSpaceClassRegistry.instance = new StateSpaceClassRegistry();
    }
    return StateSpaceClassRegistry.instance;
  }

  /**
   * Register all built-in state-space classes
   */
  private registerBuiltInClasses(): void {
    // === Special State Types (Required for every solution) ===
    this.registerClass({
      className: 'InitialState',
      displayName: 'Initial State',
      description: 'The starting point of a solution - defines input parameters and entry point',
      category: 'Control Flow',
      icon: 'play_circle',
      color: '#4CAF50',
      isStateSpaceObject: true,
      stateSpaceDisplayFields: ['displayName', 'description'],
      stateSpaceFieldsPerRow: 1,
      isBuiltIn: true,
      specialStateType: 'initial',
      eventMethods: [
        {
          methodName: 'start',
          displayName: 'Start Execution',
          description: 'Begin solution execution with input parameters',
          category: 'Control Flow',
          inputParams: [
            { name: 'inputData', displayName: 'Input Data', type: 'object', isRequired: false }
          ],
          output: { type: 'object', displayName: 'Initial Context' }
        }
      ],
      variables: [
        { name: 'displayName', displayName: 'Display Name', type: 'string', isEditable: true, defaultValue: 'Start' },
        { name: 'description', displayName: 'Description', type: 'string', isEditable: true, defaultValue: 'Solution entry point' }
      ],
      factory: () => ({ type: 'InitialState', displayName: 'Start', description: 'Solution entry point' })
    });

    this.registerClass({
      className: 'EndState',
      displayName: 'End State',
      description: 'The termination point of a solution - defines output and completion',
      category: 'Control Flow',
      icon: 'stop_circle',
      color: '#F44336',
      isStateSpaceObject: true,
      stateSpaceDisplayFields: ['displayName', 'description'],
      stateSpaceFieldsPerRow: 1,
      isBuiltIn: true,
      specialStateType: 'end',
      eventMethods: [
        {
          methodName: 'complete',
          displayName: 'Complete Execution',
          description: 'End solution execution and return output',
          category: 'Control Flow',
          inputParams: [
            { name: 'context', displayName: 'Final Context', type: 'object', isRequired: true }
          ],
          output: { type: 'any', displayName: 'Solution Output' }
        }
      ],
      variables: [
        { name: 'displayName', displayName: 'Display Name', type: 'string', isEditable: true, defaultValue: 'End' },
        { name: 'description', displayName: 'Description', type: 'string', isEditable: true, defaultValue: 'Solution completion point' }
      ],
      factory: () => ({ type: 'EndState', displayName: 'End', description: 'Solution completion point' })
    });

    // === Conditionals ===
    this.registerClass({
      className: 'ConditionalChain',
      displayName: 'Conditional Chain',
      description: 'A chainable conditional evaluation system with AND/OR/NOT logic',
      category: 'Conditionals',
      icon: 'device_hub',
      color: '#4CAF50',
      isStateSpaceObject: true,
      stateSpaceDisplayFields: ['displayName', 'defaultLogicalOperator'],
      stateSpaceFieldsPerRow: 1,
      isBuiltIn: true,
      slotConfiguration: {
        defaultInputCount: 1,
        defaultOutputCount: 1,
        allowDynamicInputs: true,
        allowDynamicOutputs: false,
        maxInputSlots: 0, // unlimited
        maxOutputSlots: 1, // always exactly one output
        inputType: 'any',
        outputType: 'boolean',
        inputLabels: ['Input'],
        outputLabels: ['Result']
      },
      eventMethods: [
        {
          methodName: 'evaluate',
          displayName: 'Evaluate',
          description: 'Evaluate the conditional chain against input data',
          category: 'Logic',
          inputParams: [
            { name: 'data', displayName: 'Input Data', type: 'object', isRequired: true }
          ],
          output: { type: 'boolean', displayName: 'Result' }
        },
        {
          methodName: 'toSQL',
          displayName: 'Generate SQL',
          description: 'Generate SQL WHERE clause from conditions',
          category: 'SQL',
          inputParams: [
            { name: 'tableAlias', displayName: 'Table Alias', type: 'string', isRequired: false }
          ],
          output: { type: 'string', displayName: 'SQL WHERE Clause' }
        }
      ],
      variables: [
        { name: 'displayName', displayName: 'Display Name', type: 'string', isEditable: true, defaultValue: 'Condition Chain' },
        { name: 'defaultLogicalOperator', displayName: 'Default Operator', type: 'string', isEditable: true, defaultValue: 'AND' },
        { name: 'links', displayName: 'Condition Links', type: 'array', isEditable: false }
      ],
      factory: () => new ConditionalChain()
    });

    // === Loops ===
    this.registerClass({
      className: 'ForLoop',
      displayName: 'For Loop',
      description: 'Traditional indexed for loop (i = start; i < end; i += step)',
      category: 'Loops',
      icon: 'loop',
      color: '#2196F3',
      isStateSpaceObject: true,
      stateSpaceDisplayFields: ['displayName', 'iteratorVariable', 'startValue', 'endValue'],
      stateSpaceFieldsPerRow: 2,
      isBuiltIn: true,
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
      variables: [
        { name: 'displayName', displayName: 'Display Name', type: 'string', isEditable: true, defaultValue: 'For Loop' },
        { name: 'iteratorVariable', displayName: 'Iterator Variable', type: 'string', isEditable: true, defaultValue: 'i' },
        { name: 'startValue', displayName: 'Start Value', type: 'number', isEditable: true, defaultValue: 0 },
        { name: 'endValue', displayName: 'End Value', type: 'number', isEditable: true, defaultValue: 10 },
        { name: 'stepValue', displayName: 'Step Value', type: 'number', isEditable: true, defaultValue: 1 }
      ],
      factory: () => new ForLoop()
    });

    this.registerClass({
      className: 'WhileLoop',
      displayName: 'While Loop',
      description: 'Condition-based loop that runs while condition is true',
      category: 'Loops',
      icon: 'refresh',
      color: '#2196F3',
      isStateSpaceObject: true,
      stateSpaceDisplayFields: ['displayName', 'maxIterations'],
      stateSpaceFieldsPerRow: 1,
      isBuiltIn: true,
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
        }
      ],
      variables: [
        { name: 'displayName', displayName: 'Display Name', type: 'string', isEditable: true, defaultValue: 'While Loop' },
        { name: 'maxIterations', displayName: 'Max Iterations', type: 'number', isEditable: true, defaultValue: 10000 }
      ],
      factory: () => new WhileLoop()
    });

    this.registerClass({
      className: 'ForEachLoop',
      displayName: 'For Each Loop',
      description: 'Iterate over each item in a collection',
      category: 'Loops',
      icon: 'format_list_numbered',
      color: '#2196F3',
      isStateSpaceObject: true,
      stateSpaceDisplayFields: ['displayName', 'itemVariable', 'collectionVariable'],
      stateSpaceFieldsPerRow: 2,
      isBuiltIn: true,
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
        }
      ],
      variables: [
        { name: 'displayName', displayName: 'Display Name', type: 'string', isEditable: true, defaultValue: 'For Each' },
        { name: 'itemVariable', displayName: 'Item Variable', type: 'string', isEditable: true, defaultValue: 'item' },
        { name: 'indexVariable', displayName: 'Index Variable', type: 'string', isEditable: true, defaultValue: 'index' },
        { name: 'collectionVariable', displayName: 'Collection Variable', type: 'string', isEditable: true, defaultValue: 'collection' }
      ],
      factory: () => new ForEachLoop()
    });

    // === Data Operations ===
    this.registerClass({
      className: 'FilterList',
      displayName: 'Filter List',
      description: 'Filter a list of objects based on type or condition',
      category: 'Data',
      icon: 'filter_list',
      color: '#00BCD4',
      isStateSpaceObject: true,
      stateSpaceDisplayFields: ['displayName', 'filterType', 'objectType'],
      stateSpaceFieldsPerRow: 2,
      isBuiltIn: true,
      slotConfiguration: {
        defaultInputCount: 1,
        defaultOutputCount: 1,
        allowDynamicInputs: true,
        allowDynamicOutputs: false,
        maxInputSlots: 0, // unlimited
        maxOutputSlots: 1, // always exactly one output
        inputType: 'any',
        outputType: 'array',
        inputLabels: ['Input List'],
        outputLabels: ['Filtered List']
      },
      eventMethods: [
        {
          methodName: 'execute',
          displayName: 'Filter List',
          description: 'Filter the input list based on criteria',
          category: 'Data',
          inputParams: [
            { name: 'inputList', displayName: 'Input List', type: 'array', isRequired: true },
            { name: 'filterCondition', displayName: 'Filter Condition', type: 'ConditionalChain', isRequired: false }
          ],
          output: { type: 'array', displayName: 'Filtered List' }
        }
      ],
      variables: [
        { name: 'displayName', displayName: 'Display Name', type: 'string', isEditable: true, defaultValue: 'Filter' },
        { name: 'filterType', displayName: 'Filter Type', type: 'string', isEditable: true, defaultValue: 'byType' },
        { name: 'objectType', displayName: 'Object Type', type: 'string', isEditable: true, defaultValue: '' }
      ],
      factory: () => ({ type: 'FilterList', displayName: 'Filter', filterType: 'byType', objectType: '' })
    });

    this.registerClass({
      className: 'MapList',
      displayName: 'Map List',
      description: 'Transform each item in a list',
      category: 'Data',
      icon: 'transform',
      color: '#00BCD4',
      isStateSpaceObject: true,
      stateSpaceDisplayFields: ['displayName', 'outputField'],
      stateSpaceFieldsPerRow: 1,
      isBuiltIn: true,
      eventMethods: [
        {
          methodName: 'execute',
          displayName: 'Map List',
          description: 'Apply transformation to each item',
          category: 'Data',
          inputParams: [
            { name: 'inputList', displayName: 'Input List', type: 'array', isRequired: true },
            { name: 'transformCallback', displayName: 'Transform Function', type: 'function', isRequired: true }
          ],
          output: { type: 'array', displayName: 'Mapped List' }
        }
      ],
      variables: [
        { name: 'displayName', displayName: 'Display Name', type: 'string', isEditable: true, defaultValue: 'Map' },
        { name: 'outputField', displayName: 'Output Field', type: 'string', isEditable: true, defaultValue: '' }
      ],
      factory: () => ({ type: 'MapList', displayName: 'Map', outputField: '' })
    });

    this.registerClass({
      className: 'ReduceList',
      displayName: 'Reduce List',
      description: 'Reduce a list to a single value',
      category: 'Data',
      icon: 'compress',
      color: '#00BCD4',
      isStateSpaceObject: true,
      stateSpaceDisplayFields: ['displayName', 'operation'],
      stateSpaceFieldsPerRow: 1,
      isBuiltIn: true,
      eventMethods: [
        {
          methodName: 'execute',
          displayName: 'Reduce List',
          description: 'Reduce list to single value',
          category: 'Data',
          inputParams: [
            { name: 'inputList', displayName: 'Input List', type: 'array', isRequired: true },
            { name: 'initialValue', displayName: 'Initial Value', type: 'any', isRequired: false },
            { name: 'reduceCallback', displayName: 'Reduce Function', type: 'function', isRequired: true }
          ],
          output: { type: 'any', displayName: 'Reduced Value' }
        }
      ],
      variables: [
        { name: 'displayName', displayName: 'Display Name', type: 'string', isEditable: true, defaultValue: 'Reduce' },
        { name: 'operation', displayName: 'Operation', type: 'string', isEditable: true, defaultValue: 'sum' }
      ],
      factory: () => ({ type: 'ReduceList', displayName: 'Reduce', operation: 'sum' })
    });

    this.registerClass({
      className: 'ReturnStatement',
      displayName: 'Return',
      description: 'Return a value and exit the current flow',
      category: 'Control Flow',
      icon: 'exit_to_app',
      color: '#F44336',
      isStateSpaceObject: true,
      stateSpaceDisplayFields: ['displayName'],
      stateSpaceFieldsPerRow: 1,
      isBuiltIn: true,
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
      variables: [
        { name: 'displayName', displayName: 'Display Name', type: 'string', isEditable: true, defaultValue: 'Return' }
      ],
      factory: () => new ReturnStatement()
    });

    // === Debug ===
    this.registerClass({
      className: 'LogOutput',
      displayName: 'Log Output',
      description: 'Output debug/log messages',
      category: 'Debug',
      icon: 'bug_report',
      color: '#607D8B',
      isStateSpaceObject: true,
      stateSpaceDisplayFields: ['displayName', 'logLevel', 'messageTemplate'],
      stateSpaceFieldsPerRow: 1,
      isBuiltIn: true,
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
      variables: [
        { name: 'displayName', displayName: 'Display Name', type: 'string', isEditable: true, defaultValue: 'Log' },
        { name: 'logLevel', displayName: 'Log Level', type: 'string', isEditable: true, defaultValue: 'info' },
        { name: 'messageTemplate', displayName: 'Message', type: 'string', isEditable: true, defaultValue: '' }
      ],
      factory: () => new LogOutput()
    });

    // === Control Flow ===
    this.registerClass({
      className: 'BreakStatement',
      displayName: 'Break',
      description: 'Break out of current loop',
      category: 'Control Flow',
      icon: 'stop',
      color: '#F44336',
      isStateSpaceObject: true,
      stateSpaceDisplayFields: ['displayName'],
      stateSpaceFieldsPerRow: 1,
      isBuiltIn: true,
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
      variables: [
        { name: 'displayName', displayName: 'Display Name', type: 'string', isEditable: true, defaultValue: 'Break' }
      ],
      factory: () => new BreakStatement()
    });

    this.registerClass({
      className: 'ContinueStatement',
      displayName: 'Continue',
      description: 'Skip to next loop iteration',
      category: 'Control Flow',
      icon: 'skip_next',
      color: '#FF9800',
      isStateSpaceObject: true,
      stateSpaceDisplayFields: ['displayName'],
      stateSpaceFieldsPerRow: 1,
      isBuiltIn: true,
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
      variables: [
        { name: 'displayName', displayName: 'Display Name', type: 'string', isEditable: true, defaultValue: 'Continue' }
      ],
      factory: () => new ContinueStatement()
    });
  }

  /**
   * Register a new state-space class
   */
  registerClass(metadata: StateSpaceClassMetadata): void {
    this.classes.set(metadata.className, metadata);
  }

  /**
   * Unregister a class
   */
  unregisterClass(className: string): boolean {
    return this.classes.delete(className);
  }

  /**
   * Get class metadata by name
   */
  getClass(className: string): StateSpaceClassMetadata | undefined {
    return this.classes.get(className);
  }

  /**
   * Get all registered classes
   */
  getAllClasses(): StateSpaceClassMetadata[] {
    return Array.from(this.classes.values());
  }

  /**
   * Get classes by category
   */
  getClassesByCategory(category: StateSpaceCategory): StateSpaceClassMetadata[] {
    return this.getAllClasses().filter(c => c.category === category);
  }

  /**
   * Get all categories
   */
  getCategories(): StateSpaceCategory[] {
    const categories = new Set(this.getAllClasses().map(c => c.category));
    return Array.from(categories);
  }

  /**
   * Get classes grouped by category (for UI dropdowns)
   */
  getClassesByCategories(): Map<StateSpaceCategory, StateSpaceClassMetadata[]> {
    const grouped = new Map<StateSpaceCategory, StateSpaceClassMetadata[]>();

    for (const metadata of this.getAllClasses()) {
      const existing = grouped.get(metadata.category) || [];
      existing.push(metadata);
      grouped.set(metadata.category, existing);
    }

    return grouped;
  }

  /**
   * Create a new instance of a class
   */
  createInstance(className: string): any {
    const metadata = this.classes.get(className);
    if (!metadata) {
      throw new Error(`Class '${className}' not found in registry`);
    }
    return metadata.factory();
  }

  /**
   * Get class names for autocomplete
   */
  getClassNames(): string[] {
    return Array.from(this.classes.keys());
  }

  /**
   * Search classes by name or description
   */
  searchClasses(query: string): StateSpaceClassMetadata[] {
    const lowerQuery = query.toLowerCase();
    return this.getAllClasses().filter(c =>
      c.className.toLowerCase().includes(lowerQuery) ||
      c.displayName.toLowerCase().includes(lowerQuery) ||
      c.description.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * Get only built-in classes (system classes like loops, conditionals, etc.)
   */
  getBuiltInClasses(): StateSpaceClassMetadata[] {
    return this.getAllClasses().filter(c => c.isBuiltIn);
  }

  /**
   * Get only user-defined classes (non-built-in)
   */
  getUserDefinedClasses(): StateSpaceClassMetadata[] {
    return this.getAllClasses().filter(c => !c.isBuiltIn);
  }

  /**
   * Get special state types (InitialState, EndState)
   */
  getSpecialStateTypes(): StateSpaceClassMetadata[] {
    return this.getAllClasses().filter(c => c.specialStateType !== undefined);
  }

  /**
   * Get solution-based definitions (solutions registered as state definitions)
   */
  getSolutionDefinitions(): StateSpaceClassMetadata[] {
    return this.getAllClasses().filter(c => c.specialStateType === 'solution');
  }

  /**
   * Register a solution as a state definition (for solution nesting)
   * This allows a solution to be used as a state in another solution
   */
  registerSolutionAsDefinition(
    solutionName: string,
    displayName: string,
    description: string,
    inputParams: { name: string; displayName: string; type: string; isRequired: boolean }[],
    outputType: string,
    icon?: string,
    color?: string
  ): void {
    const className = `Solution_${solutionName.replace(/[^a-zA-Z0-9]/g, '_')}`;

    this.registerClass({
      className,
      displayName: displayName || solutionName,
      description: description || `Execute the ${solutionName} solution as a sub-flow`,
      category: 'Custom',
      icon: icon || 'account_tree',
      color: color || '#673AB7',
      isStateSpaceObject: true,
      stateSpaceDisplayFields: ['displayName'],
      stateSpaceFieldsPerRow: 1,
      isBuiltIn: false,
      specialStateType: 'solution',
      sourceSolutionName: solutionName,
      eventMethods: [
        {
          methodName: 'execute',
          displayName: 'Execute Solution',
          description: `Run the ${solutionName} solution`,
          category: 'Solution',
          inputParams,
          output: { type: outputType, displayName: 'Solution Output' }
        }
      ],
      variables: [
        { name: 'displayName', displayName: 'Display Name', type: 'string', isEditable: true, defaultValue: displayName || solutionName }
      ],
      factory: () => ({
        type: 'SolutionCall',
        solutionName,
        displayName: displayName || solutionName
      })
    });
  }

  /**
   * Unregister a solution definition
   */
  unregisterSolutionDefinition(solutionName: string): boolean {
    const className = `Solution_${solutionName.replace(/[^a-zA-Z0-9]/g, '_')}`;
    return this.unregisterClass(className);
  }

  /**
   * Check if a solution is registered as a definition
   */
  isSolutionRegistered(solutionName: string): boolean {
    const className = `Solution_${solutionName.replace(/[^a-zA-Z0-9]/g, '_')}`;
    return this.classes.has(className);
  }
}

// Export singleton getter
export function getStateSpaceRegistry(): StateSpaceClassRegistry {
  return StateSpaceClassRegistry.getInstance();
}

// Export for convenience - common operations

/**
 * Get all available state-space class names
 */
export function getAvailableStateSpaceClasses(): string[] {
  return getStateSpaceRegistry().getClassNames();
}

/**
 * Get class metadata
 */
export function getStateSpaceClassMetadata(className: string): StateSpaceClassMetadata | undefined {
  return getStateSpaceRegistry().getClass(className);
}

/**
 * Create a new instance of a state-space class
 */
export function createStateSpaceInstance(className: string): any {
  return getStateSpaceRegistry().createInstance(className);
}

/**
 * Get all classes grouped by category for UI
 */
export function getStateSpaceClassesByCategory(): Map<StateSpaceCategory, StateSpaceClassMetadata[]> {
  return getStateSpaceRegistry().getClassesByCategories();
}

// Re-export all the classes for easy imports
export {
  ConditionalChain,
  ConditionalChainLink,
  createConditionLink,
  createNestedConditionGroup,
  ConditionType,
  CONDITION_TYPE_OPTIONS,
  CONDITION_OPTIONS_BY_CATEGORY,
  getConditionOptionsForType,
  ForLoop,
  WhileLoop,
  ForEachLoop,
  createSimpleForLoop,
  createRangeForLoop,
  createSimpleWhileLoop,
  createForEachLoop,
  VariableAssignment,
  FunctionCall,
  ReturnStatement,
  LogOutput,
  BreakStatement,
  ContinueStatement,
  createAssignment,
  createDeclaration,
  createFunctionCall,
  createReturn,
  createLog
};
