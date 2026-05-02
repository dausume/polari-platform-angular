// Author: Dustin Etts
// polari-platform-angular/src/app/models/stateSpace/index.ts

/**
 * State-Space Models Index
 *
 * Central export for all state-space related models, classes, and utilities.
 *
 * NOTE: After the per-state colocation refactor, the actual implementations live under
 * `src/app/components/custom-no-code/states/...`. This barrel preserves the old import
 * surface (`@models/stateSpace`) so existing import sites keep working.
 */

// Condition Types and Options
export {
  ConditionOperator,
  ConditionType,
  ConditionTypeOption,
  CONDITION_TYPE_OPTIONS,
  CONDITION_OPTIONS_BY_CATEGORY,
  LOGICAL_OPERATORS,
  getConditionOptionsForType,
  getConditionOption
} from '../../components/custom-no-code/states/_shared/condition-type-options';

// Value Source Config (shared by ConditionalChain, ValueSourceSelector, etc.)
export {
  LogicalOperator,
  EvaluationMode,
  ValueSourceType,
  ValueSourceConfig,
  createDefaultValueSourceConfig,
  getSourceLabel
} from '../../components/custom-no-code/states/_shared/value-source-config';

// Conditional Chain
export {
  ConditionalChainLink,
  ConditionalChain,
  createConditionLink,
  createConditionLinkWithSources,
  createNestedConditionGroup
} from '../../components/custom-no-code/states/conditionals/conditional-chain/conditional-chain.model';

// Loop States
export {
  LoopStateBase,
  LoopExecutionResult,
  parseLoopFromJSON
} from '../../components/custom-no-code/states/_shared/loop-state-base';

export {
  ForLoop,
  createSimpleForLoop,
  createRangeForLoop,
  isForLoop
} from '../../components/custom-no-code/states/loops/for-loop/for-loop.model';

export {
  WhileLoop,
  createSimpleWhileLoop,
  isWhileLoop
} from '../../components/custom-no-code/states/loops/while-loop/while-loop.model';

export {
  ForEachLoop,
  createForEachLoop,
  isForEachLoop
} from '../../components/custom-no-code/states/loops/for-each-loop/for-each-loop.model';

// Operation States
export {
  VariableDataType,
  OperationStateBase,
  ValueSource,
  parseOperationFromJSON
} from '../../components/custom-no-code/states/_shared/operation-state-base';

export {
  VariableAssignment,
  createAssignment,
  createDeclaration,
  isVariableAssignment
} from '../../components/custom-no-code/states/variables/variable-assignment/variable-assignment.model';

export {
  FunctionCall,
  createFunctionCall,
  isFunctionCall
} from '../../components/custom-no-code/states/variables/function-call/function-call.model';

export {
  ReturnStatement,
  createReturn,
  isReturnStatement
} from '../../components/custom-no-code/states/end-states/return-statement/return-statement.model';

export {
  LogOutput,
  LogOutputValueSourceType,
  LogOutputVariable,
  createLog,
  isLogOutput
} from '../../components/custom-no-code/states/debug/log-output/log-output.model';

export {
  BreakStatement,
  isBreakStatement
} from '../../components/custom-no-code/states/flow-control/break-statement/break-statement.model';

export {
  ContinueStatement,
  isContinueStatement
} from '../../components/custom-no-code/states/flow-control/continue-statement/continue-statement.model';

// Form Validation
export {
  FormValidation,
  FormValidationField
} from '../../components/custom-no-code/states/conditionals/form-validation/form-validation.model';

// Frontend States
export { ReactiveTransform } from '../../components/custom-no-code/states/frontend/reactive-transform/reactive-transform.model';
export { AwaitBackendCall } from '../../components/custom-no-code/states/cross-runtime/await-backend-call/await-backend-call.model';

// Initial States (Typed Entry Points)
export {
  InitialStateTriggerType,
  getAvailableInitialStateTypes
} from '../../components/custom-no-code/states/_shared/initial-state-types';

export { DirectInvocation } from '../../components/custom-no-code/states/initial-states/direct-invocation/direct-invocation.model';
export { FormSubscription } from '../../components/custom-no-code/states/initial-states/form-subscription/form-subscription.model';
export { LogicFlowEntry } from '../../components/custom-no-code/states/initial-states/logic-flow-entry/logic-flow-entry.model';
export {
  BackendStateChange,
  BackendChangeType
} from '../../components/custom-no-code/states/initial-states/backend-state-change/backend-state-change.model';

// End States (Typed Exit Points)
export {
  EndStateCompletionType,
  getAvailableEndStateTypes
} from '../../components/custom-no-code/states/_shared/end-state-types';

export { ReturnValue } from '../../components/custom-no-code/states/end-states/return-value/return-value.model';
export { StateChangeCommit } from '../../components/custom-no-code/states/end-states/state-change-commit/state-change-commit.model';
export { EmitEvent } from '../../components/custom-no-code/states/end-states/emit-event/emit-event.model';

// Solution Context
export {
  CONTROL_FLOW_STATE_TYPES,
  BranchPoint,
  PotentialVariable,
  PotentialObjectType,
  PotentialObjectField,
  PotentialContext,
  InstanceVariable,
  InstanceObject,
  InstanceContext
} from '../../components/custom-no-code/states/_shared/solution-context';

// State-Space Class Registry
export {
  StateSpaceCategory,
  StateSpaceEventMethod,
  StateSpaceClassMetadata,
  StateSpaceClassRegistry,
  ConditionalSlotConfig,
  SlotConfigurationTemplate,
  getStateSpaceRegistry,
  getAvailableStateSpaceClasses,
  getStateSpaceClassMetadata,
  createStateSpaceInstance,
  getStateSpaceClassesByCategory
} from '../../components/custom-no-code/states/_shared/state-space-class-registry';
