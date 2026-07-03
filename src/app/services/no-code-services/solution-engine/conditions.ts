// Author: Dustin Etts
// conditions.ts — comparison/arithmetic operators + condition
// evaluation for the client engine. MIRRORS the Python engine's
// COMPARISON_OPS / ARITHMETIC_OPS / _evaluate_condition /
// _evaluate_chain_link / _evaluate_condition_any /
// _eval_element_expression, including operator aliases and the
// "left op right" spaced-string forms.

import { Context, resolveValueSourceConfig, safeResolveValue } from './value-sources';

type CmpFn = (a: any, b: any) => boolean;

const eq: CmpFn = (a, b) => a === b || (typeof a === 'number' && typeof b === 'number' && a === b);
const contains: CmpFn = (a, b) => {
    if (typeof a === 'string') return a.includes(String(b));
    if (Array.isArray(a)) return a.includes(b);
    if (a && typeof a === 'object') return b in a;
    return false;
};

export const COMPARISON_OPS: Record<string, CmpFn> = {
    '==': eq, 'equals': eq,
    '!=': (a, b) => !eq(a, b), 'notEquals': (a, b) => !eq(a, b), 'not_equals': (a, b) => !eq(a, b),
    '>': (a, b) => a > b, 'greaterThan': (a, b) => a > b, 'greater_than': (a, b) => a > b,
    '<': (a, b) => a < b, 'lessThan': (a, b) => a < b, 'less_than': (a, b) => a < b,
    '>=': (a, b) => a >= b, 'greaterThanOrEqual': (a, b) => a >= b, 'greater_than_or_equal': (a, b) => a >= b,
    '<=': (a, b) => a <= b, 'lessThanOrEqual': (a, b) => a <= b, 'less_than_or_equal': (a, b) => a <= b,
    'contains': contains,
    'notContains': (a, b) => !contains(a, b), 'not_contains': (a, b) => !contains(a, b),
    'startsWith': (a, b) => String(a).startsWith(String(b)),
    'endsWith': (a, b) => String(a).endsWith(String(b)),
    'isNull': (a, _b) => a === null || a === undefined,
    'isNotNull': (a, _b) => a !== null && a !== undefined,
    'isTrue': (a, _b) => Boolean(a) === true,
    'isFalse': (a, _b) => Boolean(a) === false,
};

type ArithFn = (a: any, b: any) => any;
export const ARITHMETIC_OPS: Record<string, ArithFn> = {
    '+': (a, b) => a + b, 'add': (a, b) => a + b,
    '-': (a, b) => a - b, 'subtract': (a, b) => a - b,
    '*': (a, b) => a * b, 'multiply': (a, b) => a * b,
    '/': (a, b) => {
        if (b === 0) throw new Error('division by zero');
        return a / b;
    },
    'divide': (a, b) => {
        if (b === 0) throw new Error('division by zero');
        return a / b;
    },
    '%': (a, b) => {
        // Python modulo semantics (sign follows the divisor).
        const m = a % b;
        return (m !== 0 && (m < 0) !== (b < 0)) ? m + b : m;
    },
    'modulo': (a, b) => ARITHMETIC_OPS['%'](a, b),
    '**': (a, b) => Math.pow(a, b), 'power': (a, b) => Math.pow(a, b),
};

/** Mirror of _evaluate_condition (legacy dict / compound / string). */
export function evaluateCondition(conditionData: any, context: Context): boolean {
    if (typeof conditionData === 'string') {
        return Boolean(safeResolveValue(conditionData, context));
    }
    if (typeof conditionData !== 'object' || conditionData === null) return false;

    if ('conditions' in conditionData) {
        const conditions = conditionData.conditions || [];
        const logicalOp = String(conditionData.logicalOperator || 'AND').toUpperCase();
        if (logicalOp === 'OR') {
            return conditions.some((c: any) => evaluateCondition(c, context));
        }
        return conditions.every((c: any) => evaluateCondition(c, context));
    }

    const leftStr = conditionData.leftOperand ?? conditionData.left ?? '';
    const opStr = conditionData.operator ?? conditionData.comparisonOperator ?? '==';
    const rightStr = conditionData.rightOperand ?? conditionData.right ?? '';
    const leftVal = safeResolveValue(leftStr, context);
    const rightVal = safeResolveValue(rightStr, context);
    const opFn = COMPARISON_OPS[opStr] ?? eq;
    try {
        return Boolean(opFn(leftVal, rightVal));
    } catch {
        return false;
    }
}

