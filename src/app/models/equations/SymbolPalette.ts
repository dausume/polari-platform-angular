// Author: Dustin Etts
// Catalog of LaTeX symbol palette entries used by EquationSymbolPaletteComponent.
//
// Each entry powers ONE button in the sidebar:
//   - `latex`           the snippet inserted into the LaTeX textarea on click
//   - `cursorOffset`    when set, the cursor lands `cursorOffset` chars from the
//                       END of the inserted text (used for `\frac{│}{}`-style
//                       templates so the user can immediately type the numerator)
//   - `label`           short human name shown beneath the rendered symbol
//                       ("Partial Derivative")
//   - `description`     one-line explanation shown in the tooltip
//   - `docsUrl`         link to the relevant KaTeX docs section (KaTeX is the
//                       library we use to render the preview, so its supported-
//                       commands page is the most directly applicable reference
//                       for our users)

export interface SymbolPaletteEntry {
    /** LaTeX snippet inserted into the textarea on click. */
    latex: string;
    /** Optional: cursor lands this many chars from the end of the insert. */
    cursorOffset?: number;
    /** Short human label. */
    label: string;
    /** One-line description used in the hover tooltip. */
    description: string;
    /** Direct link to the most relevant KaTeX docs anchor. */
    docsUrl: string;
}

export interface SymbolPaletteCategory {
    /** Human-readable name shown on the accordion header. */
    name: string;
    /** Optional Material icon shown next to the category name. */
    icon?: string;
    /** Buttons in the category. */
    entries: SymbolPaletteEntry[];
}

const KATEX_DOCS = 'https://katex.org/docs/supported.html';

