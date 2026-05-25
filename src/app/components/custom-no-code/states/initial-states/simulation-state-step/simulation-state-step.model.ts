// Author: Dustin Etts
// polari-platform-angular/src/app/components/custom-no-code/states/initial-states/simulation-state-step/simulation-state-step.model.ts

import { InitialStateTriggerType } from '../../_shared/initial-state-types';

export type SimStepRole = 'simStepComplete' | 'simStepPartial' | 'simStepComposition';

/**
 * SimulationStateStep — Entry point for a solution that runs as one
 * timestep of a simulation. The SimulationRunner invokes it with the
 * previous step's `*SimState` field values + the SimulationDefinition's
 * parameters + step metadata (dt, time, step) all merged into the
 * execution context.
 *
 * The graph's terminator depends on `simStepRole`:
 *   - simStepComplete    → SimStepNextState (full next-step row).
 *   - simStepPartial     → SimStepContribution (sparse field deltas).
 *   - simStepComposition → SimStepNextState (built from partials'
 *                          contributions merged into the baseline).
 *
 * Backend-only — the simulation runner is a Python orchestrator.
 *
 * `simStateClassName` is the target `*SimState` class (e.g.
 * `PendulumBobSimState`).
 *
 * `expectedFields` lists the prev-row fields the step solution reads.
 */
export class SimulationStateStep {
  type = 'SimulationStateStep';
  triggerType: InitialStateTriggerType = 'simulation_state_step';
  displayName: string;
  description: string;
  simStateClassName: string;
  simStepRole: SimStepRole;
  expectedFields: string[];

  constructor(
    displayName: string = 'Simulation Step',
    simStateClassName: string = '',
    expectedFields: string[] = [],
    simStepRole: SimStepRole = 'simStepComplete',
    description: string = 'Runs once per simulation timestep — reads prev-step *SimState fields + params + dt/step from context. Terminates at SimStepNextState or SimStepContribution depending on simStepRole.',
  ) {
    this.displayName = displayName;
    this.simStateClassName = simStateClassName;
    this.expectedFields = expectedFields;
    this.simStepRole = simStepRole;
    this.description = description;
  }
}
