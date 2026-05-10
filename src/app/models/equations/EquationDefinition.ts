/**
 * Frontend model types for EquationDefinition.
 *
 * Mirrors the backend `EquationDefinition` shape served via the CRUDE
 * endpoint `/EquationDefinition` and consumed by `/executeEquation` /
 * `/executeEquationDirect`.
 */

export type EquationOperationType =
    | 'derivative'
    | 'integral_definite'
    | 'integral_indefinite'
    | 'evaluate'
    | 'simplify'
    | 'expand'
    | 'factor'
    | 'solve'
    | 'limit'
    | 'series'
    | 'ode_solve'
    | 'pde_solve'
    | 'evaluate_predicate'
    | 'is_identity'
    | 'piecewise_evaluate'
    | 'dataseries_derivative'
    | 'dataseries_integral'
    | 'dataseries_ode_solve';

/** Operation types whose result is a boolean (true/false), not a number. */
export const BOOLEAN_RESULT_OPERATIONS: ReadonlyArray<EquationOperationType> = [
    'evaluate_predicate',
    'is_identity'
];

export function isBooleanResultOperation(op: EquationOperationType): boolean {
    return (BOOLEAN_RESULT_OPERATIONS as readonly string[]).indexOf(op) >= 0;
}

export const EQUATION_OPERATION_TYPES: EquationOperationType[] = [
    'derivative',
    'integral_definite',
    'integral_indefinite',
    'evaluate',
    'simplify',
    'expand',
    'factor',
    'solve',
    'limit',
    'series',
    'ode_solve',
    'pde_solve',
    'evaluate_predicate',
    'is_identity',
    'piecewise_evaluate',
    'dataseries_derivative',
    'dataseries_integral',
    'dataseries_ode_solve'
];

export const EQUATION_OPERATION_LABELS: Record<EquationOperationType, string> = {
    derivative: 'Derivative',
    integral_definite: 'Definite Integral',
    integral_indefinite: 'Indefinite Integral',
    evaluate: 'Evaluate',
    simplify: 'Simplify',
    expand: 'Expand',
    factor: 'Factor',
    solve: 'Solve',
    limit: 'Limit',
    series: 'Series Expansion',
    ode_solve: 'ODE Solve',
    pde_solve: 'PDE Solve',
    evaluate_predicate: 'Evaluate Predicate (Boolean)',
    is_identity: 'Check Identity (Boolean)',
    piecewise_evaluate: 'Piecewise / Conditional',
    dataseries_derivative: 'DataSeries Derivative',
    dataseries_integral: 'DataSeries Integral',
    dataseries_ode_solve: 'DataSeries ODE Solve'
};

/**
 * Legacy source-type vocabulary, retained ONLY so we can migrate older seed
 * equations into the new `potential` shape on load. New writes never emit a
 * `source` field — bindings carry their `potential` (a `DataPotentialDefinition`)
 * instead, and concrete test values live in component-local state during edit.
 */
export type EquationVariableSourceType =
    | 'literal'
    | 'dataset_field'
    | 'object_variable'
    | 'parameter';

export interface EquationLiteralSource {
    type: 'literal';
    value: number | string | number[];
}

export interface EquationDatasetFieldSource {
    type: 'dataset_field';
    datasetId: string;
    fieldPath: string;
}

export interface EquationObjectVariableSource {
    type: 'object_variable';
    objectClass: string;
    fieldPath: string;
}

export interface EquationParameterSource {
    type: 'parameter';
    parameterName: string;
}

export type EquationVariableSource =
    | EquationLiteralSource
    | EquationDatasetFieldSource
    | EquationObjectVariableSource
    | EquationParameterSource;

import { DataPotentialDefinition } from '@components/custom-no-code/shared/value-binding/branch-types';
import { ValueSourceConfig } from '@models/stateSpace';

/**
 * A binding declares which symbol in the equation expects what *shape* of
 * input (`potential`) and ALSO carries a default `defaultSource` — a concrete
 * `ValueSourceConfig` whose branch kind is constrained to match the potential.
 *
 * The default source serves two roles:
 *   - **At edit time**: feeds the Step-2 substituted preview and the Run-
 *     direct workflow on the equation edit page.
 *   - **At host time** (when the equation is dropped into a no-code state):
 *     pre-populates the host state's source-selector for that potential, which
 *     the host can then override.
 *
 * `source` is kept on the type only so legacy seed-data records still parse
 * during the migration step. New writes drop it.
 */
