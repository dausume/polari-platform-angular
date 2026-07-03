"use strict";
// Author: Dustin Etts
// value-sources.ts — ValueSourceConfig resolution for the client engine.
// MIRRORS polariNoCode/SolutionExecutionEngine.py:
//   _resolve_value_source_config / _resolve_context_path /
//   _safe_resolve_value — same source kinds, same fallbacks, same
//   literal-parsing order. from_latex is BACKEND-ONLY (SymPy lives
//   server-side); the capability partition routes any solution using it
//   to the backend, so hitting it here is a wiring error we surface
//   plainly instead of guessing at math.
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveContextPath = resolveContextPath;
exports.resolveValueSourceConfig = resolveValueSourceConfig;
exports.safeResolveValue = safeResolveValue;
function resolveContextPath(path, context) {
    if (!path)
        return null;
    if (path in context)
        return context[path];
    if (path.startsWith('self.')) {
        const bare = path.slice(5);
        if (bare in context)
            return context[bare];
    }
    return null;
}
function resolveValueSourceConfig(config, context) {
    if (typeof config !== 'object' || config === null || !('sourceType' in config)) {
        return config;
    }
    const sourceType = config.sourceType || '';
    if (sourceType === 'from_source_object') {
        return resolveContextPath(config.sourceObjectPath || '', context);
    }
    if (sourceType === 'from_input') {
        const varName = config.inputVariableName || '';
        if (varName && varName in context)
            return context[varName];
        return null;
    }
    if (sourceType === 'direct_assignment' || sourceType === 'literal') {
        const value = sourceType === 'literal'
            ? (config.literalValue ?? config.directValue)
            : config.directValue;
        if (value === null || value === undefined)
            return null;
        const valueType = sourceType === 'literal'
            ? (config.directValueType ?? config.valueType ?? 'str')
            : (config.directValueType ?? 'str');
        try {
            if (valueType === 'int') {
                const n = parseInt(String(value), 10);
                return Number.isNaN(n) ? value : n;
            }
            if (valueType === 'float') {
                const f = parseFloat(String(value));
                return Number.isNaN(f) ? value : f;
            }
            if (valueType === 'bool') {
                if (typeof value === 'boolean')
                    return value;
                return ['true', '1'].includes(String(value).toLowerCase());
            }
            return value;
        }
        catch {
            return value;
        }
    }
    if (sourceType === 'from_field') {
        return resolveContextPath(config.fieldPath ?? config.sourceObjectPath ?? '', context);
    }
    if (sourceType === 'from_latex') {
        // Backend-only capability — same reason the partition exists.
        throw new Error('This solution uses a LaTeX math source (from_latex), which '
            + 'runs on the backend engine. Run the solution on the '
            + 'backend, or replace the math source with a Math Operation '
            + 'node for client-side execution.');
    }
    if (sourceType === 'array') {
        const elements = config.elements || [];
        return elements.map((el) => (typeof el === 'object' && el !== null && 'sourceType' in el)
            ? resolveValueSourceConfig(el, context)
            : el);
    }
    if (sourceType === 'element') {
        const src = config.source;
        const idx = config.index ?? 0;
        const base = (typeof src === 'object' && src !== null)
            ? resolveValueSourceConfig(src, context) : src;
        try {
            const i = parseInt(String(idx), 10);
            if (base === null || base === undefined || Number.isNaN(i))
                return null;
            const v = base[i];
            return v === undefined ? null : v;
        }
        catch {
            return null;
        }
    }
    if (sourceType === 'json_decode') {
        const src = config.source;
        const base = (typeof src === 'object' && src !== null)
            ? resolveValueSourceConfig(src, context) : src;
        if (typeof base !== 'string')
            return base;
        try {
            return JSON.parse(base);
        }
        catch {
            return null;
        }
    }
    if (sourceType === 'json_encode') {
        const src = config.source;
        const base = (typeof src === 'object' && src !== null)
            ? resolveValueSourceConfig(src, context) : src;
        try {
            const s = JSON.stringify(base);
            return s === undefined ? 'null' : s;
        }
        catch {
            return null;
        }
    }
    return null;
}
/** Mirror of _safe_resolve_value: context refs, self.-stripping, then
 *  literal parsing in the SAME order (bool/none words, number, JSON,
 *  quoted string, raw string). */
function safeResolveValue(valueStr, context) {
    if (valueStr === null || valueStr === undefined)
        return null;
    if (typeof valueStr === 'object' && 'sourceType' in valueStr) {
        return resolveValueSourceConfig(valueStr, context);
    }
    if (typeof valueStr !== 'string')
        return valueStr;
    const stripped = valueStr.trim();
    if (stripped in context)
        return context[stripped];
    if (stripped.startsWith('self.')) {
        const bare = stripped.slice(5);
        if (bare in context)
            return context[bare];
    }
    const lower = stripped.toLowerCase();
    if (lower === 'true')
        return true;
    if (lower === 'false')
        return false;
    if (lower === 'none' || lower === 'null')
        return null;
    // Number — mirror Python: contains '.' → float, else int; strict
    // numeric shape so identifiers fall through to string.
    if (/^[+-]?\d+$/.test(stripped))
        return parseInt(stripped, 10);
    if (/^[+-]?(\d+\.\d*|\.\d+|\d+)([eE][+-]?\d+)?$/.test(stripped)
        && (stripped.includes('.') || /[eE]/.test(stripped))) {
        const f = parseFloat(stripped);
        if (!Number.isNaN(f))
            return f;
    }
    // JSON (objects/arrays/quoted strings)
    try {
        return JSON.parse(stripped);
    }
    catch { /* fall through */ }
    if ((stripped.startsWith('"') && stripped.endsWith('"'))
        || (stripped.startsWith("'") && stripped.endsWith("'"))) {
        return stripped.slice(1, -1);
    }
    return stripped;
}
