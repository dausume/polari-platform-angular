// Author: Dustin Etts
// InitialConditionsValidatorEntry — entry point for a solution that
// validates a simulation's proposed initial conditions BEFORE step 0
// is written.
//
// The runner invokes the validator solution with the merged initial
// conditions (class defaults + sim-def overrides + per-run overrides)
// flattened into the execution context as `<className>.<field>` keys,
// plus `params.<key>` for each sim constant and `participating_classes`
// for the class roster. The graph terminates at a `ValidationResult`
// end state declaring `outcome` (valid | invalid), an optional `reason`,
// and optional `repairedValues` the runner folds into step 0.

import { InitialStateTriggerType } from '../../_shared/initial-state-types';

export class InitialConditionsValidatorEntry {
  type = 'InitialConditionsValidatorEntry';
  triggerType: InitialStateTriggerType = 'initial_conditions_validator';
  displayName: string;
  description: string;
  simulationDefinitionName: string;
  /** Plain-language description of what this validator checks — drives
   *  the overlay's summary chip + the editor's documentation panel. */
  validationSummary: string;

  constructor(
    displayName: string = 'Validate Initial Conditions',
    simulationDefinitionName: string = '',
    validationSummary: string = '',
    description: string = (
      'Runs once before step 0 with the merged initial conditions in context. ' +
      'Terminates at a ValidationResult declaring whether the proposal is physically valid.'
    ),
  ) {
    this.displayName = displayName;
    this.simulationDefinitionName = simulationDefinitionName;
    this.validationSummary = validationSummary;
    this.description = description;
  }
}
