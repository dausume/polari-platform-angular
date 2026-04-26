// Author: Dustin Etts
// polari-platform-angular/src/app/components/custom-no-code/states/_shared/end-state-types.ts

import { TargetRuntime } from '../../../../models/noCode/mock-NCS-data';

/**
 * Completion type identifier for end states.
 * Determines how a solution terminates.
 */
export type EndStateCompletionType =
  | 'return_value'       // Return a value to the caller
  | 'state_change'       // Commit object state to backend
  | 'emit_event';        // Emit event for cross-solution signaling

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
