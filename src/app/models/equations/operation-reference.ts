// Author: Dustin Etts
// Catalog of every equation operation with the metadata needed by the
// Operation Selector popup: category, description, example LaTeX, and a
// structured list of inputs (each with its own description + implications).
//
// Categories group related operations (Calculus, Algebra, etc.) and drive
// the accordion in the selector popup — same pattern as the symbol palette
// sidebar so users have a consistent mental model for both.

import { EquationOperationType } from './EquationDefinition';

export interface OperationInputSpec {
    /** Internal field key (e.g. `variable`, `lower`, `upper`, `function`, `method`). */
    name: string;
    /** Human label shown in the form. */
    label: string;
    /** What this input represents and why it matters. */
    description: string;
    /** Optional caveat — what changes if the user gets this wrong / picks a non-default. */
    implication?: string;
    optional?: boolean;
}

export interface OperationReferenceEntry {
    operation: EquationOperationType;
    label: string;
    /** Category for grouping in the selector popup. */
    category: string;
    /** Material icon used in the category header / op tile. */
    icon: string;
    /** Plain-language one-liner. */
    description: string;
    /** LaTeX patterns the user typically writes for this operation. */
    latexPatterns: string[];
    /** Example LaTeX expression the user could try. */
    exampleLatex: string;
    /** Structured inputs for the operation. Empty list = no extra inputs. */
    inputs: OperationInputSpec[];
    /** True when the result is a Python boolean (rendered True/False, not 1/0). */
    booleanResult: boolean;
    /** Optional notes on edge cases / implications a user should know. */
    notes?: string[];
}

/** Display order for category accordions. */
export const OPERATION_CATEGORIES: { name: string; icon: string; description: string }[] = [
    { name: 'Calculus', icon: 'trending_up', description: 'Differentiation, integration, limits.' },
    { name: 'Differential Equations', icon: 'scatter_plot', description: 'Symbolic ODE / PDE solving.' },
    { name: 'Algebra', icon: 'functions', description: 'Symbolic manipulation: simplify, expand, factor, solve.' },
    { name: 'Series', icon: 'stacked_line_chart', description: 'Series and sequence expansions.' },
    { name: 'Evaluation', icon: 'calculate', description: 'Substitute and compute, including piecewise.' },
    { name: 'Boolean / Logic', icon: 'rule', description: 'Operations whose result is a True / False boolean.' },
    { name: 'DataSeries (numeric)', icon: 'show_chart', description: 'Numerical operations on sampled arrays.' },
];

