// Catalog of matrix-operation snippets for the Expression editor's palette
// toolbar — the matrix analogue of SymbolPalette.ts (the LaTeX palette).
//
// Each entry inserts a NumPy-expression `snippet` at the caret. `cursorOffset`
// (chars from the END of the snippet) lands the caret inside a template — e.g.
// `inv(│)` so the user can immediately type the operand.

export interface MatrixOpPaletteEntry {
    /** NumPy-expression fragment inserted at the caret. */
    snippet: string;
    /** Caret lands this many chars from the end of the snippet (template fill). */
    cursorOffset?: number;
    /** Short human label. */
    label: string;
    /** One-line tooltip explanation. */
    description: string;
}

export interface MatrixOpPaletteCategory {
    name: string;
    icon?: string;
    entries: MatrixOpPaletteEntry[];
}

export const MATRIX_OP_PALETTE: MatrixOpPaletteCategory[] = [
    {
        name: 'Products', icon: 'close',
        entries: [
            { snippet: ' @ ',        label: 'Matmul',     description: 'Matrix multiplication  A @ B.' },
            { snippet: ' * ',        label: 'Hadamard',   description: 'Elementwise product  A * B.' },
            { snippet: 'kron(, )',   cursorOffset: 3, label: 'Kronecker', description: 'Kronecker product  kron(A, B).' },
            { snippet: 'dot(, )',    cursorOffset: 3, label: 'Dot',       description: 'Dot product  dot(A, B).' },
        ],
    },
    {
        name: 'Transforms', icon: 'transform',
        entries: [
            { snippet: 'T()',        cursorOffset: 1, label: 'Transpose', description: 'Transpose  T(A) = Aᵀ.' },
            { snippet: 'inv()',      cursorOffset: 1, label: 'Inverse',   description: 'Matrix inverse  inv(A) = A⁻¹.' },
            { snippet: ' ** 2',      label: 'Power',     description: 'Matrix power  A ** n.' },
            { snippet: 'solve(, )',  cursorOffset: 3, label: 'Solve',     description: 'Solve  solve(A, b) = A⁻¹b.' },
        ],
    },
    {
        name: 'Reductions', icon: 'functions',
        entries: [
            { snippet: 'det()',      cursorOffset: 1, label: 'Determinant', description: 'Determinant  det(A) → scalar.' },
            { snippet: 'tr()',       cursorOffset: 1, label: 'Trace',       description: 'Trace  tr(A) → scalar.' },
        ],
    },
    {
        name: 'Build', icon: 'grid_on',
        entries: [
            { snippet: 'eye(2)',     label: 'Identity', description: 'Identity matrix  eye(n).' },
            { snippet: 'diag([])',   cursorOffset: 2, label: 'Diagonal', description: 'Diagonal matrix  diag([d1, d2, …]).' },
        ],
    },
    {
        name: 'Operators', icon: 'add',
        entries: [
            { snippet: ' + ',        label: 'Add',      description: 'Addition.' },
            { snippet: ' - ',        label: 'Subtract', description: 'Subtraction.' },
            { snippet: ' * ',        label: 'Scalar ×', description: 'Scalar multiply  2 * A.' },
            { snippet: '()',         cursorOffset: 1, label: 'Group', description: 'Parentheses for grouping.' },
        ],
    },
];
