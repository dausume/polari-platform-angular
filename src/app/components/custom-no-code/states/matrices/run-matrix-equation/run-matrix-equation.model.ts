// Author: Dustin Etts
// run-matrix-equation.model.ts
//
// Model + config types for the MatrixEquationOperation no-code state. Hosts a
// MatrixEquationDefinition reference inside a state-space graph, and per
// declared operand symbol supplies a ValueSourceConfig that feeds the runtime
// executor. Unlike the standalone Matrix-Equation *page* operand model
// ({kind:matrix|scalar, ref|value}) — which binds STORED entities — these
// operands are threaded from the RUNTIME execution context via
// ValueSourceConfig (sim fields, upstream variables, literals, assembled
// vectors, vector elements, or LaTeX).
//
// The frontend code-generator / SolutionExecutionEngine translates this into a
// call to matrices.matrix_equation_executor.evaluate_equation with the
// resolved operand dict.
//
// Engine reference: polariNoCode/SolutionExecutionEngine.py
//   - state_class == 'MatrixEquationOperation' handler reads
//     matrixEquationName / operandBindings / resultTarget /
//     resultVariableName / resultFieldPath.
//   - _resolve_value_source_config resolves each operand's `source`, including
//     the `array` (vector assembly) and `element` (vector component) kinds
//     that the standard ValueSourceSelector does not surface.

import { ValueSourceConfig } from '@models/stateSpace';

/**
 * Extended ValueSourceConfig vocabulary the matrix-operand editor authors.
 *
 * The shared `ValueSourceConfig` (states/_shared/value-source-config.ts) only
 * declares the scalar/dataset/latex source kinds. The MatrixEquationOperation
 * engine additionally resolves two collection kinds — `array` (assemble a
 * vector from N element sources) and `element` (extract one component of a
 * vector). We model them here as a structural superset so the node can author
 * them without mutating the shared type (which the rest of the no-code editor
 * relies on). At the wire/JSON level these are plain `{sourceType, ...}` dicts
 * the backend's `_resolve_value_source_config` understands.
 */
export type MatrixSourceType = ValueSourceConfig['sourceType'] | 'array' | 'element';

/** A source config that may also be an `array` or `element` collection source. */
export interface MatrixValueSourceConfig extends Omit<ValueSourceConfig, 'sourceType'> {
    sourceType: MatrixSourceType;

    /** When 'array' — the ordered element sources that assemble the vector.
     *  Each element is itself a (scalar) source config, e.g.
     *  [ {sourceType:'from_source_object', sourceObjectPath:'self.f_app_x'}, ... ]. */
    elements?: MatrixValueSourceConfig[];

    /** When 'element' — the array-valued source to extract a component from. */
    source?: MatrixValueSourceConfig;

    /** When 'element' — the zero-based component index. */
    index?: number;
}

/**
 * Per-symbol operand binding: maps an operand symbol the matrix equation
 * declares onto a concrete runtime source available in the hosting state-space.
 */
export interface RunMatrixEquationOperandBinding {
    symbol: string;
    source: MatrixValueSourceConfig;
}

/**
 * Configuration persisted on a MatrixEquationOperation state instance.
 *
 * This is exactly the `boundObjectFieldValues` shape the runner consumes (see
 * the engine handler + simulations/seed_data.py `_mat_step`).
 */
export interface RunMatrixEquationConfig {
    /** Name of the MatrixEquationDefinition this state runs. Empty when un-picked. */
    matrixEquationName: string;
    /** One source-config per operand symbol the matrix equation declares. */
    operandBindings: RunMatrixEquationOperandBinding[];
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
export interface RunMatrixEquation {
    type: 'MatrixEquationOperation';
    displayName: string;
    matrixEquationName: string;
    operandBindings: RunMatrixEquationOperandBinding[];
    resultTarget: 'result_variable' | 'solution_field';
    resultVariableName: string;
    resultFieldPath: string;
}

export function makeEmptyRunMatrixEquationConfig(): RunMatrixEquationConfig {
    return {
        matrixEquationName: '',
        operandBindings: [],
        resultTarget: 'result_variable',
        resultVariableName: 'result',
        resultFieldPath: '',
        displayName: 'Matrix Equation Operation',
    };
}

export function createRunMatrixEquation(): RunMatrixEquation {
    return {
        type: 'MatrixEquationOperation',
        displayName: 'Matrix Equation Operation',
        matrixEquationName: '',
        operandBindings: [],
        resultTarget: 'result_variable',
        resultVariableName: 'result',
        resultFieldPath: '',
    };
}
