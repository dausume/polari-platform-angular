/**
 * Frontend model for MatrixEquationDefinition — an operation over operand
 * matrices / matrix-equations / scalar-equations, rendered with LaTeX.
 *
 * Backend persists `operation` and `operands` as JSON strings
 * (`operation_json` / `operands_json`); the service (de)serialises them.
 * Evaluated/validated via /api/matrix-equations/{evaluate,validate}.
 */

export type MatrixEquationOperationKind =
    | 'matmul' | 'add' | 'subtract' | 'hadamard' | 'kron' | 'solve'
    | 'transpose' | 'inverse' | 'determinant' | 'trace'
    | 'scalar_mul' | 'power' | 'elementwise' | 'expr';

/** Flexible operation shape (optional fields per kind — avoids union narrowing
 *  pain in templates). Which fields matter is defined by OP_META[kind]. */
export interface MatrixEquationOperation {
    kind: MatrixEquationOperationKind;
    a?: string;            // operand symbol (binary/unary primary)
    b?: string;            // operand symbol (binary secondary)
    scalar?: string;       // operand symbol (scalar_mul coefficient)
    n?: string;            // operand symbol (power exponent)
    symbol?: string;       // elementwise: the per-cell variable (default 'x')
    equationRef?: string;  // elementwise: saved scalar equation
    latex?: string;        // elementwise: inline scalar latex
    expr?: string;         // expr: free numpy expression
}

export type MatrixEquationOperandKind = 'matrix' | 'matrixEquation' | 'equation' | 'scalar';

/** How an operand's symbol is decorated in the displayed LaTeX. Bold uppercase
 *  is the standard convention for a matrix. */
export type MatrixNotation = 'bold' | 'plain' | 'bar' | 'hat';

export const MATRIX_NOTATIONS: MatrixNotation[] = ['bold', 'plain', 'bar', 'hat'];
export const MATRIX_NOTATION_LABELS: Record<MatrixNotation, string> = {
    bold: 'Bold 𝐀', plain: 'Plain A', bar: 'Bar Ā', hat: 'Hat Â',
};

export interface MatrixEquationOperand {
    kind: MatrixEquationOperandKind;
    ref?: string;            // for matrix / matrixEquation / equation
    value?: number;          // for scalar
    notation?: MatrixNotation; // display styling for the symbol (default bold)
}

/** Wrap a symbol in its notation styling for KaTeX. */
export function styledSymbol(symbol: string, notation: MatrixNotation = 'bold'): string {
    const s = (symbol || 'A').trim();
    switch (notation) {
        case 'plain': return s;
        case 'bar': return `\\bar{${s}}`;
        case 'hat': return `\\hat{${s}}`;
        default: return `\\mathbf{${s}}`;
    }
}

export interface MatrixEquationRecord {
    id: string;
    name: string;
    description: string;
    latex: string;
    operation: MatrixEquationOperation;
    operands: { [symbol: string]: MatrixEquationOperand };
    tags: string;
}

export interface MatrixEquationSummary {
    id: string;
    name: string;
    description?: string;
    latex?: string;
    kind?: MatrixEquationOperationKind;
    tags?: string;
}

export interface MatrixEquationValidateResponse {
    valid: boolean;
    errors: string[];
    warnings: string[];
    kind?: MatrixEquationOperationKind;
}

/** One operand slot the operation needs the user to fill. */
export interface OpSlot {
    /** Key on the operation object that names the operand symbol (e.g. 'a'). */
    key: 'a' | 'b' | 'scalar' | 'n';
    /** Default operand symbol to create. */
    symbol: string;
    label: string;
    /** What the slot accepts. 'matrix' = matrix or matrix-equation; 'scalar' =
     *  number or scalar-equation; 'int' = integer scalar. */
    role: 'matrix' | 'scalar' | 'int';
}

/** Styles an operand symbol for display (looks up its notation). */
export type Styler = (sym?: string) => string;

