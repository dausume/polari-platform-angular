// stomp.service.ts
// ==============================================================================
// STOMP WebSocket Service
// ==============================================================================
// Singleton service wrapping @stomp/rx-stomp for real-time change notifications.
//
// The backend publishes STOMP MESSAGE frames when CRUDE operations modify data.
// Frontend components subscribe to topics to know when to refetch.
//
// Topic pattern:
//   /topic/{ClassName}              - CRUDE / polariTree changes
//   /topic/{ClassName}/{formatType} - Specific format changes (flatJson, d3Column, geoJson)
//
// ct-6 (the frontend half). Three things live here that did not before:
//
//  1. IDENTITY. Every (re)connect carries `Authorization: Bearer <token>` on
//     the STOMP CONNECT frame, refreshed in `beforeConnect` from the current
//     Keycloak session. The backend reads exactly that header
//     (accessControl/stomp_identity.py). CONNECT headers rather than
//     `Sec-WebSocket-Protocol`: the subprotocol route needs the server to echo
//     one of the offered protocols in the handshake or the browser closes the
//     socket, and there is nothing to gain from it here. Signed out = no
//     header = an anonymous socket, exactly as before.
//     There is no second token-refresh mechanism: the token in hand at connect
//     time is the one used, and the NEXT reconnect picks up a fresher one.
//
//  2. NOTICES. Under `advisory` the gate answers a SUBSCRIBE with a MESSAGE
//     frame on the very destination just subscribed to. It is NOT a change —
//     it is filtered out here (the one chokepoint every watcher goes through)
//     and routed to SecurityAdvisoryService, so nothing refetches on it and
//     nothing can loop.
//
//  3. REFUSALS. Under `enforce` the gate answers with an ERROR frame and does
//     not register the subscription. stompjs hands an ERROR frame to
//     `onStompError` and does NOT close the connection, and RxStomp only fails
//     a watch when `correlateErrors` says so — which is deliberately left
//     unset, so ONE refused subscribe cannot tear down the others. The refused
//     class is remembered instead, and `watchChanges` falls back to a slow
//     refetch tick for that class: the panel keeps its data and keeps
//     updating, slowly, rather than going dead or reconnecting in a storm.
// ==============================================================================

import { Injectable } from '@angular/core';
import { RxStomp, RxStompConfig } from '@stomp/rx-stomp';
import { IFrame, IMessage } from '@stomp/stompjs';
import { BehaviorSubject, Observable, merge, timer } from 'rxjs';
import { filter, map, switchMap } from 'rxjs/operators';
import { RuntimeConfigService } from './runtime-config.service';
import { ClassDirectoryService } from './class-directory.service';
import { AuthSessionService } from './auth/auth-session.service';
import { SecurityAdvisoryService } from './security-advisory.service';
import { classOfDestination, gateNoticeOf } from './stomp-notices';

export type StompConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

/** How often a class whose subscription was REFUSED is refetched instead. */
export const REFUSED_FALLBACK_POLL_MS = 60_000;

export interface StompChangeNotification {
    className: string;
    formatType: string;
    operation: 'create' | 'update' | 'delete';
    timestamp: string;
    instanceIds: string[];
    /** true when this tick came from the refused-subscribe fallback, not the socket */
    fallback?: boolean;
}

@Injectable({
    providedIn: 'root'
})
export class StompService {

    private rxStomp: RxStomp;
    // modsplit-3: change notifications come from the backend that
    // OWNS a class, so watch subscriptions route per class through
    // the directory — one extra RxStomp client per remote broker,
    // created lazily and reused. Core stays this.rxStomp.
    private remoteClients: Map<string, RxStomp> = new Map();
    public connectionStatus$ = new BehaviorSubject<StompConnectionStatus>('disconnected');

    /**
     * Classes an ENFORCING instance refused a subscription for (ct-6). A
     * BehaviorSubject carrying a NEW Set each time, so a panel that starts
     * watching after the refusal is armed immediately, and a refusal seen
     * again (a reconnect re-subscribes and is refused again) re-arms.
     */
    private readonly _refusedClasses$ = new BehaviorSubject<ReadonlySet<string>>(new Set());

