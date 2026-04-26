// Author: Dustin Etts
// Shared types for the form-validation-overlay component and its sized sub-views.

import { FormValidationField } from '@models/stateSpace';

export { FormValidationField };

/** Fields auto-detected from the upstream state (FormSubscription or initial state) */
export interface UpstreamField {
  fieldName: string;
  displayName: string;
  fieldType: string;
  required: boolean;
}

/** Size tier for the overlay, derived from the host rect width. */
export type FormValidationOverlaySizeTier = 'tiny' | 'compact' | 'full';

export const TINY_MAX_WIDTH = 60;
export const COMPACT_MAX_WIDTH = 140;

export function resolveSizeTier(width: number): FormValidationOverlaySizeTier {
  if (width < TINY_MAX_WIDTH) return 'tiny';
  if (width < COMPACT_MAX_WIDTH) return 'compact';
  return 'full';
}