export const SYMBOL_PALETTE_CATEGORIES: SymbolPaletteCategory[] = [
    {
        name: 'Operators',
        icon: 'add',
        entries: [
            { latex: '+ ',                 label: 'Plus',           description: 'Addition.',                                       docsUrl: `${KATEX_DOCS}#operators-and-relations` },
            { latex: '- ',                 label: 'Minus',          description: 'Subtraction.',                                    docsUrl: `${KATEX_DOCS}#operators-and-relations` },
            { latex: '\\times ',           label: 'Times',          description: 'Multiplication symbol (×).',                      docsUrl: `${KATEX_DOCS}#operators-and-relations` },
            { latex: '\\div ',             label: 'Divide',         description: 'Division symbol (÷).',                            docsUrl: `${KATEX_DOCS}#operators-and-relations` },
            { latex: '\\cdot ',            label: 'Dot Product',    description: 'Multiplication dot (·).',                         docsUrl: `${KATEX_DOCS}#operators-and-relations` },
            { latex: '\\pm ',              label: 'Plus-Minus',     description: '± — both signs.',                                 docsUrl: `${KATEX_DOCS}#operators-and-relations` },
            { latex: '= ',                 label: 'Equals',         description: 'Equality.',                                       docsUrl: `${KATEX_DOCS}#operators-and-relations` },
            { latex: '\\neq ',             label: 'Not Equals',     description: 'Inequality (≠).',                                 docsUrl: `${KATEX_DOCS}#operators-and-relations` },
            { latex: '< ',                 label: 'Less Than',      description: 'Strict less-than.',                               docsUrl: `${KATEX_DOCS}#operators-and-relations` },
            { latex: '\\leq ',             label: 'Less or Equal',  description: '≤',                                               docsUrl: `${KATEX_DOCS}#operators-and-relations` },
            { latex: '> ',                 label: 'Greater Than',   description: 'Strict greater-than.',                            docsUrl: `${KATEX_DOCS}#operators-and-relations` },
            { latex: '\\geq ',             label: 'Greater or Eq',  description: '≥',                                               docsUrl: `${KATEX_DOCS}#operators-and-relations` },
            { latex: '\\approx ',          label: 'Approximately',  description: 'Approximate equality (≈).',                       docsUrl: `${KATEX_DOCS}#operators-and-relations` },
        ]
    },
    {
        name: 'Differentiation',
        icon: 'trending_up',
        entries: [
            { latex: '\\frac{d}{dx} ',                 label: 'Derivative',         description: 'First-order derivative w.r.t. x.',                                 docsUrl: `${KATEX_DOCS}#math-operators` },
            { latex: '\\frac{d^{2}}{dx^{2}} ',         label: 'Second Derivative',  description: 'Second-order derivative w.r.t. x.',                                docsUrl: `${KATEX_DOCS}#math-operators` },
            { latex: '\\frac{\\partial}{\\partial x} ', label: 'Partial Derivative', description: 'First-order partial derivative w.r.t. x. Used in PDEs and multivariable calculus.', docsUrl: `${KATEX_DOCS}#operators-and-relations` },
            { latex: '\\frac{\\partial^{2}}{\\partial x^{2}} ', label: '∂² / ∂x²',     description: 'Second-order partial derivative w.r.t. x.',                       docsUrl: `${KATEX_DOCS}#operators-and-relations` },
            { latex: '\\partial ',                     label: 'Partial Symbol',     description: 'The bare partial-differential symbol (∂).',                       docsUrl: `${KATEX_DOCS}#operators-and-relations` },
            { latex: '\\nabla ',                       label: 'Nabla / Del',        description: 'Gradient operator (∇). Used in vector calculus.',                 docsUrl: `${KATEX_DOCS}#operators-and-relations` },
            { latex: '\\Delta ',                       label: 'Delta / Laplacian',  description: 'Δ — finite difference, or as Laplacian operator (∇²).',           docsUrl: `${KATEX_DOCS}#letters-and-unicode` },
            { latex: '\\dot{x} ',                      label: 'Time Derivative',    description: 'ẋ — Newton notation for first time derivative.',                   docsUrl: `${KATEX_DOCS}#accents` },
            { latex: '\\ddot{x} ',                     label: '2nd Time Deriv.',    description: 'ẍ — second time derivative.',                                     docsUrl: `${KATEX_DOCS}#accents` },
            { latex: "y'(x) ",                         label: 'Prime',              description: "y'(x) — Lagrange notation for derivative. Required form for SymPy ode_solve.", docsUrl: `${KATEX_DOCS}#operators-and-relations` },
        ]
    },
    {
        name: 'Integrals',
        icon: 'integration_instructions',
        entries: [
            { latex: '\\int ',                  label: 'Integral',          description: 'Indefinite integral. Pair with `dx` for what you integrate over.', docsUrl: `${KATEX_DOCS}#big-operators` },
            { latex: '\\int_{}^{} ',            cursorOffset: 5, label: 'Definite Integral', description: 'Definite integral with lower and upper bounds.',                  docsUrl: `${KATEX_DOCS}#big-operators` },
            { latex: '\\iint ',                 label: 'Double Integral',   description: 'Double integral (∬) — used for area / surface integrals.',                          docsUrl: `${KATEX_DOCS}#big-operators` },
            { latex: '\\iiint ',                label: 'Triple Integral',   description: 'Triple integral (∭) — used for volume integrals.',                                  docsUrl: `${KATEX_DOCS}#big-operators` },
            { latex: '\\oint ',                 label: 'Contour Integral',  description: 'Closed-loop / contour integral (∮).',                                                docsUrl: `${KATEX_DOCS}#big-operators` },
            { latex: '\\, dx ',                 label: 'dx',                description: 'Differential element with thin space — append after the integrand.',                  docsUrl: `${KATEX_DOCS}#spacing` },
        ]
    },
    {
        name: 'Series & Limits',
        icon: 'functions',
        entries: [
            { latex: '\\sum ',                              label: 'Summation',     description: 'Generic summation (Σ).',                                       docsUrl: `${KATEX_DOCS}#big-operators` },
            { latex: '\\sum_{n=0}^{\\infty} ',              label: 'Σ to ∞',         description: 'Infinite summation from n = 0 to ∞.',                          docsUrl: `${KATEX_DOCS}#big-operators` },
            { latex: '\\sum_{i=1}^{n} ',                    label: 'Σ to n',         description: 'Finite summation from i = 1 to n.',                            docsUrl: `${KATEX_DOCS}#big-operators` },
            { latex: '\\prod ',                             label: 'Product',       description: 'Generic product (Π).',                                         docsUrl: `${KATEX_DOCS}#big-operators` },
            { latex: '\\prod_{i=1}^{n} ',                   label: 'Π to n',         description: 'Finite product from i = 1 to n.',                              docsUrl: `${KATEX_DOCS}#big-operators` },
            { latex: '\\lim_{x \\to 0} ',                   label: 'Limit at 0',    description: 'Limit as x approaches 0.',                                     docsUrl: `${KATEX_DOCS}#math-operators` },
            { latex: '\\lim_{x \\to \\infty} ',             label: 'Limit at ∞',     description: 'Limit as x approaches infinity.',                              docsUrl: `${KATEX_DOCS}#math-operators` },
            { latex: '\\lim_{x \\to } ',  cursorOffset: 2,  label: 'Limit at ?',    description: 'Limit with custom approach point.',                            docsUrl: `${KATEX_DOCS}#math-operators` },
            { latex: '\\infty ',                            label: 'Infinity',      description: 'Infinity symbol (∞).',                                         docsUrl: `${KATEX_DOCS}#letters-and-unicode` },
        ]
    },
    {
        name: 'Functions',
        icon: 'show_chart',
        entries: [
            { latex: '\\sin ',                  label: 'sin',           description: 'Sine.',                                                   docsUrl: `${KATEX_DOCS}#math-operators` },
            { latex: '\\cos ',                  label: 'cos',           description: 'Cosine.',                                                 docsUrl: `${KATEX_DOCS}#math-operators` },
            { latex: '\\tan ',                  label: 'tan',           description: 'Tangent.',                                                docsUrl: `${KATEX_DOCS}#math-operators` },
            { latex: '\\arcsin ',               label: 'arcsin',        description: 'Inverse sine.',                                           docsUrl: `${KATEX_DOCS}#math-operators` },
            { latex: '\\arccos ',               label: 'arccos',        description: 'Inverse cosine.',                                         docsUrl: `${KATEX_DOCS}#math-operators` },
            { latex: '\\arctan ',               label: 'arctan',        description: 'Inverse tangent.',                                        docsUrl: `${KATEX_DOCS}#math-operators` },
            { latex: '\\sinh ',                 label: 'sinh',          description: 'Hyperbolic sine.',                                        docsUrl: `${KATEX_DOCS}#math-operators` },
            { latex: '\\cosh ',                 label: 'cosh',          description: 'Hyperbolic cosine.',                                      docsUrl: `${KATEX_DOCS}#math-operators` },
            { latex: '\\log ',                  label: 'log',           description: 'Logarithm (base 10 by convention).',                      docsUrl: `${KATEX_DOCS}#math-operators` },
            { latex: '\\ln ',                   label: 'ln',            description: 'Natural logarithm.',                                      docsUrl: `${KATEX_DOCS}#math-operators` },
            { latex: '\\exp ',                  label: 'exp',           description: 'Exponential function.',                                   docsUrl: `${KATEX_DOCS}#math-operators` },
            { latex: 'e^{}',  cursorOffset: 1,  label: 'e^x',           description: 'Exponential — cursor lands inside the superscript braces.', docsUrl: `${KATEX_DOCS}#math-operators` },
            { latex: '\\sqrt{}', cursorOffset: 1, label: 'Square Root', description: 'Square root — cursor lands inside the radicand braces.',  docsUrl: `${KATEX_DOCS}#delimiters` },
            { latex: '\\sqrt[n]{}', cursorOffset: 1, label: 'n-th Root', description: 'n-th root with custom index.',                            docsUrl: `${KATEX_DOCS}#delimiters` },
            { latex: '|x| ',                    label: 'Absolute Value', description: '|x| — absolute value bars.',                              docsUrl: `${KATEX_DOCS}#delimiters` },
        ]
    },
    {
        name: 'Greek Letters',
        icon: 'translate',
        entries: [
            { latex: '\\alpha ',  label: 'α', description: 'Greek alpha.',         docsUrl: `${KATEX_DOCS}#letters-and-unicode` },
            { latex: '\\beta ',   label: 'β', description: 'Greek beta.',          docsUrl: `${KATEX_DOCS}#letters-and-unicode` },
            { latex: '\\gamma ',  label: 'γ', description: 'Greek gamma.',         docsUrl: `${KATEX_DOCS}#letters-and-unicode` },
            { latex: '\\delta ',  label: 'δ', description: 'Greek delta.',         docsUrl: `${KATEX_DOCS}#letters-and-unicode` },
            { latex: '\\epsilon ',label: 'ε', description: 'Greek epsilon.',       docsUrl: `${KATEX_DOCS}#letters-and-unicode` },
            { latex: '\\zeta ',   label: 'ζ', description: 'Greek zeta.',          docsUrl: `${KATEX_DOCS}#letters-and-unicode` },
            { latex: '\\eta ',    label: 'η', description: 'Greek eta.',           docsUrl: `${KATEX_DOCS}#letters-and-unicode` },
            { latex: '\\theta ',  label: 'θ', description: 'Greek theta.',         docsUrl: `${KATEX_DOCS}#letters-and-unicode` },
            { latex: '\\lambda ', label: 'λ', description: 'Greek lambda.',        docsUrl: `${KATEX_DOCS}#letters-and-unicode` },
            { latex: '\\mu ',     label: 'μ', description: 'Greek mu.',            docsUrl: `${KATEX_DOCS}#letters-and-unicode` },
            { latex: '\\pi ',     label: 'π', description: 'Greek pi (≈ 3.14159).',docsUrl: `${KATEX_DOCS}#letters-and-unicode` },
            { latex: '\\rho ',    label: 'ρ', description: 'Greek rho.',           docsUrl: `${KATEX_DOCS}#letters-and-unicode` },
            { latex: '\\sigma ',  label: 'σ', description: 'Greek sigma.',         docsUrl: `${KATEX_DOCS}#letters-and-unicode` },
            { latex: '\\tau ',    label: 'τ', description: 'Greek tau.',           docsUrl: `${KATEX_DOCS}#letters-and-unicode` },
            { latex: '\\phi ',    label: 'φ', description: 'Greek phi.',           docsUrl: `${KATEX_DOCS}#letters-and-unicode` },
            { latex: '\\omega ',  label: 'ω', description: 'Greek omega.',         docsUrl: `${KATEX_DOCS}#letters-and-unicode` },
            { latex: '\\Gamma ',  label: 'Γ', description: 'Capital Gamma.',       docsUrl: `${KATEX_DOCS}#letters-and-unicode` },
            { latex: '\\Delta ',  label: 'Δ', description: 'Capital Delta.',       docsUrl: `${KATEX_DOCS}#letters-and-unicode` },
            { latex: '\\Theta ',  label: 'Θ', description: 'Capital Theta.',       docsUrl: `${KATEX_DOCS}#letters-and-unicode` },
            { latex: '\\Lambda ', label: 'Λ', description: 'Capital Lambda.',      docsUrl: `${KATEX_DOCS}#letters-and-unicode` },
            { latex: '\\Sigma ',  label: 'Σ', description: 'Capital Sigma.',       docsUrl: `${KATEX_DOCS}#letters-and-unicode` },
            { latex: '\\Phi ',    label: 'Φ', description: 'Capital Phi.',         docsUrl: `${KATEX_DOCS}#letters-and-unicode` },
            { latex: '\\Omega ',  label: 'Ω', description: 'Capital Omega.',       docsUrl: `${KATEX_DOCS}#letters-and-unicode` },
        ]
    },
    {
        name: 'Sets & Logic',
        icon: 'category',
        entries: [
            { latex: '\\in ',           label: 'Element Of',     description: 'x ∈ S — x is an element of set S.',         docsUrl: `${KATEX_DOCS}#operators-and-relations` },
            { latex: '\\notin ',        label: 'Not In',         description: '∉',                                          docsUrl: `${KATEX_DOCS}#operators-and-relations` },
            { latex: '\\subset ',       label: 'Subset',         description: '⊂',                                          docsUrl: `${KATEX_DOCS}#operators-and-relations` },
            { latex: '\\subseteq ',     label: 'Subset or Eq',   description: '⊆',                                          docsUrl: `${KATEX_DOCS}#operators-and-relations` },
            { latex: '\\cup ',          label: 'Union',          description: 'Set union (∪).',                             docsUrl: `${KATEX_DOCS}#operators-and-relations` },
            { latex: '\\cap ',          label: 'Intersection',   description: 'Set intersection (∩).',                      docsUrl: `${KATEX_DOCS}#operators-and-relations` },
            { latex: '\\emptyset ',     label: 'Empty Set',      description: '∅',                                          docsUrl: `${KATEX_DOCS}#letters-and-unicode` },
            { latex: '\\forall ',       label: 'For All',        description: '∀ — universal quantifier.',                  docsUrl: `${KATEX_DOCS}#operators-and-relations` },
            { latex: '\\exists ',       label: 'There Exists',   description: '∃ — existential quantifier.',                docsUrl: `${KATEX_DOCS}#operators-and-relations` },
            { latex: '\\to ',           label: 'Maps To',        description: '→ — used in limits, function notation, etc.', docsUrl: `${KATEX_DOCS}#operators-and-relations` },
            { latex: '\\Rightarrow ',   label: 'Implies',         description: '⇒',                                          docsUrl: `${KATEX_DOCS}#operators-and-relations` },
            { latex: '\\Leftrightarrow ',label: 'Iff',           description: '⇔ — if and only if.',                        docsUrl: `${KATEX_DOCS}#operators-and-relations` },
            { latex: '\\mathbb{R} ',    label: 'Reals',          description: 'ℝ — set of real numbers.',                   docsUrl: `${KATEX_DOCS}#letters-and-unicode` },
            { latex: '\\mathbb{N} ',    label: 'Naturals',       description: 'ℕ',                                          docsUrl: `${KATEX_DOCS}#letters-and-unicode` },
            { latex: '\\mathbb{Z} ',    label: 'Integers',       description: 'ℤ',                                          docsUrl: `${KATEX_DOCS}#letters-and-unicode` },
        ]
    },
    {
        name: 'Structures',
        icon: 'view_module',
        entries: [
            { latex: '\\frac{}{}',  cursorOffset: 3, label: 'Fraction',     description: 'Numerator / denominator. Cursor lands in the numerator.',  docsUrl: `${KATEX_DOCS}#fractions-and-binomials` },
            { latex: '^{}',         cursorOffset: 1, label: 'Superscript',  description: 'x^{n} — cursor lands inside the braces.',                  docsUrl: `${KATEX_DOCS}#math-operators` },
            { latex: '_{}',         cursorOffset: 1, label: 'Subscript',    description: 'x_{n} — cursor lands inside the braces.',                  docsUrl: `${KATEX_DOCS}#math-operators` },
            { latex: '\\binom{}{}', cursorOffset: 3, label: 'Binomial',     description: 'n choose k — combinatorial coefficient.',                   docsUrl: `${KATEX_DOCS}#fractions-and-binomials` },
            { latex: '\\vec{}',     cursorOffset: 1, label: 'Vector',       description: 'Vector arrow over the next character or group.',            docsUrl: `${KATEX_DOCS}#accents` },
            { latex: '\\hat{}',     cursorOffset: 1, label: 'Hat',          description: 'Hat (unit vector / estimate).',                            docsUrl: `${KATEX_DOCS}#accents` },
            { latex: '\\bar{}',     cursorOffset: 1, label: 'Bar',          description: 'Bar (mean / complement).',                                  docsUrl: `${KATEX_DOCS}#accents` },
            { latex: '\\overline{}',cursorOffset: 1, label: 'Overline',     description: 'Bar over a longer expression.',                            docsUrl: `${KATEX_DOCS}#accents` },
            { latex: '\\underline{}',cursorOffset: 1, label: 'Underline',   description: 'Underline.',                                                docsUrl: `${KATEX_DOCS}#accents` },
            { latex: '\\left( \\right) ',  cursorOffset: 8,  label: '( )', description: 'Auto-sized parentheses.',     docsUrl: `${KATEX_DOCS}#delimiters` },
            { latex: '\\left[ \\right] ',  cursorOffset: 8,  label: '[ ]', description: 'Auto-sized brackets.',        docsUrl: `${KATEX_DOCS}#delimiters` },
            { latex: '\\left\\{ \\right\\} ', cursorOffset: 9, label: '{ }', description: 'Auto-sized curly braces.', docsUrl: `${KATEX_DOCS}#delimiters` },
        ]
    },
];

/** Flatten the catalog when filtering by search string. */
export function flattenPalette(): SymbolPaletteEntry[] {
    return SYMBOL_PALETTE_CATEGORIES.flatMap(c => c.entries);
}

/** Case-insensitive search across label, description, and latex. */
export function filterPalette(query: string): SymbolPaletteEntry[] {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return flattenPalette().filter(e =>
        e.label.toLowerCase().includes(q) ||
        e.description.toLowerCase().includes(q) ||
        e.latex.toLowerCase().includes(q)
    );
}
