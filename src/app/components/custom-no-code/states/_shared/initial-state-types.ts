// Author: Dustin Etts
// polari-platform-angular/src/app/components/custom-no-code/states/_shared/initial-state-types.ts

import { TargetRuntime } from '../../../../models/noCode/mock-NCS-data';

/**
 * Trigger type identifier for initial states.
 * Determines how a solution is initialized.
 *
 * `simulation_state_step` flags a solution authored as ONE timestep of
 * a simulation: the SimulationRunner invokes it with prev-step
 * `*SimState` field values + params + dt/step in context. The graph
 * terminates at SimStepNextState (simStepComplete / simStepComposition)
 * or SimStepContribution (simStepPartial) depending on the role
 * declared on the entry node. Backend-only — the simulation runner
 * doesn't have a frontend counterpart yet.
 */
export type InitialStateTriggerType =
  | 'direct_invocation'
  | 'form_subscription'
  | 'logic_flow_entry'
  | 'backend_state_change'
  | 'simulation_state_step'
  | 'initial_conditions_validator';

/**
 * Returns the valid initial state trigger types for a given runtime.
 */
export function getAvailableInitialStateTypes(runtime: TargetRuntime): InitialStateTriggerType[] {
  switch (runtime) {
    case 'typescript_frontend':
      return ['direct_invocation', 'form_subscription', 'logic_flow_entry'];
    case 'python_backend':
      return [
        'direct_invocation', 'logic_flow_entry', 'backend_state_change',
        'simulation_state_step', 'initial_conditions_validator',
      ];
    default:
      return ['direct_invocation', 'logic_flow_entry'];
  }
}
