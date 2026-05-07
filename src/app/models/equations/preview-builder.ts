// Author: Dustin Etts
// Builds the operation-aware LaTeX preview string.
//
// The preview wraps the user's expression with the SELECTED operation's
// symbol (rendered bold via \\mathbf) so the user can see what the backend
// will actually compute. When the LaTeX already contains the operator's
// signature (e.g. they typed `\\int_0^1 …` and the operation is Definite
// Integral), no wrap is added — the LaTeX is already self-describing.

import { EquationBounds, EquationOperationType } from './EquationDefinition';

export function buildPreviewLatex(
    latex: string,
    op: EquationOperationType,
    bounds?: EquationBounds | null
): string {
    const expr = (latex || '').trim();
    if (!expr) return '';

    // If the LaTeX already encodes this operation, leave it alone.
    if (latexAlreadyContainsOperator(expr, op)) {
        return expr;
    }

    const v = bounds?.variable || 'x';

    switch (op) {
        case 'derivative':
            return `\\mathbf{\\dfrac{d}{d${v}}}\\!\\left(${expr}\\right)`;

        case 'integral_definite': {
            const lo = bounds?.lower ?? '';
            const hi = bounds?.upper ?? '';
            return `\\mathbf{\\int_{${lo}}^{${hi}}}\\,${expr}\\,\\mathbf{d${v}}`;
        }

        case 'integral_indefinite':
            return `\\mathbf{\\int}\\,${expr}\\,\\mathbf{d${v}}`;

        case 'limit': {
            const point = bounds?.point ?? '';
            return `\\mathbf{\\lim_{${v}\\to ${point}}}\\,${expr}`;
        }

        case 'series': {
            const point = bounds?.point ?? '0';
            const order = bounds?.order ?? 6;
            return `\\mathbf{\\text{Series at } ${v}=${point} \\text{ to order } ${order}:}\\;${expr}`;
        }

        case 'solve':
            return `\\mathbf{\\text{Solve}}\\;${expr} = 0`;

        case 'simplify':
            return `\\mathbf{\\text{Simplify:}}\\;${expr}`;

        case 'expand':
            return `\\mathbf{\\text{Expand:}}\\;${expr}`;

        case 'factor':
            return `\\mathbf{\\text{Factor:}}\\;${expr}`;

        case 'ode_solve':
            return `\\mathbf{\\text{ODE:}}\\;${expr} = 0`;

        case 'pde_solve':
            return `\\mathbf{\\text{PDE:}}\\;${expr} = 0`;

        case 'evaluate_predicate':
            return `\\mathbf{\\text{Predicate:}}\\;${expr}`;

        case 'is_identity':
            return `\\mathbf{\\text{Identity?}}\\;${expr}`;

        case 'piecewise_evaluate':
            return `\\mathbf{\\text{Piecewise:}}\\;${expr}`;

        case 'evaluate':
        default:
            return expr;
    }
}

/**
 * Build a "post-substitution" LaTeX string by replacing every occurrence of
 * a bound symbol in the user's LaTeX with the test value supplied at edit
 * time. Drives the Step 2 preview on the equation edit page so the user can
 * sanity-check what the backend actually receives.
 *
 * Substitution rules:
 *   - Substitution is keyed by symbol; the `testValues` dict maps a symbol
 *     name to its concrete value. Symbols not in the dict are left alone.
 *   - Symbols are matched on word boundaries with a negative lookbehind for
 *     `\\` so LaTeX command names (`\\sin`, `\\pi`, `\\sigma`) aren't mangled.
 *   - Empty / null values are skipped (treated as "not yet bound").
 *   - Array values render as `[a, b, c]`.
 */
export type PreviewTestValues = { [symbol: string]: any };

export function buildSubstitutedLatex(
    latex: string,
    testValues: PreviewTestValues
): { substituted: string; substitutionsApplied: number } {
    let result = latex || '';
    let count = 0;
    for (const symbol of Object.keys(testValues || {})) {
        const sym = (symbol || '').trim();
        if (!sym) continue;
        const value = testValues[symbol];
        if (value === undefined || value === null || value === '') continue;
        const valueStr = formatValueForLatex(value);
        const re = new RegExp(`(?<!\\\\)\\b${escapeRegex(sym)}\\b`, 'g');
        const before = result;
        result = result.replace(re, valueStr);
        if (before !== result) count += 1;
    }
    return { substituted: result, substitutionsApplied: count };
}

function formatValueForLatex(v: any): string {
    if (Array.isArray(v)) return `[${v.map(x => formatValueForLatex(x)).join(',\\,')}]`;
    if (typeof v === 'number') return String(v);
    if (typeof v === 'boolean') return v ? '\\text{True}' : '\\text{False}';
    return String(v);
}

function escapeRegex(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function latexAlreadyContainsOperator(latex: string, op: EquationOperationType): boolean {
    const s = latex.replace(/\s+/g, '');
    switch (op) {
        case 'derivative':
            return /\\frac\{d/.test(s) ||
                   /\\frac\{\\partial/.test(s) ||
                   /\\nabla\b/.test(s) ||
                   /\\dot\{/.test(s) ||
                   /\\ddot\{/.test(s);
        case 'integral_definite':
        case 'integral_indefinite':
            return /\\(int|iint|iiint|oint)\b/.test(s);
        case 'limit':
            return /\\lim\b/.test(s);
        case 'ode_solve':
            return /[a-zA-Z]'\([a-zA-Z]/.test(s);
        case 'pde_solve':
            return /\\frac\{\\partial/.test(s);
        case 'piecewise_evaluate':
            return /\\begin\{cases\}/.test(s);
        default:
            return false;
    }
}
