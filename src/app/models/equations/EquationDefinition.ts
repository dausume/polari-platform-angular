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
    | 'dataseries_derivative'
    | 'dataseries_integral'
    | 'dataseries_ode_solve';

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
    dataseries_derivative: 'DataSeries Derivative',
    dataseries_integral: 'DataSeries Integral',
    dataseries_ode_solve: 'DataSeries ODE Solve'
};

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

export interface EquationVariableBinding {
    symbol: string;
    source: EquationVariableSource;
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
    result_numeric: number | number[] | null;
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
