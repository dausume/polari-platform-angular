// Author: Dustin Etts
// SimStepNextState — terminator for `simStepComplete` and
// `simStepComposition` SimulationStateStep solutions. Declares the
// next *SimState row's field values via an `outputMappings` list of
// `{outputFieldName, valueSource}` pairs that the SimulationRunner
// projects onto a new row at step persistence time.
//
// The `valueSource` field is a ValueSourceConfig — same shape as
// every other binding in the no-code editor — so a Composition
// solution can pull from `_step_contributions` via from_source_object
// just like any other context-derived value.

import { EndStateCompletionType } from '../../_shared/end-state-types';
import { ValueSourceConfig } from '@models/stateSpace';

export interface SimStepNextStateMapping {
  outputFieldName: string;
  valueSource: ValueSourceConfig | null;
}

export class SimStepNextState {
  type = 'SimStepNextState';
  completionType: EndStateCompletionType = 'sim_step_next_state';
  displayName: string;
  simStateClassName: string;
  outputMappings: SimStepNextStateMapping[];
  description: string;

  constructor(
    displayName: string = 'Sim Step Next State',
    simStateClassName: string = '',
    outputMappings: SimStepNextStateMapping[] = [],
    description: string = 'Declares the next-step *SimState row that the SimulationRunner persists.',
  ) {
    this.displayName = displayName;
    this.simStateClassName = simStateClassName;
    this.outputMappings = outputMappings;
    this.description = description;
  }
}