export const OPERATION_REFERENCE: OperationReferenceEntry[] = [
    // ============================ Calculus ============================
    {
        operation: 'derivative',
        label: 'Derivative',
        category: 'Calculus',
        icon: 'trending_up',
        description: 'Take the symbolic derivative of an expression with respect to a variable.',
        latexPatterns: ['\\frac{d}{dx}', '\\frac{\\partial}{\\partial x}', '\\nabla', '\\dot{x}'],
        exampleLatex: '\\sin(x) \\cdot x^2',
        inputs: [
            {
                name: 'variable',
                label: 'Variable to differentiate with respect to',
                description: 'Symbol the operation acts on. Default `x`.',
                implication: 'If your expression has multiple free symbols, this picks which one is the dependent variable. Others are treated as constants.',
            },
        ],
        booleanResult: false,
    },
    {
        operation: 'integral_definite',
        label: 'Definite Integral',
        category: 'Calculus',
        icon: 'integration_instructions',
        description: 'Integrate an expression over a fixed numeric range.',
        latexPatterns: ['\\int_{a}^{b}', '\\iint_{a}^{b}', '\\oint_{a}^{b}'],
        exampleLatex: '\\sin(x)',
        inputs: [
            {
                name: 'variable',
                label: 'Integration variable',
                description: 'Symbol you are integrating with respect to.',
                implication: 'Must match a free symbol in the expression. If absent, the integral is just `expr · (upper − lower)`.',
            },
            {
                name: 'lower',
                label: 'Lower bound',
                description: 'Bound where integration starts. Numeric or LaTeX (e.g. `0`, `-\\pi/2`).',
            },
            {
                name: 'upper',
                label: 'Upper bound',
                description: 'Bound where integration ends.',
                implication: 'If `upper < lower`, SymPy returns the negative of the reversed integral.',
            },
        ],
        booleanResult: false,
    },
    {
        operation: 'integral_indefinite',
        label: 'Indefinite Integral',
        category: 'Calculus',
        icon: 'integration_instructions',
        description: 'Find an antiderivative — integration without bounds. Result includes an implicit constant of integration.',
        latexPatterns: ['\\int', '\\iint', '\\oint'],
        exampleLatex: 'x^2',
        inputs: [
            {
                name: 'variable',
                label: 'Integration variable',
                description: 'Symbol you are integrating with respect to.',
            },
        ],
        booleanResult: false,
        notes: [
            'SymPy does not append `+ C` automatically; the result is one antiderivative. Add the constant downstream if you need it.',
        ],
    },
    {
        operation: 'limit',
        label: 'Limit',
        category: 'Calculus',
        icon: 'trending_flat',
        description: 'Compute the limit of an expression as a variable approaches a point.',
        latexPatterns: ['\\lim', '\\lim_{x \\to 0}', '\\lim_{x \\to \\infty}'],
        exampleLatex: '\\frac{\\sin(x)}{x}',
        inputs: [
            { name: 'variable', label: 'Variable', description: 'The variable taking the limit.' },
            {
                name: 'point',
                label: 'Approach point',
                description: 'Value the variable approaches. Use `\\infty` or `-\\infty` for unbounded limits.',
            },
            {
                name: 'direction',
                label: 'Direction (optional)',
                description: '`+` for limit from above, `-` for from below, blank for two-sided.',
                implication: 'Some limits exist only one-sided (e.g. `\\sqrt{x}` at 0). Two-sided will return UNDEFINED in those cases.',
                optional: true,
            },
        ],
        booleanResult: false,
    },

    // ===================== Differential Equations =====================
    {
        operation: 'ode_solve',
        label: 'ODE Solve',
        category: 'Differential Equations',
        icon: 'scatter_plot',
        description: 'Symbolically solve an ordinary differential equation for an unknown function.',
        latexPatterns: ["y'(x)", "z'(t)", '\\frac{dy}{dx}'],
        exampleLatex: "y'(x) - y(x)",
        inputs: [
            {
                name: 'function',
                label: 'Unknown function declaration',
                description: 'The function to solve for, e.g. `y(x)`. Must include the independent variable in parentheses.',
                implication: 'SymPy treats this symbol as the unknown; everything else in the expression becomes a constant or independent variable.',
            },
            {
                name: 'variable',
                label: 'Independent variable',
                description: 'Variable inside the function declaration (e.g. `x` in `y(x)`).',
            },
        ],
        booleanResult: false,
        notes: [
            "SymPy's parse_latex needs explicit derivative notation. Write `y'(x) - y(x) = 0` (or `y'(x) - y(x)`) rather than `dy/dx = y`.",
            "The result is a general solution containing arbitrary constants `C1`, `C2`, etc.",
        ],
    },
    {
        operation: 'pde_solve',
        label: 'PDE Solve',
        category: 'Differential Equations',
        icon: 'grid_view',
        description: 'Symbolically solve a partial differential equation. SymPy supports a limited class of PDEs (mostly first-order linear).',
        latexPatterns: ['\\frac{\\partial}{\\partial x} u(x,t)'],
        exampleLatex: '\\frac{\\partial u(x,t)}{\\partial t} - \\frac{\\partial u(x,t)}{\\partial x}',
        inputs: [
            {
                name: 'function',
                label: 'Unknown function declaration',
                description: 'Multivariate function like `u(x,t)`.',
                implication: 'The argument list defines the independent variables. Each argument must appear in the expression as a partial.',
            },
        ],
        booleanResult: false,
        notes: [
            'SymPy handles only some PDE classes — first-order linear, certain second-order, etc. Many real-world PDEs require numerical methods (FEniCS, Py-PDE, etc.) outside this system.',
        ],
    },

    // ============================ Algebra =============================
    {
        operation: 'simplify',
        label: 'Simplify',
        category: 'Algebra',
        icon: 'auto_fix_high',
        description: 'Algebraically simplify the expression: cancel, combine like terms, apply trig identities, etc.',
        latexPatterns: ['(any expression)'],
        exampleLatex: '\\sin(x)^2 + \\cos(x)^2',
        inputs: [],
        booleanResult: false,
        notes: [
            "`simplify` tries multiple heuristics — it's slower than `expand`/`factor` but gets the cleanest form.",
        ],
    },
    {
        operation: 'expand',
        label: 'Expand',
        category: 'Algebra',
        icon: 'unfold_more',
        description: 'Expand polynomial / algebraic products and distribute over sums.',
        latexPatterns: ['(x+1)(x-1)', '(a+b)^n'],
        exampleLatex: '(x + 1)(x - 1)',
        inputs: [],
        booleanResult: false,
    },
    {
        operation: 'factor',
        label: 'Factor',
        category: 'Algebra',
        icon: 'unfold_less',
        description: 'Factor a polynomial into a product of simpler polynomials.',
        latexPatterns: ['x^2 - 4', 'x^3 - 1'],
        exampleLatex: 'x^2 - 4',
        inputs: [],
        booleanResult: false,
        notes: [
            'Works over the rationals by default. For factoring over `Q[i]` / extensions, do it in SymPy directly — not exposed in this UI yet.',
        ],
    },
    {
        operation: 'solve',
        label: 'Solve',
        category: 'Algebra',
        icon: 'troubleshoot',
        description: 'Find values of a variable that make the expression equal to zero.',
        latexPatterns: ['x^2 - 4', 'a x + b'],
        exampleLatex: 'x^2 - 4',
        inputs: [
            {
                name: 'variable',
                label: 'Variable to solve for',
                description: 'Symbol whose roots you want.',
                implication: 'Other free symbols are treated as parameters and may appear in the answer.',
            },
        ],
        booleanResult: false,
        notes: [
            'Treats the expression as `expr = 0`. To solve `f(x) = g(x)`, write `f(x) - g(x)` instead.',
            'Returns a list of solutions. Empty list means no symbolic solution found.',
        ],
    },

    // ============================ Series =============================
    {
        operation: 'series',
        label: 'Series Expansion',
        category: 'Series',
        icon: 'stacked_line_chart',
        description: 'Compute the Taylor / power series expansion of an expression around a point.',
        latexPatterns: ['e^x', '\\sin(x)', '(any analytic expression)'],
        exampleLatex: 'e^x',
        inputs: [
            { name: 'variable', label: 'Variable', description: 'The expansion variable.' },
            {
                name: 'point',
                label: 'Expansion point',
                description: 'Value to expand around. Use `0` for Maclaurin series.',
            },
            {
                name: 'order',
                label: 'Order — number of terms to keep',
                description: 'Truncation order. Higher = more accurate, slower.',
                implication: 'The output excludes the `O(x^n)` remainder term. To inspect the remainder, run series via SymPy directly.',
            },
        ],
        booleanResult: false,
    },

    // ========================== Evaluation ===========================
    {
        operation: 'evaluate',
        label: 'Evaluate',
        category: 'Evaluation',
        icon: 'calculate',
        description: 'Substitute variable bindings into the expression and compute a numeric value.',
        latexPatterns: ['(any expression with variables)'],
        exampleLatex: '3x + 5',
        inputs: [],
        booleanResult: false,
        notes: [
            'Returns a numeric value when all free symbols are bound, otherwise a partially-substituted symbolic form.',
            'Supply variable values via the **Variable Bindings** section below.',
        ],
    },
    {
        operation: 'piecewise_evaluate',
        label: 'Piecewise / Conditional',
        category: 'Evaluation',
        icon: 'alt_route',
        description: 'Evaluate a multi-branch case expression. The branch whose condition is true at runtime is the result.',
        latexPatterns: ['\\begin{cases} ... \\end{cases}'],
        exampleLatex: '\\begin{cases} x & x \\geq 0 \\\\ -x & \\text{otherwise} \\end{cases}',
        inputs: [],
        booleanResult: false,
        notes: [
            "SymPy's `parse_latex` does not handle `\\begin{cases}`; the backend has a custom parser.",
            'Conditions are LaTeX expressions like `x > 0`, `x = 1`, or `\\text{otherwise}` (treated as the default).',
        ],
    },

    // ======================== Boolean / Logic =========================
    {
        operation: 'evaluate_predicate',
        label: 'Evaluate Predicate',
        category: 'Boolean / Logic',
        icon: 'rule',
        description: 'Substitute bindings into a comparison or inequality and reduce to True / False.',
        latexPatterns: ['x > 0', 'a \\leq b', 'p \\neq q'],
        exampleLatex: 'x > 0',
        inputs: [],
        booleanResult: true,
        notes: [
            'The expression must be a relational form (uses `<`, `>`, `\\leq`, `\\geq`, `\\neq`, or `=`).',
            'Result is a real Python boolean — output renders as **True** or **False**, not 1 / 0.',
        ],
    },
    {
        operation: 'is_identity',
        label: 'Check Identity',
        category: 'Boolean / Logic',
        icon: 'rule_folder',
        description: 'Verify that LHS = RHS holds for every value of the free variables (i.e. the equality is an identity).',
        latexPatterns: ['\\sin^2(x) + \\cos^2(x) = 1'],
        exampleLatex: '\\sin(x)^2 + \\cos(x)^2 = 1',
        inputs: [],
        booleanResult: true,
        notes: [
            'Internally checks `simplify(LHS - RHS) == 0`. If SymPy can\'t simplify, identity may return False even when mathematically true.',
        ],
    },

    // =================== DataSeries (numeric arrays) ==================
    {
        operation: 'dataseries_derivative',
        label: 'DataSeries Derivative',
        category: 'DataSeries (numeric)',
        icon: 'show_chart',
        description: 'Numerical first derivative of a sampled dataseries via finite differences (NumPy `np.gradient`).',
        latexPatterns: ['(operates on a dataseries variable, not a LaTeX expression)'],
        exampleLatex: '',
        inputs: [
            {
                name: 'dataseriesVariable',
                label: 'DataSeries variable name',
                description: 'Name of the binding holding the numeric array of y-values.',
                implication: 'Must be supplied via Variable Bindings as a list of numbers.',
            },
            {
                name: 'x',
                label: 'X-grid (optional)',
                description: 'Optional binding for the x-coordinates if the data is not uniformly spaced.',
                implication: 'Without it, `np.gradient` assumes unit spacing (Δx = 1).',
                optional: true,
            },
        ],
        booleanResult: false,
    },
    {
        operation: 'dataseries_integral',
        label: 'DataSeries Integral',
        category: 'DataSeries (numeric)',
        icon: 'area_chart',
        description: 'Numerical integration of a sampled dataseries (trapezoidal or Simpson rule).',
        latexPatterns: ['(operates on a dataseries variable)'],
        exampleLatex: '',
        inputs: [
            {
                name: 'dataseriesVariable',
                label: 'DataSeries variable name',
                description: 'Name of the binding holding the numeric array of y-values.',
            },
            {
                name: 'method',
                label: 'Numerical method',
                description: '`Trapezoidal Rule` (default) or `Simpson\'s Rule` (more accurate but requires evenly-spaced data).',
                implication: 'Simpson requires an odd number of samples; falls back to trapezoidal otherwise.',
            },
        ],
        booleanResult: false,
    },
    {
        operation: 'dataseries_ode_solve',
        label: 'DataSeries ODE Solve',
        category: 'DataSeries (numeric)',
        icon: 'multiline_chart',
        description: 'Numerically solve an initial-value ODE on a t-grid via `scipy.integrate.solve_ivp`.',
        latexPatterns: ['f(t, y) = ...'],
        exampleLatex: '-y',
        inputs: [
            {
                name: 'dataseriesVariable',
                label: 'T-grid variable',
                description: 'Numeric array of t-values where the solution is evaluated.',
            },
            {
                name: 'y0',
                label: 'Initial value y(t₀)',
                description: 'Value of `y` at the first t-grid point.',
            },
            {
                name: 'method',
                label: 'Integrator',
                description: 'RK45 (default), DOP853, Radau, BDF, or LSODA.',
                implication: 'RK45 is fast for non-stiff problems. Use BDF / LSODA for stiff systems.',
            },
        ],
        booleanResult: false,
        notes: [
            'The LaTeX expression here is the right-hand side `f(t, y)`. The system is `dy/dt = f(t, y)`.',
        ],
    },
];
