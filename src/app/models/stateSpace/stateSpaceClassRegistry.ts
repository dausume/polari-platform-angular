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
import { TargetRuntime } from '../noCode/mock-NCS-data';
import { ReactiveTransform, AwaitBackendCall } from './frontendStates';
import {
  InitialStateTriggerType,
  DirectInvocation,
  FormSubscription,
  LogicFlowEntry,
  BackendStateChange,
  getAvailableInitialStateTypes
} from './initialStates';
import {
  EndStateCompletionType,
  ReturnValue,
  StateChangeCommit,
  EmitEvent,
  getAvailableEndStateTypes
} from './endStates';

/**
 * State-space class category for UI organization
 */
export type StateSpaceCategory =
  | 'Control Flow'
  | 'Conditionals'
  | 'Loops'
  | 'Data'
  | 'Debug'
  | 'Custom'
  | 'Frontend'
  | 'Cross-Runtime';

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
/**
 * Configuration for a conditional output slot
 */
export interface ConditionalSlotConfig {
  // Human-readable label for the condition (e.g., "If True", "If False", "Default")
  conditionLabel: string;
  // The condition expression that triggers this output (e.g., "true", "false", "x > 5")
  conditionExpression: string;
  // Group ID for exclusive conditional outputs (only one in a group fires)
  conditionalGroup: string;
  // Default color for this conditional output
  color?: string;
}

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
  // Configuration for conditional output slots (for ConditionalChain, etc.)
  // If provided, the output slots are marked as conditional
  conditionalOutputs?: ConditionalSlotConfig[];
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

  // Special state type - for InitialState and ReturnStatement
  specialStateType?: 'initial' | 'end' | 'solution';

  // For initial states: identifies the trigger type subclass
  initialStateSubtype?: InitialStateTriggerType;

  // For end states: identifies the completion type subclass
  endStateSubtype?: EndStateCompletionType;

  // For solution-based definitions, the source solution name
  sourceSolutionName?: string;

  // Supported runtimes - omitted means universal (available in both runtimes)
  supportedRuntimes?: TargetRuntime[];

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
    // === Typed Initial States ===
    // Each defines HOW a solution is triggered. They are exclusively entry points.

    this.registerClass({
      className: 'DirectInvocation',
      displayName: 'Direct Invocation',
      description: 'Generic function-call entry point - defines input parameters',
      category: 'Control Flow',
      icon: 'play_circle',
      color: '#4CAF50',
      isStateSpaceObject: true,
      stateSpaceDisplayFields: ['displayName', 'description'],
      stateSpaceFieldsPerRow: 1,
      isBuiltIn: true,
      specialStateType: 'initial',
      initialStateSubtype: 'direct_invocation',
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
        { name: 'description', displayName: 'Description', type: 'string', isEditable: true, defaultValue: 'Solution entry point' },
        { name: 'inputParams', displayName: 'Input Parameters', type: 'array', isEditable: true, defaultValue: [] }
      ],
      factory: () => new DirectInvocation()
    });

    this.registerClass({
      className: 'FormSubscription',
      displayName: 'Form Subscription',
      description: 'Triggered by a form/page observable - reactive frontend entry point',
      category: 'Control Flow',
      icon: 'sensors',
      color: '#E91E63',
      isStateSpaceObject: true,
      stateSpaceDisplayFields: ['displayName', 'sourceName'],
      stateSpaceFieldsPerRow: 1,
      isBuiltIn: true,
      specialStateType: 'initial',
      initialStateSubtype: 'form_subscription',
      supportedRuntimes: ['typescript_frontend'],
      eventMethods: [
        {
          methodName: 'subscribe',
          displayName: 'Subscribe',
          description: 'Subscribe to the form/page observable',
          category: 'Control Flow',
          inputParams: [
            { name: 'source', displayName: 'Source Observable', type: 'Observable', isRequired: true }
          ],
          output: { type: 'Subscription', displayName: 'Subscription' }
        }
      ],
      variables: [
        { name: 'displayName', displayName: 'Display Name', type: 'string', isEditable: true, defaultValue: 'Form Subscription' },
        { name: 'sourceName', displayName: 'Source Name', type: 'string', isEditable: true, defaultValue: '' },
        { name: 'description', displayName: 'Description', type: 'string', isEditable: true, defaultValue: '' }
      ],
      factory: () => new FormSubscription()
    });

    this.registerClass({
      className: 'LogicFlowEntry',
      displayName: 'Logic Flow Entry',
      description: 'Invoked by a parent solution - child solution entry point',
      category: 'Control Flow',
      icon: 'account_tree',
      color: '#673AB7',
      isStateSpaceObject: true,
      stateSpaceDisplayFields: ['displayName', 'parentSolutionName'],
      stateSpaceFieldsPerRow: 1,
      isBuiltIn: true,
      specialStateType: 'initial',
      initialStateSubtype: 'logic_flow_entry',
      eventMethods: [
        {
          methodName: 'start',
          displayName: 'Start Execution',
          description: 'Begin execution from parent solution invocation',
          category: 'Control Flow',
          inputParams: [
            { name: 'parentContext', displayName: 'Parent Context', type: 'object', isRequired: false }
          ],
          output: { type: 'object', displayName: 'Initial Context' }
        }
      ],
      variables: [
        { name: 'displayName', displayName: 'Display Name', type: 'string', isEditable: true, defaultValue: 'Logic Flow Entry' },
        { name: 'parentSolutionName', displayName: 'Parent Solution', type: 'string', isEditable: true, defaultValue: '' },
        { name: 'description', displayName: 'Description', type: 'string', isEditable: true, defaultValue: '' }
      ],
      factory: () => new LogicFlowEntry()
    });

    this.registerClass({
      className: 'BackendStateChange',
      displayName: 'Backend State Change',
      description: 'Triggered by database state changes being committed',
      category: 'Control Flow',
      icon: 'storage',
      color: '#FF9800',
      isStateSpaceObject: true,
      stateSpaceDisplayFields: ['displayName', 'modelName', 'changeType'],
      stateSpaceFieldsPerRow: 2,
      isBuiltIn: true,
      specialStateType: 'initial',
      initialStateSubtype: 'backend_state_change',
      supportedRuntimes: ['python_backend'],
      eventMethods: [
        {
          methodName: 'onStateChange',
          displayName: 'On State Change',
          description: 'Triggered when database state changes are committed',
          category: 'Control Flow',
          inputParams: [
            { name: 'changeData', displayName: 'Change Data', type: 'object', isRequired: true }
          ],
          output: { type: 'object', displayName: 'Change Context' }
        }
      ],
      variables: [
        { name: 'displayName', displayName: 'Display Name', type: 'string', isEditable: true, defaultValue: 'Backend State Change' },
        { name: 'modelName', displayName: 'Model Name', type: 'string', isEditable: true, defaultValue: '' },
        { name: 'fieldName', displayName: 'Field Name', type: 'string', isEditable: true, defaultValue: '' },
        { name: 'changeType', displayName: 'Change Type', type: 'string', isEditable: true, defaultValue: 'any' },
        { name: 'description', displayName: 'Description', type: 'string', isEditable: true, defaultValue: '' }
      ],
      factory: () => new BackendStateChange()
    });

    // Legacy alias: old solutions with stateClass='InitialState' deserialize as DirectInvocation
    this.registerClass({
      className: 'InitialState',
      displayName: 'Initial State',
      description: 'Legacy initial state - maps to DirectInvocation',
      category: 'Control Flow',
      icon: 'play_circle',
      color: '#4CAF50',
      isStateSpaceObject: true,
      stateSpaceDisplayFields: ['displayName', 'description'],
      stateSpaceFieldsPerRow: 1,
      isBuiltIn: true,
      specialStateType: 'initial',
      initialStateSubtype: 'direct_invocation',
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
        { name: 'description', displayName: 'Description', type: 'string', isEditable: true, defaultValue: 'Solution entry point' },
        { name: 'inputParams', displayName: 'Input Parameters', type: 'array', isEditable: true, defaultValue: [] }
      ],
      factory: () => new DirectInvocation()
    });

    // Note: EndState has been deprecated in favor of ReturnStatement
    // ReturnStatement now serves as the solution termination point with specialStateType: 'end'

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
        defaultOutputCount: 2,
        allowDynamicInputs: true,
        allowDynamicOutputs: false,
        maxInputSlots: 0, // unlimited
        maxOutputSlots: 2, // two conditional outputs (true/false)
        inputType: 'any',
        outputType: 'boolean',
        inputLabels: ['Input'],
        outputLabels: ['T', 'F'],
        conditionalOutputs: [
          {
            conditionLabel: 'If True',
            conditionExpression: 'true',
            conditionalGroup: 'conditional_result',
            color: '#4caf50' // green for true
          },
          {
            conditionLabel: 'If False',
            conditionExpression: 'false',
            conditionalGroup: 'conditional_result',
            color: '#f44336' // red for false
          }
        ]
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
      className: 'MathOperation',
      displayName: 'Math Operation',
      description: 'Perform basic math operations: add, subtract, multiply, divide, modulo',
      category: 'Data',
      icon: 'calculate',
      color: '#2196F3',
      isStateSpaceObject: true,
      stateSpaceDisplayFields: ['displayName', 'operationType'],
      stateSpaceFieldsPerRow: 2,
      isBuiltIn: true,
      slotConfiguration: {
        defaultInputCount: 1,
        defaultOutputCount: 1,
        allowDynamicInputs: false,
        allowDynamicOutputs: false,
        maxInputSlots: 1,
        maxOutputSlots: 1,
        inputType: 'any',
        outputType: 'number',
        inputLabels: ['Input'],
        outputLabels: ['Result']
      },
      eventMethods: [
        {
          methodName: 'execute',
          displayName: 'Execute Operation',
          description: 'Perform the math operation',
          category: 'Data',
          inputParams: [
            { name: 'leftOperand', displayName: 'Left Operand', type: 'number', isRequired: true },
            { name: 'rightOperand', displayName: 'Right Operand', type: 'number', isRequired: true }
          ],
          output: { type: 'number', displayName: 'Result' }
        }
      ],
      variables: [
        { name: 'displayName', displayName: 'Display Name', type: 'string', isEditable: true, defaultValue: 'Math' },
        { name: 'operationType', displayName: 'Operation', type: 'string', isEditable: true, defaultValue: 'add' },
        { name: 'leftOperand', displayName: 'Left Operand', type: 'object', isEditable: true },
        { name: 'rightOperand', displayName: 'Right Operand', type: 'object', isEditable: true },
        { name: 'resultFieldPath', displayName: 'Result Field', type: 'string', isEditable: true },
        { name: 'resultVariableName', displayName: 'Result Variable', type: 'string', isEditable: true }
      ],
      factory: () => ({ type: 'MathOperation', displayName: 'Math', operationType: 'add' })
    });

    // === Data Operations (Variable & Function) ===
    this.registerClass({
      className: 'VariableAssignment',
      displayName: 'Variable Assignment',
      description: 'Assign a value to a variable (declare or update)',
      category: 'Data',
      icon: 'edit',
      color: '#9C27B0',
      isStateSpaceObject: true,
      stateSpaceDisplayFields: ['displayName', 'variableName', 'dataType'],
      stateSpaceFieldsPerRow: 2,
      isBuiltIn: true,
      slotConfiguration: {
        defaultInputCount: 1,
        defaultOutputCount: 1,
        allowDynamicInputs: false,
        allowDynamicOutputs: false,
        maxInputSlots: 1,
        maxOutputSlots: 1,
        inputType: 'any',
        outputType: 'any',
        inputLabels: ['Input'],
        outputLabels: ['Output']
      },
      eventMethods: [
        {
          methodName: 'execute',
          displayName: 'Execute Assignment',
          description: 'Assign value to variable',
          category: 'Data',
          inputParams: [
            { name: 'context', displayName: 'Context', type: 'object', isRequired: true }
          ],
          output: { type: 'object', displayName: 'Updated Context' }
        }
      ],
      variables: [
        { name: 'displayName', displayName: 'Display Name', type: 'string', isEditable: true, defaultValue: 'Assign' },
        { name: 'variableName', displayName: 'Variable Name', type: 'string', isEditable: true, defaultValue: 'variable' },
        { name: 'dataType', displayName: 'Data Type', type: 'string', isEditable: true, defaultValue: 'any' },
        { name: 'isDeclare', displayName: 'Is Declaration', type: 'boolean', isEditable: true, defaultValue: true },
        { name: 'isConst', displayName: 'Is Const', type: 'boolean', isEditable: true, defaultValue: true }
      ],
      factory: () => new VariableAssignment()
    });

    this.registerClass({
      className: 'FunctionCall',
      displayName: 'Function Call',
      description: 'Call a function and optionally store the result',
      category: 'Data',
      icon: 'functions',
      color: '#9C27B0',
      isStateSpaceObject: true,
      stateSpaceDisplayFields: ['displayName', 'functionName', 'resultVariableName'],
      stateSpaceFieldsPerRow: 2,
      isBuiltIn: true,
      slotConfiguration: {
        defaultInputCount: 1,
        defaultOutputCount: 1,
        allowDynamicInputs: true,
        allowDynamicOutputs: false,
        maxInputSlots: 0, // unlimited (for function arguments)
        maxOutputSlots: 1,
        inputType: 'any',
        outputType: 'any',
        inputLabels: ['Input'],
        outputLabels: ['Result']
      },
      eventMethods: [
        {
          methodName: 'execute',
          displayName: 'Execute Function Call',
          description: 'Call function and return result',
          category: 'Data',
          inputParams: [
            { name: 'context', displayName: 'Context', type: 'object', isRequired: true },
            { name: 'functions', displayName: 'Available Functions', type: 'object', isRequired: false }
          ],
          output: { type: 'any', displayName: 'Function Result' }
        }
      ],
      variables: [
        { name: 'displayName', displayName: 'Display Name', type: 'string', isEditable: true, defaultValue: 'Call' },
        { name: 'functionName', displayName: 'Function Name', type: 'string', isEditable: true, defaultValue: 'func' },
        { name: 'objectPath', displayName: 'Object Path', type: 'string', isEditable: true, defaultValue: '' },
        { name: 'resultVariableName', displayName: 'Result Variable', type: 'string', isEditable: true, defaultValue: 'result' }
      ],
      factory: () => new FunctionCall()
    });

    this.registerClass({
      className: 'ReturnStatement',
      displayName: 'Return',
      description: 'Return a value and exit the solution flow',
      category: 'Control Flow',
      icon: 'exit_to_app',
      color: '#F44336',
      isStateSpaceObject: true,
      stateSpaceDisplayFields: ['displayName'],
      stateSpaceFieldsPerRow: 1,
      isBuiltIn: true,
      specialStateType: 'end',  // Marks solution termination point (replaces deprecated EndState)
      endStateSubtype: 'return_value',  // Legacy alias for ReturnValue
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

    // === End State Types ===
    this.registerClass({
      className: 'ReturnValue',
      displayName: 'Return Value',
      description: 'Return a value to the caller and exit the solution',
      category: 'Control Flow',
      icon: 'exit_to_app',
      color: '#F44336',
      isStateSpaceObject: true,
      stateSpaceDisplayFields: ['displayName', 'returnValue'],
      stateSpaceFieldsPerRow: 1,
      isBuiltIn: true,
      specialStateType: 'end',
      endStateSubtype: 'return_value',
      eventMethods: [
        {
          methodName: 'execute',
          displayName: 'Return Value',
          description: 'Return value and exit flow',
          category: 'Control Flow',
          inputParams: [
            { name: 'context', displayName: 'Context', type: 'object', isRequired: true }
          ],
          output: { type: 'any', displayName: 'Return Value' }
        }
      ],
      variables: [
        { name: 'displayName', displayName: 'Display Name', type: 'string', isEditable: true, defaultValue: 'Return Value' },
        { name: 'returnValue', displayName: 'Return Value', type: 'string', isEditable: true, defaultValue: '' },
        { name: 'returnValueSource', displayName: 'Return Value Source', type: 'object', isEditable: true, defaultValue: null }
      ],
      factory: () => new ReturnValue()
    });

    this.registerClass({
      className: 'StateChangeCommit',
      displayName: 'Commit State Change',
      description: 'Commit object state changes to the backend and exit',
      category: 'Control Flow',
      icon: 'save',
      color: '#4CAF50',
      isStateSpaceObject: true,
      stateSpaceDisplayFields: ['displayName', 'targetFieldName', 'changeType'],
      stateSpaceFieldsPerRow: 2,
      isBuiltIn: true,
      specialStateType: 'end',
      endStateSubtype: 'state_change',
      supportedRuntimes: ['python_backend'],
      eventMethods: [
        {
          methodName: 'execute',
          displayName: 'Commit State',
          description: 'Commit state changes and exit flow',
          category: 'Control Flow',
          inputParams: [
            { name: 'context', displayName: 'Context', type: 'object', isRequired: true }
          ],
          output: { type: 'void', displayName: 'Committed' }
        }
      ],
      variables: [
        { name: 'displayName', displayName: 'Display Name', type: 'string', isEditable: true, defaultValue: 'Commit State Change' },
        { name: 'targetFieldName', displayName: 'Target Field', type: 'string', isEditable: true, defaultValue: '' },
        { name: 'changeType', displayName: 'Change Type', type: 'string', isEditable: true, defaultValue: 'update' }
      ],
      factory: () => new StateChangeCommit()
    });

    this.registerClass({
      className: 'EmitEvent',
      displayName: 'Emit Event',
      description: 'Emit an event for cross-solution signaling and exit',
      category: 'Control Flow',
      icon: 'send',
      color: '#E91E63',
      isStateSpaceObject: true,
      stateSpaceDisplayFields: ['displayName', 'eventName'],
      stateSpaceFieldsPerRow: 1,
      isBuiltIn: true,
      specialStateType: 'end',
      endStateSubtype: 'emit_event',
      supportedRuntimes: ['typescript_frontend'],
      eventMethods: [
        {
          methodName: 'execute',
          displayName: 'Emit Event',
          description: 'Emit event and exit flow',
          category: 'Control Flow',
          inputParams: [
            { name: 'context', displayName: 'Context', type: 'object', isRequired: true }
          ],
          output: { type: 'void', displayName: 'Event Emitted' }
        }
      ],
      variables: [
        { name: 'displayName', displayName: 'Display Name', type: 'string', isEditable: true, defaultValue: 'Emit Event' },
        { name: 'eventName', displayName: 'Event Name', type: 'string', isEditable: true, defaultValue: '' },
        { name: 'eventPayload', displayName: 'Event Payload', type: 'string', isEditable: true, defaultValue: '{}' }
      ],
      factory: () => new EmitEvent()
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

    // === Frontend Blocks (TypeScript/Reactive) ===
    // Note: StateSubscription removed - absorbed into FormSubscription initial state type

    this.registerClass({
      className: 'ReactiveTransform',
      displayName: 'Reactive Transform',
      description: 'Apply RxJS pipe operators (map, filter, switchMap, etc.)',
      category: 'Frontend',
      icon: 'transform',
      color: '#E91E63',
      isStateSpaceObject: true,
      stateSpaceDisplayFields: ['displayName', 'operator'],
      stateSpaceFieldsPerRow: 1,
      isBuiltIn: true,
      supportedRuntimes: ['typescript_frontend'],
      eventMethods: [
        {
          methodName: 'transform',
          displayName: 'Transform',
          description: 'Apply pipe operator to the stream',
          category: 'Frontend',
          inputParams: [
            { name: 'source$', displayName: 'Source Stream', type: 'Observable', isRequired: true }
          ],
          output: { type: 'Observable', displayName: 'Transformed Stream' }
        }
      ],
      variables: [
        { name: 'displayName', displayName: 'Display Name', type: 'string', isEditable: true, defaultValue: 'Transform' },
        { name: 'operator', displayName: 'Operator', type: 'string', isEditable: true, defaultValue: 'map' },
        { name: 'expression', displayName: 'Expression', type: 'string', isEditable: true, defaultValue: '' }
      ],
      factory: () => new ReactiveTransform()
    });

    // === Cross-Runtime Blocks ===
    this.registerClass({
      className: 'AwaitBackendCall',
      displayName: 'Await Backend Call',
      description: 'Call a backend Python solution and await response',
      category: 'Cross-Runtime',
      icon: 'cloud_download',
      color: '#FF5722',
      isStateSpaceObject: true,
      stateSpaceDisplayFields: ['displayName', 'targetSolutionName'],
      stateSpaceFieldsPerRow: 1,
      isBuiltIn: true,
      supportedRuntimes: ['typescript_frontend'],
      eventMethods: [
        {
          methodName: 'execute',
          displayName: 'Execute Backend Call',
          description: 'Call backend solution and await result',
          category: 'Cross-Runtime',
          inputParams: [
            { name: 'params', displayName: 'Parameters', type: 'object', isRequired: false }
          ],
          output: { type: 'any', displayName: 'Backend Response' }
        }
      ],
      variables: [
        { name: 'displayName', displayName: 'Display Name', type: 'string', isEditable: true, defaultValue: 'Await Backend' },
        { name: 'targetSolutionName', displayName: 'Target Solution', type: 'string', isEditable: true, defaultValue: '' },
        { name: 'resultVariable', displayName: 'Result Variable', type: 'string', isEditable: true, defaultValue: 'result' }
      ],
      factory: () => new AwaitBackendCall()
    });

    this.registerClass({
      className: 'EmitFrontendEvent',
      displayName: 'Emit Frontend Event',
      description: 'Emit an event from backend to trigger a frontend solution',
      category: 'Cross-Runtime',
      icon: 'cloud_upload',
      color: '#FF5722',
      isStateSpaceObject: true,
      stateSpaceDisplayFields: ['displayName', 'targetSolutionName'],
      stateSpaceFieldsPerRow: 1,
      isBuiltIn: true,
      supportedRuntimes: ['python_backend'],
      eventMethods: [
        {
          methodName: 'emit',
          displayName: 'Emit Event',
          description: 'Emit event to trigger frontend solution',
          category: 'Cross-Runtime',
          inputParams: [
            { name: 'eventData', displayName: 'Event Data', type: 'object', isRequired: false }
          ],
          output: { type: 'void', displayName: 'Event Sent' }
        }
      ],
      variables: [
        { name: 'displayName', displayName: 'Display Name', type: 'string', isEditable: true, defaultValue: 'Emit Event' },
        { name: 'targetSolutionName', displayName: 'Target Solution', type: 'string', isEditable: true, defaultValue: '' },
        { name: 'eventPayload', displayName: 'Event Payload', type: 'string', isEditable: true, defaultValue: '' }
      ],
      factory: () => ({ type: 'EmitFrontendEvent', displayName: 'Emit Event', targetSolutionName: '', eventPayload: '' })
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
   * Get classes available for a specific runtime.
   * Classes with no supportedRuntimes set are considered universal (available in both).
   */
  getClassesForRuntime(runtime: TargetRuntime): StateSpaceClassMetadata[] {
    return this.getAllClasses().filter(c =>
      !c.supportedRuntimes || c.supportedRuntimes.includes(runtime)
    );
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
   * Get special state types (InitialState, ReturnStatement)
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
   * Get all initial state type classes (excludes legacy 'InitialState' alias)
   */
  getInitialStateTypes(): StateSpaceClassMetadata[] {
    return this.getAllClasses().filter(c =>
      c.specialStateType === 'initial' && c.className !== 'InitialState'
    );
  }

  /**
   * Get initial state types available for a specific runtime
   */
  getInitialStateTypesForRuntime(runtime: TargetRuntime): StateSpaceClassMetadata[] {
    return this.getInitialStateTypes().filter(c =>
      !c.supportedRuntimes || c.supportedRuntimes.includes(runtime)
    );
  }

  /**
   * Get all end state type classes (excludes legacy 'ReturnStatement' alias)
   */
  getEndStateTypes(): StateSpaceClassMetadata[] {
    return this.getAllClasses().filter(c =>
      c.specialStateType === 'end' && c.className !== 'ReturnStatement'
    );
  }

  /**
   * Get end state types available for a specific runtime
   */
  getEndStateTypesForRuntime(runtime: TargetRuntime): StateSpaceClassMetadata[] {
    return this.getEndStateTypes().filter(c =>
      !c.supportedRuntimes || c.supportedRuntimes.includes(runtime)
    );
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

// Re-export initial state types
export {
  InitialStateTriggerType,
  DirectInvocation,
  FormSubscription,
  LogicFlowEntry,
  BackendStateChange,
  getAvailableInitialStateTypes
} from './initialStates';
