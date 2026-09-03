// Author: Dustin Etts
// display-form-feedback.service.ts — per-item submission outcome that
// OUTLIVES the display renderer.
//
// The defect this fixes: a display form submits its linked solution;
// the solution ends with EmitFrontendEvent('refreshDisplay'); the
// display page re-fetches the display and re-instantiates the whole
// renderer. The old renderer instance — the one holding "Saved." — is
// gone before the user can read it, and the new one renders defaults.
//
// So the outcome lives HERE, a root singleton keyed by display id +
// item id. The renderer writes in-flight/outcome records through this
// service and reads them back on every render, so a re-render (or a
// navigate-away-and-back) shows the last outcome until it is dismissed
// or replaced by the next submission.

import { Injectable } from '@angular/core';

export interface DisplayFormFeedback {
    /** 'running' while the request is in flight (button disabled). */
    kind: 'running' | 'ok' | 'error';
    /** Words only — never a JSON dump (Dustin's rule). */
    text: string;
    /** Epoch ms when this record was written. */
    at: number;
    /** Optional second line: at most a count in words ("3 rows written"). */
    detail?: string;
}

/** Minimum time a line stays on screen before auto-dismiss may remove it. */
export const FEEDBACK_MIN_VISIBLE_MS = 8000;
/** Success lines auto-dismiss after this; errors stay until dismissed. */
export const FEEDBACK_OK_AUTO_DISMISS_MS = 20000;

@Injectable({ providedIn: 'root' })
export class DisplayFormFeedbackService {
    private readonly records = new Map<string, DisplayFormFeedback>();
    private readonly timers = new Map<string, any>();

    static key(displayId: string | null | undefined, itemId: string): string {
        return `${displayId || '-'}::${itemId}`;
    }

    get(key: string): DisplayFormFeedback | null {
        return this.records.get(key) || null;
    }

    isRunning(key: string): boolean {
        return this.records.get(key)?.kind === 'running';
    }

    /** Mark in flight — survives a mid-request re-render so the new
     *  renderer instance keeps the submit button disabled. */
    markRunning(key: string): void {
        this.cancelTimer(key);
        this.records.set(key, { kind: 'running', text: 'Running…', at: Date.now() });
    }

    /** Record the outcome. Success lines auto-dismiss (never sooner
     *  than FEEDBACK_MIN_VISIBLE_MS); error lines stay until dismissed. */
    setOutcome(key: string, kind: 'ok' | 'error', text: string, detail?: string): void {
        this.cancelTimer(key);
        const record: DisplayFormFeedback = { kind, text, at: Date.now() };
        if (detail) { record.detail = detail; }
        this.records.set(key, record);
        if (kind === 'ok') {
            const ms = Math.max(FEEDBACK_MIN_VISIBLE_MS, FEEDBACK_OK_AUTO_DISMISS_MS);
            this.timers.set(key, setTimeout(() => {
                // Only clear the record we set — a newer one wins.
                if (this.records.get(key) === record) { this.records.delete(key); }
                this.timers.delete(key);
            }, ms));
        }
    }

    /** Explicit dismiss (the × on the line). */
    clear(key: string): void {
        this.cancelTimer(key);
        this.records.delete(key);
    }

    private cancelTimer(key: string): void {
        const t = this.timers.get(key);
        if (t) { clearTimeout(t); this.timers.delete(key); }
    }
}
