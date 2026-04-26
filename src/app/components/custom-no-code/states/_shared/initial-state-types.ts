// Author: Dustin Etts
// polari-platform-angular/src/app/components/custom-no-code/states/_shared/initial-state-types.ts

import { TargetRuntime } from '../../../../models/noCode/mock-NCS-data';

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
