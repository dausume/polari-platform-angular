// Author: Dustin Etts
// ValidationResult — terminator for an InitialConditionsValidator
// solution. Declares whether the proposed initial conditions are valid
// and (when invalid) a human-readable reason.
//
// The runner reads three optional context fields off this terminator's
// final context:
//   * outcome           — 'valid' | 'invalid'  (drives go/no-go)
//   * reason            — user-facing message when outcome='invalid'
//   * repairedValues    — dict keyed by `<className>.<field>` of values
//                         the validator wants to overwrite into step 0
//                         (e.g. recompute tension from the proposed θ)
//
// The first two are bound to plain context variables produced by
// earlier states (ConditionalChain → VariableAssignment etc.). The
// repairedValues map is optional; leave it empty for pure-veto
// validators that don't massage the inputs.

import { EndStateCompletionType } from '../../_shared/end-state-types';
import { ValueSourceConfig } from '@models/stateSpace';

export interface ValidationResultMapping {
  outputFieldName: string;        // 'outcome' | 'reason' | 'repairedValues'
  valueSource: ValueSourceConfig | null;
}

export class ValidationResult {
  type = 'ValidationResult';
  completionType: EndStateCompletionType = 'validation_result';
  displayName: string;
  outputMappings: ValidationResultMapping[];
  description: string;

  constructor(
    displayName: string = 'Validation Result',
    outputMappings: ValidationResultMapping[] = [],
    description: string = (
      'Verdict for an initial-conditions validator. ' +
      'Bind `outcome` to "valid" or "invalid", `reason` to a message string when invalid, ' +
      'and optionally `repairedValues` to a dict of replacement values.'
    ),
  ) {
    this.displayName = displayName;
    this.outputMappings = outputMappings;
    this.description = description;
  }
}
