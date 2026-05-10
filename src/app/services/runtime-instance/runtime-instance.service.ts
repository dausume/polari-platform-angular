// runtime-instance.service.ts
//
// Provides observable streams of currently-loaded class instances. Used by
// the value-source-selector's `from_object` branch to populate per-class
// instance pickers without each component issuing its own HTTP requests.
//
// Refcounted polling: the first subscriber to a class triggers an immediate
// fetch + sets up a poll loop; the poll stops when the last subscriber
// unsubscribes. While a from-object picker is mounted in selection mode,
// instance lists stay fresh (~3s cadence). Idle = no traffic.

import { Injectable, OnDestroy } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject, Observable, Subscription } from 'rxjs';
import { PolariService } from '@services/polari-service';

/** Lightweight summary of a backend instance for picker UIs. */
export interface RuntimeInstanceSummary {
    /** Stable identifier (matches the class's identifier field, usually `id`). */
    id: string;
    /** Identifier field name on the class (defaults `'id'`). */
    idFieldName: string;
    /** Class name (echoed for caller convenience). */
    className: string;
    /** Optional human-readable label (typically a `name`/`title`-like field). */
    label?: string;
    /** Raw instance data — keep light, not the whole row. */
    fields: { [key: string]: any };
}

const POLL_INTERVAL_MS = 3000;

@Injectable({ providedIn: 'root' })
export class RuntimeInstanceService implements OnDestroy {

    private subjects = new Map<string, BehaviorSubject<RuntimeInstanceSummary[]>>();
    private timers = new Map<string, any>();
    private refCounts = new Map<string, number>();
    private inflight = new Map<string, Subscription>();

    constructor(
        private http: HttpClient,
        private polari: PolariService,
    ) {}

    ngOnDestroy(): void {
        for (const t of this.timers.values()) clearInterval(t);
        for (const s of this.inflight.values()) s.unsubscribe();
        this.timers.clear();
        this.inflight.clear();
    }

    /**
     * Stream of instances for a single class. Polls while at least one
     * subscriber is active; stops on the last unsubscribe.
     */
    instances$(className: string): Observable<RuntimeInstanceSummary[]> {
        const key = className || '';
        if (!this.subjects.has(key)) {
            this.subjects.set(key, new BehaviorSubject<RuntimeInstanceSummary[]>([]));
            this.refCounts.set(key, 0);
        }
        const subject = this.subjects.get(key)!;
        return new Observable<RuntimeInstanceSummary[]>(observer => {
            const sub = subject.subscribe(observer);
            this.acquire(key);
            return () => {
                sub.unsubscribe();
                this.release(key);
            };
        });
    }

    /** Force an immediate refetch for a class regardless of poll cadence. */
    refresh(className: string): void {
        if (className) this.fetchOnce(className);
    }

    private acquire(className: string): void {
        const next = (this.refCounts.get(className) || 0) + 1;
        this.refCounts.set(className, next);
        if (next === 1) this.startPolling(className);
    }

    private release(className: string): void {
        const next = (this.refCounts.get(className) || 1) - 1;
        this.refCounts.set(className, next);
        if (next <= 0) this.stopPolling(className);
    }

    private startPolling(className: string): void {
        this.fetchOnce(className);
        const t = setInterval(() => this.fetchOnce(className), POLL_INTERVAL_MS);
        this.timers.set(className, t);
    }

    private stopPolling(className: string): void {
        const t = this.timers.get(className);
        if (t) clearInterval(t);
        this.timers.delete(className);
        const inflight = this.inflight.get(className);
        if (inflight) {
            inflight.unsubscribe();
            this.inflight.delete(className);
        }
    }

    private fetchOnce(className: string): void {
        if (!className) return;
        // Cancel any in-flight request for the same class to avoid pile-up.
        const prev = this.inflight.get(className);
        if (prev) prev.unsubscribe();

        const url = `${this.polari.getBackendBaseUrl()}/${className}`;
        const opts = {
            headers: new HttpHeaders({
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            }),
        };
        const sub = this.http.get<any>(url, opts).subscribe({
            next: response => {
                const subject = this.subjects.get(className);
                if (!subject) return;
                const items = this.parseInstances(response, className);
                subject.next(items);
                this.inflight.delete(className);
            },
            error: err => {
                console.warn(`[RuntimeInstanceService] Failed to fetch ${className}:`, err);
                this.inflight.delete(className);
            },
        });
        this.inflight.set(className, sub);
    }

    /** CRUDE response shapes vary; mirror InstancePickerDialog's parsing logic. */
    private parseInstances(response: any, className: string): RuntimeInstanceSummary[] {
        if (!response) return [];
        let raw: any[] = [];

        // Format 1: { class, data: [...] }
        if (response && !Array.isArray(response) && 'data' in response && 'class' in response) {
            raw = Array.isArray(response.data) ? response.data : [];
        } else if (Array.isArray(response)) {
            if (response.length === 1 && response[0]?.class && response[0]?.data) {
                raw = Array.isArray(response[0].data) ? response[0].data : [];
            } else if (className && response[0]?.[className]) {
                raw = this.extractFromClassData(response[0][className]);
            } else {
                raw = response;
            }
        } else if (className && typeof response === 'object' && response[className]) {
            raw = this.extractFromClassData(response[className]);
        } else if (response.data && Array.isArray(response.data)) {
            raw = response.data;
        }

        return this.summarize(raw, className);
    }

    private extractFromClassData(classData: any): any[] {
        if (!classData) return [];
        if (Array.isArray(classData)) {
            if (classData.length > 0 && classData[0]?.data && classData[0]?.class) {
                const out: any[] = [];
                for (const ds of classData) {
                    if (Array.isArray(ds.data)) out.push(...ds.data);
                }
                return out;
            }
            return classData;
        }
        if (typeof classData === 'object') return Object.values(classData);
        return [];
    }

    private summarize(rows: any[], className: string): RuntimeInstanceSummary[] {
        const out: RuntimeInstanceSummary[] = [];
        const seen = new Set<string>();
        for (const r of rows) {
            if (!r || typeof r !== 'object') continue;
            const idFieldName =
                r._idFieldName || (r['id'] !== undefined ? 'id' : (r['_id'] !== undefined ? '_id' : 'id'));
            const idVal = r[idFieldName] ?? r['id'] ?? r['_id'] ?? r['_instanceId'];
            if (idVal == null) continue;
            const idStr = String(idVal);
            if (seen.has(idStr)) continue;
            seen.add(idStr);
            const label =
                r.name || r.displayName || r.title || r.label || `${className} ${idStr}`;
            out.push({
                id: idStr,
                idFieldName,
                className,
                label: String(label),
                fields: r,
            });
        }
        return out;
    }
}
