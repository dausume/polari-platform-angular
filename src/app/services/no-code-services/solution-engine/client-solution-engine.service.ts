// Author: Dustin Etts
// client-solution-engine.service.ts — the Angular wiring around the
// framework-free client engine (P5).
//
// Supplies the two runtime dependencies the engine core declares:
//   * SolutionResolver — SolutionDefinition rows fetched RAW over CRUDE
//     (deserializeSolution drops contract_json/target_runtime, so we
//     read the row fields ourselves), cached briefly so a recursive
//     solution doesn't refetch per invocation;
//   * BackendBridge — AwaitBackendCall's HTTP half: the named solution
//     runs on the backend via /executeSolutionStepped and its return +
//     final-context outputs bind back into the client execution.

import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { SolutionManagerService } from '../solution-manager.service';
import { ClientSolutionEngine } from './client-engine';
import {
    BackendBridge, ClientTrace, SolutionResolver, SolutionRow,
} from './engine-types';
import { solutionRequiresBackend, CapabilityVerdict } from './capability';

const ROW_CACHE_TTL_MS = 30_000;

@Injectable({ providedIn: 'root' })
export class ClientSolutionEngineService implements SolutionResolver, BackendBridge {

    private rowCache: { rows: SolutionRow[]; fetchedAt: number } | null = null;

    constructor(private solutionManager: SolutionManagerService) {}

    // ------------------------------------------------------------------
    // SolutionResolver
    // ------------------------------------------------------------------
    async loadSolutionRow(name: string): Promise<SolutionRow | null> {
        const rows = await this.loadRows();
        return rows.find((r) => r.name === name) ?? null;
    }

    private async loadRows(): Promise<SolutionRow[]> {
        const now = Date.now();
        if (this.rowCache && now - this.rowCache.fetchedAt < ROW_CACHE_TTL_MS) {
            return this.rowCache.rows;
        }
        const raw = await firstValueFrom(this.solutionManager.loadRawSolutionRows());
        const rows: SolutionRow[] = [];
        for (const item of raw || []) {
            if (!item || !item.name) continue;
            rows.push({
                name: item.name,
                definition: this.parseJson(item.definition, {}),
                contractJson: this.parseJson(item.contract_json, {}),
                targetRuntime: item.target_runtime || 'python_backend',
            });
        }
        this.rowCache = { rows, fetchedAt: now };
        return rows;
    }

    private parseJson(value: any, dflt: any): any {
        if (value === null || value === undefined || value === '') return dflt;
        if (typeof value !== 'string') return value;
        try {
            return JSON.parse(value);
        } catch {
            return dflt;
        }
    }

    /** Drop the row cache (call after saving a solution). */
    invalidateCache(): void {
        this.rowCache = null;
    }

    // ------------------------------------------------------------------
    // BackendBridge — AwaitBackendCall's HTTP half
    // ------------------------------------------------------------------
    async invokeBackendSolution(
        solutionName: string, inputParams: Record<string, any>,
    ): Promise<{ status: string; finalReturnValue: any; outputs: Record<string, any>; error?: string }> {
        try {
            const response: any = await firstValueFrom(
                this.solutionManager.executeSolutionStepped(
                    solutionName, inputParams || {}, 'python_backend'));
            const trace = response?.trace || {};
            const summary = response?.displaySummary || {};
            const status = summary.status || trace.status
                || (response?.success ? 'completed' : 'errored');
            // Named outputs = the backend trace's final context.
            const steps: any[] = trace.steps || [];
            const lastVars = steps.length
                ? (steps[steps.length - 1]?.contextAfter?.variables
                   || steps[steps.length - 1]?.context_after?.variables || {})
                : {};
            const outputs: Record<string, any> = {};
            for (const [k, v] of Object.entries(lastVars)) {
                outputs[k] = (v && typeof v === 'object' && 'value' in (v as any))
                    ? (v as any).value : v;
            }
            return {
                status,
                finalReturnValue: 'finalReturnValue' in summary
                    ? summary.finalReturnValue
                    : (trace.finalReturnValue ?? trace.final_return_value ?? null),
                outputs,
                error: response?.error || trace.errorSummary || trace.error_summary,
            };
        } catch (err: any) {
            return {
                status: 'errored', finalReturnValue: null, outputs: {},
                error: err?.error?.error || err?.message || 'Backend call failed.',
            };
        }
    }

    // ------------------------------------------------------------------
    // Execution
    // ------------------------------------------------------------------

    /** The partition verdict for a stored definition. */
    requiresBackend(definition: any): CapabilityVerdict {
        return solutionRequiresBackend(definition);
    }

    /** Execute a solution row in-browser. */
    async execute(row: SolutionRow, inputParams: Record<string, any>): Promise<ClientTrace> {
        const engine = new ClientSolutionEngine({ resolver: this, bridge: this });
        return engine.execute(
            row.definition, inputParams || {},
            row.targetRuntime || 'typescript_frontend');
    }
}
