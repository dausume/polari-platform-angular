// Author: Dustin Etts
// polari-platform-angular/src/app/models/stateSpace/initialStates.ts
// Typed initial state classes for state-space solutions.
// Each class defines HOW a solution is triggered (its entry point type).

import { TargetRuntime } from '../noCode/mock-NCS-data';

/**
 * Trigger type identifier for initial states.
 * Determines how a solution is initialized.
 */
export type InitialStateTriggerType =
  | 'direct_invocation'
  | 'form_subscription'
  | 'logic_flow_entry'
  | 'backend_state_change';

/**
 * DirectInvocation — Generic function-call entry point.
 * Replaces the old generic InitialState. Available in both runtimes.
 */
export class DirectInvocation {
  type = 'DirectInvocation';
  triggerType: InitialStateTriggerType = 'direct_invocation';
  displayName: string;
  description: string;
  inputParams: { name: string; type: string; description?: string }[];

  constructor(
    displayName: string = 'Start',
    description: string = 'Solution entry point',
    inputParams: { name: string; type: string; description?: string }[] = []
  ) {
    this.displayName = displayName;
    this.description = description;
    this.inputParams = inputParams;
  }
}

/**
 * FormSubscription — Triggered by a form/page observable.
 * Absorbs the logic of the old StateSubscription class.
 * TypeScript frontend only.
 */
export class FormSubscription {
  type = 'FormSubscription';
  triggerType: InitialStateTriggerType = 'form_subscription';
  displayName: string;
  sourceName: string;
  description: string;

  constructor(
    displayName: string = 'Form Subscription',
    sourceName: string = '',
    description: string = 'Triggered by form/page observable'
  ) {
    this.displayName = displayName;
    this.sourceName = sourceName;
    this.description = description;
  }
}

/**
 * LogicFlowEntry — Invoked by a parent solution.
 * Available in both runtimes.
 */
export class LogicFlowEntry {
  type = 'LogicFlowEntry';
  triggerType: InitialStateTriggerType = 'logic_flow_entry';
  displayName: string;
  parentSolutionName: string;
  description: string;

  constructor(
    displayName: string = 'Logic Flow Entry',
    parentSolutionName: string = '',
    description: string = 'Invoked by a parent solution'
  ) {
    this.displayName = displayName;
    this.parentSolutionName = parentSolutionName;
    this.description = description;
  }
}

/**
 * Change type for backend state change triggers.
 */
export type BackendChangeType = 'create' | 'update' | 'delete' | 'any';

/**
 * BackendStateChange — Triggered by database state changes being committed.
 * Python backend only.
 */
export class BackendStateChange {
  type = 'BackendStateChange';
  triggerType: InitialStateTriggerType = 'backend_state_change';
  displayName: string;
  modelName: string;
  fieldName: string;
  changeType: BackendChangeType;
  description: string;

  constructor(
    displayName: string = 'Backend State Change',
    modelName: string = '',
    fieldName: string = '',
    changeType: BackendChangeType = 'any',
    description: string = 'Triggered by database state changes'
  ) {
    this.displayName = displayName;
    this.modelName = modelName;
    this.fieldName = fieldName;
    this.changeType = changeType;
    this.description = description;
  }
}

/**
 * Returns the valid initial state trigger types for a given runtime.
 */
export function getAvailableInitialStateTypes(runtime: TargetRuntime): InitialStateTriggerType[] {
  switch (runtime) {
    case 'typescript_frontend':
      return ['direct_invocation', 'form_subscription', 'logic_flow_entry'];
    case 'python_backend':
      return ['direct_invocation', 'logic_flow_entry', 'backend_state_change'];
    default:
      return ['direct_invocation', 'logic_flow_entry'];
  }
}
