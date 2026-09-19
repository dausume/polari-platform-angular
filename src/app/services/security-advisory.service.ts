// security-advisory.service.ts
// ==============================================================================
// SecurityAdvisoryService — the one place the browser keeps what the instance
// said it WOULD have refused.
// ==============================================================================
// In dev posture the backend runs its security gates in `advisory` mode: it
// answers the request normally and states, in a response header, what an
// ENFORCING instance would have done instead. Four headers say it:
//
//   X-Polari-Permission-Advisory : would-deny <Class>:<verb>
//                                  unauthenticated <Class>:<verb>
//   X-Polari-Owner-Advisory      : would-deny <Class>:<id>:<verb>
//                                  would-project <Class>:<id>
//   X-Polari-Traffic-Advisory    : would-refuse <direction> <name> ...
//   X-Polari-Auth                : invalid-or-expired
//
// The STOMP gate (ct-6) says the same thing on the socket, as a MESSAGE frame
// marked `polariNotice` (advisory) or an ERROR frame (enforce).
//
// This service holds ONE deduped, counted list of all of it — key = header ×
// value — so a person can see "the same would-deny fired 40 times" rather than
// 40 lines. Nothing here is persisted and nothing identifies a person: the
// backend already keys everyone by Keycloak `sub`, and the advisory values
// carry class/verb/id only.
// ==============================================================================

import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

/** Which gate spoke. `subscribe` is the STOMP half (ct-6). */
export type AdvisoryKind = 'permission' | 'owner' | 'traffic' | 'auth' | 'subscribe';

/** The response headers this service reads, and the kind each one means. */
export const ADVISORY_HEADERS: ReadonlyArray<{ header: string; kind: AdvisoryKind }> = [
    { header: 'X-Polari-Permission-Advisory', kind: 'permission' },
    { header: 'X-Polari-Owner-Advisory', kind: 'owner' },
    { header: 'X-Polari-Traffic-Advisory', kind: 'traffic' },
    { header: 'X-Polari-Auth', kind: 'auth' },
];

/** One advisory, however many times it has fired. */
export interface AdvisoryEntry {
    /** dedupe key: `<header>|<value>` */
    key: string;
    kind: AdvisoryKind;
    /** the header that carried it, or `STOMP SUBSCRIBE` for a socket notice */
    header: string;
    /** the verbatim header value */
    value: string;
    /** first word of the value: would-deny | would-project | unauthenticated | … */
    outcome: string;
    /** the rest of the value — `<Class>:<verb>`, `<Class>:<id>` … */
    subject: string;
    count: number;
    firstSeen: number;
    lastSeen: number;
    /** the request path (or topic) that last produced it */
    path: string;
}

/** What the notice bar renders in one line. */
export interface AdvisorySummary {
    /** distinct advisories held */
    entries: number;
    /** total times they fired */
    occurrences: number;
    /** distinct advisories per outcome, e.g. `{'would-deny': 3, 'would-project': 1}` */
    byOutcome: Record<string, number>;
    /** the worst thing present: 'enforced' > 'would-deny' > anything else */
    level: 'info' | 'warning';
}

/** A response's headers, as little of Angular's HttpHeaders as is actually used. */
export interface HeaderLookup { get(name: string): string | null; }

/** Ceiling on the list; the least recently seen entry is dropped past it. */
export const MAX_ADVISORY_ENTRIES = 200;

@Injectable({ providedIn: 'root' })
export class SecurityAdvisoryService {

    private readonly _entries$ = new BehaviorSubject<AdvisoryEntry[]>([]);
    private readonly byKey = new Map<string, AdvisoryEntry>();

    /** Every advisory held, most recently seen first. */
    get entries$(): Observable<AdvisoryEntry[]> { return this._entries$.asObservable(); }

    get entries(): AdvisoryEntry[] { return this._entries$.value; }

    /**
     * Read the four advisory headers off one response.
     *
     * `url` is reduced to a path — a query string can carry values a person
     * would not expect to find in a notice bar, and the path is what makes an
     * advisory recognisable.
     */
    recordResponse(headers: HeaderLookup | null | undefined, url: string): void {
        if (!headers) { return; }
        const path = pathOf(url);
        for (const { header, kind } of ADVISORY_HEADERS) {
            let value: string | null = null;
            try { value = headers.get(header); } catch { value = null; }
            if (value) { this.record(kind, header, value, path); }
        }
    }

    /**
     * A STOMP gate notice (ct-6): the advisory MESSAGE frame under `advisory`,
     * the ERROR frame under `enforce`. `refused` is what distinguishes them —
     * an ERROR frame means the subscription was NOT registered.
     */
    recordStompNotice(value: string, topic: string, refused: boolean): void {
        if (!value) { return; }
        this.record('subscribe', refused ? 'STOMP SUBSCRIBE (refused)' : 'STOMP SUBSCRIBE',
                    value, topic);
    }

    /** Add one occurrence, deduped by header × value. */
    record(kind: AdvisoryKind, header: string, value: string, path: string): void {
        const clean = String(value).trim();
        if (!clean) { return; }
        const key = `${header}|${clean}`;
        const now = Date.now();
        const existing = this.byKey.get(key);
        if (existing) {
            existing.count += 1;
            existing.lastSeen = now;
            existing.path = path || existing.path;
        } else {
            const split = clean.indexOf(' ');
            this.byKey.set(key, {
                key, kind, header, value: clean,
                outcome: split > 0 ? clean.slice(0, split) : clean,
                subject: split > 0 ? clean.slice(split + 1) : '',
                count: 1, firstSeen: now, lastSeen: now, path,
            });
            this.evictIfFull();
        }
        this.publish();
    }

    /** Forget everything — the "clear" on the notice bar. */
    clear(): void {
        this.byKey.clear();
        this.publish();
    }

    /** The one line the notice bar shows. */
    summary(): AdvisorySummary {
        const entries = this._entries$.value;
        const byOutcome: Record<string, number> = {};
        let occurrences = 0;
        let level: 'info' | 'warning' = 'info';
        for (const entry of entries) {
            byOutcome[entry.outcome] = (byOutcome[entry.outcome] || 0) + 1;
            occurrences += entry.count;
            if (entry.outcome !== 'would-project') { level = 'warning'; }
        }
        return { entries: entries.length, occurrences, byOutcome, level };
    }

    /** Past the cap, the entry seen longest ago goes. */
    private evictIfFull(): void {
        while (this.byKey.size > MAX_ADVISORY_ENTRIES) {
            let oldestKey = '';
            let oldest = Number.POSITIVE_INFINITY;
            this.byKey.forEach((entry, key) => {
                if (entry.lastSeen < oldest) { oldest = entry.lastSeen; oldestKey = key; }
            });
            if (!oldestKey) { return; }
            this.byKey.delete(oldestKey);
        }
    }

    private publish(): void {
        this._entries$.next(
            Array.from(this.byKey.values()).sort((a, b) => b.lastSeen - a.lastSeen));
    }
}

/** `https://host/api/x?y=1` → `/api/x`; a relative URL keeps its shape. */
export function pathOf(url: string): string {
    const raw = String(url || '');
    const cut = raw.split('?')[0].split('#')[0];
    const scheme = cut.indexOf('://');
    if (scheme < 0) { return cut; }
    const slash = cut.indexOf('/', scheme + 3);
    return slash < 0 ? '/' : cut.slice(slash);
}
