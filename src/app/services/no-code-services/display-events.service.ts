// Author: Dustin Etts
// display-events.service.ts — the client-side display event bus (P4).
//
// No-code solutions emit events (EmitEvent / EmitFrontendEvent nodes);
// the engine records them in the execution response's displaySummary,
// and the DisplaySolutionRunnerService dispatches the frontend-facing
// ones here. Any component may subscribe (the first consumer is the
// display page itself: an event named 'refreshDisplay' re-fetches the
// display's data).

import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { filter } from 'rxjs/operators';

/** Mirror of the engine's _emitted_events entry shape. */
export interface DisplayEvent {
    name: string;
    payload: Record<string, any>;
    sourceState: string;
    channel: 'frontend' | 'backend';
    /** Which solution execution produced it (added client-side). */
    solutionName?: string;
}

@Injectable({ providedIn: 'root' })
export class DisplayEventsService {
    private readonly events = new Subject<DisplayEvent>();

    /** All dispatched display events. */
    readonly displayEvents$: Observable<DisplayEvent> = this.events.asObservable();

    dispatch(event: DisplayEvent): void {
        this.events.next(event);
    }

    /** Convenience: only events with a given name. */
    on(name: string): Observable<DisplayEvent> {
        return this.displayEvents$.pipe(filter(e => e.name === name));
    }
}
