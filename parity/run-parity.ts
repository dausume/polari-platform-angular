// Author: Dustin Etts
// run-parity.ts — the TypeScript half of the P5 engine-parity contract.
//
// Executes the SAME shared vectors the Python engine runs
// (polari-framework/polariNoCode/parity_vectors/*.json — Python side:
// `python3 -m polariNoCode.selftest_parity`) through the client engine,
// asserting the same results and the same user-facing error wording.
//
// Run with: npm run parity
// (tsc compiles the framework-free engine core + this runner to plain
//  CommonJS — no ts-node, no Angular, no karma.)

import {
    ClientSolutionEngine,
} from '../src/app/services/no-code-services/solution-engine/client-engine';
import {
    BackendBridge, ClientTrace, SolutionResolver, SolutionRow,
} from '../src/app/services/no-code-services/solution-engine/engine-types';

declare const require: any;
declare const process: any;
declare const __dirname: string;
declare const console: any;

const fs = require('fs');
const path = require('path');

const VECTORS_DIR = path.resolve(
    __dirname, '..', '..', '..', 'polari-framework', 'polariNoCode', 'parity_vectors');

const PASS = '\x1b[0;32mPASS\x1b[0m';
const FAIL = '\x1b[0;31mFAIL\x1b[0m';
const results: boolean[] = [];

function check(label: string, cond: boolean, extra = ''): void {
    results.push(!!cond);
    console.log(`  [${cond ? PASS : FAIL}] ${label}${extra ? '  ' + extra : ''}`);
}

/** Python-repr-ish display so the two suites' logs read alike. */
function show(v: any): string {
    if (v === null || v === undefined) return 'None';
    if (v === true) return 'True';
    if (v === false) return 'False';
    if (typeof v === 'string') return `'${v}'`;
    if (Array.isArray(v)) return `[${v.map(show).join(', ')}]`;
    if (typeof v === 'object') {
        return `{${Object.entries(v).map(([k, x]) => `'${k}': ${show(x)}`).join(', ')}}`;
    }
    return String(v);
}

/** == with bool/number kept distinct (true must not satisfy 1). */
function valuesEqual(expected: any, actual: any): boolean {
    if (typeof expected === 'boolean' || typeof actual === 'boolean') {
        return typeof expected === 'boolean' && typeof actual === 'boolean'
            && expected === actual;
    }
    if (Array.isArray(expected)) {
        return Array.isArray(actual) && expected.length === actual.length
            && expected.every((e, i) => valuesEqual(e, actual[i]));
    }
    if (expected && typeof expected === 'object') {
        if (!actual || typeof actual !== 'object' || Array.isArray(actual)) return false;
        const ek = Object.keys(expected).sort();
        const ak = Object.keys(actual).sort();
        return ek.length === ak.length && ek.every((k, i) => k === ak[i])
            && ek.every((k) => valuesEqual(expected[k], actual[k]));
    }
    return expected === actual;
}

function finalContext(trace: ClientTrace): Record<string, any> {
    if (!trace.steps.length) return {};
    const variables = trace.steps[trace.steps.length - 1]?.contextAfter?.variables || {};
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(variables)) {
        out[k] = (v && typeof v === 'object' && 'value' in (v as any))
            ? (v as any).value : v;
    }
    return out;
}

function makeResolver(solutions: any[]): SolutionResolver {
    return {
        async loadSolutionRow(name: string): Promise<SolutionRow | null> {
            const s = solutions.find((x) => x.name === name);
            if (!s) return null;
            return {
                name: s.name,
                definition: s.definition,
                contractJson: s.contractJson || {},
                targetRuntime: s.targetRuntime || 'typescript_frontend',
            };
        },
    };
}

/** Stub bridge: "the backend" is another client engine over the same
 *  vector rows — exactly what the Python suite does in-process, so the
 *  round-trip semantics (inputs out, return + named outputs back) are
 *  what parity measures, not HTTP. */
