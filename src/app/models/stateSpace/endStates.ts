// Author: Dustin Etts
// polari-platform-angular/src/app/models/stateSpace/endStates.ts
// Typed end state classes for state-space solutions.
// Each class defines HOW a solution completes (its exit point type).

import { TargetRuntime } from '../noCode/mock-NCS-data';

/**
 * Completion type identifier for end states.
 * Determines how a solution terminates.
 */
export type EndStateCompletionType =
  | 'return_value'       // Return a value to the caller
  | 'state_change'       // Commit object state to backend
  | 'emit_event';        // Emit event for cross-solution signaling

/**
 * ReturnValue — Return a value and exit the solution.
 * Replaces / aliases the old generic ReturnStatement. Available in both runtimes.
 */
export class ReturnValue {
  type = 'ReturnValue';
  completionType: EndStateCompletionType = 'return_value';
  displayName: string;
  description: string;
  returnValue: string;

  constructor(
    displayName: string = 'Return Value',
    description: string = 'Return value and exit',
    returnValue: string = ''
  ) {
    this.displayName = displayName;
    this.description = description;
    this.returnValue = returnValue;
  }
}

/**
 * StateChangeCommit — Commit object state changes to the backend.
 * Python backend only.
 */
export class StateChangeCommit {
  type = 'StateChangeCommit';
  completionType: EndStateCompletionType = 'state_change';
  displayName: string;
  targetFieldName: string;
  changeType: 'create' | 'update' | 'delete';
  description: string;

  constructor(
    displayName: string = 'Commit State Change',
    targetFieldName: string = '',
    changeType: 'create' | 'update' | 'delete' = 'update',
    description: string = 'Commit object state to backend'
  ) {
    this.displayName = displayName;
    this.targetFieldName = targetFieldName;
    this.changeType = changeType;
    this.description = description;
  }
}

/**
 * EmitEvent — Emit an event for cross-solution signaling.
 * TypeScript frontend only.
 */
export class EmitEvent {
  type = 'EmitEvent';
  completionType: EndStateCompletionType = 'emit_event';
  displayName: string;
  eventName: string;
  eventPayload: string;
  description: string;

  constructor(
    displayName: string = 'Emit Event',
    eventName: string = '',
    eventPayload: string = '{}',
    description: string = 'Emit event for cross-solution signaling'
  ) {
    this.displayName = displayName;
    this.eventName = eventName;
    this.eventPayload = eventPayload;
    this.description = description;
  }
}

/**
 * Returns the valid end state completion types for a given runtime.
 */
export function getAvailableEndStateTypes(runtime: TargetRuntime): EndStateCompletionType[] {
  switch (runtime) {
    case 'typescript_frontend':
      return ['return_value', 'emit_event'];
    case 'python_backend':
      return ['return_value', 'state_change'];
    default:
      return ['return_value'];
  }
}
