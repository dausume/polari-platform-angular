// Author: Dustin Etts
// display-solution-runner.service.ts — the runtime bridge between
// Display forms/buttons and no-code solution EXECUTION (P4, engine
// choice P5).
//
// THE CONFIGURATION IS THE ARTIFACT: the same stored SolutionDefinition
// JSON is interpreted by two engines. This service picks which one per
// the capability partition:
//   * declared target_runtime 'typescript_frontend' AND every node
//     client-capable (no backend-only nodes, no from_latex sources)
//       -> the in-browser TypeScript engine (instant validation, no
//          roundtrip; AwaitBackendCall nodes bridge to the backend
//          explicitly when the graph says so);
//   * anything else -> the backend Python engine via
//     /executeSolutionStepped.
// The result reports which engine ran (`engine`) so surfaces and tests
// can assert the path. Frontend-channel events — plus any event named
// 'refreshDisplay' regardless of channel — are dispatched on the
// DisplayEventsService bus for BOTH engines.

import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { SolutionManagerService } from './solution-manager.service';
import { DisplayEventsService, DisplayEvent } from './display-events.service';
import { ClientSolutionEngineService } from './solution-engine/client-solution-engine.service';
import { ClientTrace } from './solution-engine/engine-types';

/** Mirror of the backend displaySummary shape (solutionExecutionAPI). */
export interface DisplayRunSummary {
    status: string;
    finalReturnValue: any;
    formValid: boolean | null;
    validation: { [fieldName: string]: { valid: boolean; errors: string[] } } | null;
    invalidFields: string[];
    events: DisplayEvent[];
    committed: Array<{ className: string; instance: string; fields: Record<string, any> }>;
    /** Human-readable outcome the solution chose to report: a final
     *  variable named `message` (or `result.message`), or a string
     *  return value. Words only — surfaced verbatim on the form. */
    message?: string | null;
    /** A count the solution reported (`written` / `result.written` /
     *  `count`), shown as "N rows written". */
    written?: number | null;
}

export interface DisplayRunResult {
    success: boolean;
    summary: DisplayRunSummary | null;
    /** Which engine executed the solution. */
    engine: 'client' | 'backend';
    /** Human-readable failure when success is false. */
    error?: string;
}

@Injectable({ providedIn: 'root' })
export class DisplaySolutionRunnerService {
    constructor(
        private solutionManager: SolutionManagerService,
        private displayEvents: DisplayEventsService,
        private clientEngine: ClientSolutionEngineService,
    ) {}

    /** Execute a linked solution with the collected inputs and dispatch
     *  its frontend events. Never throws — display surfaces read the
     *  structured result. */
    async run(solutionName: string, inputParams: Record<string, any>): Promise<DisplayRunResult> {
        if (!solutionName) {
            return { success: false, summary: null, engine: 'backend', error: 'No solution linked.' };
        }
        // Engine choice: read the stored row and apply the partition.
        try {
            const row = await this.clientEngine.loadSolutionRow(solutionName);
            if (row
                && row.targetRuntime === 'typescript_frontend'
                && !this.clientEngine.requiresBackend(row.definition).backendRequired) {
                return await this.runOnClient(solutionName, row, inputParams);
            }
        } catch {
            // Row lookup failing is not fatal — the backend path resolves
            // the solution by name itself.
        }
        return this.runOnBackend(solutionName, inputParams);
    }

    // ------------------------------------------------------------------
    private async runOnClient(
        solutionName: string, row: any, inputParams: Record<string, any>,
    ): Promise<DisplayRunResult> {
        const trace: ClientTrace = await this.clientEngine.execute(row, inputParams || {});
        const summary = this.summarizeClientTrace(trace);
        this.dispatchEvents(solutionName, summary.events);
        if (trace.status !== 'completed') {
            return {
                success: false, summary, engine: 'client',
                error: trace.errorSummary || 'The linked solution failed.',
            };
        }
        return { success: true, summary, engine: 'client' };
    }

