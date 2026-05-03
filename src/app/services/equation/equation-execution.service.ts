import { Injectable, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, Subject, Subscription } from 'rxjs';
import { map } from 'rxjs/operators';
import { PolariService } from '@services/polari-service';
import { StompService } from '@services/stomp.service';
import {
    EquationExecutionResult,
    ExecuteEquationDirectRequest,
    ExecuteEquationRequest
} from '@models/equations/EquationDefinition';

/**
 * Service that wraps the two equation execution endpoints and
 * exposes a Subject for async STOMP-driven listeners.
 *
 *  POST /executeEquation        - run a saved EquationDefinition by name
 *  POST /executeEquationDirect  - run an ad-hoc equation
 *
 * Both endpoints return synchronously AND publish on STOMP topics:
 *   /topic/EquationExecution
 *   /topic/EquationExecution/<name>
 */
@Injectable({ providedIn: 'root' })
export class EquationExecutionService implements OnDestroy {

    /** Emits whenever an EquationExecutionResult arrives via STOMP. */
    public readonly executionResults$ = new Subject<EquationExecutionResult>();

    private stompSub: Subscription | null = null;
    private stompStarted = false;

    constructor(
        private http: HttpClient,
        private polariService: PolariService,
        private stompService: StompService
    ) {}

    ngOnDestroy(): void {
        this.stompSub?.unsubscribe();
        this.stompSub = null;
    }

    /**
     * Lazily subscribe to the broadcast equation execution topic.
     * Safe to call multiple times — subsequent calls are no-ops.
     */
    ensureStompSubscription(): void {
        if (this.stompStarted) return;
        this.stompStarted = true;
        try {
            this.stompSub = this.stompService.watchTopic('EquationExecution').subscribe({
                next: (message) => {
                    try {
                        const parsed = JSON.parse(message.body) as EquationExecutionResult;
                        this.executionResults$.next(parsed);
                    } catch (e) {
                        console.warn('[EquationExecutionService] Failed to parse STOMP message body:', e);
                    }
                },
                error: (err) => {
                    console.error('[EquationExecutionService] STOMP subscription error:', err);
                }
            });
        } catch (e) {
            console.error('[EquationExecutionService] Failed to start STOMP subscription:', e);
        }
    }

    /** Subscribe to results for a specific saved equation by name. */
    watchResultsForName(name: string): Observable<EquationExecutionResult> {
        return this.stompService.watchTopic('EquationExecution', name).pipe(
            map(message => JSON.parse(message.body) as EquationExecutionResult)
        );
    }

    /** Run a saved EquationDefinition. */
    executeNamed(req: ExecuteEquationRequest): Observable<EquationExecutionResult> {
        const url = `${this.polariService.getBackendBaseUrl()}/executeEquation`;
        return this.http.post<EquationExecutionResult>(
            url,
            req,
            this.polariService.backendRequestOptions
        );
    }

    /** Run an ad-hoc equation without persisting it. */
    executeDirect(req: ExecuteEquationDirectRequest): Observable<EquationExecutionResult> {
        const url = `${this.polariService.getBackendBaseUrl()}/executeEquationDirect`;
        return this.http.post<EquationExecutionResult>(
            url,
            req,
            this.polariService.backendRequestOptions
        );
    }
}
