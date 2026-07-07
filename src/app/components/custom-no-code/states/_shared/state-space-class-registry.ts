// Author: Dustin Etts
// polari-platform-angular/src/app/components/custom-no-code/states/_shared/state-space-class-registry.ts

/**
 * State-Space Class Registry
 *
 * Central registry for all state-space enabled classes available in the visual programming system.
 * Provides metadata, configuration, and factory methods for creating state instances.
 *
 * This acts as a mock/frontend representation of the backend polyTypedObject registry
 * filtered to only include isStateSpaceObject=true classes.
 */

import { ConditionalChain, ConditionalChainLink, createConditionLink, createNestedConditionGroup } from '../conditionals/conditional-chain/conditional-chain.model';
import { FormValidation } from '../conditionals/form-validation/form-validation.model';
import { ConditionType, CONDITION_TYPE_OPTIONS, CONDITION_OPTIONS_BY_CATEGORY, getConditionOptionsForType } from './condition-type-options';
import { ForLoop, createSimpleForLoop, createRangeForLoop } from '../loops/for-loop/for-loop.model';
import { WhileLoop, createSimpleWhileLoop } from '../loops/while-loop/while-loop.model';
import { ForEachLoop, createForEachLoop } from '../loops/for-each-loop/for-each-loop.model';
import { VariableAssignment, createAssignment, createDeclaration } from '../variables/variable-assignment/variable-assignment.model';
import { FunctionCall, createFunctionCall } from '../variables/function-call/function-call.model';
import { SolutionInvocation, createSolutionInvocation } from '../variables/solution-invocation/solution-invocation.model';
import { ReturnStatement, createReturn } from '../end-states/return-statement/return-statement.model';
import { LogOutput, createLog } from '../debug/log-output/log-output.model';
import { BreakStatement } from '../flow-control/break-statement/break-statement.model';
import { ContinueStatement } from '../flow-control/continue-statement/continue-statement.model';
import { TargetRuntime } from '../../../../models/noCode/mock-NCS-data';
import { ReactiveTransform } from '../frontend/reactive-transform/reactive-transform.model';
import { AwaitBackendCall } from '../cross-runtime/await-backend-call/await-backend-call.model';
import {
  InitialStateTriggerType,
  getAvailableInitialStateTypes
} from './initial-state-types';
import { DirectInvocation } from '../initial-states/direct-invocation/direct-invocation.model';
import { FormSubscription } from '../initial-states/form-subscription/form-subscription.model';
import { LogicFlowEntry } from '../initial-states/logic-flow-entry/logic-flow-entry.model';
import { BackendStateChange } from '../initial-states/backend-state-change/backend-state-change.model';
import { SimulationStateStep } from '../initial-states/simulation-state-step/simulation-state-step.model';
import { InitialConditionsValidatorEntry } from '../initial-states/initial-conditions-validator/initial-conditions-validator.model';
import {
  EndStateCompletionType,
  getAvailableEndStateTypes
} from './end-state-types';
import { ReturnValue } from '../end-states/return-value/return-value.model';
import { StateChangeCommit } from '../end-states/state-change-commit/state-change-commit.model';
import { EmitEvent } from '../end-states/emit-event/emit-event.model';
import { SimStepContribution } from '../end-states/sim-step-contribution/sim-step-contribution.model';
import { SimStepNextState } from '../end-states/sim-step-next-state/sim-step-next-state.model';
import { ValidationResult } from '../end-states/validation-result/validation-result.model';

/**
 * State-space class category for UI organization
 */
