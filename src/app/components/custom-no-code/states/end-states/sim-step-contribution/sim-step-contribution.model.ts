// Author: Dustin Etts
// SimStepContribution — terminator for `partial` SimulationStateStep
// solutions. Emits a sparse `{fieldName → {value, op}}` payload onto
// the per-trace `_step_contributions` list that the SimulationRunner
// harvests and either aggregates additively (default) or hands to a
// Resolution solution.
//
// Mirrors the canonical SimStepNextState shape (`simStateClassName` +
// `outputMappings`) with one extra `op` field per mapping. The op
// vocabulary is set | add | mul | min | max — matching the backend
// runner's `_apply_step_contributions` merge semantics.

import { EndStateCompletionType } from '../../_shared/end-state-types';
import { ValueSourceConfig } from '@models/stateSpace';

export type SimStepContributionOp = 'set' | 'add' | 'mul' | 'min' | 'max';

export interface SimStepContributionMapping {
  outputFieldName: string;
  valueSource: ValueSourceConfig | null;
  op: SimStepContributionOp;
}

export class SimStepContribution {
  type = 'SimStepContribution';
  completionType: EndStateCompletionType = 'sim_step_contribution';
  displayName: string;
  simStateClassName: string;
  outputMappings: SimStepContributionMapping[];
  description: string;

  constructor(
    displayName: string = 'Sim Step Contribution',
    simStateClassName: string = '',
    outputMappings: SimStepContributionMapping[] = [],
    description: string = 'Partial step contribution — sparse field deltas with per-field op (set/add/mul/min/max).',
  ) {
    this.displayName = displayName;
    this.simStateClassName = simStateClassName;
    this.outputMappings = outputMappings;
    this.description = description;
  }
}
