// Author: Dustin Etts
// collections.ts — loop-frame helpers, scoped element variables, and
// the dict/list verbs. MIRRORS the Python engine's _loop_frame_for /
// _loop_budget / _check_loop_budget / _coerce_number /
// _resolve_collection / _scoped_vars / _collection_operation —
// including the exact budget-exhaustion and unknown-verb wording (the
// parity vectors assert the words).

import { DEFAULT_LOOP_BUDGET, LoopFrame } from './engine-types';
import { Context, resolveValueSourceConfig, safeResolveValue } from './value-sources';

export function loopFrameFor(loopStack: LoopFrame[], stateName: string): LoopFrame | null {
    for (let i = loopStack.length - 1; i >= 0; i--) {
        if (loopStack[i].name === stateName) return loopStack[i];
    }
    return null;
}

export function loopBudget(fieldValues: any): number {
    const budget = parseInt(String(fieldValues.maxIterations ?? 0), 10);
    return Number.isFinite(budget) && budget > 0 ? budget : DEFAULT_LOOP_BUDGET;
}

export function checkLoopBudget(frame: LoopFrame, stateName: string): void {
    if (frame.iterations > frame.budget) {
        throw new Error(
            `Loop '${stateName}' exceeded its iteration budget `
            + `(${frame.budget}). If this many iterations is intended, `
            + `raise maxIterations on the loop node.`
        );
    }
}

export function coerceNumber(value: any, dflt: number): number {
    if (typeof value === 'boolean') return dflt;
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    const f = parseFloat(String(value));
    if (!Number.isFinite(f)) return dflt;
    return f === Math.trunc(f) ? Math.trunc(f) : f;
}

export function resolveCollection(sourceVar: string, fieldValues: any, context: Context): any[] {
    const raw = fieldValues.sourceValue;
    let resolved: any;
    if (raw && typeof raw === 'object' && 'sourceType' in raw) {
        resolved = resolveValueSourceConfig(raw, context);
    } else if (sourceVar) {
        resolved = safeResolveValue(sourceVar, context);
    } else {
        resolved = [];
    }
    return Array.isArray(resolved) ? resolved : [];
}

/** Mirror of _scoped_vars: bind loop/element variables temporarily,
 *  restoring (or removing) afterwards so bindings never leak. */
export function withScopedVars<T>(
    context: Context, names: string[], body: (setVar: (n: string, v: any) => void) => T,
): T {
    const sentinel = Symbol('unset');
    const saved: Record<string, any> = {};
    for (const n of names) {
        saved[n] = n in context ? context[n] : sentinel;
    }
    try {
        return body((name, value) => { context[name] = value; });
    } finally {
        for (const n of names) {
            if (saved[n] === sentinel) {
                delete context[n];
            } else {
                context[n] = saved[n];
            }
        }
    }
}

/** Mirror of _collection_operation — same verbs, same error wording. */
export function collectionOperation(
    context: Context, op: string, targetVar: string, key: any, value: any, stateName: string,
): any {
    let target = context[targetVar];
    if (op === 'dictSet') {
        if (typeof target !== 'object' || target === null || Array.isArray(target)) {
            target = {};
            context[targetVar] = target;
        }
        target[key] = value;
        return target;
    }
    if (op === 'dictGet') {
        return (target && typeof target === 'object' && !Array.isArray(target))
            ? (key in target ? target[key] : null) : null;
    }
    if (op === 'dictKeys') {
        return (target && typeof target === 'object' && !Array.isArray(target))
            ? Object.keys(target) : [];
    }
    if (op === 'dictDelete') {
        if (target && typeof target === 'object' && !Array.isArray(target)) {
            delete target[key];
        }
        return target;
    }
    if (op === 'listAppend') {
        if (!Array.isArray(target)) {
            target = [];
            context[targetVar] = target;
        }
        target.push(value);
        return target;
    }
    if (op === 'listGet') {
        if (!Array.isArray(target)) return null;
        const i = parseInt(String(key), 10);
        if (!Number.isFinite(i) || i < 0 || i >= target.length) return null;
        return target[i];
    }
    if (op === 'listSet') {
        if (Array.isArray(target)) {
            const i = parseInt(String(key), 10);
            if (Number.isFinite(i) && i >= 0 && i < target.length) target[i] = value;
        }
        return target;
    }
    if (op === 'listLength') {
        if (Array.isArray(target) || typeof target === 'string') return target.length;
        if (target && typeof target === 'object') return Object.keys(target).length;
        return 0;
    }
    throw new Error(
        `'${stateName}': unknown collection operation ${op ? `'${op}'` : op}. Expected `
        + `one of: dictGet, dictSet, dictKeys, dictDelete, listAppend, `
        + `listGet, listSet, listLength.`
    );
}