export interface EquationVariableBinding {
    symbol: string;
    /** Declared input shape — set on every binding written by the new UI. */
    potential?: DataPotentialDefinition;
    /** Concrete default source, kind-compatible with `potential`. */
    defaultSource?: ValueSourceConfig;
    /** Legacy concrete-source — present on pre-potentials seed records only. */
    source?: EquationVariableSource;
}

export interface EquationBounds {
    variable?: string;
    lower?: string;
    upper?: string;
    point?: string;
    direction?: '+' | '-';
    order?: number;
}

export interface EquationResultSpec {
    type: 'scalar' | 'expression' | 'dataseries';
}

export interface EquationDefinitionConfig {
    latexExpression: string;
    operationType: EquationOperationType;
    variableBindings: EquationVariableBinding[];
    bounds?: EquationBounds | null;
    options?: { [key: string]: any };
    resultSpec?: EquationResultSpec;
}

export interface EquationDefinitionSummary {
    id: string;
    name: string;
    description?: string;
    source_class?: string;
}

export interface EquationDefinitionRecord {
    id: string;
    name: string;
    description: string;
    source_class: string;
    definition: EquationDefinitionConfig;
}

export interface EquationExecutionResult {
    success: boolean;
    result_latex: string | null;
    /**
     * For boolean-result operations (predicate / identity / piecewise), this
     * is a Python `True`/`False` serialized as JSON `true`/`false` — NOT
     * `1`/`0`. The frontend should render bools accordingly.
     */
    result_numeric: number | number[] | boolean | null;
    error: string | null;
    warnings: string[];
    requestId?: string;
    name?: string;
}

/**
 * Runtime variable bindings sent to the backend executor: a flat
 * { symbol: value } dict. NOT the storage-format list of {symbol, source}.
 * Resolve the storage list to this dict before calling the API.
 */
export type RuntimeVariableBindings = { [symbol: string]: any };

export interface ExecuteEquationRequest {
    name: string;
    variableBindings?: RuntimeVariableBindings;
    requestId?: string;
}

export interface ExecuteEquationDirectRequest {
    latexExpression: string;
    operationType: EquationOperationType;
    variableBindings?: RuntimeVariableBindings;
    bounds?: EquationBounds | null;
    options?: { [key: string]: any };
    requestId?: string;
}

/** Convenience: produce an empty EquationDefinitionConfig draft. */
export function makeEmptyEquationDefinitionConfig(): EquationDefinitionConfig {
    return {
        latexExpression: '',
        operationType: 'evaluate',
        variableBindings: [],
        bounds: null,
        options: {},
        resultSpec: { type: 'scalar' }
    };
}

/**
 * Operation-type capability flags.
 * Used by the editor to show/hide config sections.
 */
export interface OperationCapabilities {
    needsBoundsVariable: boolean;
    needsLowerUpper: boolean;
    needsLimitPoint: boolean;
    needsSeriesPoint: boolean;
    needsFunctionDecl: boolean;
    isDataSeries: boolean;
    isPde: boolean;
}

export function getOperationCapabilities(op: EquationOperationType): OperationCapabilities {
    const caps: OperationCapabilities = {
        needsBoundsVariable: false,
        needsLowerUpper: false,
        needsLimitPoint: false,
        needsSeriesPoint: false,
        needsFunctionDecl: false,
        isDataSeries: false,
        isPde: false
    };
    switch (op) {
        case 'derivative':
        case 'integral_indefinite':
        case 'solve':
            caps.needsBoundsVariable = true;
            break;
        case 'integral_definite':
            caps.needsBoundsVariable = true;
            caps.needsLowerUpper = true;
            break;
        case 'limit':
            caps.needsBoundsVariable = true;
            caps.needsLimitPoint = true;
            break;
        case 'series':
            caps.needsBoundsVariable = true;
            caps.needsSeriesPoint = true;
            break;
        case 'ode_solve':
            caps.needsBoundsVariable = true;
            caps.needsFunctionDecl = true;
            break;
        case 'pde_solve':
            caps.needsBoundsVariable = true;
            caps.needsFunctionDecl = true;
            caps.isPde = true;
            break;
        case 'dataseries_derivative':
        case 'dataseries_integral':
        case 'dataseries_ode_solve':
            caps.isDataSeries = true;
            break;
    }
    return caps;
}