    constructor(
        private runtimeConfig: RuntimeConfigService,
        private classDirectory: ClassDirectoryService,
        private auth: AuthSessionService,
        private advisories: SecurityAdvisoryService
    ) {
        this.rxStomp = new RxStomp();
        this.wireGateErrors(this.rxStomp);
    }

    /** The classes whose live subscription the server refused. */
    get refusedClasses$(): Observable<ReadonlySet<string>> {
        return this._refusedClasses$.asObservable();
    }

    isRefused(className: string): boolean {
        return this._refusedClasses$.value.has(className);
    }

    // ---- connection -------------------------------------------------------

    /**
     * The shared client configuration. `brokerURL` is the only thing that
     * differs between core and a remote broker — identity, heartbeats and
     * reconnect behaviour are the same everywhere.
     */
    private clientConfig(brokerURL: string): RxStompConfig {
        return {
            brokerURL,
            heartbeatIncoming: 0,
            heartbeatOutgoing: 20000,
            reconnectDelay: 5000,
            // ct-6: the bearer, re-read on EVERY (re)connect. RxStomp awaits
            // this before sending CONNECT, so an async token read is safe.
            beforeConnect: async (client: RxStomp) => {
                client.configure({ connectHeaders: await this.connectHeaders() });
            },
            // `correlateErrors` is deliberately NOT set. Left unset, an ERROR
            // frame fails no watch at all — which is what keeps a single
            // refused destination from killing every other subscription. The
            // refusal is handled in wireGateErrors() instead.
        };
    }

    /**
     * `Authorization: Bearer <token>` when somebody is signed in, nothing at
     * all when they are not. The token is read, never stored by us — the only
     * copy stays with oidc-client-ts.
     */
    private async connectHeaders(): Promise<{ [key: string]: string }> {
        let token: string | null = null;
        try {
            // The freshest copy oidc-client-ts holds; falls back to the value
            // AuthSessionService is already publishing if that call is unhappy.
            token = await this.auth.refreshAccessToken();
        } catch {
            token = null;
        }
        if (!token) {
            try { token = this.auth.accessToken; } catch { token = null; }
        }
        return token ? { Authorization: `Bearer ${token}` } : {};
    }

    /**
     * Watch one client's ERROR frames for a ct-6 subscribe refusal.
     *
     * Never rethrows and never deactivates: an ERROR frame here means "this
     * one destination is not available to you", not "the connection is bad".
     */
    private wireGateErrors(client: RxStomp): void {
        client.stompErrors$.subscribe((frame: IFrame) => {
            const notice = gateNoticeOf(frame as any, true);
            if (!notice) { return; }
            const className = notice.className || classOfDestination(notice.destination);
            this.advisories.recordStompNotice(
                notice.advisory, notice.destination || `/topic/${className}`, true);
            if (className) { this.markRefused(className); }
        });
    }

    /**
     * The RxStomp client for a class: the owning backend's broker
     * when the directory routes it elsewhere, core otherwise.
     * Remote clients activate lazily and auto-reconnect like core.
     */
    private clientForClass(className: string): RxStomp {
        const wsUrl = this.classDirectory.wsUrlForClass(className);
        if (!wsUrl) {
            return this.rxStomp;
        }
        let client = this.remoteClients.get(wsUrl);
        if (!client) {
            client = new RxStomp();
            client.configure(this.clientConfig(wsUrl));
            this.wireGateErrors(client);
            client.activate();
            this.remoteClients.set(wsUrl, client);
        }
        return client;
    }

    /**
     * Activate the STOMP connection to the backend WebSocket server.
     * RxStomp handles auto-reconnect internally.
     */
    connect(): void {
        const brokerURL = this.runtimeConfig.getWebSocketUrl();
        // console.log(`[STOMP] Connecting to ${brokerURL}`);

        const config: RxStompConfig = {
            ...this.clientConfig(brokerURL),
            debug: (msg: string) => {
                // Only log non-heartbeat messages to avoid noise
                if (msg && !msg.startsWith('>>>') && !msg.startsWith('<<<')) {
                    // console.log(`[STOMP] ${msg}`);
                }
            }
        };

        this.rxStomp.configure(config);

        // Track connection status
        this.rxStomp.connectionState$.subscribe(state => {
            // RxStompState: 0=CLOSED, 1=TRYING, 2=OPEN
            switch (state) {
                case 0: // CLOSED
                    this.connectionStatus$.next('disconnected');
                    // console.log('[STOMP] Disconnected');
                    break;
                case 1: // TRYING
                    this.connectionStatus$.next('connecting');
                    // console.log('[STOMP] Connecting...');
                    break;
                case 2: // OPEN
                    this.connectionStatus$.next('connected');
                    // console.log('[STOMP] Connected');
                    break;
            }
        });

        this.rxStomp.activate();
    }

