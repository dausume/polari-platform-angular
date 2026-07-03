"use strict";
// Author: Dustin Etts
// validation.ts — FormValidation + ValidationResult for the client
// engine. MIRRORS the Python handlers' rules AND MESSAGES exactly (the
// parity vectors assert the words): required / int / float / bool /
// minValue / maxValue / minLength / maxLength / pattern. The instant
// per-field feedback this enables IS the payoff of client execution.
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleFormValidation = handleFormValidation;
exports.handleValidationResult = handleValidationResult;
const engine_types_1 = require("./engine-types");
const value_sources_1 = require("./value-sources");
function handleFormValidation(fieldValues, context, stateName, logOutput, result) {
    const fieldsCfg = (fieldValues.fields || []).filter((f) => f && typeof f === 'object' && (f.enabled ?? true));
    const verdicts = {};
    const invalidFields = [];
    for (const f of fieldsCfg) {
        const fname = f.fieldName || '';
        if (!fname)
            continue;
        const label = f.displayName || fname;
        const value = fname in context ? context[fname] : null;
        const errors = [];
        const missing = value === null || value === undefined
            || (typeof value === 'string' && value.trim() === '');
        if (missing) {
            if (f.required)
                errors.push(`${label} is required.`);
        }
        else {
            const ftype = String(f.fieldType || '').toLowerCase();
            let numVal = null;
            if (ftype === 'int' || ftype === 'integer') {
                if (/^[+-]?\d+$/.test(String(value).trim())) {
                    numVal = parseInt(String(value), 10);
                }
                else {
                    errors.push(`${label} must be a whole number.`);
                }
            }
            else if (ftype === 'float' || ftype === 'number' || ftype === 'num') {
                const fVal = Number(String(value).trim());
                if (String(value).trim() !== '' && Number.isFinite(fVal)) {
                    numVal = fVal;
                }
                else {
                    errors.push(`${label} must be a number.`);
                }
            }
            else if (ftype === 'bool' || ftype === 'boolean') {
                if (typeof value !== 'boolean'
                    && !['true', 'false', '0', '1'].includes(String(value).toLowerCase())) {
                    errors.push(`${label} must be true or false.`);
                }
            }
            if (numVal !== null) {
                if ('minValue' in f && f.minValue !== null && f.minValue !== undefined
                    && numVal < f.minValue) {
                    errors.push(`${label} must be at least ${f.minValue}.`);
                }
                if ('maxValue' in f && f.maxValue !== null && f.maxValue !== undefined
                    && numVal > f.maxValue) {
                    errors.push(`${label} must be at most ${f.maxValue}.`);
                }
            }
            if (typeof value === 'string') {
                if (f.minLength && value.length < f.minLength) {
                    errors.push(`${label} must be at least ${f.minLength} characters.`);
                }
                if (f.maxLength && value.length > f.maxLength) {
                    errors.push(`${label} must be at most ${f.maxLength} characters.`);
                }
                const pattern = f.pattern || f.regex;
                if (pattern) {
                    try {
                        if (!new RegExp(pattern).test(value)) {
                            errors.push(`${label} does not match the expected format.`);
                        }
                    }
                    catch {
                        errors.push(`${label} has an invalid validation pattern `
                            + `(fix the rule in the editor).`);
                    }
                }
            }
        }
        verdicts[fname] = { valid: errors.length === 0, errors };
        if (errors.length)
            invalidFields.push(fname);
    }
    const formValid = invalidFields.length === 0;
    context[engine_types_1.FORM_VALIDATION_KEY] = verdicts;
    context['form_valid'] = formValid;
    context['_invalid_fields'] = invalidFields;
    result.result = formValid;
    if (formValid) {
        result.branch_taken = 0;
        result.branch_label = 'All Valid';
        logOutput.push(`[${stateName}] all ${fieldsCfg.length} field(s) valid `
            + `— proceeding down "All Valid"`);
    }
    else {
        result.branch_taken = 1;
        result.branch_label = 'Invalid';
        const firstErrs = verdicts[invalidFields[0]].errors;
        logOutput.push(`[${stateName}] validation FAILED for ${invalidFields.join(', ')} — `
            + `${firstErrs.length ? firstErrs[0] : 'invalid'}`);
    }
}
function handleValidationResult(fieldValues, context, stateName, logOutput, result) {
    const resolveFlexible = (raw) => (raw && typeof raw === 'object' && 'sourceType' in raw)
        ? (0, value_sources_1.resolveValueSourceConfig)(raw, context)
        : (0, value_sources_1.safeResolveValue)(raw, context);
    const wrote = [];
    for (const key of ['outcome', 'reason', 'complete']) {
        if (key in fieldValues) {
            context[key] = resolveFlexible(fieldValues[key]);
            wrote.push(key);
        }
    }
    for (const key of ['derivedValues', 'repairedValues']) {
        const mapping = fieldValues[key];
        if (mapping && typeof mapping === 'object' && !('sourceType' in mapping)) {
            const out = {};
            for (const [k, v] of Object.entries(mapping)) {
                out[k] = resolveFlexible(v);
            }
            context[key] = out;
            wrote.push(key);
        }
        else if (mapping !== null && mapping !== undefined) {
            context[key] = resolveFlexible(mapping);
            wrote.push(key);
        }
    }
    for (const mapping of fieldValues.outputMappings || []) {
        if (!mapping || typeof mapping !== 'object')
            continue;
        const outName = mapping.outputFieldName || '';
        if (outName) {
            context[outName] = (0, value_sources_1.resolveValueSourceConfig)(mapping.valueSource, context);
            wrote.push(outName);
        }
    }
    result.result = 'outcome' in context ? context['outcome'] : context['complete'];
    logOutput.push(`[${stateName}] validation verdict bound: `
        + `${wrote.length ? wrote.join(', ') : '(nothing configured)'}`);
}
