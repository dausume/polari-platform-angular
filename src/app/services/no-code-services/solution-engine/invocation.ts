// Author: Dustin Etts
// invocation.ts — SolutionInvocation (client mirror of the Python
// handler: same contract validation, same wording, same fresh-context
// abstraction boundary, same childExecution summary) and
// AwaitBackendCall (the EXPLICIT cross-runtime bridge: a client-side
// graph delegating one named solution to the backend engine).

import {
    ChildExecutionSummary, ClientTrace, MAX_INVOCATION_DEPTH,
    SolutionResolver, BackendBridge, SolutionRow, StateEvalResult, pyRepr,
} from './engine-types';
import { solutionRequiresBackend } from './capability';
import { Context, resolveValueSourceConfig } from './value-sources';

/** What invocation handlers need from the engine (avoids a circular
 *  import — the engine passes itself in). */
export interface EngineHost {
    solutionName: string;
    invocationChain: string[];
    resolver: SolutionResolver | null;
    bridge: BackendBridge | null;
    executeChild(
        row: SolutionRow, inputParams: Record<string, any>, chain: string[],
    ): Promise<ClientTrace>;
}

function resolveInputMappings(fieldValues: any, context: Context): Record<string, any> {
    const childInputs: Record<string, any> = {};
    for (const m of fieldValues.inputMappings || []) {
        if (!m || typeof m !== 'object') continue;
        const param = String(m.param || '').trim();
        if (!param) continue;
        const src = m.valueSource;
        childInputs[param] = (src && typeof src === 'object')
            ? resolveValueSourceConfig(src, context) : src;
    }
    return childInputs;
}

function validateContract(
    contract: any, childInputs: Record<string, any>,
    stateName: string, calleeName: string, logOutput: string[],
): string {
    const declaredInputs: any[] = contract?.inputs || [];
    const missing = declaredInputs
        .filter((i) => i && typeof i === 'object' && i.required
            && (childInputs[i.name] === null || childInputs[i.name] === undefined))
        .map((i) => i.name);
    if (missing.length) {
        const desc = contract?.description || '';
        throw new Error(
            `SolutionInvocation '${stateName}': solution `
            + `'${calleeName}' requires input(s) [${missing.map((m) => `'${m}'`).join(', ')}] that were `
            + `not provided (or resolved to nothing). `
            + (desc ? `It describes itself as: ${desc}`
                : `Map each required input in the invocation's settings.`)
        );
    }
    if (declaredInputs.length) {
        const declaredNames = new Set(declaredInputs.map((i) => i?.name));
        for (const extra of Object.keys(childInputs)) {
            if (!declaredNames.has(extra)) {
                logOutput.push(
                    `[${stateName}] note: input '${extra}' is not in `
                    + `'${calleeName}'s contract — passed through anyway.`);
            }
        }
    }
    return contract?.executionRights || 'invoker';
}

function bindResults(
    fieldValues: any, context: Context, stateName: string, calleeName: string,
    logOutput: string[], finalReturnValue: any, childOutputs: Record<string, any>,
): void {
    for (const b of fieldValues.resultBindings || []) {
        if (!b || typeof b !== 'object') continue;
        const output = String(b.output || 'return').trim();
        const varName = String(b.contextVar || '').trim();
        if (!varName) continue;
        let value: any;
        if (output === 'return') {
            value = finalReturnValue;
        } else if (output in childOutputs) {
            value = childOutputs[output];
        } else {
            logOutput.push(
                `[${stateName}] note: '${calleeName}' produced no `
                + `output named '${output}' — '${varName}' set to None. `
                + `Available: ${Object.keys(childOutputs).sort().slice(0, 12).map((k) => `'${k}'`).join(', ')}`);
            value = null;
        }
        context[varName] = value === undefined ? null : value;
        logOutput.push(`[${stateName}] ${varName} = ${pyRepr(context[varName])} (from ${output})`);
    }
}

