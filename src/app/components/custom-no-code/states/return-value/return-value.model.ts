// Author: Dustin Etts
// polari-platform-angular/src/app/components/custom-no-code/states/return-value/return-value.model.ts

import { EndStateCompletionType } from '../_shared/end-state-types';

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
