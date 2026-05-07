// Author: Dustin Etts
// run-equation.model.ts
//
// Model + config types for the RunEquation no-code state. Hosts an
// EquationDefinition reference inside a state-space graph, and per declared
// variable potential supplies a ValueSourceConfig that feeds the runtime
// executor. The frontend code-generator translates this into a backend call
// to /executeEquation with the resolved binding dict.

import { ValueSourceConfig } from '@models/stateSpace';

/**
 * Per-symbol binding: maps a symbol the equation declared as a potential
 * onto a concrete value source available in the hosting state-space.
 */
export interface RunEquationBindingEntry {
    symbol: string;
    source: ValueSourceConfig;
}

/**
 * Configuration persisted on a RunEquation state instance.
 */
export interface RunEquationConfig {
    /** ID of the EquationDefinition this state runs. Empty when un-picked. */
    equationId: string;
    /** Cached display name (avoids round-trip on canvas redraw). */
    equationName: string;
    /** One source-config per symbol declared on the equation's potentials. */
    bindings: RunEquationBindingEntry[];
    /** Where to put the result. `result_variable` flows into the next state's
     *  input slot; `solution_field` writes back onto the source object. */
    resultTarget: 'result_variable' | 'solution_field';
    /** When `resultTarget === 'result_variable'`. */
    resultVariableName: string;
    /** When `resultTarget === 'solution_field'`. */
    resultFieldPath: string;
}

/** Plain shape for state-instance creation via the registry factory. */
export interface RunEquation {
    type: 'RunEquation';
    displayName: string;
    equationId: string;
    equationName: string;
    bindings: RunEquationBindingEntry[];
    resultTarget: 'result_variable' | 'solution_field';
    resultVariableName: string;
    resultFieldPath: string;
}

export function makeEmptyRunEquationConfig(): RunEquationConfig {
    return {
        equationId: '',
        equationName: '',
        bindings: [],
        resultTarget: 'result_variable',
        resultVariableName: 'result',
        resultFieldPath: '',
    };
}

export function createRunEquation(): RunEquation {
    return {
        type: 'RunEquation',
        displayName: 'Run Equation',
        equationId: '',
        equationName: '',
        bindings: [],
        resultTarget: 'result_variable',
        resultVariableName: 'result',
        resultFieldPath: '',
    };
}
