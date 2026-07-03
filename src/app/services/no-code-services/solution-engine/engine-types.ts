// Author: Dustin Etts
// engine-types.ts — shared types + constants for the CLIENT-SIDE
// solution execution engine (P5: the true TypeScript mirror).
//
// THE CONFIGURATION IS THE ARTIFACT: this engine interprets the SAME
// stored SolutionDefinition JSON the Python SolutionExecutionEngine
// walks — no code generation, no translation step. Every constant and
// semantic here MIRRORS polariNoCode/SolutionExecutionEngine.py; the
// shared parity vectors (polariNoCode/parity_vectors/) hold both
// engines to the same answers AND the same user-facing error wording.
// When you change one engine, change the other and extend the vectors.
//
// This core is deliberately framework-free (no Angular imports) so the
// parity runner can execute it under plain node.

/** Entry-point state classes (mirror: INITIAL_STATE_CLASSES). */
export const INITIAL_STATE_CLASSES = new Set([
    'InitialState', 'DirectInvocation', 'FormSubscription',
    'LogicFlowEntry', 'BackendStateChange',
    'SimulationStateStep',
    'InitialConditionsValidatorEntry',
]);

/** Terminal state classes (mirror: TERMINAL_STATE_CLASSES). */
export const TERMINAL_STATE_CLASSES = new Set([
    'ReturnStatement', 'ReturnValue',
    'SimStepNextState', 'SimStepContribution',
    'ValidationResult', 'EmitEvent', 'EmitFrontendEvent',
]);

/** Branch-picking state classes (mirror: BRANCHING_STATE_CLASSES). */
export const BRANCHING_STATE_CLASSES = new Set(['ConditionalChain', 'FormValidation']);

// Sentinel context keys — identical to the Python constants.
export const EMITTED_EVENTS_KEY = '_emitted_events';
export const FORM_VALIDATION_KEY = '_form_validation';
export const COMMITTED_CHANGES_KEY = '_committed_changes';
export const STEP_CONTRIBUTIONS_KEY = '_step_contributions';

export const MAX_INVOCATION_DEPTH = 16;
export const DEFAULT_LOOP_BUDGET = 10_000;
export const MAX_STEPS = 200_000;

/** One emitted event (mirror of the Python event shape). */
export interface EmittedEvent {
    name: string;
    payload: Record<string, any>;
    sourceState: string;
    channel: 'backend' | 'frontend';
}

/** Serialized variable record inside a context snapshot — the same
 *  {name, type, value, sourceStateName} wrap the Python engine writes,
 *  so the stepping UI and child-output extraction read both engines'
 *  traces identically. */
export interface SnapshotVariable {
    name: string;
    type: string;
    value: any;
    sourceStateName: string;
}

export interface ContextSnapshot {
    stateName: string;
    solutionName: string;
    executionId: string;
    variables: Record<string, SnapshotVariable>;
}

/** One step of a client trace — camelCase, matching
 *  ExecutionStepSnapshot.to_dict() closely enough that the stepping UI
 *  renders either engine's trace. */
export interface ClientTraceStep {
    snapshotId: string;
    stepIndex: number;
    stateName: string;
    stateClassName: string;
    contextBefore: ContextSnapshot;
    contextAfter: ContextSnapshot;
    status: 'completed' | 'errored';
    executionResult: any;
    executionError: string | null;
    startTime: string;
    endTime: string;
    durationMs: number;
    branchTaken: number | null;
    branchLabel: string | null;
    logOutput: string[];
    childExecution?: ChildExecutionSummary;
}

export interface ChildExecutionSummary {
    executionId: string;
    solutionName: string;
    status: string;
    stepCount: number;
    finalReturnValue?: any;
}

/** The client-side ExecutionTrace mirror (camelCase field names match
 *  ExecutionTrace.to_dict()). */
export interface ClientTrace {
    executionId: string;
    solutionName: string;
    targetRuntime: string;
    status: 'running' | 'completed' | 'errored' | 'cancelled';
    steps: ClientTraceStep[];
    startedAt: string;
    completedAt?: string;
    finalReturnValue?: any;
    errorSummary?: string;
    /** Which engine produced this trace — the one field the Python
     *  trace doesn't carry (its absence implies 'backend'). */
    engine: 'client';
}

/** A SolutionDefinition row as the engine needs it (the stored
 *  configuration — definition JSON + contract + declared runtime). */
export interface SolutionRow {
    name: string;
    definition: any;            // parsed {solutionName, stateInstances}
    contractJson?: any;         // parsed contract_json (or undefined)
    targetRuntime?: string;
}

/** Resolves callee solutions for SolutionInvocation — the client
 *  mirror of the Python engine's manager lookup. Async because the
 *  browser fetches rows over CRUDE. */
export interface SolutionResolver {
    loadSolutionRow(name: string): Promise<SolutionRow | null>;
}

/** The explicit cross-runtime bridge behind AwaitBackendCall: invoke a
 *  named solution ON THE BACKEND and return its results. */
export interface BackendBridge {
    invokeBackendSolution(
        solutionName: string,
        inputParams: Record<string, any>,
    ): Promise<{
        status: string;
        finalReturnValue: any;
        outputs: Record<string, any>;
        error?: string;
    }>;
}

/** A loop frame (mirror of the Python loop_stack entries). */
export interface LoopFrame {
    name: string;
    kind: 'for' | 'while' | 'foreach';
    iterations: number;
    budget: number;
    current?: number;
    end?: number;
    step?: number;
    items?: any[];
    index?: number;
}

/** Handler result (mirror of the Python _evaluate_state result dict). */
export interface StateEvalResult {
    result: any;
    branch_taken: number | null;
    branch_label: string | null;
    loop_action: 'body' | 'exit' | 'break' | 'continue' | null;
    child_execution?: ChildExecutionSummary;
}

let snapCounter = 0;
export function generateSnapshotId(): string {
    snapCounter += 1;
    return `snap_c${snapCounter.toString(16).padStart(10, '0')}`;
}

let execCounter = 0;
export function generateExecutionId(): string {
    execCounter += 1;
    return `exec_c${execCounter.toString(16).padStart(10, '0')}`;
}

/** Python-style repr for log parity: strings quoted, booleans
 *  capitalized, null → None. Close enough that shared log assertions
 *  hold for the values the vectors exercise. */
export function pyRepr(value: any): string {
    if (value === null || value === undefined) return 'None';
    if (value === true) return 'True';
    if (value === false) return 'False';
    if (typeof value === 'string') return `'${value}'`;
    if (Array.isArray(value)) return `[${value.map(pyRepr).join(', ')}]`;
    if (typeof value === 'object') {
        const inner = Object.entries(value)
            .map(([k, v]) => `${pyRepr(k)}: ${pyRepr(v)}`).join(', ');
        return `{${inner}}`;
    }
    return String(value);
}
