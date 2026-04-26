// Author: Dustin Etts
// polari-platform-angular/src/app/components/custom-no-code/states/state-change-commit/state-change-commit.model.ts

import { EndStateCompletionType } from '../_shared/end-state-types';

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
