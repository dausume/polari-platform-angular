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
// ==============================================================================

import { Injectable } from '@angular/core';
import { RxStomp, RxStompConfig } from '@stomp/rx-stomp';
import { IMessage } from '@stomp/stompjs';
import { BehaviorSubject, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { RuntimeConfigService } from './runtime-config.service';
import { ClassDirectoryService } from './class-directory.service';

export type StompConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface StompChangeNotification {
    className: string;
    formatType: string;
    operation: 'create' | 'update' | 'delete';
    timestamp: string;
    instanceIds: string[];
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

    constructor(
        private runtimeConfig: RuntimeConfigService,
        private classDirectory: ClassDirectoryService
    ) {
        this.rxStomp = new RxStomp();
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
            client.configure({
                brokerURL: wsUrl,
                heartbeatIncoming: 0,
                heartbeatOutgoing: 20000,
                reconnectDelay: 5000,
            });
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
            brokerURL: brokerURL,
            heartbeatIncoming: 0,
            heartbeatOutgoing: 20000,
            reconnectDelay: 5000,
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

    /**
     * Subscribe to change notifications for a class.
     *
     * @param className - The object class name (e.g. 'MyClass')
     * @param formatType - Optional format type for format-specific topics
     * @returns Observable of raw STOMP IMessage
     */
    watchTopic(className: string, formatType?: string): Observable<IMessage> {
        const topic = formatType
            ? `/topic/${className}/${formatType}`
            : `/topic/${className}`;
        // console.log(`[STOMP] Subscribing to ${topic}`);
        return this.clientForClass(className).watch(topic);
    }

    /**
     * Subscribe to parsed change notifications for a class.
     *
     * @param className - The object class name
     * @param formatType - Optional format type
     * @returns Observable of parsed StompChangeNotification
     */
    watchChanges(className: string, formatType?: string): Observable<StompChangeNotification> {
        return this.watchTopic(className, formatType).pipe(
            map(message => {
                const notification = JSON.parse(message.body) as StompChangeNotification;
                // console.log(`[STOMP] Received on /topic/${className}${formatType ? '/' + formatType : ''}: ${notification.operation}`);
                return notification;
            })
        );
    }
}
