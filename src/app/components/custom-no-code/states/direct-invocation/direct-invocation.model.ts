// Author: Dustin Etts
// polari-platform-angular/src/app/components/custom-no-code/states/direct-invocation/direct-invocation.model.ts

import { InitialStateTriggerType } from '../_shared/initial-state-types';

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
