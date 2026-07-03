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

import {
    BRANCHING_STATE_CLASSES, ClientTrace, ClientTraceStep, ContextSnapshot,
    EMITTED_EVENTS_KEY, INITIAL_STATE_CLASSES, LoopFrame, MAX_STEPS,
    SnapshotVariable, SolutionResolver, BackendBridge, SolutionRow,
    StateEvalResult, TERMINAL_STATE_CLASSES, generateExecutionId,
    generateSnapshotId, pyRepr,
} from './engine-types';
import { BACKEND_ONLY_CLASSES } from './capability';
import {
    Context, resolveValueSourceConfig, safeResolveValue,
} from './value-sources';
import {
    ARITHMETIC_OPS, evaluateChainLink, evaluateCondition,
    evaluateConditionAny, evalElementExpression,
} from './conditions';
import {
    checkLoopBudget, coerceNumber, collectionOperation, loopBudget,
    loopFrameFor, resolveCollection, withScopedVars,
} from './collections';
import { handleFormValidation, handleValidationResult } from './validation';
import { EngineHost, handleAwaitBackendCall, handleSolutionInvocation } from './invocation';

/** Python-ish type names so trace snapshots read the same. */
function pyType(value: any): string {
    if (value === null || value === undefined) return 'NoneType';
    if (typeof value === 'boolean') return 'bool';
    if (typeof value === 'number') return Number.isInteger(value) ? 'int' : 'float';
    if (typeof value === 'string') return 'str';
    if (Array.isArray(value)) return 'list';
    if (typeof value === 'object') return 'dict';
    return typeof value;
}

export interface ClientEngineOptions {
    resolver?: SolutionResolver | null;
    bridge?: BackendBridge | null;
}

export class ClientSolutionEngine {
    private resolver: SolutionResolver | null;
    private bridge: BackendBridge | null;

    constructor(options: ClientEngineOptions = {}) {
        this.resolver = options.resolver ?? null;
        this.bridge = options.bridge ?? null;
    }