    /** Distill a client trace into the SAME summary shape the backend
     *  responds with, from the same sentinel context keys the Python
     *  API reads. `committed` is always empty on the client path —
     *  StateChangeCommit is backend-only, so a client-partitioned graph
     *  cannot contain one. */
    private summarizeClientTrace(trace: ClientTrace): DisplayRunSummary {
        const lastStep = trace.steps[trace.steps.length - 1];
        const variables = lastStep?.contextAfter?.variables || {};
        const ctx: Record<string, any> = {};
        for (const [k, v] of Object.entries(variables)) {
            ctx[k] = (v && typeof v === 'object' && 'value' in (v as any))
                ? (v as any).value : v;
        }
        const outcome = DisplaySolutionRunnerService.readOutcome(ctx, trace.finalReturnValue);
        return {
            status: trace.status,
            finalReturnValue: trace.finalReturnValue ?? null,
            formValid: typeof ctx['form_valid'] === 'boolean' ? ctx['form_valid'] : null,
            validation: ctx['_form_validation'] ?? null,
            invalidFields: ctx['_invalid_fields'] ?? [],
            events: ctx['_emitted_events'] ?? [],
            committed: [],
            ...outcome,
        };
    }

    /** Unwrap the engine's final variables (backend trace shape:
     *  steps[-1].contextAfter.variables, each {name, value} or bare). */
    private static finalVariables(trace: any): Record<string, any> {
        const steps = trace?.steps;
        const last = Array.isArray(steps) && steps.length ? steps[steps.length - 1] : null;
        const variables = last?.contextAfter?.variables || last?.context_after?.variables || {};
        const ctx: Record<string, any> = {};
        if (variables && typeof variables === 'object') {
            for (const [k, v] of Object.entries(variables)) {
                ctx[k] = (v && typeof v === 'object' && 'value' in (v as any))
                    ? (v as any).value : v;
            }
        }
        return ctx;
    }

    /** The honest, wordy outcome: a `message` the solution set (top
     *  level, or under `result`/`results`), else a string return value;
     *  plus a `written`/`count` number if one was reported. Objects are
     *  never stringified — no JSON on screens. */
    private static readOutcome(
        ctx: Record<string, any>, finalReturnValue: any,
    ): { message: string | null; written: number | null } {
        const bags: any[] = [ctx, ctx['result'], ctx['results'], finalReturnValue]
            .filter(b => b && typeof b === 'object');
        let message: string | null = null;
        let written: number | null = null;
        for (const bag of bags) {
            if (message === null && typeof bag['message'] === 'string' && bag['message'].trim()) {
                message = bag['message'].trim();
            }
            for (const k of ['written', 'count', 'rows_written', 'rowsWritten']) {
                const n = bag[k];
                if (written === null && typeof n === 'number' && Number.isFinite(n)) { written = n; }
            }
        }
        if (message === null && typeof finalReturnValue === 'string' && finalReturnValue.trim()) {
            message = finalReturnValue.trim();
        }
        return { message, written };
    }

    // ------------------------------------------------------------------
    private async runOnBackend(
        solutionName: string, inputParams: Record<string, any>,
    ): Promise<DisplayRunResult> {
        try {
            const response: any = await firstValueFrom(
                this.solutionManager.executeSolutionStepped(
                    solutionName, inputParams || {}, 'python_backend',
                ),
            );
            const summary: DisplayRunSummary | null = response?.displaySummary ?? null;
            if (summary) {
                Object.assign(summary, DisplaySolutionRunnerService.readOutcome(
                    DisplaySolutionRunnerService.finalVariables(response?.trace),
                    summary.finalReturnValue));
            }
            const executed = !!response?.success && summary?.status === 'completed';
            this.dispatchEvents(solutionName, summary?.events ?? []);
            if (!executed) {
                return {
                    success: false,
                    summary,
                    engine: 'backend',
                    error: response?.error
                        || (summary?.status === 'errored'
                            ? (response?.trace?.errorSummary || response?.trace?.error_summary
                               || 'The linked solution failed.')
                            : 'The linked solution did not complete.'),
                };
            }
            return { success: true, summary, engine: 'backend' };
        } catch (err: any) {
            return {
                success: false,
                summary: null,
                engine: 'backend',
                error: err?.error?.error || err?.message || 'Execution request failed.',
            };
        }
    }

    /** Dispatch events: frontend-channel ones always; plus
     *  'refreshDisplay' regardless of channel (the built-in
     *  display-refresh convention). */
    private dispatchEvents(solutionName: string, events: DisplayEvent[]): void {
        for (const ev of events || []) {
            if (ev.channel === 'frontend' || ev.name === 'refreshDisplay') {
                this.displayEvents.dispatch({ ...ev, solutionName });
            }
        }
    }
}