export interface OpMeta {
    kind: MatrixEquationOperationKind;
    label: string;
    /** True for the structured single-operations (the "Matrix Operations"
     *  quick-starts), false for the free Expression. */
    operation: boolean;
    slots: OpSlot[];
    elementwise?: boolean;
    expr?: boolean;
    /** Build display LaTeX from the operation, styling matrix operands via `sty`. */
    latex: (op: MatrixEquationOperation, sty: Styler) => string;
}

const M = (key: OpSlot['key'], symbol: string, label: string, role: OpSlot['role']): OpSlot =>
    ({ key, symbol, label, role });

export const OP_META: Record<MatrixEquationOperationKind, OpMeta> = {
    expr:        { kind: 'expr',    label: 'Expression (compose, e.g. A·B + C)', operation: false, slots: [], expr: true, latex: (o, s) => exprToLatex(o.expr || '', s) },
    matmul:      { kind: 'matmul',  label: 'Multiply (A·B)', operation: true, slots: [M('a','A','A','matrix'), M('b','B','B','matrix')], latex: (o,s) => `${s(o.a)}\\,${s(o.b)}` },
    add:         { kind: 'add',     label: 'Add (A+B)',      operation: true, slots: [M('a','A','A','matrix'), M('b','B','B','matrix')], latex: (o,s) => `${s(o.a)} + ${s(o.b)}` },
    subtract:    { kind: 'subtract',label: 'Subtract (A−B)', operation: true, slots: [M('a','A','A','matrix'), M('b','B','B','matrix')], latex: (o,s) => `${s(o.a)} - ${s(o.b)}` },
    hadamard:    { kind: 'hadamard',label: 'Hadamard (A∘B)', operation: true, slots: [M('a','A','A','matrix'), M('b','B','B','matrix')], latex: (o,s) => `${s(o.a)} \\circ ${s(o.b)}` },
    kron:        { kind: 'kron',    label: 'Kronecker (A⊗B)',operation: true, slots: [M('a','A','A','matrix'), M('b','B','B','matrix')], latex: (o,s) => `${s(o.a)} \\otimes ${s(o.b)}` },
    solve:       { kind: 'solve',   label: 'Solve (Ax=b)',   operation: true, slots: [M('a','A','A','matrix'), M('b','b','b','matrix')], latex: (o,s) => `${s(o.a)}^{-1}${s(o.b)}` },
    transpose:   { kind: 'transpose',label: 'Transpose (Aᵀ)',operation: true, slots: [M('a','A','A','matrix')], latex: (o,s) => `${s(o.a)}^{\\top}` },
    inverse:     { kind: 'inverse', label: 'Inverse (A⁻¹)',  operation: true, slots: [M('a','A','A','matrix')], latex: (o,s) => `${s(o.a)}^{-1}` },
    determinant: { kind: 'determinant', label: 'Determinant (det A)', operation: true, slots: [M('a','A','A','matrix')], latex: (o,s) => `\\det(${s(o.a)})` },
    trace:       { kind: 'trace',   label: 'Trace (tr A)',   operation: true, slots: [M('a','A','A','matrix')], latex: (o,s) => `\\operatorname{tr}(${s(o.a)})` },
    scalar_mul:  { kind: 'scalar_mul', label: 'Scalar multiply (c·A)', operation: true, slots: [M('scalar','c','c','scalar'), M('a','A','A','matrix')], latex: (o,s) => `${o.scalar||'c'}\\,${s(o.a)}` },
    power:       { kind: 'power',   label: 'Power (Aⁿ)',     operation: true, slots: [M('a','A','A','matrix'), M('n','n','n','int')], latex: (o,s) => `${s(o.a)}^{${o.n||'n'}}` },
    elementwise: { kind: 'elementwise', label: 'Elementwise f(x)', operation: true, slots: [M('a','A','A','matrix')], elementwise: true, latex: (o,s) => `f(${s(o.a)})` },
};

export const MATRIX_EQUATION_KINDS: MatrixEquationOperationKind[] =
    Object.keys(OP_META) as MatrixEquationOperationKind[];

