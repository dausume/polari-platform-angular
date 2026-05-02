// Author: Dustin Etts
// State-specific types for the form-validation overlay and its sub-views.
// Size-tier types live in _shared/state-overlay/size-tier — see that file for the convention.

import { FormValidationField } from '@models/stateSpace';

export { FormValidationField };

/** Fields auto-detected from the upstream state (FormSubscription or initial state) */
export interface UpstreamField {
  fieldName: string;
  displayName: string;
  fieldType: string;
  required: boolean;
}
