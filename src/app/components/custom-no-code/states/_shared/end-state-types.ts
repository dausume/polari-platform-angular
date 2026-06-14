// Author: Dustin Etts
// polari-platform-angular/src/app/components/custom-no-code/states/_shared/end-state-types.ts

import { TargetRuntime } from '../../../../models/noCode/mock-NCS-data';

/**
 * Completion type identifier for end states.
 * Determines how a solution terminates.
 */
export type EndStateCompletionType =
  | 'return_value'              // Return a value to the caller
  | 'state_change'              // Commit object state to backend
  | 'emit_event'                // Emit event for cross-solution signaling
  | 'sim_step_next_state'       // Declare the next *SimState row (simStepComplete/Composition terminator)
  | 'sim_step_contribution'     // Emit a partial-step delta (simStepPartial terminator)
  | 'validation_result';        // Pass/fail verdict from an InitialConditionsValidator solution

/**
 * Returns the valid end state completion types for a given runtime.
 *
 * `sim_step_next_state` and `sim_step_contribution` are intentionally
 * NOT listed here — they're only valid inside SimulationStateStep
 * solutions and the Sim-Step editor offers them via dedicated pickers
 * driven by the active `simStepRole`, not via the generic end-state
 * dropdown.
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