function makeBridge(solutions: any[]): BackendBridge {
    const resolver = makeResolver(solutions);
    return {
        async invokeBackendSolution(solutionName: string, inputParams: Record<string, any>) {
            const row = await resolver.loadSolutionRow(solutionName);
            if (!row) {
                return { status: 'errored', finalReturnValue: null, outputs: {},
                         error: `solution '${solutionName}' was not found.` };
            }
            const engine = new ClientSolutionEngine({ resolver, bridge: this });
            const trace = await engine.execute(row.definition, inputParams, row.targetRuntime);
            const outputs = finalContext(trace);
            return {
                status: trace.status,
                finalReturnValue: trace.finalReturnValue ?? null,
                outputs,
                error: trace.errorSummary,
            };
        },
    };
}

async function runVector(fname: string, vector: any): Promise<void> {
    console.log(`\n--- ${fname}: ${vector.description}`);
    const solutions: any[] = vector.solutions;
    const entry = solutions.find((s) => s.name === vector.entry);
    const engine = new ClientSolutionEngine({
        resolver: makeResolver(solutions),
        bridge: makeBridge(solutions),
    });
    const trace = await engine.execute(
        entry.definition, { ...(vector.inputParams || {}) },
        entry.targetRuntime || 'typescript_frontend');
    const expect = vector.expect;
    const ctx = finalContext(trace);

    check(`status == ${expect.status}`, trace.status === expect.status,
        trace.status !== expect.status
            ? `(got ${trace.status}; error: ${trace.errorSummary})` : '');

    if ('finalReturnValue' in expect) {
        check(`finalReturnValue == ${show(expect.finalReturnValue)}`,
            valuesEqual(expect.finalReturnValue, trace.finalReturnValue),
            `(got ${show(trace.finalReturnValue)})`);
    }

    for (const [name, want] of Object.entries(expect.context || {})) {
        check(`context['${name}'] == ${show(want)}`,
            name in ctx && valuesEqual(want, ctx[name]),
            `(got ${show(ctx[name])})`);
    }

    for (const name of expect.contextAbsent || []) {
        check(`context has no '${name}'`, !(name in ctx), `(got ${show(ctx[name])})`);
    }

    for (const fragment of expect.errorContains || []) {
        const summary = trace.errorSummary || '';
        check(`error mentions '${fragment}'`, summary.includes(fragment),
            `(error was: '${summary}')`);
    }

    if ('events' in expect) {
        const emitted: any[] = ctx['_emitted_events'] || [];
        check(`${expect.events.length} event(s) emitted`,
            emitted.length === expect.events.length, `(got ${emitted.length})`);
        expect.events.forEach((want: any, i: number) => {
            const got = emitted[i];
            const ok = got && typeof got === 'object'
                && got.name === want.name
                && got.channel === want.channel
                && (!('payload' in want) || valuesEqual(want.payload, got.payload));
            check(`event '${want.name}' on '${want.channel}' channel`,
                ok, `(got ${show(got)})`);
        });
    }

    for (const [field, wantErrors] of Object.entries(expect.verdictErrors || {})) {
        const verdicts = ctx['_form_validation'] || {};
        const gotErrors = (verdicts[field] || {}).errors;
        check(`verdict for '${field}': ${show(wantErrors)}`,
            valuesEqual(wantErrors, gotErrors), `(got ${show(gotErrors)})`);
    }
}

async function main(): Promise<void> {
    const files: string[] = fs.readdirSync(VECTORS_DIR)
        .filter((f: string) => f.endsWith('.json')).sort();
    console.log(`Engine parity vectors (TypeScript side): ${files.length} `
        + `vector(s) from ${VECTORS_DIR}`);
    for (const fname of files) {
        const vector = JSON.parse(
            fs.readFileSync(path.join(VECTORS_DIR, fname), 'utf8'));
        await runVector(fname, vector);
    }
    const passed = results.filter(Boolean).length;
    console.log(`\n${'='.repeat(60)}\nParity (TypeScript): `
        + `${passed}/${results.length} checks passed`);
    if (passed !== results.length) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