export type StateSpaceCategory =
  | 'Initial States'
  | 'Conditionals'
  | 'Loops'
  | 'List Operations'
  | 'Math'
  | 'Physics/Chemistry'
  | 'Variables & Calls'
  | 'End States'
  | 'Flow Control'
  | 'Debug'
  | 'Frontend'
  | 'Cross-Runtime'
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

  // HONESTY TAG (mirrors the backend StateBuildingBlock.execution_status):
  // what actually happens when the execution engine reaches this node.
  //   'real'           — fully executes
  //   'stub'           — recognized but incomplete
  //   'authoring-only' — no engine handler yet; authorable but a no-op
  // Applied centrally from EXECUTION_STATUS_BY_CLASS in registerClass so
  // the palette can badge/dim nodes that would silently do nothing.
  executionStatus?: 'real' | 'stub' | 'authoring-only';
  executionNote?: string;

  // RUNTIME-CAPABILITY TAG (P5 — mirrors StateBuildingBlock.runtime_capability):
  // which engine(s) can actually execute this node. Applied centrally in
  // registerClass from the solution-engine capability partition, so the
  // palette and the display-solution-runner agree on where a graph runs.
  //   'client-and-backend' — both engines interpret it identically
  //   'backend-only'       — Python engine only (SymPy/numpy/DB/simulation)
  //   'authoring-only'     — no engine handler anywhere yet
  runtimeCapability?: 'client-and-backend' | 'backend-only' | 'authoring-only';
}

/**
 * Ground truth for which node classes the execution engines actually
 * execute. Anything not listed defaults to 'real'.
 * Keep in step with the Python engine's _evaluate_state handlers AND the
 * TypeScript mirror (services/no-code-services/solution-engine/) — the
 * parity vectors hold the two to the same behavior.
 */
export const EXECUTION_STATUS_BY_CLASS: {
  [className: string]: { status: 'real' | 'stub' | 'authoring-only'; note: string };
} = {
  FunctionCall: {
    status: 'authoring-only',
    note: 'Retired legacy node — it never invokes anything. Use Solution Invocation instead.',
  },
  ReactiveTransform: {
    status: 'authoring-only',
    note: 'Frontend-runtime node — arrives with the reactive-binding layer.',
  },
  AwaitBackendCall: {
    status: 'real',
    note: 'The explicit cross-runtime bridge: from a client-executing solution it '
        + 'ships one named solution to the backend engine and binds the results '
        + 'back; on the backend engine it is an in-process invocation.',
  },
};

/**
 * The runtime-capability partition (P5), mirrored from
 * services/no-code-services/solution-engine/capability.ts and from the
 * backend's StateBuildingBlock.runtime_capability tags. Anything not
 * listed here that executes ('real'/'stub') runs on BOTH engines.
 */
