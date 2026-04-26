// Author: Dustin Etts
// polari-platform-angular/src/app/components/custom-no-code/states/logic-flow-entry/logic-flow-entry.model.ts

import { InitialStateTriggerType } from '../_shared/initial-state-types';

/**
 * LogicFlowEntry — Invoked by a parent solution.
 * Available in both runtimes.
 */
export class LogicFlowEntry {
  type = 'LogicFlowEntry';
  triggerType: InitialStateTriggerType = 'logic_flow_entry';
  displayName: string;
  description: string;

  constructor(
    displayName: string = 'Logic Flow Entry',
    description: string = 'Invoked by a parent solution'
  ) {
    this.displayName = displayName;
    this.description = description;
  }
}
