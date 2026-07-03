// Author: Dustin Etts
// display-solution-runner.service.ts — the runtime bridge between
// Display forms/buttons and no-code solution EXECUTION (P4).
//
// This is the piece the audit found missing end-to-end: display items
// stored `linkedSolutionName` but nothing ever ran it (and the one
// component that could, called the codegen-only endpoint). This service
// always calls the EXECUTION path (/executeSolutionStepped) and returns
// the response's distilled `displaySummary` (validation verdicts,
// emitted events, committed changes) so forms can surface per-field
// errors inline. Frontend-channel events — plus any event named
// 'refreshDisplay' regardless of channel — are dispatched on the
// DisplayEventsService bus.

import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { SolutionManagerService } from './solution-manager.service';
import { DisplayEventsService, DisplayEvent } from './display-events.service';

/** Mirror of the backend displaySummary shape (solutionExecutionAPI). */
export interface DisplayRunSummary {
    status: string;
    finalReturnValue: any;
    formValid: boolean | null;
    validation: { [fieldName: string]: { valid: boolean; errors: string[] } } | null;
    invalidFields: string[];
    events: DisplayEvent[];
    committed: Array<{ className: string; instance: string; fields: Record<string, any> }>;
}

export interface DisplayRunResult {
    success: boolean;
    summary: DisplayRunSummary | null;
    /** Human-readable failure when success is false. */
    error?: string;
}

@Injectable({ providedIn: 'root' })
export class DisplaySolutionRunnerService {
    constructor(
        private solutionManager: SolutionManagerService,
        private displayEvents: DisplayEventsService,
    ) {}

    /** Execute a linked solution with the collected inputs and dispatch
     *  its frontend events. Never throws — display surfaces read the
     *  structured result. */
    async run(solutionName: string, inputParams: Record<string, any>): Promise<DisplayRunResult> {
        if (!solutionName) {
            return { success: false, summary: null, error: 'No solution linked.' };
        }
        try {
            const response: any = await firstValueFrom(
                this.solutionManager.executeSolutionStepped(
                    solutionName, inputParams || {}, 'python_backend',
                ),
            );
            const summary: DisplayRunSummary | null = response?.displaySummary ?? null;
            const executed = !!response?.success && summary?.status === 'completed';
            // Dispatch events: frontend-channel ones always; plus
            // 'refreshDisplay' regardless of channel (the built-in
            // display-refresh convention).
            for (const ev of summary?.events ?? []) {
                if (ev.channel === 'frontend' || ev.name === 'refreshDisplay') {
                    this.displayEvents.dispatch({ ...ev, solutionName });
                }
            }
            if (!executed) {
                return {
                    success: false,
                    summary,
                    error: response?.error
                        || (summary?.status === 'errored'
                            ? (response?.trace?.errorSummary || response?.trace?.error_summary
                               || 'The linked solution failed.')
                            : 'The linked solution did not complete.'),
                };
            }
            return { success: true, summary };
        } catch (err: any) {
            return {
                success: false,
                summary: null,
                error: err?.error?.error || err?.message || 'Execution request failed.',
            };
        }
    }
}
