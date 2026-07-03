"use strict";
// Author: Dustin Etts
// client-engine.ts — the TypeScript SolutionExecutionEngine (P5).
//
// Interprets the SAME stored SolutionDefinition JSON the Python engine
// walks — the configuration IS the artifact, so modules carry frontend
// logic as pure config. Semantics MIRROR
// polariNoCode/SolutionExecutionEngine.py: same entry/terminal sets,
// same loop-frame conventions (slot 0 = Body, slot 1 = Done,
// auto-return, budgets), same verdict-driven FormValidation routing
// (an invalid form NEVER proceeds down "All Valid"), same
// SolutionInvocation contract wording. The shared parity vectors
// (polariNoCode/parity_vectors/) hold both engines to the same answers
// and the same user-facing error words.
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClientSolutionEngine = void 0;
const engine_types_1 = require("./engine-types");
const capability_1 = require("./capability");
const value_sources_1 = require("./value-sources");
const conditions_1 = require("./conditions");
const collections_1 = require("./collections");
const validation_1 = require("./validation");
const invocation_1 = require("./invocation");
/** Python-ish type names so trace snapshots read the same. */
function pyType(value) {
    if (value === null || value === undefined)
        return 'NoneType';
    if (typeof value === 'boolean')
        return 'bool';
    if (typeof value === 'number')
        return Number.isInteger(value) ? 'int' : 'float';
    if (typeof value === 'string')
        return 'str';
    if (Array.isArray(value))
        return 'list';
    if (typeof value === 'object')
        return 'dict';
    return typeof value;
}
class ClientSolutionEngine {
    resolver;
    bridge;
    constructor(options = {}) {
        this.resolver = options.resolver ?? null;
        this.bridge = options.bridge ?? null;
    }
    /** Execute a solution definition (parsed JSON) — the mirror of
     *  SolutionExecutionEngine.execute(). Async because invocation /
     *  backend-bridge nodes await. */
    async execute(solutionData, inputParams = {}, targetRuntime = 'typescript_frontend', instanceFields = null, invocationChain = []) {
        // ISOLATION: deep-clone, never mutate the stored definition.
        solutionData = JSON.parse(JSON.stringify(solutionData ?? {}));
        const solutionName = solutionData.solutionName || 'untitled';
        const executionId = (0, engine_types_1.generateExecutionId)();
        const trace = {
            executionId, solutionName, targetRuntime,
            status: 'running', steps: [],
            startedAt: new Date().toISOString(), engine: 'client',
        };
        const complete = (finalReturnValue) => {
            trace.status = 'completed';
            trace.completedAt = new Date().toISOString();
            if (finalReturnValue !== undefined)
                trace.finalReturnValue = finalReturnValue;
            return trace;
        };
        const fail = (msg) => {
            trace.status = 'errored';
            trace.completedAt = new Date().toISOString();
            trace.errorSummary = msg;
            return trace;
        };
        const stateInstances = solutionData.stateInstances || [];
        if (!stateInstances.length)
            return fail('No state instances found in solution');
        const sortedStates = [...stateInstances].sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
        const statesByName = {};
        for (const s of sortedStates) {
            if (s.stateName)
                statesByName[s.stateName] = s;
        }
        let initialState = null;
        for (const s of sortedStates) {
            const cls = s.boundObjectClass ?? s.stateClass ?? '';
            if (engine_types_1.INITIAL_STATE_CLASSES.has(cls)) {
                initialState = s;
                break;
            }
        }
        if (!initialState)
            return fail('No initial state found in solution');
        const context = {};
        if (instanceFields)
            Object.assign(context, instanceFields);
        if (inputParams)
            Object.assign(context, inputParams);
        const host = {
            solutionName,
            invocationChain,
            resolver: this.resolver,
            bridge: this.bridge,
            executeChild: (row, inputs, chain) => {
                const child = new ClientSolutionEngine({ resolver: this.resolver, bridge: this.bridge });
                return child.execute(row.definition, inputs, row.targetRuntime || 'typescript_frontend', null, chain);
            },
        };
        let currentState = initialState;
        let stepIndex = 0;
        const loopStack = [];
        try {
            while (currentState !== null && stepIndex < engine_types_1.MAX_STEPS) {
                const stateName = currentState.stateName || `Step_${stepIndex}`;
                const stateClass = currentState.boundObjectClass
                    ?? currentState.stateClass ?? '';
                const fieldValues = currentState.boundObjectFieldValues || {};
                const contextBefore = this.snapshot(context, stateName, solutionName, executionId);
                const startTime = Date.now();
                const logOutput = [];
                let status = 'completed';
                let executionError = null;
                let evalResult = {
                    result: null, branch_taken: null, branch_label: null, loop_action: null,
                };
                try {
                    evalResult = await this.evaluateState(host, stateClass, fieldValues, context, stateName, logOutput, loopStack);
                }
                catch (e) {
                    executionError = e?.message ?? String(e);
                    status = 'errored';
                }
                const endTime = Date.now();
                const contextAfter = this.snapshot(context, stateName, solutionName, executionId);
                const step = {
                    snapshotId: (0, engine_types_1.generateSnapshotId)(),
                    stepIndex,
                    stateName,
                    stateClassName: stateClass,
                    contextBefore,
                    contextAfter,
                    status,
                    executionResult: evalResult.result,
                    executionError,
                    startTime: new Date(startTime).toISOString(),
                    endTime: new Date(endTime).toISOString(),
                    durationMs: endTime - startTime,
                    branchTaken: evalResult.branch_taken,
                    branchLabel: evalResult.branch_label,
                    logOutput,
                };
                if (evalResult.child_execution) {
                    step.childExecution = evalResult.child_execution;
                }
                trace.steps.push(step);
                if (status === 'errored')
                    return fail(executionError);
                if (engine_types_1.TERMINAL_STATE_CLASSES.has(stateClass)) {
                    return complete(evalResult.result);
                }
                // Routing — mirror of the Python walk's loop actions.
                let nextState;
                if (evalResult.loop_action === 'body') {
                    nextState = this.slotTarget(currentState, statesByName, 0) ?? currentState;
                }
                else if (evalResult.loop_action === 'exit') {
                    nextState = this.slotTarget(currentState, statesByName, 1);
                }
                else if (evalResult.loop_action === 'break') {
                    const frame = loopStack.pop();
                    const loopNode = frame ? statesByName[frame.name] : null;
                    nextState = loopNode
                        ? this.slotTarget(loopNode, statesByName, 1) : null;
                }
                else if (evalResult.loop_action === 'continue') {
                    nextState = statesByName[loopStack[loopStack.length - 1].name];
                }
                else {
                    nextState = this.getNextState(currentState, statesByName, context, evalResult.branch_taken);
                }
                // Dead-end rule: a body path that simply ends returns to
                // the innermost active loop for its next iteration.
                if ((nextState === null || nextState === undefined) && loopStack.length) {
                    nextState = statesByName[loopStack[loopStack.length - 1].name];
                }
                currentState = nextState ?? null;
                stepIndex += 1;
            }
            if (stepIndex >= engine_types_1.MAX_STEPS) {
                return fail(`Execution exceeded maximum step limit (${engine_types_1.MAX_STEPS})`);
            }
            return complete();
        }
        catch (e) {
            return fail(e?.message ?? String(e));
        }
    }
    // ---------------------------------------------------------------
    // State dispatch — mirrors _evaluate_state's client-capable set.
    // ---------------------------------------------------------------
    async evaluateState(host, stateClass, fieldValues, context, stateName, logOutput, loopStack) {
        const result = {
            result: null, branch_taken: null, branch_label: null, loop_action: null,
        };
        if (['InitialState', 'DirectInvocation', 'FormSubscription', 'LogicFlowEntry',
            'InitialConditionsValidatorEntry'].includes(stateClass)) {
            const inputParams = fieldValues.inputParams || [];
            const paramStrs = inputParams.map((p) => {
                const pName = p?.name ?? '?';
                const pVal = pName in context ? context[pName] : '<not provided>';
                return `${pName}=${pName in context ? (0, engine_types_1.pyRepr)(pVal) : pVal}`;
            });
            result.result = `Entry point with ${inputParams.length} parameters`;
            logOutput.push(`[${stateName}] Entering with params: `
                + `${paramStrs.length ? paramStrs.join(', ') : '(none)'}`);
        }
        else if (stateClass === 'VariableAssignment') {
            const varName = fieldValues.variableName || '';
            const valueStr = fieldValues.value ?? '';
            const assignmentConfig = fieldValues.assignmentConfig || {};
            const valueSourceConfig = assignmentConfig?.valueSource;
            if (varName) {
                let resolved;
                if (valueSourceConfig && typeof valueSourceConfig === 'object'
                    && 'sourceType' in valueSourceConfig) {
                    resolved = (0, value_sources_1.resolveValueSourceConfig)(valueSourceConfig, context);
                }
                else {
                    resolved = (0, value_sources_1.safeResolveValue)(valueStr, context);
                }
                context[varName] = resolved;
                if (varName.startsWith('self.'))
                    context[varName.slice(5)] = resolved;
                result.result = resolved;
                logOutput.push(`[${stateName}] ${varName} = ${(0, engine_types_1.pyRepr)(resolved)} `
                    + `(type: ${pyType(resolved)})`);
            }
        }
        else if (stateClass === 'ConditionalChain') {
            const links = fieldValues.links || [];
            const conditions = fieldValues.conditions || [];
            const condition = fieldValues.condition ?? '';
            const defaultOp = String(fieldValues.defaultLogicalOperator || 'AND').toUpperCase();
            if (links.length > 0) {
                const linkResults = links.map((link) => [
                    (0, conditions_1.evaluateChainLink)(link, context, logOutput),
                    String(link.logicalOperator ?? defaultOp).toUpperCase(),
                ]);
                let combined = linkResults[0][0];
                for (let i = 1; i < linkResults.length; i++) {
                    const [resultVal] = linkResults[i];
                    const prevOp = linkResults[i - 1][1];
                    if (prevOp === 'OR')
                        combined = combined || resultVal;
                    else if (prevOp === 'NOT')
                        combined = combined && !resultVal;
                    else if (prevOp === 'XOR')
                        combined = combined !== resultVal;
                    else
                        combined = combined && resultVal;
                }
                result.branch_taken = combined ? 0 : 1;
                result.branch_label = combined ? 'true' : 'false';
                logOutput.push(`[${stateName}] Condition result: ${combined ? 'True' : 'False'} `
                    + `-> branch ${result.branch_label}`);
            }
            else if (conditions.length > 0) {
                let matched = false;
                for (let i = 0; i < conditions.length; i++) {
                    if ((0, conditions_1.evaluateCondition)(conditions[i], context)) {
                        result.branch_taken = i;
                        result.branch_label = conditions[i]?.label ?? `Branch ${i}`;
                        matched = true;
                        break;
                    }
                }
                if (!matched) {
                    result.branch_taken = conditions.length;
                    result.branch_label = 'else';
                }
                logOutput.push(`[${stateName}] Condition result -> branch ${result.branch_label}`);
            }
            else if (condition) {
                const ok = (0, conditions_1.evaluateCondition)(condition, context);
                result.branch_taken = ok ? 0 : 1;
                result.branch_label = ok ? 'true' : 'false';
                logOutput.push(`[${stateName}] Condition result -> branch ${result.branch_label}`);
            }
            else {
                result.branch_taken = 0;
                result.branch_label = 'default';
                logOutput.push(`[${stateName}] No condition defined -> branch default`);
            }
        }
        else if (stateClass === 'ForLoop') {
            const iterator = fieldValues.iteratorVariable || fieldValues.iterator || 'i';
            let frame = (0, collections_1.loopFrameFor)(loopStack, stateName);
            if (frame === null) {
                const start = (0, collections_1.coerceNumber)((0, value_sources_1.safeResolveValue)(fieldValues.startValue ?? fieldValues.start ?? 0, context), 0);
                const end = (0, collections_1.coerceNumber)((0, value_sources_1.safeResolveValue)(fieldValues.endValue ?? fieldValues.end ?? 10, context), 10);
                const step = (0, collections_1.coerceNumber)((0, value_sources_1.safeResolveValue)(fieldValues.stepValue ?? fieldValues.step ?? 1, context), 1);
                if (step === 0) {
                    throw new Error(`Loop '${stateName}': step is 0 — the loop would `
                        + `never advance. Use a positive or negative step.`);
                }
                frame = {
                    name: stateName, kind: 'for', current: start, end, step,
                    iterations: 0, budget: (0, collections_1.loopBudget)(fieldValues),
                };
                loopStack.push(frame);
            }
            else {
                frame.current = frame.current + frame.step;
            }
            const cont = (frame.step > 0 && frame.current < frame.end)
                || (frame.step < 0 && frame.current > frame.end);
            if (cont) {
                frame.iterations += 1;
                (0, collections_1.checkLoopBudget)(frame, stateName);
                context[iterator] = frame.current;
                result.loop_action = 'body';
                result.result = {
                    loop: 'for', iterator, value: frame.current,
                    iteration: frame.iterations,
                };
                logOutput.push(`[${stateName}] iteration ${frame.iterations}: `
                    + `${iterator} = ${frame.current}`);
            }
            else {
                loopStack.splice(loopStack.indexOf(frame), 1);
                result.loop_action = 'exit';
                result.result = { loop: 'for', completed: true, iterations: frame.iterations };
                logOutput.push(`[${stateName}] done after ${frame.iterations} iterations`);
            }
        }
        else if (stateClass === 'WhileLoop') {
            const condition = fieldValues.condition ?? '';
            let frame = (0, collections_1.loopFrameFor)(loopStack, stateName);
            if (frame === null) {
                frame = {
                    name: stateName, kind: 'while', iterations: 0,
                    budget: (0, collections_1.loopBudget)(fieldValues),
                };
                loopStack.push(frame);
            }
            const condOk = (0, conditions_1.evaluateConditionAny)(condition, context, logOutput);
            if (condOk) {
                frame.iterations += 1;
                (0, collections_1.checkLoopBudget)(frame, stateName);
                result.loop_action = 'body';
                result.result = { loop: 'while', iteration: frame.iterations };
                logOutput.push(`[${stateName}] condition true — iteration `
                    + `${frame.iterations}`);
            }
            else {
                loopStack.splice(loopStack.indexOf(frame), 1);
                result.loop_action = 'exit';
                result.result = { loop: 'while', completed: true, iterations: frame.iterations };
                logOutput.push(`[${stateName}] condition false — done after `
                    + `${frame.iterations} iterations`);
            }
        }
        else if (stateClass === 'ForEachLoop') {
            const item = fieldValues.itemVariable || fieldValues.item || 'item';
            const indexVar = fieldValues.indexVariable || `${item}_index`;
            let frame = (0, collections_1.loopFrameFor)(loopStack, stateName);
            if (frame === null) {
                const raw = fieldValues.collection ?? '[]';
                let collection;
                if (raw && typeof raw === 'object' && 'sourceType' in raw) {
                    collection = (0, value_sources_1.resolveValueSourceConfig)(raw, context);
                }
                else {
                    collection = (0, value_sources_1.safeResolveValue)(raw, context);
                }
                if (!Array.isArray(collection)) {
                    logOutput.push(`[${stateName}] collection is not a list `
                        + `(${pyType(collection)}) — treating as empty.`);
                    collection = [];
                }
                frame = {
                    name: stateName, kind: 'foreach', items: [...collection],
                    index: 0, iterations: 0, budget: (0, collections_1.loopBudget)(fieldValues),
                };
                loopStack.push(frame);
            }
            else {
                frame.index = frame.index + 1;
            }
            const items = frame.items;
            if (frame.index < items.length) {
                frame.iterations += 1;
                (0, collections_1.checkLoopBudget)(frame, stateName);
                context[item] = items[frame.index];
                context[indexVar] = frame.index;
                result.loop_action = 'body';
                result.result = { loop: 'foreach', index: frame.index, item: context[item] };
                logOutput.push(`[${stateName}] item ${frame.index + 1}/`
                    + `${items.length}: ${item} = ${(0, engine_types_1.pyRepr)(context[item])}`);
            }
            else {
                loopStack.splice(loopStack.indexOf(frame), 1);
                result.loop_action = 'exit';
                result.result = { loop: 'foreach', completed: true, iterations: frame.iterations };
                logOutput.push(`[${stateName}] done after ${items.length} items`);
            }
        }
        else if (stateClass === 'BreakStatement') {
            if (!loopStack.length) {
                throw new Error(`'${stateName}': Break used outside of a loop — there `
                    + `is no loop to break out of.`);
            }
            result.loop_action = 'break';
            result.result = `break out of ${loopStack[loopStack.length - 1].name}`;
            logOutput.push(`[${stateName}] breaking out of loop `
                + `'${loopStack[loopStack.length - 1].name}'`);
        }
        else if (stateClass === 'ContinueStatement') {
            if (!loopStack.length) {
                throw new Error(`'${stateName}': Continue used outside of a loop — `
                    + `there is no loop to continue.`);
            }
            result.loop_action = 'continue';
            result.result = `continue loop ${loopStack[loopStack.length - 1].name}`;
            logOutput.push(`[${stateName}] continuing loop `
                + `'${loopStack[loopStack.length - 1].name}'`);
        }
        else if (stateClass === 'SolutionInvocation') {
            await (0, invocation_1.handleSolutionInvocation)(host, fieldValues, context, stateName, logOutput, result);
        }
        else if (stateClass === 'AwaitBackendCall') {
            await (0, invocation_1.handleAwaitBackendCall)(host, fieldValues, context, stateName, logOutput, result);
        }
        else if (stateClass === 'FunctionCall') {
            const funcName = fieldValues.functionName || '';
            const resultVar = fieldValues.resultVariableName || '';
            if (resultVar)
                context[resultVar] = null;
            result.result = 'FunctionCall is not executable (use SolutionInvocation)';
            logOutput.push(`[${stateName}] FunctionCall "${funcName}" is an authoring-only `
                + `legacy node and did NOT run. Use a SolutionInvocation node to `
                + `call solution logic; ${resultVar || '(no result var)'} was set `
                + `to None.`);
        }
        else if (stateClass === 'ReturnValue' || stateClass === 'ReturnStatement') {
            const returnValueStr = fieldValues.returnValue ?? '';
            const returnSource = fieldValues.returnValueSource ?? 'literal';
            let resolved;
            if (returnSource && typeof returnSource === 'object' && 'sourceType' in returnSource) {
                resolved = (0, value_sources_1.resolveValueSourceConfig)(returnSource, context);
            }
            else if (returnSource === 'variable'
                || (!returnValueStr && fieldValues.variableName)) {
                const varName = fieldValues.variableName ?? returnValueStr;
                resolved = varName in context
                    ? context[varName] : (0, value_sources_1.safeResolveValue)(returnValueStr, context);
            }
            else {
                resolved = (0, value_sources_1.safeResolveValue)(returnValueStr, context);
            }
            result.result = resolved;
            logOutput.push(`[${stateName}] Returning: ${(0, engine_types_1.pyRepr)(resolved)} `
                + `(type: ${pyType(resolved)})`);
        }
        else if (stateClass === 'LogOutput') {
            let msg = fieldValues.messageTemplate ?? '';
            for (const [varName, varValue] of Object.entries(context)) {
                msg = msg.split(`{${varName}}`).join(String(varValue));
            }
            logOutput.push(msg);
            result.result = msg;
        }
        else if (stateClass === 'MathOperation') {
            const leftRaw = fieldValues.leftOperand ?? fieldValues.left ?? '0';
            const rightRaw = fieldValues.rightOperand ?? fieldValues.right ?? '0';
            const leftVal = (0, value_sources_1.safeResolveValue)(leftRaw, context);
            const rightVal = (0, value_sources_1.safeResolveValue)(rightRaw, context);
            const opStr = fieldValues.operator ?? fieldValues.operationType ?? '+';
            const opSymbol = {
                add: '+', subtract: '-', multiply: '*', divide: '/',
                modulo: '%', power: '**',
            }[opStr] ?? opStr;
            const arithFn = conditions_1.ARITHMETIC_OPS[opStr] ?? conditions_1.ARITHMETIC_OPS['+'];
            let computed = null;
            try {
                computed = arithFn(leftVal, rightVal);
            }
            catch (e) {
                logOutput.push(`[${stateName}] MathOperation error: ${e?.message ?? e}`);
            }
            let resultVar = fieldValues.resultVariable || ''
                || fieldValues.resultFieldPath || ''
                || fieldValues.resultVariableName || ''
                || fieldValues.variableName || '';
            if (!resultVar) {
                resultVar = fieldValues.resultFieldPath
                    || fieldValues.resultVariableName || fieldValues.variableName || '';
            }
            if (resultVar) {
                context[resultVar] = computed;
                if (resultVar.startsWith('self.'))
                    context[resultVar.slice(5)] = computed;
            }
            result.result = computed;
            if (computed !== null && computed !== undefined) {
                const displayVar = resultVar.startsWith('self.')
                    ? resultVar.replace('self.', '') : resultVar;
                logOutput.push(`[${stateName}] ${displayVar} = ${(0, engine_types_1.pyRepr)(leftVal)} ${opSymbol} `
                    + `${(0, engine_types_1.pyRepr)(rightVal)} = ${(0, engine_types_1.pyRepr)(computed)}`);
            }
        }
        else if (stateClass === 'FilterList') {
            const sourceVar = fieldValues.sourceVariable || '';
            const resultVar = fieldValues.resultVariable || '';
            const itemVar = fieldValues.itemVariable || 'x';
            const condition = fieldValues.filterCondition ?? fieldValues.condition ?? {};
            const source = (0, collections_1.resolveCollection)(sourceVar, fieldValues, context);
            const kept = [];
            (0, collections_1.withScopedVars)(context, [itemVar], (setVar) => {
                for (const el of source) {
                    setVar(itemVar, el);
                    if ((0, conditions_1.evaluateConditionAny)(condition, context))
                        kept.push(el);
                }
            });
            if (resultVar)
                context[resultVar] = kept;
            result.result = kept;
            logOutput.push(`[${stateName}] kept ${kept.length} of ${source.length} items`
                + (resultVar ? ` -> ${resultVar}` : ''));
        }
        else if (stateClass === 'MapList') {
            const sourceVar = fieldValues.sourceVariable || '';
            const resultVar = fieldValues.resultVariable || '';
            const itemVar = fieldValues.itemVariable || 'x';
            const source = (0, collections_1.resolveCollection)(sourceVar, fieldValues, context);
            const mapped = [];
            (0, collections_1.withScopedVars)(context, [itemVar], (setVar) => {
                for (const el of source) {
                    setVar(itemVar, el);
                    mapped.push((0, conditions_1.evalElementExpression)(fieldValues, context, itemVar));
                }
            });
            if (resultVar)
                context[resultVar] = mapped;
            result.result = mapped;
            logOutput.push(`[${stateName}] mapped ${mapped.length} items`
                + (resultVar ? ` -> ${resultVar}` : ''));
        }
        else if (stateClass === 'ReduceList') {
            const sourceVar = fieldValues.sourceVariable || '';
            const resultVar = fieldValues.resultVariable || '';
            const itemVar = fieldValues.itemVariable || 'x';
            const accVar = fieldValues.accumulatorVariable || 'acc';
            const initial = (0, value_sources_1.safeResolveValue)(fieldValues.initialValue ?? 0, context);
            const source = (0, collections_1.resolveCollection)(sourceVar, fieldValues, context);
            let acc = initial;
            (0, collections_1.withScopedVars)(context, [itemVar, accVar], (setVar) => {
                for (const el of source) {
                    setVar(itemVar, el);
                    setVar(accVar, acc);
                    acc = (0, conditions_1.evalElementExpression)(fieldValues, context, itemVar);
                }
            });
            if (resultVar)
                context[resultVar] = acc;
            result.result = acc;
            logOutput.push(`[${stateName}] reduced ${source.length} items to ${(0, engine_types_1.pyRepr)(acc)}`
                + (resultVar ? ` -> ${resultVar}` : ''));
        }
        else if (stateClass === 'CollectionOperation') {
            const op = fieldValues.operationType || '';
            const targetVar = fieldValues.targetVariable || '';
            const key = (0, value_sources_1.safeResolveValue)(fieldValues.key ?? '', context);
            const rawValue = fieldValues.value ?? null;
            const value = (rawValue && typeof rawValue === 'object' && 'sourceType' in rawValue)
                ? (0, value_sources_1.resolveValueSourceConfig)(rawValue, context)
                : (0, value_sources_1.safeResolveValue)(rawValue, context);
            const resultVar = fieldValues.resultVariable || '';
            const out = (0, collections_1.collectionOperation)(context, op, targetVar, key, value, stateName);
            if (resultVar)
                context[resultVar] = out;
            result.result = out;
            logOutput.push(`[${stateName}] ${op} on '${targetVar}' -> ${(0, engine_types_1.pyRepr)(out)}`);
        }
        else if (stateClass === 'ValidationResult') {
            (0, validation_1.handleValidationResult)(fieldValues, context, stateName, logOutput, result);
        }
        else if (stateClass === 'EmitEvent' || stateClass === 'EmitFrontendEvent') {
            const channel = stateClass === 'EmitFrontendEvent' ? 'frontend' : 'backend';
            const eventName = fieldValues.eventName || fieldValues.name || stateName;
            const payload = {};
            const rawPayload = fieldValues.payload;
            if (rawPayload && typeof rawPayload === 'object' && !('sourceType' in rawPayload)) {
                for (const [k, v] of Object.entries(rawPayload)) {
                    payload[k] = (v && typeof v === 'object' && 'sourceType' in v)
                        ? (0, value_sources_1.resolveValueSourceConfig)(v, context)
                        : (0, value_sources_1.safeResolveValue)(v, context);
                }
            }
            for (const mapping of fieldValues.payloadMappings || []) {
                if (!mapping || typeof mapping !== 'object')
                    continue;
                const outName = mapping.outputFieldName || '';
                if (outName) {
                    payload[outName] = (0, value_sources_1.resolveValueSourceConfig)(mapping.valueSource, context);
                }
            }
            const event = { name: eventName, payload, sourceState: stateName, channel };
            if (!Array.isArray(context[engine_types_1.EMITTED_EVENTS_KEY])) {
                context[engine_types_1.EMITTED_EVENTS_KEY] = [];
            }
            context[engine_types_1.EMITTED_EVENTS_KEY].push(event);
            result.result = event;
            const tag = channel === 'frontend' ? 'FRONTEND event' : 'event';
            logOutput.push(`[${stateName}] emitted ${tag} '${eventName}' with `
                + `${Object.keys(payload).length} payload field(s)`);
        }
        else if (stateClass === 'FormValidation') {
            (0, validation_1.handleFormValidation)(fieldValues, context, stateName, logOutput, result);
        }
        else if (capability_1.BACKEND_ONLY_CLASSES.has(stateClass)) {
            throw new Error(`'${stateName}' (${stateClass}) runs only on the backend engine. `
                + `This solution should not have been routed to the client — `
                + `run it on the backend, or remove the backend-only node.`);
        }
        else {
            result.result = `State ${stateName} (${stateClass}) - no evaluation`;
        }
        return result;
    }
    // ---------------------------------------------------------------
    // Routing — mirrors _slot_target / _get_next_state exactly.
    // ---------------------------------------------------------------
    slotTarget(state, statesByName, slotIndex) {
        if (!state)
            return null;
        const outputSlots = (state.slots || []).filter((s) => !s.isInput);
        if (slotIndex >= outputSlots.length)
            return null;
        for (const conn of outputSlots[slotIndex].connectors || []) {
            const targetName = conn.targetStateName;
            if (targetName && targetName in statesByName)
                return statesByName[targetName];
        }
        return null;
    }
    getNextState(currentState, statesByName, context, branchTaken) {
        const slots = currentState.slots || [];
        const stateClass = currentState.boundObjectClass ?? currentState.stateClass ?? '';
        const outputSlots = slots.filter((s) => !s.isInput);
        if (!outputSlots.length)
            return null;
        if (stateClass === 'FormValidation') {
            // Verdict-driven routing. CRITICAL INVARIANT: an invalid form
            // NEVER proceeds down "All Valid".
            const follow = (slot) => {
                for (const conn of slot?.connectors || []) {
                    const targetName = conn.targetStateName;
                    if (targetName && targetName in statesByName) {
                        return statesByName[targetName];
                    }
                }
                return null;
            };
            if (context['form_valid']) {
                return outputSlots.length ? follow(outputSlots[0]) : null;
            }
            const fieldsCfg = (currentState.boundObjectFieldValues || {}).fields || [];
            const slotByAbsIndex = {};
            for (const s of outputSlots)
                slotByAbsIndex[s.index] = s;
            for (const fname of context['_invalid_fields'] || []) {
                const fCfg = fieldsCfg.find((f) => f && typeof f === 'object' && f.fieldName === fname);
                if (!fCfg)
                    continue;
                const slot = slotByAbsIndex[fCfg.outputSlotIndex];
                if (slot && (slot.connectors || []).length) {
                    const nxt = follow(slot);
                    if (nxt)
                        return nxt;
                }
            }
            const hasPerFieldSlots = fieldsCfg.some((f) => f && typeof f === 'object'
                && f.outputSlotIndex !== null && f.outputSlotIndex !== undefined);
            if (!hasPerFieldSlots && outputSlots.length > 1
                && (outputSlots[1].connectors || []).length) {
                return follow(outputSlots[1]);
            }
            return null;
        }
        if (stateClass === 'ConditionalChain' && branchTaken !== null) {
            const targetSlot = branchTaken < outputSlots.length
                ? outputSlots[branchTaken]
                : outputSlots[outputSlots.length - 1];
            if (targetSlot) {
                const connectors = targetSlot.connectors || [];
                if (connectors.length) {
                    const targetName = connectors[0].targetStateName;
                    if (targetName)
                        return statesByName[targetName] ?? null;
                }
            }
            return null;
        }
        for (const slot of outputSlots) {
            for (const conn of slot.connectors || []) {
                const targetName = conn.targetStateName;
                if (targetName && targetName in statesByName) {
                    return statesByName[targetName];
                }
            }
        }
        return null;
    }
    snapshot(context, stateName, solutionName, executionId) {
        const variables = {};
        for (const [name, value] of Object.entries(context)) {
            let snapValue = value;
            try {
                JSON.stringify(value);
            }
            catch {
                snapValue = String(value);
            }
            variables[name] = {
                name, type: pyType(value), value: snapValue,
                sourceStateName: stateName,
            };
        }
        return { stateName, solutionName, executionId, variables };
    }
}
exports.ClientSolutionEngine = ClientSolutionEngine;
