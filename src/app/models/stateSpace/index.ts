// Author: Dustin Etts
// polari-platform-angular/src/app/models/stateSpace/index.ts

/**
 * State-Space Models Index
 *
 * Central export for all state-space related models, classes, and utilities.
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
} from './conditionTypeOptions';

// Conditional Chain
export {
  LogicalOperator,
  EvaluationMode,
  ConditionalChainLink,
  ConditionalChain,
  createConditionLink,
  createNestedConditionGroup
} from './conditionalChain';

// Loop States
export {
  LoopStateBase,
  LoopExecutionResult,
  ForLoop,
  WhileLoop,
  ForEachLoop,
  createSimpleForLoop,
  createRangeForLoop,
  createSimpleWhileLoop,
  createForEachLoop,
  isForLoop,
  isWhileLoop,
  isForEachLoop,
  parseLoopFromJSON
} from './loopStates';

// Operation States
export {
  VariableDataType,
  OperationStateBase,
  ValueSource,
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
  createLog,
  isVariableAssignment,
  isFunctionCall,
  isReturnStatement,
  isLogOutput,
  isBreakStatement,
  isContinueStatement,
  parseOperationFromJSON
} from './operationStates';

// State-Space Class Registry
export {
  StateSpaceCategory,
  StateSpaceEventMethod,
  StateSpaceClassMetadata,
  StateSpaceClassRegistry,
  getStateSpaceRegistry,
  getAvailableStateSpaceClasses,
  getStateSpaceClassMetadata,
  createStateSpaceInstance,
  getStateSpaceClassesByCategory
} from './stateSpaceClassRegistry';