    /** Execute a solution definition (parsed JSON) — the mirror of
     *  SolutionExecutionEngine.execute(). Async because invocation /
     *  backend-bridge nodes await. */
    async execute(
        solutionData: any,
        inputParams: Record<string, any> = {},
        targetRuntime = 'typescript_frontend',
        instanceFields: Record<string, any> | null = null,
        invocationChain: string[] = [],
    ): Promise<ClientTrace> {
        // ISOLATION: deep-clone, never mutate the stored definition.
        solutionData = JSON.parse(JSON.stringify(solutionData ?? {}));
        const solutionName = solutionData.solutionName || 'untitled';
        const executionId = generateExecutionId();
        const trace: ClientTrace = {
            executionId, solutionName, targetRuntime,
            status: 'running', steps: [],
            startedAt: new Date().toISOString(), engine: 'client',
        };
        const complete = (finalReturnValue?: any) => {
            trace.status = 'completed';
            trace.completedAt = new Date().toISOString();
            if (finalReturnValue !== undefined) trace.finalReturnValue = finalReturnValue;
            return trace;
        };
        const fail = (msg: string) => {
            trace.status = 'errored';
            trace.completedAt = new Date().toISOString();
            trace.errorSummary = msg;
            return trace;
        };

        const stateInstances: any[] = solutionData.stateInstances || [];
        if (!stateInstances.length) return fail('No state instances found in solution');

        const sortedStates = [...stateInstances].sort(
            (a, b) => (a.index ?? 0) - (b.index ?? 0));
        const statesByName: Record<string, any> = {};
        for (const s of sortedStates) {
            if (s.stateName) statesByName[s.stateName] = s;
        }
        let initialState: any = null;
        for (const s of sortedStates) {
            const cls = s.boundObjectClass ?? s.stateClass ?? '';
            if (INITIAL_STATE_CLASSES.has(cls)) { initialState = s; break; }
        }
        if (!initialState) return fail('No initial state found in solution');

        const context: Context = {};
        if (instanceFields) Object.assign(context, instanceFields);
        if (inputParams) Object.assign(context, inputParams);

        const host: EngineHost = {
            solutionName,
            invocationChain,
            resolver: this.resolver,
            bridge: this.bridge,
            executeChild: (row: SolutionRow, inputs, chain) => {
                const child = new ClientSolutionEngine(
                    { resolver: this.resolver, bridge: this.bridge });
                return child.execute(
                    row.definition, inputs,
                    row.targetRuntime || 'typescript_frontend', null, chain);
            },
        };

        let currentState: any = initialState;
        let stepIndex = 0;
        const loopStack: LoopFrame[] = [];

        try {
            while (currentState !== null && stepIndex < MAX_STEPS) {
                const stateName = currentState.stateName || `Step_${stepIndex}`;
                const stateClass = currentState.boundObjectClass
                    ?? currentState.stateClass ?? '';
                const fieldValues = currentState.boundObjectFieldValues || {};

                const contextBefore = this.snapshot(context, stateName, solutionName, executionId);
                const startTime = Date.now();
                const logOutput: string[] = [];
                let status: 'completed' | 'errored' = 'completed';
                let executionError: string | null = null;
                let evalResult: StateEvalResult = {
                    result: null, branch_taken: null, branch_label: null, loop_action: null,
                };
                try {
                    evalResult = await this.evaluateState(
                        host, stateClass, fieldValues, context, stateName,
                        logOutput, loopStack);
                } catch (e: any) {
                    executionError = e?.message ?? String(e);
                    status = 'errored';
                }
                const endTime = Date.now();
                const contextAfter = this.snapshot(context, stateName, solutionName, executionId);

                const step: ClientTraceStep = {
                    snapshotId: generateSnapshotId(),
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

                if (status === 'errored') return fail(executionError as string);
                if (TERMINAL_STATE_CLASSES.has(stateClass)) {
                    return complete(evalResult.result);
                }

                // Routing — mirror of the Python walk's loop actions.
                let nextState: any;
                if (evalResult.loop_action === 'body') {
                    nextState = this.slotTarget(currentState, statesByName, 0) ?? currentState;
                } else if (evalResult.loop_action === 'exit') {
                    nextState = this.slotTarget(currentState, statesByName, 1);
                } else if (evalResult.loop_action === 'break') {
                    const frame = loopStack.pop();
                    const loopNode = frame ? statesByName[frame.name] : null;
                    nextState = loopNode
                        ? this.slotTarget(loopNode, statesByName, 1) : null;
                } else if (evalResult.loop_action === 'continue') {
                    nextState = statesByName[loopStack[loopStack.length - 1].name];
                } else {
                    nextState = this.getNextState(
                        currentState, statesByName, context, evalResult.branch_taken);
                }
                // Dead-end rule: a body path that simply ends returns to
                // the innermost active loop for its next iteration.
                if ((nextState === null || nextState === undefined) && loopStack.length) {
                    nextState = statesByName[loopStack[loopStack.length - 1].name];
                }
                currentState = nextState ?? null;
                stepIndex += 1;
            }
            if (stepIndex >= MAX_STEPS) {
                return fail(`Execution exceeded maximum step limit (${MAX_STEPS})`);
            }
            return complete();
        } catch (e: any) {
            return fail(e?.message ?? String(e));
        }
    }

    // ---------------------------------------------------------------
    // State dispatch — mirrors _evaluate_state's client-capable set.
    // ---------------------------------------------------------------
    private async evaluateState(
        host: EngineHost, stateClass: string, fieldValues: any, context: Context,
        stateName: string, logOutput: string[], loopStack: LoopFrame[],
    ): Promise<StateEvalResult> {
        const result: StateEvalResult = {
            result: null, branch_taken: null, branch_label: null, loop_action: null,
        };

        if (['InitialState', 'DirectInvocation', 'FormSubscription', 'LogicFlowEntry',
             'InitialConditionsValidatorEntry'].includes(stateClass)) {
            const inputParams = fieldValues.inputParams || [];
            const paramStrs = inputParams.map((p: any) => {
                const pName = p?.name ?? '?';
                const pVal = pName in context ? context[pName] : '<not provided>';
                return `${pName}=${pName in context ? pyRepr(pVal) : pVal}`;
            });
            result.result = `Entry point with ${inputParams.length} parameters`;
            logOutput.push(
                `[${stateName}] Entering with params: `
                + `${paramStrs.length ? paramStrs.join(', ') : '(none)'}`);

        } else if (stateClass === 'VariableAssignment') {
            const varName = fieldValues.variableName || '';
            const valueStr = fieldValues.value ?? '';
            const assignmentConfig = fieldValues.assignmentConfig || {};
            const valueSourceConfig = assignmentConfig?.valueSource;
            if (varName) {
                let resolved: any;
                if (valueSourceConfig && typeof valueSourceConfig === 'object'
                    && 'sourceType' in valueSourceConfig) {
                    resolved = resolveValueSourceConfig(valueSourceConfig, context);
                } else {
                    resolved = safeResolveValue(valueStr, context);
                }
                context[varName] = resolved;
                if (varName.startsWith('self.')) context[varName.slice(5)] = resolved;
                result.result = resolved;
                logOutput.push(
                    `[${stateName}] ${varName} = ${pyRepr(resolved)} `
                    + `(type: ${pyType(resolved)})`);
            }

        } else if (stateClass === 'ConditionalChain') {
            const links = fieldValues.links || [];
            const conditions = fieldValues.conditions || [];
            const condition = fieldValues.condition ?? '';
            const defaultOp = String(fieldValues.defaultLogicalOperator || 'AND').toUpperCase();
            if (links.length > 0) {
                const linkResults: Array<[boolean, string]> = links.map((link: any) => [
                    evaluateChainLink(link, context, logOutput),
                    String(link.logicalOperator ?? defaultOp).toUpperCase(),
                ]);
                let combined = linkResults[0][0];
                for (let i = 1; i < linkResults.length; i++) {
                    const [resultVal] = linkResults[i];
                    const prevOp = linkResults[i - 1][1];
                    if (prevOp === 'OR') combined = combined || resultVal;
                    else if (prevOp === 'NOT') combined = combined && !resultVal;
                    else if (prevOp === 'XOR') combined = combined !== resultVal;
                    else combined = combined && resultVal;
                }
                result.branch_taken = combined ? 0 : 1;
                result.branch_label = combined ? 'true' : 'false';
                logOutput.push(
                    `[${stateName}] Condition result: ${combined ? 'True' : 'False'} `
                    + `-> branch ${result.branch_label}`);
            } else if (conditions.length > 0) {
                let matched = false;
                for (let i = 0; i < conditions.length; i++) {
                    if (evaluateCondition(conditions[i], context)) {
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
                logOutput.push(
                    `[${stateName}] Condition result -> branch ${result.branch_label}`);
            } else if (condition) {
                const ok = evaluateCondition(condition, context);
                result.branch_taken = ok ? 0 : 1;
                result.branch_label = ok ? 'true' : 'false';
                logOutput.push(
                    `[${stateName}] Condition result -> branch ${result.branch_label}`);
            } else {
                result.branch_taken = 0;
                result.branch_label = 'default';
                logOutput.push(`[${stateName}] No condition defined -> branch default`);
            }

        } else if (stateClass === 'ForLoop') {
            const iterator = fieldValues.iteratorVariable || fieldValues.iterator || 'i';
            let frame = loopFrameFor(loopStack, stateName);
            if (frame === null) {
                const start = coerceNumber(safeResolveValue(
                    fieldValues.startValue ?? fieldValues.start ?? 0, context), 0);
                const end = coerceNumber(safeResolveValue(
                    fieldValues.endValue ?? fieldValues.end ?? 10, context), 10);
                const step = coerceNumber(safeResolveValue(
                    fieldValues.stepValue ?? fieldValues.step ?? 1, context), 1);
                if (step === 0) {
                    throw new Error(
                        `Loop '${stateName}': step is 0 — the loop would `
                        + `never advance. Use a positive or negative step.`);
                }
                frame = {
                    name: stateName, kind: 'for', current: start, end, step,
                    iterations: 0, budget: loopBudget(fieldValues),
                };
                loopStack.push(frame);
            } else {
                frame.current = (frame.current as number) + (frame.step as number);
            }
            const cont = ((frame.step as number) > 0 && (frame.current as number) < (frame.end as number))
                || ((frame.step as number) < 0 && (frame.current as number) > (frame.end as number));
            if (cont) {
                frame.iterations += 1;
                checkLoopBudget(frame, stateName);
                context[iterator] = frame.current;
                result.loop_action = 'body';
                result.result = {
                    loop: 'for', iterator, value: frame.current,
                    iteration: frame.iterations,
                };
                logOutput.push(
                    `[${stateName}] iteration ${frame.iterations}: `
                    + `${iterator} = ${frame.current}`);
            } else {
                loopStack.splice(loopStack.indexOf(frame), 1);
                result.loop_action = 'exit';
                result.result = { loop: 'for', completed: true, iterations: frame.iterations };
                logOutput.push(
                    `[${stateName}] done after ${frame.iterations} iterations`);
            }

        } else if (stateClass === 'WhileLoop') {
            const condition = fieldValues.condition ?? '';
            let frame = loopFrameFor(loopStack, stateName);
            if (frame === null) {
                frame = {
                    name: stateName, kind: 'while', iterations: 0,
                    budget: loopBudget(fieldValues),
                };
                loopStack.push(frame);
            }
            const condOk = evaluateConditionAny(condition, context, logOutput);
            if (condOk) {
                frame.iterations += 1;
                checkLoopBudget(frame, stateName);
                result.loop_action = 'body';
                result.result = { loop: 'while', iteration: frame.iterations };
                logOutput.push(
                    `[${stateName}] condition true — iteration `
                    + `${frame.iterations}`);
            } else {
                loopStack.splice(loopStack.indexOf(frame), 1);
                result.loop_action = 'exit';
                result.result = { loop: 'while', completed: true, iterations: frame.iterations };
                logOutput.push(
                    `[${stateName}] condition false — done after `
                    + `${frame.iterations} iterations`);
            }

        } else if (stateClass === 'ForEachLoop') {
            const item = fieldValues.itemVariable || fieldValues.item || 'item';
            const indexVar = fieldValues.indexVariable || `${item}_index`;
            let frame = loopFrameFor(loopStack, stateName);
            if (frame === null) {
                const raw = fieldValues.collection ?? '[]';
                let collection: any;
                if (raw && typeof raw === 'object' && 'sourceType' in raw) {
                    collection = resolveValueSourceConfig(raw, context);
                } else {
                    collection = safeResolveValue(raw, context);
                }
                if (!Array.isArray(collection)) {
                    logOutput.push(
                        `[${stateName}] collection is not a list `
                        + `(${pyType(collection)}) — treating as empty.`);
                    collection = [];
                }
                frame = {
                    name: stateName, kind: 'foreach', items: [...collection],
                    index: 0, iterations: 0, budget: loopBudget(fieldValues),
                };
                loopStack.push(frame);
            } else {
                frame.index = (frame.index as number) + 1;
            }
            const items = frame.items as any[];
            if ((frame.index as number) < items.length) {
                frame.iterations += 1;
                checkLoopBudget(frame, stateName);
                context[item] = items[frame.index as number];
                context[indexVar] = frame.index;
                result.loop_action = 'body';
                result.result = { loop: 'foreach', index: frame.index, item: context[item] };
                logOutput.push(
                    `[${stateName}] item ${(frame.index as number) + 1}/`
                    + `${items.length}: ${item} = ${pyRepr(context[item])}`);
            } else {
                loopStack.splice(loopStack.indexOf(frame), 1);
                result.loop_action = 'exit';
                result.result = { loop: 'foreach', completed: true, iterations: frame.iterations };
                logOutput.push(`[${stateName}] done after ${items.length} items`);
            }

        } else if (stateClass === 'BreakStatement') {
            if (!loopStack.length) {
                throw new Error(
                    `'${stateName}': Break used outside of a loop — there `
                    + `is no loop to break out of.`);
            }
            result.loop_action = 'break';
            result.result = `break out of ${loopStack[loopStack.length - 1].name}`;
            logOutput.push(
                `[${stateName}] breaking out of loop `
                + `'${loopStack[loopStack.length - 1].name}'`);

        } else if (stateClass === 'ContinueStatement') {
            if (!loopStack.length) {
                throw new Error(
                    `'${stateName}': Continue used outside of a loop — `
                    + `there is no loop to continue.`);
            }
            result.loop_action = 'continue';
            result.result = `continue loop ${loopStack[loopStack.length - 1].name}`;
            logOutput.push(
                `[${stateName}] continuing loop `
                + `'${loopStack[loopStack.length - 1].name}'`);

        } else if (stateClass === 'SolutionInvocation') {
            await handleSolutionInvocation(
                host, fieldValues, context, stateName, logOutput, result);

        } else if (stateClass === 'AwaitBackendCall') {
            await handleAwaitBackendCall(
                host, fieldValues, context, stateName, logOutput, result);

        } else if (stateClass === 'FunctionCall') {
            const funcName = fieldValues.functionName || '';
            const resultVar = fieldValues.resultVariableName || '';
            if (resultVar) context[resultVar] = null;
            result.result = 'FunctionCall is not executable (use SolutionInvocation)';
            logOutput.push(
                `[${stateName}] FunctionCall "${funcName}" is an authoring-only `
                + `legacy node and did NOT run. Use a SolutionInvocation node to `
                + `call solution logic; ${resultVar || '(no result var)'} was set `
                + `to None.`);

        } else if (stateClass === 'ReturnValue' || stateClass === 'ReturnStatement') {
            const returnValueStr = fieldValues.returnValue ?? '';
            const returnSource = fieldValues.returnValueSource ?? 'literal';
            let resolved: any;
            if (returnSource && typeof returnSource === 'object' && 'sourceType' in returnSource) {
                resolved = resolveValueSourceConfig(returnSource, context);
            } else if (returnSource === 'variable'
                || (!returnValueStr && fieldValues.variableName)) {
                const varName = fieldValues.variableName ?? returnValueStr;
                resolved = varName in context
                    ? context[varName] : safeResolveValue(returnValueStr, context);
            } else {
                resolved = safeResolveValue(returnValueStr, context);
            }
            result.result = resolved;
            logOutput.push(
                `[${stateName}] Returning: ${pyRepr(resolved)} `
                + `(type: ${pyType(resolved)})`);

        } else if (stateClass === 'LogOutput') {
            let msg = fieldValues.messageTemplate ?? '';
            for (const [varName, varValue] of Object.entries(context)) {
                msg = msg.split(`{${varName}}`).join(String(varValue));
            }
            logOutput.push(msg);
            result.result = msg;

        } else if (stateClass === 'MathOperation') {
            const leftRaw = fieldValues.leftOperand ?? fieldValues.left ?? '0';
            const rightRaw = fieldValues.rightOperand ?? fieldValues.right ?? '0';
            const leftVal = safeResolveValue(leftRaw, context);
            const rightVal = safeResolveValue(rightRaw, context);
            const opStr = fieldValues.operator ?? fieldValues.operationType ?? '+';
            const opSymbol: string = ({
                add: '+', subtract: '-', multiply: '*', divide: '/',
                modulo: '%', power: '**',
            } as Record<string, string>)[opStr] ?? opStr;
            const arithFn = ARITHMETIC_OPS[opStr] ?? ARITHMETIC_OPS['+'];
            let computed: any = null;
            try {
                computed = arithFn(leftVal, rightVal);
            } catch (e: any) {
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
                if (resultVar.startsWith('self.')) context[resultVar.slice(5)] = computed;
            }
            result.result = computed;
            if (computed !== null && computed !== undefined) {
                const displayVar = resultVar.startsWith('self.')
                    ? resultVar.replace('self.', '') : resultVar;
                logOutput.push(
                    `[${stateName}] ${displayVar} = ${pyRepr(leftVal)} ${opSymbol} `
                    + `${pyRepr(rightVal)} = ${pyRepr(computed)}`);
            }

        } else if (stateClass === 'FilterList') {
            const sourceVar = fieldValues.sourceVariable || '';
            const resultVar = fieldValues.resultVariable || '';
            const itemVar = fieldValues.itemVariable || 'x';
            const condition = fieldValues.filterCondition ?? fieldValues.condition ?? {};
            const source = resolveCollection(sourceVar, fieldValues, context);
            const kept: any[] = [];
            withScopedVars(context, [itemVar], (setVar) => {
                for (const el of source) {
                    setVar(itemVar, el);
                    if (evaluateConditionAny(condition, context)) kept.push(el);
                }
            });
            if (resultVar) context[resultVar] = kept;
            result.result = kept;
            logOutput.push(
                `[${stateName}] kept ${kept.length} of ${source.length} items`
                + (resultVar ? ` -> ${resultVar}` : ''));

        } else if (stateClass === 'MapList') {
            const sourceVar = fieldValues.sourceVariable || '';
            const resultVar = fieldValues.resultVariable || '';
            const itemVar = fieldValues.itemVariable || 'x';
            const source = resolveCollection(sourceVar, fieldValues, context);
            const mapped: any[] = [];
            withScopedVars(context, [itemVar], (setVar) => {
                for (const el of source) {
                    setVar(itemVar, el);
                    mapped.push(evalElementExpression(fieldValues, context, itemVar));
                }
            });
            if (resultVar) context[resultVar] = mapped;
            result.result = mapped;
            logOutput.push(
                `[${stateName}] mapped ${mapped.length} items`
                + (resultVar ? ` -> ${resultVar}` : ''));

        } else if (stateClass === 'ReduceList') {
            const sourceVar = fieldValues.sourceVariable || '';
            const resultVar = fieldValues.resultVariable || '';
            const itemVar = fieldValues.itemVariable || 'x';
            const accVar = fieldValues.accumulatorVariable || 'acc';
            const initial = safeResolveValue(fieldValues.initialValue ?? 0, context);
            const source = resolveCollection(sourceVar, fieldValues, context);
            let acc = initial;
            withScopedVars(context, [itemVar, accVar], (setVar) => {
                for (const el of source) {
                    setVar(itemVar, el);
                    setVar(accVar, acc);
                    acc = evalElementExpression(fieldValues, context, itemVar);
                }
            });
            if (resultVar) context[resultVar] = acc;
            result.result = acc;
            logOutput.push(
                `[${stateName}] reduced ${source.length} items to ${pyRepr(acc)}`
                + (resultVar ? ` -> ${resultVar}` : ''));

        } else if (stateClass === 'CollectionOperation') {
            const op = fieldValues.operationType || '';
            const targetVar = fieldValues.targetVariable || '';
            const key = safeResolveValue(fieldValues.key ?? '', context);
            const rawValue = fieldValues.value ?? null;
            const value = (rawValue && typeof rawValue === 'object' && 'sourceType' in rawValue)
                ? resolveValueSourceConfig(rawValue, context)
                : safeResolveValue(rawValue, context);
            const resultVar = fieldValues.resultVariable || '';
            const out = collectionOperation(context, op, targetVar, key, value, stateName);
            if (resultVar) context[resultVar] = out;
            result.result = out;
            logOutput.push(
                `[${stateName}] ${op} on '${targetVar}' -> ${pyRepr(out)}`);

        } else if (stateClass === 'ValidationResult') {
            handleValidationResult(fieldValues, context, stateName, logOutput, result);

        } else if (stateClass === 'EmitEvent' || stateClass === 'EmitFrontendEvent') {
            const channel = stateClass === 'EmitFrontendEvent' ? 'frontend' : 'backend';
            const eventName = fieldValues.eventName || fieldValues.name || stateName;
            const payload: Record<string, any> = {};
            const rawPayload = fieldValues.payload;
            if (rawPayload && typeof rawPayload === 'object' && !('sourceType' in rawPayload)) {
                for (const [k, v] of Object.entries(rawPayload)) {
                    payload[k] = (v && typeof v === 'object' && 'sourceType' in (v as any))
                        ? resolveValueSourceConfig(v, context)
                        : safeResolveValue(v, context);
                }
            }
            for (const mapping of fieldValues.payloadMappings || []) {
                if (!mapping || typeof mapping !== 'object') continue;
                const outName = mapping.outputFieldName || '';
                if (outName) {
                    payload[outName] = resolveValueSourceConfig(mapping.valueSource, context);
                }
            }
            const event = { name: eventName, payload, sourceState: stateName, channel };
            if (!Array.isArray(context[EMITTED_EVENTS_KEY])) {
                context[EMITTED_EVENTS_KEY] = [];
            }
            context[EMITTED_EVENTS_KEY].push(event);
            result.result = event;
            const tag = channel === 'frontend' ? 'FRONTEND event' : 'event';
            logOutput.push(
                `[${stateName}] emitted ${tag} '${eventName}' with `
                + `${Object.keys(payload).length} payload field(s)`);

        } else if (stateClass === 'FormValidation') {
            handleFormValidation(fieldValues, context, stateName, logOutput, result);

        } else if (BACKEND_ONLY_CLASSES.has(stateClass)) {
            throw new Error(
                `'${stateName}' (${stateClass}) runs only on the backend engine. `
                + `This solution should not have been routed to the client — `
                + `run it on the backend, or remove the backend-only node.`);

        } else {
            result.result = `State ${stateName} (${stateClass}) - no evaluation`;
        }

        return result;
    }

    // ---------------------------------------------------------------
    // Routing — mirrors _slot_target / _get_next_state exactly.
    // ---------------------------------------------------------------
    private slotTarget(state: any, statesByName: Record<string, any>, slotIndex: number): any {
        if (!state) return null;
        const outputSlots = (state.slots || []).filter((s: any) => !s.isInput);
        if (slotIndex >= outputSlots.length) return null;
        for (const conn of outputSlots[slotIndex].connectors || []) {
            const targetName = conn.targetStateName;
            if (targetName && targetName in statesByName) return statesByName[targetName];
        }
        return null;
    }

    private getNextState(
        currentState: any, statesByName: Record<string, any>,
        context: Context, branchTaken: number | null,
    ): any {
        const slots = currentState.slots || [];
        const stateClass = currentState.boundObjectClass ?? currentState.stateClass ?? '';
        const outputSlots = slots.filter((s: any) => !s.isInput);
        if (!outputSlots.length) return null;

        if (stateClass === 'FormValidation') {
            // Verdict-driven routing. CRITICAL INVARIANT: an invalid form
            // NEVER proceeds down "All Valid".
            const follow = (slot: any) => {
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
            const slotByAbsIndex: Record<number, any> = {};
            for (const s of outputSlots) slotByAbsIndex[s.index] = s;
            for (const fname of context['_invalid_fields'] || []) {
                const fCfg = fieldsCfg.find(
                    (f: any) => f && typeof f === 'object' && f.fieldName === fname);
                if (!fCfg) continue;
                const slot = slotByAbsIndex[fCfg.outputSlotIndex];
                if (slot && (slot.connectors || []).length) {
                    const nxt = follow(slot);
                    if (nxt) return nxt;
                }
            }
            const hasPerFieldSlots = fieldsCfg.some(
                (f: any) => f && typeof f === 'object'
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
                    if (targetName) return statesByName[targetName] ?? null;
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

    private snapshot(
        context: Context, stateName: string, solutionName: string, executionId: string,
    ): ContextSnapshot {
        const variables: Record<string, SnapshotVariable> = {};
        for (const [name, value] of Object.entries(context)) {
            let snapValue = value;
            try {
                JSON.stringify(value);
            } catch {
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
