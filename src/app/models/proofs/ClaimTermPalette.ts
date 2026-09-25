// The TERM-LANGUAGE palette of the proofs claim editor (mathproofs, plan COMPUTE_LOD_TENSOR §I.4 / pf-3).
//
// The same assistive panel the LaTeX editors use — categorized buttons, a rendered glyph, a tooltip, a docs
// link — with OUR vocabulary: each button inserts a JSON term snippet (the statement the checkers lower),
// while the glyph shows the mathematics it means. LaTeX is never authored here: the backend DERIVES it from
// the term and the editor renders that derivation live (POST /api/mathproofs/terms/preview).
//
// `insert` is what lands in the textarea; `latex` is only the glyph. Snippets use `…` where a person fills
// a row reference / a number, and `cursorOffset` parks the caret on the first gap.

import { SymbolPaletteCategory } from '@models/equations/SymbolPalette';

const DOCS = '/display/mathproofs';   // the module's own page: the claims, their LaTeX, the rules, the tiers

export const CLAIM_TERM_PALETTE_CATEGORIES: SymbolPaletteCategory[] = [
    {
        name: 'Quantifiers',
        icon: 'all_inclusive',
        entries: [
            { latex: '\\forall\\, x \\in \\text{rows}', insert: '{"forall": [{"var": "x", "in": "rows:<Class>[:<field>=<value>]"}], "holds": …}', cursorOffset: 1,
              label: 'for all rows', description: 'Over a FINITE set of rows (the numeric tier walks it; the first failing row is the counterexample). x binds the row: {"ref": "x", "path": ["<field>"]} reads it.', docsUrl: DOCS },
            { latex: '\\forall\\, x \\in V', insert: '{"forall": [{"var": "x", "in": "validity:<TensorMapping>"}], "holds": …}', cursorOffset: 1,
              label: 'for all in a domain', description: 'Over a CONTINUUM — a mapping\'s validity box, a node\'s domain, a claim\'s scope (validity:… | domain:… | scope:…). The z3 tier decides it; a model of the negation is the counterexample. {"ref": "x", "path": ["<dim>"]} is the point\'s coordinate.', docsUrl: DOCS },
            { latex: '\\exists\\, x', insert: '{"exists": [{"var": "x", "in": "validity:<TensorMapping>"}], "holds": …}', cursorOffset: 1,
              label: 'there exists', description: 'A witness in the set (rows: numeric; a continuum: z3).', docsUrl: DOCS },
        ]
    },
    {
        name: 'Sets & domains',
        icon: 'crop_square',
        entries: [
            { latex: 'A \\subseteq B', insert: '{"subset": ["validity:<m2>", "validity:<m1>"]}', label: 'domain inside', description: 'Interval sets: every dim\'s range of the first inside the second\'s (the interval tier decides; z3 re-derives it as ∀x∈A: x∈B).', docsUrl: DOCS },
            { latex: 'x \\in B', insert: '{"in": ["x", "validity:<TensorMapping>"]}', label: 'point in domain', description: 'The bound point lies inside that set\'s box (inside a forall/exists).', docsUrl: DOCS },
            { latex: '\\mathrm{dims}(m_2) \\subseteq \\mathrm{dims}(m_1)', insert: '{"dims_subset": ["<m2>.source_dims", "<m1>.target_dims"]}', label: 'dims compose', description: 'What the second link consumes is what the first produced.', docsUrl: DOCS },
        ]
    },
    {
        name: 'Comparisons',
        icon: 'compare_arrows',
        entries: [
            { latex: 'a = b', insert: '{"eq": […, …]}', cursorOffset: 6, label: 'equal', description: 'Equality (relative tolerance 1e-9 by default).', docsUrl: DOCS },
            { latex: 'a = b \\pm \\epsilon', insert: '{"eq": […, …], "tol": {"abs": 0.01}}', cursorOffset: 27, label: 'equal within', description: 'Equality with an ABSOLUTE tolerance (the only kind z3 lowers over a continuum).', docsUrl: DOCS },
            { latex: 'a \\le b', insert: '{"le": […, …]}', cursorOffset: 6, label: 'at most', description: '≤', docsUrl: DOCS },
            { latex: 'a < b', insert: '{"lt": […, …]}', cursorOffset: 6, label: 'less than', description: '<', docsUrl: DOCS },
            { latex: 'a \\ge b', insert: '{"ge": […, …]}', cursorOffset: 6, label: 'at least', description: '≥', docsUrl: DOCS },
            { latex: 'a > b', insert: '{"gt": […, …]}', cursorOffset: 6, label: 'greater than', description: '>', docsUrl: DOCS },
        ]
    },
    {
        name: 'Logic',
        icon: 'account_tree',
        entries: [
            { latex: 'P \\land Q', insert: '{"and": [… , …]}', cursorOffset: 7, label: 'and', description: 'Every statement holds.', docsUrl: DOCS },
            { latex: 'P \\lor Q', insert: '{"or": [… , …]}', cursorOffset: 7, label: 'or', description: 'At least one holds.', docsUrl: DOCS },
            { latex: '\\lnot P', insert: '{"not": …}', cursorOffset: 1, label: 'not', description: 'The negation.', docsUrl: DOCS },
            { latex: 'P \\Rightarrow Q', insert: '{"implies": [… , …]}', cursorOffset: 7, label: 'implies', description: 'Vacuously true when the antecedent fails.', docsUrl: DOCS },
            { latex: '[P] \\Rightarrow Q\\ (\\text{else undetermined})', insert: '{"given": …, "holds": …}', cursorOffset: 12, label: 'given', description: 'Three-valued: when the premise does not hold the claim is UNDETERMINED (not defined here) — never refuted, never vacuously true.', docsUrl: DOCS },
            { latex: '\\mathrm{recorded}(v)', insert: '{"recorded": {"ref": "<Class>:<name>", "path": ["<field>"]}}', label: 'recorded', description: 'The value is present (not None / empty). Pair it with `given` so an unrecorded value makes the claim undetermined.', docsUrl: DOCS },
        ]
    },
    {
        name: 'Reading rows',
        icon: 'table_rows',
        entries: [
            { latex: '\\mathrm{row.field}', insert: '{"ref": "<Class>:<name>", "path": ["<field>"]}', label: 'a row\'s field', description: 'READ a row\'s field by class + name; the path walks into JSON fields ({"path": ["conditions_json", "delta_pct"]}). A bound var reads its row or point.', docsUrl: DOCS },
            { latex: '\\sum_{\\text{rows}}', insert: '{"sum": {"over": "rows:<Class>[:<field>=<value>]", "path": ["<field>"]}}', label: 'sum over rows', description: 'Σ of a field over a filtered row set (= exact, ~ substring).', docsUrl: DOCS },
            { latex: '\\max_{\\text{rows}}', insert: '{"max": {"over": "rows:<Class>", "path": ["<field>"]}}', label: 'max over rows', description: 'The largest value of a field over the rows.', docsUrl: DOCS },
            { latex: '\\min_{\\text{rows}}', insert: '{"min": {"over": "rows:<Class>", "path": ["<field>"]}}', label: 'min over rows', description: 'The smallest value of a field over the rows.', docsUrl: DOCS },
            { latex: '\\#\\,\\text{rows}', insert: '{"count": {"over": "rows:<Class>"}}', label: 'count rows', description: 'How many rows the set has.', docsUrl: DOCS },
            { latex: 'a + b', insert: '{"add": [… , …]}', cursorOffset: 7, label: 'add', description: 'Sum of numeric terms.', docsUrl: DOCS },
            { latex: 'a \\cdot b', insert: '{"mul": [… , …]}', cursorOffset: 7, label: 'multiply', description: 'Product of numeric terms (units conversions live here: × 1e9 for nano-strain).', docsUrl: DOCS },
        ]
    },
    {
        name: 'Templates (proved over symbols / by theorem)',
        icon: 'verified',
        entries: [
            { latex: '\\sigma_{ij} = C_{ijkl}\\varepsilon_{kl} \\Rightarrow \\sigma_{ij} = \\sigma_{ji}', insert: '{"symbolic": {"template": "symmetry-of-contraction", "args": {"n": 2}}}', label: 'σ symmetry (n)', description: 'σ = C:ε preserves symmetry, over free symbols at a fixed dimension n (SymPy); "n": "any" names the general theorem (the Lean tier, asked for by name).', docsUrl: DOCS },
            { latex: '(g \\circ f)\\ \\text{linear}', insert: '{"symbolic": {"template": "linear-composition", "args": {}}}', label: 'composition linear', description: 'Two linear links compose to a linear map (SymPy).', docsUrl: DOCS },
            { latex: 'R(R(T)) = R(T)', insert: '{"symbolic": {"template": "restriction-idempotent", "args": {}}}', label: 'restriction idempotent', description: 'Restricting twice is restricting once (SymPy at a fixed range; Lean in general).', docsUrl: DOCS },
            { latex: '\\bigcap_{i \\le n} V_i = V_n', insert: '{"symbolic": {"template": "chain-domains-compose", "args": {"links": "any"}}}', label: 'chain composes (theorem)', description: 'Pairwise domain inclusion along a chain gives validity on the last domain, which is the intersection — the Lean theorem behind the chain rule.', docsUrl: DOCS },
            { latex: '\\left|\\sum a_i b_i\\right| < 2^{63}', insert: '{"bitvector": {"template": "mac-no-overflow", "args": {"products": 4, "operand_bits": 32, "acc_bits": 64, "a_abs_max": 2147483647, "b_abs_max": …}}}', cursorOffset: 4, label: 'MAC never overflows', description: 'A kernel\'s fixed-point contract: bounded products accumulated one at a time never leave the accumulator\'s range (z3 over exact integers; the bounds are terms read from rows).', docsUrl: DOCS },
        ]
    },
];
