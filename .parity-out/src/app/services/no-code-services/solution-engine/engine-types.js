"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAX_STEPS = exports.DEFAULT_LOOP_BUDGET = exports.MAX_INVOCATION_DEPTH = exports.STEP_CONTRIBUTIONS_KEY = exports.COMMITTED_CHANGES_KEY = exports.FORM_VALIDATION_KEY = exports.EMITTED_EVENTS_KEY = exports.BRANCHING_STATE_CLASSES = exports.TERMINAL_STATE_CLASSES = exports.INITIAL_STATE_CLASSES = void 0;
exports.generateSnapshotId = generateSnapshotId;
exports.generateExecutionId = generateExecutionId;
exports.pyRepr = pyRepr;
/** Entry-point state classes (mirror: INITIAL_STATE_CLASSES). */
exports.INITIAL_STATE_CLASSES = new Set([
    'InitialState', 'DirectInvocation', 'FormSubscription',
    'LogicFlowEntry', 'BackendStateChange',
    'SimulationStateStep',
    'InitialConditionsValidatorEntry',
]);
/** Terminal state classes (mirror: TERMINAL_STATE_CLASSES). */
exports.TERMINAL_STATE_CLASSES = new Set([
    'ReturnStatement', 'ReturnValue',
    'SimStepNextState', 'SimStepContribution',
    'ValidationResult', 'EmitEvent', 'EmitFrontendEvent',
]);
/** Branch-picking state classes (mirror: BRANCHING_STATE_CLASSES). */
exports.BRANCHING_STATE_CLASSES = new Set(['ConditionalChain', 'FormValidation']);
// Sentinel context keys — identical to the Python constants.
exports.EMITTED_EVENTS_KEY = '_emitted_events';
exports.FORM_VALIDATION_KEY = '_form_validation';
exports.COMMITTED_CHANGES_KEY = '_committed_changes';
exports.STEP_CONTRIBUTIONS_KEY = '_step_contributions';
exports.MAX_INVOCATION_DEPTH = 16;
exports.DEFAULT_LOOP_BUDGET = 10_000;
exports.MAX_STEPS = 200_000;
let snapCounter = 0;
function generateSnapshotId() {
    snapCounter += 1;
    return `snap_c${snapCounter.toString(16).padStart(10, '0')}`;
}
let execCounter = 0;
function generateExecutionId() {
    execCounter += 1;
    return `exec_c${execCounter.toString(16).padStart(10, '0')}`;
}
/** Python-style repr for log parity: strings quoted, booleans
 *  capitalized, null → None. Close enough that shared log assertions
 *  hold for the values the vectors exercise. */
function pyRepr(value) {
    if (value === null || value === undefined)
        return 'None';
    if (value === true)
        return 'True';
    if (value === false)
        return 'False';
    if (typeof value === 'string')
        return `'${value}'`;
    if (Array.isArray(value))
        return `[${value.map(pyRepr).join(', ')}]`;
    if (typeof value === 'object') {
        const inner = Object.entries(value)
            .map(([k, v]) => `${pyRepr(k)}: ${pyRepr(v)}`).join(', ');
        return `{${inner}}`;
    }
    return String(value);
}
