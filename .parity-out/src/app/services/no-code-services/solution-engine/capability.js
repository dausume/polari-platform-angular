"use strict";
// Author: Dustin Etts
// capability.ts — the runtime-capability partition (P5).
//
// The rule the display-solution-runner applies (config-driven — the
// stored definition tells us everything):
//   * a solution whose graph contains ANY backend-only node — or any
//     from_latex value source — executes on the BACKEND engine;
//   * a pure client-capable solution declared target_runtime
//     'typescript_frontend' executes IN-BROWSER (instant validation,
//     no roundtrip);
//   * AwaitBackendCall is the EXPLICIT cross-runtime bridge — it is
//     client-capable (that is its whole point), delegating one named
//     solution to the backend mid-graph.
// Mirrored on the backend registry as StateBuildingBlock.runtime_capability.
Object.defineProperty(exports, "__esModule", { value: true });
exports.CLIENT_CAPABLE_CLASSES = exports.BACKEND_ONLY_CLASSES = void 0;
exports.solutionRequiresBackend = solutionRequiresBackend;
/** Node classes only the Python engine can execute (SymPy/numpy math,
 *  instance persistence, simulation-runner terminators). */
exports.BACKEND_ONLY_CLASSES = new Set([
    'CalculusOperation', // SymPy equations
    'MatrixEquationOperation', // numpy matrix engine
    'StateChangeCommit', // persists instances via the manager/DB
    'SimulationStateStep', // simulation-runner entry
    'SimStepNextState', // simulation-runner terminators
    'SimStepContribution',
    'BackendStateChange', // backend-trust entry intent
]);
/** Everything the client engine executes (kept in step with
 *  client-engine.ts's dispatch — the parity vectors exercise these). */
exports.CLIENT_CAPABLE_CLASSES = new Set([
    'InitialState', 'DirectInvocation', 'FormSubscription', 'LogicFlowEntry',
    'InitialConditionsValidatorEntry',
    'VariableAssignment', 'ConditionalChain',
    'ForLoop', 'WhileLoop', 'ForEachLoop', 'BreakStatement', 'ContinueStatement',
    'MathOperation',
    'FilterList', 'MapList', 'ReduceList', 'CollectionOperation',
    'SolutionInvocation', 'AwaitBackendCall',
    'FormValidation', 'ValidationResult',
    'EmitEvent', 'EmitFrontendEvent',
    'ReturnValue', 'ReturnStatement', 'LogOutput',
    'FunctionCall', // retired no-op — runs (loudly) anywhere
]);
/** Deep-scan a value for from_latex sources (they need SymPy). */
function containsLatexSource(value) {
    if (!value || typeof value !== 'object')
        return false;
    if (value.sourceType === 'from_latex')
        return true;
    if (Array.isArray(value))
        return value.some(containsLatexSource);
    return Object.values(value).some(containsLatexSource);
}
/** Inspect a stored SolutionDefinition JSON: does it need the backend?
 *  Config-driven — no execution, just reading the artifact. */
function solutionRequiresBackend(definition) {
    const reasons = [];
    const states = definition?.stateInstances || [];
    for (const s of states) {
        const cls = s?.boundObjectClass || s?.stateClass || '';
        if (exports.BACKEND_ONLY_CLASSES.has(cls)) {
            reasons.push(`node '${s?.stateName || '?'}' (${cls}) runs only on the backend`);
        }
        else if (cls && !exports.CLIENT_CAPABLE_CLASSES.has(cls)) {
            reasons.push(`node '${s?.stateName || '?'}' (${cls}) is not client-executable`);
        }
        if (containsLatexSource(s?.boundObjectFieldValues)) {
            reasons.push(`node '${s?.stateName || '?'}' uses a LaTeX math source (from_latex)`);
        }
    }
    return { backendRequired: reasons.length > 0, reasons };
}
