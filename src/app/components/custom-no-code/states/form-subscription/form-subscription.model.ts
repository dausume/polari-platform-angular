// Author: Dustin Etts
// polari-platform-angular/src/app/components/custom-no-code/states/form-subscription/form-subscription.model.ts

import { InitialStateTriggerType } from '../_shared/initial-state-types';

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
