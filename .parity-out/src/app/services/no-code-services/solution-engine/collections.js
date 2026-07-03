"use strict";
// Author: Dustin Etts
// collections.ts — loop-frame helpers, scoped element variables, and
// the dict/list verbs. MIRRORS the Python engine's _loop_frame_for /
// _loop_budget / _check_loop_budget / _coerce_number /
// _resolve_collection / _scoped_vars / _collection_operation —
// including the exact budget-exhaustion and unknown-verb wording (the
// parity vectors assert the words).
Object.defineProperty(exports, "__esModule", { value: true });
exports.loopFrameFor = loopFrameFor;
exports.loopBudget = loopBudget;
exports.checkLoopBudget = checkLoopBudget;
exports.coerceNumber = coerceNumber;
exports.resolveCollection = resolveCollection;
exports.withScopedVars = withScopedVars;
exports.collectionOperation = collectionOperation;
const engine_types_1 = require("./engine-types");
const value_sources_1 = require("./value-sources");
function loopFrameFor(loopStack, stateName) {
    for (let i = loopStack.length - 1; i >= 0; i--) {
        if (loopStack[i].name === stateName)
            return loopStack[i];
    }
    return null;
}
function loopBudget(fieldValues) {
    const budget = parseInt(String(fieldValues.maxIterations ?? 0), 10);
    return Number.isFinite(budget) && budget > 0 ? budget : engine_types_1.DEFAULT_LOOP_BUDGET;
}
function checkLoopBudget(frame, stateName) {
    if (frame.iterations > frame.budget) {
        throw new Error(`Loop '${stateName}' exceeded its iteration budget `
            + `(${frame.budget}). If this many iterations is intended, `
            + `raise maxIterations on the loop node.`);
    }
}
function coerceNumber(value, dflt) {
    if (typeof value === 'boolean')
        return dflt;
    if (typeof value === 'number' && Number.isFinite(value))
        return value;
    const f = parseFloat(String(value));
    if (!Number.isFinite(f))
        return dflt;
    return f === Math.trunc(f) ? Math.trunc(f) : f;
}
function resolveCollection(sourceVar, fieldValues, context) {
    const raw = fieldValues.sourceValue;
    let resolved;
    if (raw && typeof raw === 'object' && 'sourceType' in raw) {
        resolved = (0, value_sources_1.resolveValueSourceConfig)(raw, context);
    }
    else if (sourceVar) {
        resolved = (0, value_sources_1.safeResolveValue)(sourceVar, context);
    }
    else {
        resolved = [];
    }
    return Array.isArray(resolved) ? resolved : [];
}
/** Mirror of _scoped_vars: bind loop/element variables temporarily,
 *  restoring (or removing) afterwards so bindings never leak. */
function withScopedVars(context, names, body) {
    const sentinel = Symbol('unset');
    const saved = {};
    for (const n of names) {
        saved[n] = n in context ? context[n] : sentinel;
    }
    try {
        return body((name, value) => { context[name] = value; });
    }
    finally {
        for (const n of names) {
            if (saved[n] === sentinel) {
                delete context[n];
            }
            else {
                context[n] = saved[n];
            }
        }
    }
}
/** Mirror of _collection_operation — same verbs, same error wording. */
function collectionOperation(context, op, targetVar, key, value, stateName) {
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
        if (!Array.isArray(target))
            return null;
        const i = parseInt(String(key), 10);
        if (!Number.isFinite(i) || i < 0 || i >= target.length)
            return null;
        return target[i];
    }
    if (op === 'listSet') {
        if (Array.isArray(target)) {
            const i = parseInt(String(key), 10);
            if (Number.isFinite(i) && i >= 0 && i < target.length)
                target[i] = value;
        }
        return target;
    }
    if (op === 'listLength') {
        if (Array.isArray(target) || typeof target === 'string')
            return target.length;
        if (target && typeof target === 'object')
            return Object.keys(target).length;
        return 0;
    }
    throw new Error(`'${stateName}': unknown collection operation ${op ? `'${op}'` : op}. Expected `
        + `one of: dictGet, dictSet, dictKeys, dictDelete, listAppend, `
        + `listGet, listSet, listLength.`);
}
