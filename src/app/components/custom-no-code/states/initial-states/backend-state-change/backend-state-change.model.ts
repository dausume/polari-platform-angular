// Author: Dustin Etts
// polari-platform-angular/src/app/components/custom-no-code/states/backend-state-change/backend-state-change.model.ts

import { InitialStateTriggerType } from '../../_shared/initial-state-types';

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