/** Client mirror of _invoke_solution. */
export async function handleSolutionInvocation(
    host: EngineHost, fieldValues: any, context: Context,
    stateName: string, logOutput: string[], result: StateEvalResult,
): Promise<void> {
    const calleeName = String(fieldValues.solutionRef || fieldValues.solutionName || '').trim();
    if (!calleeName) {
        throw new Error(
            `SolutionInvocation '${stateName}': no solutionRef `
            + `configured — pick which solution to invoke.`);
    }
    const chain = host.invocationChain;
    if (chain.length >= MAX_INVOCATION_DEPTH) {
        const path = [...chain, host.solutionName, calleeName].join(' -> ');
        throw new Error(
            `SolutionInvocation '${stateName}': call nesting exceeded `
            + `${MAX_INVOCATION_DEPTH} levels (${path}). If this is `
            + `recursion, make sure the base case is reachable; if the `
            + `nesting is intentional, flatten some of the chain.`);
    }
    if (!host.resolver) {
        throw new Error(
            `SolutionInvocation '${stateName}': no solution resolver is `
            + `available in this runtime — cannot load '${calleeName}'.`);
    }
    const row = await host.resolver.loadSolutionRow(calleeName);
    if (!row) {
        throw new Error(
            `SolutionInvocation '${stateName}': solution `
            + `'${calleeName}' was not found.`);
    }
    if (!row.definition || !(row.definition.stateInstances || []).length) {
        throw new Error(
            `SolutionInvocation '${stateName}': solution `
            + `'${calleeName}' has no executable definition.`);
    }
    // Client-only twist: a callee that needs the backend cannot be
    // nested inside a client execution — the author should reach it
    // through AwaitBackendCall (the explicit bridge) instead.
    const verdict = solutionRequiresBackend(row.definition);
    if (verdict.backendRequired) {
        throw new Error(
            `SolutionInvocation '${stateName}': solution '${calleeName}' `
            + `needs the backend engine (${verdict.reasons[0]}). Use an `
            + `Await Backend Call node to reach it from a client-side solution.`);
    }

    const childInputs = resolveInputMappings(fieldValues, context);
    const contract = row.contractJson || {};
    const rights = validateContract(contract, childInputs, stateName, calleeName, logOutput);
    logOutput.push(
        `[${stateName}] invoking '${calleeName}' `
        + `(depth ${chain.length + 1}, rights: ${rights}) with `
        + `[${Object.keys(childInputs).sort().map((k) => `'${k}'`).join(', ')}]`);

    // Fresh context (ONLY the mapped inputs) — the abstraction boundary.
    const childTrace = await host.executeChild(
        row, { ...childInputs }, [...chain, host.solutionName]);

    if (childTrace.status !== 'completed') {
        throw new Error(
            `SolutionInvocation '${stateName}': solution `
            + `'${calleeName}' failed: `
            + `${childTrace.errorSummary || 'unknown engine error'}`);
    }

    const lastStep = childTrace.steps[childTrace.steps.length - 1];
    const childOutputs: Record<string, any> = {};
    const vars = lastStep?.contextAfter?.variables || {};
    for (const [k, v] of Object.entries(vars)) {
        childOutputs[k] = (v && typeof v === 'object' && 'value' in v && 'name' in v)
            ? (v as any).value : v;
    }
    bindResults(fieldValues, context, stateName, calleeName, logOutput,
        childTrace.finalReturnValue, childOutputs);
    logOutput.push(
        `[${stateName}] '${calleeName}' completed in `
        + `${childTrace.steps.length} steps`);

    const summary: ChildExecutionSummary = {
        executionId: childTrace.executionId,
        solutionName: calleeName,
        status: childTrace.status,
        stepCount: childTrace.steps.length,
        finalReturnValue: childTrace.finalReturnValue,
    };
    result.result = `${calleeName} -> ${summary.status} (${summary.stepCount} steps)`;
    result.child_execution = summary;
}

/** AwaitBackendCall — the explicit cross-runtime bridge. From a
 *  client-executing graph, invoke a named solution ON THE BACKEND with
 *  SolutionInvocation semantics (input mappings out, result bindings
 *  back). On the backend engine the same node is a local invocation —
 *  a "backend call" from the backend is in-process. */
export async function handleAwaitBackendCall(
    host: EngineHost, fieldValues: any, context: Context,
    stateName: string, logOutput: string[], result: StateEvalResult,
): Promise<void> {
    const calleeName = String(
        fieldValues.solutionRef || fieldValues.solutionName
        || fieldValues.backendSolution || '').trim();
    if (!calleeName) {
        throw new Error(
            `AwaitBackendCall '${stateName}': no solutionRef configured `
            + `— pick which backend solution to call.`);
    }
    if (!host.bridge) {
        throw new Error(
            `AwaitBackendCall '${stateName}': no backend connection is `
            + `available in this runtime.`);
    }
    const childInputs = resolveInputMappings(fieldValues, context);
    logOutput.push(
        `[${stateName}] awaiting backend solution '${calleeName}' with `
        + `[${Object.keys(childInputs).sort().map((k) => `'${k}'`).join(', ')}]`);

    const res = await host.bridge.invokeBackendSolution(calleeName, childInputs);
    if (res.status !== 'completed') {
        throw new Error(
            `AwaitBackendCall '${stateName}': backend solution `
            + `'${calleeName}' failed: ${res.error || 'unknown engine error'}`);
    }
    bindResults(fieldValues, context, stateName, calleeName, logOutput,
        res.finalReturnValue, res.outputs || {});

    const summary: ChildExecutionSummary = {
        executionId: '(backend)',
        solutionName: calleeName,
        status: res.status,
        stepCount: 0,
        finalReturnValue: res.finalReturnValue,
    };
    result.result = `${calleeName} -> ${res.status} (backend)`;
    result.child_execution = summary;
}
