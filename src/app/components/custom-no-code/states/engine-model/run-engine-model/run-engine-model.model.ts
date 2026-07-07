// Author: Dustin Etts
// run-engine-model.model.ts
//
// Model + config types for the EngineModelOperation no-code state. Hosts a
// FEM/DFT model definition reference (a FEMModelDefinition or
// DFTModelDefinition row, by name) inside a state-space graph. Runs a
// configured model definition — a REAL engine solve via materialsScience —
// and writes its outputs into the solution context as model.<key> plus any
// mapped variables. Backend-only runtime.
//
// Input bindings mirror MatrixEquationOperation's operandBindings shape
// exactly: per symbol, a ValueSourceConfig threaded from the RUNTIME
// execution context (sim fields, upstream variables, literals, assembled
// vectors, vector elements, or LaTeX). The symbol must match the model's
// stageDerived binding keys ('<stage>.<key>').
//
// Engine reference: polariNoCode/SolutionExecutionEngine.py
//   - state_class == 'EngineModelOperation' handler reads
//     modelRef / inputBindings / resultKeyMap / resultTarget /
//     resultVariableName / resultFieldPath.
//   - _resolve_value_source_config resolves each binding's `source`, same as
//     the MatrixEquationOperation handler (including `array` / `element`).

import { MatrixValueSourceConfig } from '../../matrices/run-matrix-equation/run-matrix-equation.model';

/**
 * Per-symbol input binding: maps a stageDerived binding key the model
 * declares ('<stage>.<key>') onto a concrete runtime source available in the
 * hosting state-space. SAME shape as RunMatrixEquationOperandBinding.
 */
export interface RunEngineModelInputBinding {
    symbol: string;
    source: MatrixValueSourceConfig;
}

/**
 * Optional mapping of an engine result key (e.g. effectiveK, totalEnergyHa)
 * onto a friendly context variable name. Unmapped keys still land in the
 * context as model.<key>.
 */
export interface RunEngineModelResultKeyMapEntry {
    resultKey: string;
    contextVar: string;
}

/**
 * Configuration persisted on an EngineModelOperation state instance.
 *
 * This is exactly the `boundObjectFieldValues` shape the runner consumes.
 */
export interface RunEngineModelConfig {
    /** Name of the FEMModelDefinition / DFTModelDefinition row this state
     *  runs. Empty when un-picked. */
    modelRef: string;
    /** One source-config per stageDerived binding key ('<stage>.<key>'). */
    inputBindings: RunEngineModelInputBinding[];
    /** Optional engine-result-key → context-variable mappings. */
    resultKeyMap: RunEngineModelResultKeyMapEntry[];
    /** Where to put the result. `result_variable` flows into the next state's
     *  input slot; `solution_field` writes back onto the source object. */
    resultTarget: 'result_variable' | 'solution_field';
    /** When `resultTarget === 'result_variable'`. */
    resultVariableName: string;
    /** When `resultTarget === 'solution_field'`. */
    resultFieldPath: string;
    /** Cached display name (avoids round-trip on canvas redraw). */
    displayName: string;
}

/** Plain shape for state-instance creation via the registry factory. */
export interface RunEngineModel {
    type: 'EngineModelOperation';
    displayName: string;
    modelRef: string;
    inputBindings: RunEngineModelInputBinding[];
    resultKeyMap: RunEngineModelResultKeyMapEntry[];
    resultTarget: 'result_variable' | 'solution_field';
    resultVariableName: string;
    resultFieldPath: string;
}

export function makeEmptyRunEngineModelConfig(): RunEngineModelConfig {
    return {
        modelRef: '',
        inputBindings: [],
        resultKeyMap: [],
        resultTarget: 'result_variable',
        resultVariableName: 'model_result',
        resultFieldPath: '',
        displayName: 'Engine Model (FEM/DFT)',
    };
}

export function createRunEngineModel(): RunEngineModel {
    return {
        type: 'EngineModelOperation',
        displayName: 'Engine Model (FEM/DFT)',
        modelRef: '',
        inputBindings: [],
        resultKeyMap: [],
        resultTarget: 'result_variable',
        resultVariableName: 'model_result',
        resultFieldPath: '',
    };
}