export const BACKEND_ONLY_RUNTIME_CLASSES = new Set<string>([
  'CalculusOperation',        // SymPy equations
  'MatrixEquationOperation',  // numpy matrix engine
  'EngineModelOperation',     // FEM/DFT model solve via materialsScience engines
  'StateChangeCommit',        // persists instances via the manager/DB
  'SimulationStateStep',      // simulation-runner entry
  'SimStepNextState',         // simulation-runner terminators
  'SimStepContribution',
  'BackendStateChange',       // backend-trust entry intent
]);

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
      category: 'Initial States',
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
      category: 'Initial States',
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
      category: 'Initial States',
      icon: 'account_tree',
      color: '#673AB7',
      isStateSpaceObject: true,
      stateSpaceDisplayFields: ['displayName'],
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
        { name: 'description', displayName: 'Description', type: 'string', isEditable: true, defaultValue: '' }
      ],
      factory: () => new LogicFlowEntry()
    });

    this.registerClass({
      className: 'BackendStateChange',
      displayName: 'Backend State Change',
      description: 'Triggered by database state changes being committed',
      category: 'Initial States',
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

    // Simulation State Step — entry point for solutions that run as one
    // timestep of a simulation. Context is pre-populated by the
    // SimulationRunner with prev-step *SimState fields + params + dt/
    // step. Backend-only (the runner is a Python orchestrator).
    this.registerClass({
      className: 'SimulationStateStep',
      displayName: 'Simulation State Step',
      description: 'Runs once per simulation timestep — reads prev-step *SimState fields + params + dt/step from context. Ends at SimStepNextState (simStepComplete / simStepComposition) or SimStepContribution (simStepPartial).',
      category: 'Initial States',
      icon: 'timeline',
      color: '#1e88e5',
      isStateSpaceObject: true,
      stateSpaceDisplayFields: ['displayName', 'simStateClassName', 'expectedFields'],
      stateSpaceFieldsPerRow: 1,
      isBuiltIn: true,
      specialStateType: 'initial',
      initialStateSubtype: 'simulation_state_step',
      supportedRuntimes: ['python_backend'],
      eventMethods: [
        {
          methodName: 'onTimestep',
          displayName: 'On Timestep',
          description: 'Invoked by SimulationRunner once per timestep with the prior step row\'s context pre-merged.',
          category: 'Simulation',
          inputParams: [
            { name: 'simStateContext', displayName: 'SimState Context', type: 'object', isRequired: true },
          ],
          output: { type: 'object', displayName: 'New Step Context' },
        },
      ],
      variables: [
        { name: 'displayName', displayName: 'Display Name', type: 'string', isEditable: true, defaultValue: 'Simulation Step' },
        { name: 'simStateClassName', displayName: 'Target *SimState class', type: 'string', isEditable: true, defaultValue: '' },
        { name: 'expectedFields', displayName: 'Expected prev-step fields', type: 'list', isEditable: true, defaultValue: [] },
        // `simStepRole` distinguishes the three step-solution variants
        // the SimulationRunner can dispatch:
        //   simStepComplete    — single solution producing the whole
        //                        next row; terminates at SimStepNextState.
        //   simStepPartial     — emits a sparse field-delta payload;
        //                        terminates at SimStepContribution.
        //   simStepComposition — combines partials into the next row;
        //                        terminates at SimStepNextState.
        // The runner refuses to dispatch a binding whose step solution
        // doesn't declare a role — the editor must always emit one.
        { name: 'simStepRole', displayName: 'Step Solution Role', type: 'string', isEditable: true, defaultValue: 'simStepComplete' },
        { name: 'description', displayName: 'Description', type: 'string', isEditable: true, defaultValue: '' },
      ],
      factory: () => new SimulationStateStep(),
    });

    // Initial Conditions Validator — entry point for solutions that
    // validate a simulation's proposed initial conditions BEFORE step 0.
    // Context at entry: `<className>.<field>` keys for each participating
    // class's merged initial values, plus `params.<key>` for the sim
    // constants and `participating_classes` for the class roster.
    // Backend-only — the SimulationRunner gates step 0 on the verdict.
    this.registerClass({
      className: 'InitialConditionsValidatorEntry',
      displayName: 'Validate Initial Conditions',
      description: 'Runs once before step 0 with the merged initial conditions in context. Terminates at a ValidationResult declaring whether the proposal is physically valid.',
      category: 'Initial States',
      icon: 'fact_check',
      color: '#26A69A',
      isStateSpaceObject: true,
      stateSpaceDisplayFields: ['displayName', 'simulationDefinitionName', 'validationSummary'],
      stateSpaceFieldsPerRow: 1,
      isBuiltIn: true,
      specialStateType: 'initial',
      initialStateSubtype: 'initial_conditions_validator',
      supportedRuntimes: ['python_backend'],
      eventMethods: [
        {
          methodName: 'validate',
          displayName: 'Validate',
          description: 'Invoked by the runner with the merged initial-conditions context pre-populated.',
          category: 'Simulation',
          inputParams: [
            { name: 'initialConditions', displayName: 'Initial Conditions', type: 'object', isRequired: true },
          ],
          output: { type: 'object', displayName: 'Validation Verdict' },
        },
      ],
      variables: [
        { name: 'displayName', displayName: 'Display Name', type: 'string', isEditable: true, defaultValue: 'Validate Initial Conditions' },
        { name: 'simulationDefinitionName', displayName: 'Target Simulation', type: 'string', isEditable: true, defaultValue: '' },
        { name: 'validationSummary', displayName: 'What this validates', type: 'string', isEditable: true, defaultValue: '' },
        { name: 'description', displayName: 'Description', type: 'string', isEditable: true, defaultValue: '' },
      ],
      factory: () => new InitialConditionsValidatorEntry(),
    });

    // Legacy alias: old solutions with stateClass='InitialState' deserialize as DirectInvocation
    this.registerClass({
      className: 'InitialState',
      displayName: 'Initial State',
      description: 'Legacy initial state - maps to DirectInvocation',
      category: 'Initial States',
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

    this.registerClass({
      className: 'FormValidation',
      displayName: 'Form Validation',
      description: 'Introspects a form\'s fields and generates one output slot per field for individual validation logic. Specific to FormSubscription flows.',
      category: 'Conditionals',
      icon: 'checklist',
      color: '#00BCD4',
      isStateSpaceObject: true,
      stateSpaceDisplayFields: ['displayName'],
      stateSpaceFieldsPerRow: 1,
      isBuiltIn: true,
      supportedRuntimes: ['typescript_frontend'],
      slotConfiguration: {
        defaultInputCount: 1,
        defaultOutputCount: 1,
        allowDynamicInputs: false,
        allowDynamicOutputs: true, // output slots are dynamically generated per form field
        maxInputSlots: 1,
        maxOutputSlots: 0, // unlimited — one per field + allValid
        inputType: 'object',
        outputType: 'any',
        inputLabels: ['formData'],
        outputLabels: ['All Valid'],
      },
      eventMethods: [
        {
          methodName: 'validate',
          displayName: 'Validate Fields',
          description: 'Route each form field value to its own validation output slot with debounce and per-field validity tracking',
          category: 'Conditionals',
          inputParams: [
            { name: 'formData', displayName: 'Form Data', type: 'object', isRequired: true }
          ],
          output: { type: 'boolean', displayName: 'All Valid' }
        }
      ],
      variables: [
        { name: 'displayName', displayName: 'Display Name', type: 'string', isEditable: true, defaultValue: 'Validate Form Fields' },
        { name: 'description', displayName: 'Description', type: 'string', isEditable: true, defaultValue: 'Route each form field to its own validation logic' },
        { name: 'fields', displayName: 'Validation Fields', type: 'array', isEditable: false }
      ],
      factory: () => new FormValidation()
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
      // Engine loop convention: output slot 0 = Body (the loop's
      // iteration path; it may simply end — execution auto-returns to
      // the loop), output slot 1 = Done (taken when the loop finishes).
      slotConfiguration: {
        defaultInputCount: 1,
        defaultOutputCount: 2,
        allowDynamicInputs: false,
        allowDynamicOutputs: false,
        maxInputSlots: 1,
        maxOutputSlots: 2,
        inputType: 'any',
        outputType: 'any',
        inputLabels: ['Input'],
        outputLabels: ['Body', 'Done'],
      },
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
      // Engine loop convention: output slot 0 = Body (the loop's
      // iteration path; it may simply end — execution auto-returns to
      // the loop), output slot 1 = Done (taken when the loop finishes).
      slotConfiguration: {
        defaultInputCount: 1,
        defaultOutputCount: 2,
        allowDynamicInputs: false,
        allowDynamicOutputs: false,
        maxInputSlots: 1,
        maxOutputSlots: 2,
        inputType: 'any',
        outputType: 'any',
        inputLabels: ['Input'],
        outputLabels: ['Body', 'Done'],
      },
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
      // Engine loop convention: output slot 0 = Body (the loop's
      // iteration path; it may simply end — execution auto-returns to
      // the loop), output slot 1 = Done (taken when the loop finishes).
      slotConfiguration: {
        defaultInputCount: 1,
        defaultOutputCount: 2,
        allowDynamicInputs: false,
        allowDynamicOutputs: false,
        maxInputSlots: 1,
        maxOutputSlots: 2,
        inputType: 'any',
        outputType: 'any',
        inputLabels: ['Input'],
        outputLabels: ['Body', 'Done'],
      },
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
      category: 'List Operations',
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
      category: 'List Operations',
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
      category: 'List Operations',
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
      category: 'Math',
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

    // === Calculus Operation: hosts an EquationDefinition inside a state-space ===
    this.registerClass({
      className: 'CalculusOperation',
      displayName: 'Calculus Operation',
      description: 'Execute a saved equation; per-symbol potentials are filled by sources from the state-space.',
      category: 'Math',
      icon: 'functions',
      color: '#FFB74D',
      isStateSpaceObject: true,
      supportedRuntimes: ['python_backend'],
      stateSpaceDisplayFields: ['displayName', 'equationName'],
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
        outputLabels: ['Result']
      },
      eventMethods: [
        {
          methodName: 'execute',
          displayName: 'Run Calculus Operation',
          description: 'Resolve declared potentials, call the executor, return the result.',
          category: 'Math',
          inputParams: [],
          output: { type: 'any', displayName: 'Result' }
        }
      ],
      variables: [
        { name: 'displayName', displayName: 'Display Name', type: 'string', isEditable: true, defaultValue: 'Calculus Operation' },
        { name: 'equationId', displayName: 'Equation ID', type: 'string', isEditable: true },
        { name: 'equationName', displayName: 'Equation Name', type: 'string', isEditable: true },
        { name: 'bindings', displayName: 'Bindings', type: 'object', isEditable: true },
        { name: 'resultTarget', displayName: 'Result Target', type: 'string', isEditable: true, defaultValue: 'result_variable' },
        { name: 'resultVariableName', displayName: 'Result Variable', type: 'string', isEditable: true, defaultValue: 'result' },
        { name: 'resultFieldPath', displayName: 'Result Field', type: 'string', isEditable: true }
      ],
      factory: () => ({ type: 'CalculusOperation', displayName: 'Calculus Operation', equationId: '', equationName: '', bindings: [], resultTarget: 'result_variable', resultVariableName: 'result', resultFieldPath: '' })
    });

    // === Matrix Equation Operation: hosts a MatrixEquationDefinition inside a
    //     state-space. Operand symbols are bound to RUNTIME context sources
    //     (sim fields, upstream vars, assembled vectors via the `array` source
    //     kind) rather than stored matrices. Sibling of CalculusOperation. ===
    this.registerClass({
      className: 'MatrixEquationOperation',
      displayName: 'Matrix Equation Operation',
      description: 'Execute a saved matrix/vector equation; operand symbols are bound to runtime context sources (sim fields, upstream variables, assembled vectors).',
      category: 'Math',
      icon: 'view_module',
      color: '#81C784',
      isStateSpaceObject: true,
      supportedRuntimes: ['python_backend'],
      stateSpaceDisplayFields: ['displayName', 'matrixEquationName'],
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
        outputLabels: ['Result']
      },
      eventMethods: [
        {
          methodName: 'execute',
          displayName: 'Run Matrix Equation Operation',
          description: 'Resolve operand sources, evaluate the matrix equation, return the result.',
          category: 'Math',
          inputParams: [],
          output: { type: 'any', displayName: 'Result' }
        }
      ],
      variables: [
        { name: 'displayName', displayName: 'Display Name', type: 'string', isEditable: true, defaultValue: 'Matrix Equation Operation' },
        { name: 'matrixEquationName', displayName: 'Matrix Equation Name', type: 'string', isEditable: true },
        { name: 'operandBindings', displayName: 'Operand Bindings', type: 'object', isEditable: true },
        { name: 'resultTarget', displayName: 'Result Target', type: 'string', isEditable: true, defaultValue: 'result_variable' },
        { name: 'resultVariableName', displayName: 'Result Variable', type: 'string', isEditable: true, defaultValue: 'result' },
        { name: 'resultFieldPath', displayName: 'Result Field', type: 'string', isEditable: true }
      ],
      factory: () => ({ type: 'MatrixEquationOperation', displayName: 'Matrix Equation Operation', matrixEquationName: '', operandBindings: [], resultTarget: 'result_variable', resultVariableName: 'result', resultFieldPath: '' })
    });

    // === Engine Model Operation: runs a configured FEM/DFT model definition
    //     (a real engine solve via materialsScience) and writes its outputs
    //     into the solution context as model.<key> plus any mapped variables.
    //     Backend-only runtime. Sibling of MatrixEquationOperation: input
    //     symbols ('<stage>.<key>' stageDerived binding keys) are bound to
    //     runtime context sources via the same ValueSourceConfig shape. ===
    this.registerClass({
      className: 'EngineModelOperation',
      displayName: 'Engine Model (FEM/DFT)',
      description: 'Runs a configured FEM/DFT model definition (a real engine solve via materialsScience) and writes its outputs into the solution context as model.<key> plus any mapped variables. Backend-only runtime.',
      category: 'Physics/Chemistry',
      icon: 'science',
      color: '#7986CB',
      isStateSpaceObject: true,
      supportedRuntimes: ['python_backend'],
      stateSpaceDisplayFields: ['displayName', 'modelRef'],
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
        outputLabels: ['Result']
      },
      eventMethods: [
        {
          methodName: 'execute',
          displayName: 'Run Engine Model',
          description: 'Resolve input bindings, run the FEM/DFT engine solve, map result keys into the context.',
          category: 'Physics/Chemistry',
          inputParams: [],
          output: { type: 'any', displayName: 'Result' }
        }
      ],
      variables: [
        { name: 'displayName', displayName: 'Display Name', type: 'string', isEditable: true, defaultValue: 'Engine Model (FEM/DFT)' },
        { name: 'modelRef', displayName: 'Model Definition', type: 'string', isEditable: true },
        { name: 'inputBindings', displayName: 'Input Bindings', type: 'object', isEditable: true },
        { name: 'resultKeyMap', displayName: 'Result Key Map', type: 'object', isEditable: true },
        { name: 'resultTarget', displayName: 'Result Target', type: 'string', isEditable: true, defaultValue: 'result_variable' },
        { name: 'resultVariableName', displayName: 'Result Variable', type: 'string', isEditable: true, defaultValue: 'model_result' },
        { name: 'resultFieldPath', displayName: 'Result Field', type: 'string', isEditable: true }
      ],
      factory: () => ({ type: 'EngineModelOperation', displayName: 'Engine Model (FEM/DFT)', modelRef: '', inputBindings: [], resultKeyMap: [], resultTarget: 'result_variable', resultVariableName: 'model_result', resultFieldPath: '' })
    });

    // === Data Operations (Variable & Function) ===
    this.registerClass({
      // className stays 'VariableAssignment' on the wire so existing
      // saved solutions still resolve — only the display label moves.
      // The new label reads more honestly: in practice almost every
      // "assignment" is a value-source binding (LaTeX expression,
      // upstream variable, object field), not a literal — so the node
      // is functionally a "create a new variable holding this value".
      className: 'VariableAssignment',
      displayName: 'Variable Creation',
      description: 'Create a new variable holding the value of a configured value source (literal, LaTeX expression, upstream input, object field, or dataset).',
      category: 'Variables & Calls',
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
      className: 'SolutionInvocation',
      displayName: 'Solution Invocation',
      description: 'Run another solution as a single reusable step: map inputs '
                 + 'from this context, run it in isolation, bind its outputs '
                 + 'back. Its contract is the whole interface — internals stay '
                 + 'its own. Recursion allowed (depth-guarded).',
      category: 'Variables & Calls',
      icon: 'account_tree',
      color: '#3F51B5',
      isStateSpaceObject: true,
      stateSpaceDisplayFields: ['displayName', 'solutionRef'],
      stateSpaceFieldsPerRow: 1,
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
        inputLabels: ['In'],
        outputLabels: ['Out']
      },
      eventMethods: [
        {
          methodName: 'invoke',
          displayName: 'Invoke Solution',
          description: 'Run the referenced solution with mapped inputs and bind its outputs',
          category: 'Control Flow',
          inputParams: [
            { name: 'inputMappings', displayName: 'Input Mappings', type: 'array', isRequired: false }
          ],
          output: { type: 'object', displayName: 'Bound Outputs' }
        }
      ],
      variables: [
        { name: 'displayName', displayName: 'Display Name', type: 'string', isEditable: true, defaultValue: 'Invoke Solution' },
        { name: 'solutionRef', displayName: 'Solution', type: 'string', isEditable: true, defaultValue: '' }
      ],
      factory: () => new SolutionInvocation()
    });

    this.registerClass({
      className: 'FunctionCall',
      displayName: 'Function Call',
      description: 'Call a function and optionally store the result',
      category: 'Variables & Calls',
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
      category: 'End States',
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
      category: 'End States',
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
      category: 'End States',
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
      category: 'End States',
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

    // SimStepNextState — terminator for `simStepComplete` and
    // `simStepComposition` SimulationStateStep solutions. Declares the
    // new *SimState row's field values that the SimulationRunner
    // projects onto a fresh row. NOT a general-purpose end state —
    // only valid inside a SimulationStateStep solution.
    this.registerClass({
      className: 'SimStepNextState',
      displayName: 'Sim Step Next State',
      description: 'Declares the next-step *SimState row produced by a simStepComplete or simStepComposition step solution.',
      category: 'End States',
      icon: 'last_page',
      color: '#42A5F5',
      isStateSpaceObject: true,
      stateSpaceDisplayFields: ['displayName', 'simStateClassName'],
      stateSpaceFieldsPerRow: 1,
      isBuiltIn: true,
      specialStateType: 'end',
      endStateSubtype: 'sim_step_next_state',
      supportedRuntimes: ['python_backend'],
      eventMethods: [
        {
          methodName: 'execute',
          displayName: 'Commit Next Row',
          description: 'Write the next-step *SimState row fields to context and exit.',
          category: 'Simulation',
          inputParams: [
            { name: 'context', displayName: 'Context', type: 'object', isRequired: true }
          ],
          output: { type: 'object', displayName: 'Next *SimState row' }
        }
      ],
      variables: [
        { name: 'displayName', displayName: 'Display Name', type: 'string', isEditable: true, defaultValue: 'Sim Step Next State' },
        { name: 'simStateClassName', displayName: 'Target *SimState class', type: 'string', isEditable: true, defaultValue: '' },
        { name: 'outputMappings', displayName: 'Field Values', type: 'list', isEditable: true, defaultValue: [] },
        { name: 'description', displayName: 'Description', type: 'string', isEditable: true, defaultValue: '' }
      ],
      factory: () => new SimStepNextState()
    });

    // SimStepContribution — terminator for `simStepPartial`
    // SimulationStateStep solutions. Emits a sparse {field → {value, op}}
    // payload onto the engine's `_step_contributions` list; the
    // SimulationRunner harvests it and either additively merges or
    // routes to a `simStepComposition` solution. NOT a general-purpose
    // end state — only valid inside a SimulationStateStep solution with
    // simStepRole='simStepPartial'.
    this.registerClass({
      className: 'SimStepContribution',
      displayName: 'Sim Step Contribution',
      description: 'Partial step terminator — emits sparse field deltas with per-field op (set/add/mul/min/max) for SimulationRunner aggregation.',
      category: 'End States',
      icon: 'merge_type',
      color: '#FF7043',
      isStateSpaceObject: true,
      stateSpaceDisplayFields: ['displayName', 'simStateClassName'],
      stateSpaceFieldsPerRow: 1,
      isBuiltIn: true,
      specialStateType: 'end',
      endStateSubtype: 'sim_step_contribution',
      supportedRuntimes: ['python_backend'],
      eventMethods: [
        {
          methodName: 'execute',
          displayName: 'Emit Contribution',
          description: 'Append a SimStepContribution payload to the trace and exit.',
          category: 'Simulation',
          inputParams: [
            { name: 'context', displayName: 'Context', type: 'object', isRequired: true }
          ],
          output: { type: 'object', displayName: 'Step Contribution' }
        }
      ],
      variables: [
        { name: 'displayName', displayName: 'Display Name', type: 'string', isEditable: true, defaultValue: 'Sim Step Contribution' },
        { name: 'simStateClassName', displayName: 'Target *SimState class', type: 'string', isEditable: true, defaultValue: '' },
        { name: 'outputMappings', displayName: 'Field Deltas', type: 'list', isEditable: true, defaultValue: [] },
        { name: 'description', displayName: 'Description', type: 'string', isEditable: true, defaultValue: '' }
      ],
      factory: () => new SimStepContribution()
    });

    // ValidationResult — terminator for InitialConditionsValidator
    // solutions. Declares whether the proposed initial conditions are
    // physically valid, the human-readable reason on failure, and an
    // optional dict of values to overwrite into step 0 (e.g. recompute
    // tension from theta). The runner reads `outcome`, `reason`, and
    // `repairedValues` off the final context.
    this.registerClass({
      className: 'ValidationResult',
      displayName: 'Validation Result',
      description: 'Verdict from an InitialConditionsValidator — outcome (valid|invalid), reason, and optional repaired values.',
      category: 'End States',
      icon: 'rule',
      color: '#26A69A',
      isStateSpaceObject: true,
      stateSpaceDisplayFields: ['displayName'],
      stateSpaceFieldsPerRow: 1,
      isBuiltIn: true,
      specialStateType: 'end',
      endStateSubtype: 'validation_result',
      supportedRuntimes: ['python_backend'],
      eventMethods: [
        {
          methodName: 'execute',
          displayName: 'Emit Verdict',
          description: 'Write outcome / reason / repairedValues to context and exit.',
          category: 'Simulation',
          inputParams: [
            { name: 'context', displayName: 'Context', type: 'object', isRequired: true }
          ],
          output: { type: 'object', displayName: 'Validation Verdict' }
        }
      ],
      variables: [
        { name: 'displayName', displayName: 'Display Name', type: 'string', isEditable: true, defaultValue: 'Validation Result' },
        { name: 'outputMappings', displayName: 'Verdict Bindings', type: 'list', isEditable: true, defaultValue: [] },
        { name: 'description', displayName: 'Description', type: 'string', isEditable: true, defaultValue: '' }
      ],
      factory: () => new ValidationResult()
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
      category: 'Flow Control',
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
      category: 'Flow Control',
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
    // Apply the central honesty tag unless the entry declares its own.
    if (!metadata.executionStatus) {
      const known = EXECUTION_STATUS_BY_CLASS[metadata.className];
      metadata.executionStatus = known?.status ?? 'real';
      if (known?.note) {
        metadata.executionNote = known.note;
      }
    }
    // Apply the central runtime-capability tag unless declared.
    if (!metadata.runtimeCapability) {
      if (metadata.executionStatus === 'authoring-only') {
        metadata.runtimeCapability = 'authoring-only';
      } else if (BACKEND_ONLY_RUNTIME_CLASSES.has(metadata.className)) {
        metadata.runtimeCapability = 'backend-only';
      } else {
        metadata.runtimeCapability = 'client-and-backend';
      }
    }
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
  FormValidation,
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
  SolutionInvocation,
  createSolutionInvocation,
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
  getAvailableInitialStateTypes
} from './initial-state-types';

export {
  DirectInvocation,
  FormSubscription,
  LogicFlowEntry,
  BackendStateChange
};