    /**
     * Deactivate the STOMP connection.
     */
    disconnect(): void {
        this.rxStomp.deactivate();
        this.remoteClients.forEach(client => client.deactivate());
        this.remoteClients.clear();
        this.connectionStatus$.next('disconnected');
        // console.log('[STOMP] Deactivated');
    }

    // ---- watching ---------------------------------------------------------

    /**
     * Subscribe to change notifications for a class.
     *
     * ct-6: gate notices are filtered out here, the one place every watcher
     * passes through. A notice arrives on the same destination as a change —
     * letting it through would make a panel refetch because security spoke.
     *
     * @param className - The object class name (e.g. 'MyClass')
     * @param formatType - Optional format type for format-specific topics
     * @returns Observable of raw STOMP IMessage, gate notices removed
     */
    watchTopic(className: string, formatType?: string): Observable<IMessage> {
        const topic = formatType
            ? `/topic/${className}/${formatType}`
            : `/topic/${className}`;
        // console.log(`[STOMP] Subscribing to ${topic}`);
        return this.clientForClass(className).watch(topic).pipe(
            filter((message: IMessage) => !this.divertNotice(message, topic))
        );
    }

    /**
     * True when this frame was a ct-6 gate notice (and has been handed to the
     * advisory service), i.e. it must NOT reach a refetch path.
     */
    private divertNotice(message: IMessage, topic: string): boolean {
        const notice = gateNoticeOf(message as any);
        if (!notice) { return false; }
        this.advisories.recordStompNotice(notice.advisory, notice.destination || topic,
                                          notice.refused);
        if (notice.refused && notice.className) { this.markRefused(notice.className); }
        return true;
    }

    /** Record (or re-record) a refusal, re-arming every fallback watching it. */
    private markRefused(className: string): void {
        const next = new Set(this._refusedClasses$.value);
        next.add(className);
        this._refusedClasses$.next(next);
    }

    /**
     * Subscribe to parsed change notifications for a class.
     *
     * When the server REFUSED this class's subscription (enforce), the socket
     * will never deliver anything for it — so a slow tick is merged in, which
     * every existing consumer already treats as "refetch". The panel degrades
     * to polling instead of going dead, and nothing reconnects in a loop.
     *
     * @param className - The object class name
     * @param formatType - Optional format type
     * @returns Observable of parsed StompChangeNotification
     */
    watchChanges(className: string, formatType?: string): Observable<StompChangeNotification> {
        const live = this.watchTopic(className, formatType).pipe(
            map(message => {
                const notification = JSON.parse(message.body) as StompChangeNotification;
                // console.log(`[STOMP] Received on /topic/${className}${formatType ? '/' + formatType : ''}: ${notification.operation}`);
                return notification;
            })
        );
        return merge(live, this.refusedFallback$(className, formatType));
    }

    /**
     * The polling fallback for a class an enforcing server refused: silent
     * until the refusal is seen, then one tick every
     * REFUSED_FALLBACK_POLL_MS for as long as the consumer is watching.
     */
    private refusedFallback$(className: string, formatType?: string)
            : Observable<StompChangeNotification> {
        return this._refusedClasses$.pipe(
            filter(set => set.has(className)),
            // switchMap, not mergeMap: a refusal seen twice (a reconnect
            // re-subscribes and is refused again) restarts the one timer
            // rather than stacking a second one on top of it.
            switchMap(() => timer(REFUSED_FALLBACK_POLL_MS, REFUSED_FALLBACK_POLL_MS)),
            map(() => ({
                className,
                formatType: formatType || '',
                operation: 'update' as const,
                timestamp: new Date().toISOString(),
                instanceIds: [],
                fallback: true,
            }))
        );
    }
}