/** Best-effort NumPy-expression → LaTeX. Styles operand symbols, expands the
 *  helper functions (innermost-first), and maps operators. Imperfect for deep
 *  nesting — the user can always hand-edit via the LaTeX dialog. */
export function exprToLatex(expr: string, sty: Styler, symbols: string[] = []): string {
    if (!expr || !expr.trim()) return '';
    let s = expr;
    // 1. style operand symbols (longest first so multi-letter names win)
    const syms = [...symbols].filter(Boolean).sort((a, b) => b.length - a.length);
    if (syms.length) {
        const re = new RegExp('\\b(' + syms.map(escapeRe).join('|') + ')\\b', 'g');
        s = s.replace(re, m => sty(m));
    }
    // 2. expand helper-function calls, innermost (parens-free) first
    const passes: Array<[RegExp, (m: RegExpMatchArray) => string]> = [
        [/T\(([^()]+)\)/, m => `\\left(${m[1]}\\right)^{\\top}`],
        [/inv\(([^()]+)\)/, m => `\\left(${m[1]}\\right)^{-1}`],
        [/det\(([^()]+)\)/, m => `\\det\\left(${m[1]}\\right)`],
        [/tr\(([^()]+)\)/, m => `\\operatorname{tr}\\left(${m[1]}\\right)`],
        [/diag\(([^()]+)\)/, m => `\\operatorname{diag}\\left(${m[1]}\\right)`],
        [/eye\(([^()]+)\)/, () => 'I'],
        [/kron\(([^(),]+),([^()]+)\)/, m => `${m[1]} \\otimes ${m[2]}`],
        [/dot\(([^(),]+),([^()]+)\)/, m => `${m[1]} \\cdot ${m[2]}`],
        [/solve\(([^(),]+),([^()]+)\)/, m => `\\left(${m[1]}\\right)^{-1}${m[2]}`],
    ];
    let prev = '';
    let guard = 0;
    while (s !== prev && guard++ < 50) {
        prev = s;
        for (const [re, fn] of passes) {
            const m = s.match(re);
            if (m) { s = s.slice(0, m.index!) + fn(m) + s.slice(m.index! + m[0].length); break; }
        }
    }
    // 3. operators
    s = s.replace(/\s*\*\*\s*([\w{}]+)/g, '^{$1}')
         .replace(/\s*@\s*/g, '\\,')
         .replace(/\s*\*\s*/g, ' \\cdot ');
    return s.trim();
}

function escapeRe(s: string): string { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

/** Default operands for an operation kind (so the editor has slots to fill). */
export function defaultOperandsFor(kind: MatrixEquationOperationKind): { [s: string]: MatrixEquationOperand } {
    const out: { [s: string]: MatrixEquationOperand } = {};
    for (const slot of OP_META[kind].slots) {
        out[slot.symbol] = slot.role === 'matrix'
            ? { kind: 'matrix', ref: '', notation: 'bold' }
            : { kind: 'scalar', value: slot.role === 'int' ? 2 : 1 };
    }
    return out;
}

/** Build a fresh operation object for a kind, wired to its default slot symbols. */
export function defaultOperationFor(kind: MatrixEquationOperationKind): MatrixEquationOperation {
    const op: MatrixEquationOperation = { kind };
    for (const slot of OP_META[kind].slots) (op as any)[slot.key] = slot.symbol;
    if (kind === 'elementwise') { op.symbol = 'x'; op.latex = 'x^2'; }
    if (kind === 'expr') op.expr = 'A @ B';
    return op;
}

/** New equations default to Expression mode with two matrix operands A, B. */
export function makeEmptyMatrixEquation(): MatrixEquationRecord {
    return {
        id: '', name: '', description: '',
        latex: '',
        operation: defaultOperationFor('expr'),
        operands: {
            A: { kind: 'matrix', ref: '', notation: 'bold' },
            B: { kind: 'matrix', ref: '', notation: 'bold' },
        },
        tags: '',
    };
}
