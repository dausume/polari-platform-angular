/**
 * Frontend model types for MatrixDefinition.
 *
 * Mirrors the backend `MatrixDefinition` (served via the CRUDE endpoint
 * `/MatrixDefinition`) and the math-logic routes `/api/matrices/evaluate`
 * and `/api/matrices/validate`.
 *
 * The backend persists `shape`, `values`, and `computation` as JSON strings
 * (`shape_json` / `values_json` / `computation_json`); MatrixDefinitionService
 * (de)serialises them so components work with real arrays/objects.
 */

export type MatrixElementType = 'float' | 'int' | 'complex' | 'equation' | 'matrix' | 'mixed';

export const MATRIX_ELEMENT_TYPES: MatrixElementType[] = [
    'float', 'int', 'complex', 'equation', 'matrix'
];

export const MATRIX_ELEMENT_TYPE_LABELS: Record<MatrixElementType, string> = {
    float: 'Float',
    int: 'Integer',
    complex: 'Complex',
    equation: 'Equation (per element)',
    matrix: 'Matrix (block / matrix-of-matrices)',
    mixed: 'Per-cell (number / equation / matrix)'
};

/**
 * The per-cell element kinds offered by the Matrix Element Modifier. Each cell
 * in a 'mixed' matrix is a self-describing `MatrixElement`; the Matrix View
 * tab edits these. number/equation resolve to scalars; matrix is a block.
 */
export type MatrixElementKind = 'number' | 'equation' | 'matrix';

export const MATRIX_ELEMENT_KINDS: MatrixElementKind[] = ['number', 'equation', 'matrix'];

export const MATRIX_ELEMENT_KIND_LABELS: Record<MatrixElementKind, string> = {
    number: 'Number',
    equation: 'Equation',
    matrix: 'Matrix'
};

export interface MatrixElement {
    kind: MatrixElementKind;
    /** kind === 'number' */
    value?: number;
    /** kind === 'equation' — inline LaTeX (or use equationRef) */
    latex?: string;
    /** kind === 'equation' — reference a saved EquationDefinition by name */
    equationRef?: string;
    /** kind === 'equation' — symbol → value, reduces the equation to a scalar */
    bindings?: { [symbol: string]: number | string };
    /** kind === 'matrix' — reference a saved MatrixDefinition by name */
    matrixRef?: string;
}

export function makeMatrixElement(kind: MatrixElementKind): MatrixElement {
    switch (kind) {
        case 'equation': return { kind, latex: 'x', bindings: {} };
        case 'matrix': return { kind, matrixRef: '' };
        default: return { kind: 'number', value: 0 };
    }
}

/**
 * Coerce a record's stored cells (of any element type) into a flat
 * `MatrixElement[]` of length `count`, so the Matrix View modifier can edit
 * heterogeneous cells uniformly. Pads with number-0 cells / truncates to fit.
 */
export function toMatrixElements(
    values: any[], elementType: MatrixElementType, count: number
): MatrixElement[] {
    const out: MatrixElement[] = [];
    for (let i = 0; i < count; i++) {
        out.push(coerceCell(values?.[i], elementType));
    }
    return out;
}

function coerceCell(raw: any, elementType: MatrixElementType): MatrixElement {
    if (raw === undefined || raw === null) return makeMatrixElement('number');
    if (typeof raw === 'number') return { kind: 'number', value: raw };
    if (typeof raw === 'string') return { kind: 'matrix', matrixRef: raw };
    if (typeof raw === 'object') {
        if (raw.kind === 'number' || raw.kind === 'equation' || raw.kind === 'matrix') {
            return { ...raw };
        }
        if ('matrixRef' in raw || 'ref' in raw) return { kind: 'matrix', matrixRef: raw.matrixRef || raw.ref };
        if ('latex' in raw || 'equationRef' in raw) {
            return { kind: 'equation', latex: raw.latex, equationRef: raw.equationRef, bindings: raw.bindings || {} };
        }
        if ('re' in raw && 'im' in raw) return { kind: 'number', value: raw.re };
    }
    // Fall back based on the declared element type.
    if (elementType === 'equation') return makeMatrixElement('equation');
    if (elementType === 'matrix') return makeMatrixElement('matrix');
    return makeMatrixElement('number');
}

export type MatrixComputationKind = 'literal' | 'elementwise' | 'matrix_op';

/** A complex value as the API serialises it (and accepts it back). */
export interface ComplexValue {
    re: number;
    im: number;
}

/** One `element_type: 'equation'` cell — references a saved equation or
 *  carries inline LaTeX, plus the bindings that reduce it to a scalar. */
export interface EquationElementSpec {
    equationRef?: string;
    latex?: string;
    operationType?: string;
    bindings?: { [symbol: string]: number | string };
    bounds?: { [k: string]: any } | null;
    options?: { [k: string]: any };
}

/** One `element_type: 'matrix'` cell — references a sub-matrix by name. */
export interface MatrixElementRef {
    matrixRef: string;
}

/** A row-major element. Interpretation depends on the matrix's elementType. */
export type MatrixCellValue =
    | number
    | ComplexValue
    | EquationElementSpec
    | MatrixElementRef
    | MatrixElement      // self-describing per-cell ('mixed') element
    | string;   // bare matrix-ref name for matrix elements

export type MatrixComputation =
    | { kind: 'literal' }
    | {
        kind: 'elementwise';
        equationRef?: string;
        latex?: string;
        operationType?: string;
        bindings: { [symbol: string]: string | number };   // matrixRef name or scalar
    }
    | {
        kind: 'matrix_op';
        expr: string;
        operands: { [name: string]: string };              // matrixRef name (or runtime binding)
    };

export interface MatrixDefinitionSummary {
    id: string;
    name: string;
    description?: string;
    elementType: MatrixElementType;
    shape: number[];
    tags?: string;
}

export interface MatrixDefinitionRecord {
    id: string;
    name: string;
    description: string;
    shape: number[];
    elementType: MatrixElementType;
    elementMatrixRef: string;
    values: MatrixCellValue[];
    computation: MatrixComputation;
    isTemplate: boolean;
    tags: string;
}

/** Response from POST /api/matrices/evaluate. `data` is nested arrays of
 *  numbers (or {re,im} for complex). */
export interface MatrixEvaluateResponse {
    success: boolean;
    shape: number[];
    dtype: 'float' | 'int' | 'complex';
    data: any;
    error: string | null;
    warnings: string[];
}

/** Response from POST /api/matrices/validate. */
export interface MatrixValidateResponse {
    valid: boolean;
    errors: string[];
    warnings: string[];
    shape: number[] | null;
    composedShape: number[] | null;
    elementType: MatrixElementType;
    kind: MatrixComputationKind;
}

/** Number of elements implied by a shape (product of dims; 0 dims → 1). */
export function elementCountForShape(shape: number[]): number {
    return (shape || []).reduce((acc, d) => acc * d, 1);
}

/** Convenience: an empty literal per-cell (mixed) matrix draft. */
export function makeEmptyMatrixDefinition(): MatrixDefinitionRecord {
    return {
        id: '',
        name: '',
        description: '',
        shape: [2, 2],
        elementType: 'mixed',
        elementMatrixRef: '',
        values: [
            { kind: 'number', value: 0 },
            { kind: 'number', value: 0 },
            { kind: 'number', value: 0 },
            { kind: 'number', value: 0 }
        ],
        computation: { kind: 'literal' },
        isTemplate: false,
        tags: ''
    };
}