/** Mirror of _evaluate_chain_link (ValueSourceConfig operands). */
export function evaluateChainLink(link: any, context: Context, logOutput?: string[]): boolean {
    const log = logOutput ?? [];
    const leftSource = link.leftSource;
    const leftVal = (leftSource && typeof leftSource === 'object' && 'sourceType' in leftSource)
        ? resolveValueSourceConfig(leftSource, context)
        : safeResolveValue(link.fieldName ?? '', context);
    const rightSource = link.rightSource;
    const rightVal = (rightSource && typeof rightSource === 'object' && 'sourceType' in rightSource)
        ? resolveValueSourceConfig(rightSource, context)
        : safeResolveValue(link.conditionValue ?? '', context);
    const conditionType = link.conditionType ?? 'equals';
    const opFn = COMPARISON_OPS[conditionType] ?? eq;
    try {
        const result = Boolean(opFn(leftVal, rightVal));
        log.push(`  Link result: ${result}`);
        return result;
    } catch {
        return false;
    }
}

/** Mirror of _evaluate_condition_any: chain-links dict, legacy dict,
 *  or a plain string ("left op right" spaced, or bare truthiness). */
export function evaluateConditionAny(condition: any, context: Context, logOutput?: string[]): boolean {
    if (condition && typeof condition === 'object' && condition.links?.length) {
        const links = condition.links;
        const defaultOp = String(condition.defaultLogicalOperator || 'AND').toUpperCase();
        let combined: boolean | null = null;
        let prevOp = defaultOp;
        for (const link of links) {
            const linkResult = evaluateChainLink(link, context, logOutput);
            if (combined === null) {
                combined = linkResult;
            } else if (prevOp === 'OR') {
                combined = combined || linkResult;
            } else if (prevOp === 'NOT') {
                combined = combined && !linkResult;
            } else if (prevOp === 'XOR') {
                combined = combined !== linkResult;
            } else {
                combined = combined && linkResult;
            }
            prevOp = String(link.logicalOperator ?? defaultOp).toUpperCase();
        }
        return Boolean(combined);
    }
    if (condition && typeof condition === 'object') {
        return evaluateCondition(condition, context);
    }
    if (typeof condition === 'string' && condition.trim()) {
        const parts = condition.split(/\s+/).filter(Boolean);
        if (parts.length === 3 && parts[1] in COMPARISON_OPS) {
            const left = safeResolveValue(parts[0], context);
            const right = safeResolveValue(parts[2], context);
            try {
                return Boolean(COMPARISON_OPS[parts[1]](left, right));
            } catch {
                return false;
            }
        }
        return Boolean(safeResolveValue(condition, context));
    }
    return false;
}

/** Mirror of _eval_element_expression for Map/Reduce elements. */
export function evalElementExpression(fieldValues: any, context: Context, itemVar: string): any {
    const valueSource = fieldValues.valueSource;
    if (valueSource && typeof valueSource === 'object' && 'sourceType' in valueSource) {
        return resolveValueSourceConfig(valueSource, context);
    }
    const expression = String(fieldValues.expression ?? itemVar).trim();
    const parts = expression.split(/\s+/).filter(Boolean);
    if (parts.length === 3 && parts[1] in ARITHMETIC_OPS) {
        const left = safeResolveValue(parts[0], context);
        const right = safeResolveValue(parts[2], context);
        try {
            return ARITHMETIC_OPS[parts[1]](left, right);
        } catch {
            return null;
        }
    }
    return safeResolveValue(expression, context);
}
