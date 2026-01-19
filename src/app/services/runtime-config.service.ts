// ==============================================================================
// RUNTIME CONFIGURATION SERVICE
// ==============================================================================
// This service handles Tier 2 (startup-time) and Tier 3 (runtime) configuration.
//
// TIER 2: Loads configuration from /assets/runtime-config.json at app startup
//         This allows overriding build-time defaults without rebuilding.
//
// TIER 3: Provides BehaviorSubjects for runtime-configurable values that can
//         be changed via the UI while the application is running.
//
// SECURITY: Runtime configuration can be locked via:
//   - features.allowBackendChange = false (prevents UI from changing backend)
//   - features.enableRuntimeConfig = false (disables all runtime changes)
// ==============================================================================

import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { environment } from 'src/environments/environment-dev';

// Interface for endpoint configuration
export interface EndpointConfig {
    protocol: string;
    url: string;
    port: string;
}

// Interface for backend configuration
export interface BackendConfig {
    http: EndpointConfig;
    https: EndpointConfig;
    preferHttps: boolean;
}

// Interface for frontend configuration
export interface FrontendConfig {
    http: EndpointConfig;
    https: EndpointConfig;
}

// Interface for connection settings
export interface ConnectionConfig {
    retryInterval: number;
    maxRetryTime: number;
    timeout: number;
}

// Interface for feature flags and security settings
export interface FeaturesConfig {
    enableHttps: boolean;
    enableRuntimeConfig: boolean;
    // Security: When false, users cannot change the backend URL/port via UI
    allowBackendChange: boolean;
}

// Complete runtime configuration interface
export interface RuntimeConfig {
    backend: BackendConfig;
    frontend: FrontendConfig;
    connection: ConnectionConfig;
    features: FeaturesConfig;
}

@Injectable({
    providedIn: 'root'
})
export class RuntimeConfigService {

    // Tier 2: Startup-time configuration (loaded from runtime-config.json)
    private startupConfig: RuntimeConfig | null = null;
    private configLoaded = new BehaviorSubject<boolean>(false);

    // Hosting detection
    private isLocalhost: boolean;
    private isServedOverHttps: boolean;

    // Tier 3: Runtime-configurable values (can be changed via UI)
    // Initialize with environment defaults immediately to avoid blank values
    public backendProtocol$: BehaviorSubject<string>;
    public backendUrl$: BehaviorSubject<string>;
    public backendPort$: BehaviorSubject<string>;
    public useHttps$: BehaviorSubject<boolean>;

    // Connection settings
    public retryInterval$: BehaviorSubject<number>;
    public maxRetryTime$: BehaviorSubject<number>;
    public timeout$: BehaviorSubject<number>;

    constructor(private http: HttpClient) {
        // Detect hosting environment
        this.isLocalhost = this.detectLocalhost();
        this.isServedOverHttps = window.location.protocol === 'https:';

        // Determine initial values from environment (Tier 1)
        // If served over HTTPS, prefer HTTPS backend connection
        const shouldUseHttps = this.isServedOverHttps ||
            (environment.backend?.preferHttps ?? false);

        const initialEndpoint = shouldUseHttps
            ? environment.backend?.https
            : environment.backend?.http;

        // Initialize BehaviorSubjects with proper defaults immediately
        this.backendProtocol$ = new BehaviorSubject<string>(
            initialEndpoint?.protocol || environment.protocol || 'http'
        );
        this.backendUrl$ = new BehaviorSubject<string>(
            initialEndpoint?.url || environment.backendUrl || 'localhost'
        );
        this.backendPort$ = new BehaviorSubject<string>(
            initialEndpoint?.port || environment.backendPort || '3000'
        );
        this.useHttps$ = new BehaviorSubject<boolean>(shouldUseHttps);

        // Connection settings from environment
        this.retryInterval$ = new BehaviorSubject<number>(
            environment.connection?.retryInterval ?? 3000
        );
        this.maxRetryTime$ = new BehaviorSubject<number>(
            environment.connection?.maxRetryTime ?? 60000
        );
        this.timeout$ = new BehaviorSubject<number>(
            environment.connection?.timeout ?? 30000
        );

        console.log(`[RuntimeConfig] Initialized - localhost: ${this.isLocalhost}, HTTPS: ${this.isServedOverHttps}`);
        console.log(`[RuntimeConfig] Initial backend: ${this.getBackendBaseUrl()}`);
    }

    /**
     * Detect if running on localhost.
     */
    private detectLocalhost(): boolean {
        const hostname = window.location.hostname;
        return hostname === 'localhost' ||
               hostname === '127.0.0.1' ||
               hostname.startsWith('192.168.') ||
               hostname.startsWith('10.') ||
               hostname.endsWith('.local');
    }

    /**
     * Initialize the configuration service.
     * Called during app initialization to load Tier 2 config.
     */
    initialize(): Promise<void> {
        return new Promise((resolve) => {
            this.loadRuntimeConfig().subscribe({
                next: () => resolve(),
                error: () => resolve() // Continue even if config load fails
            });
        });
    }

    /**
     * Load runtime configuration from JSON file (Tier 2).
     * Falls back to build-time defaults if file doesn't exist.
     */
    private loadRuntimeConfig(): Observable<RuntimeConfig | null> {
        return this.http.get<RuntimeConfig>('/assets/runtime-config.json').pipe(
            tap(config => {
                console.log('[RuntimeConfig] Loaded startup-time configuration:', config);
                this.startupConfig = config;
                this.applyStartupConfig(config);
                this.configLoaded.next(true);
            }),
            catchError(error => {
                console.log('[RuntimeConfig] No runtime-config.json found, using build-time defaults');
                this.applyBuildTimeDefaults();
                this.configLoaded.next(true);
                return of(null);
            })
        );
    }

    /**
     * Apply Tier 2 (startup-time) configuration to Tier 3 subjects.
     */
    private applyStartupConfig(config: RuntimeConfig): void {
        // Determine which protocol to use
        const useHttps = config.backend?.preferHttps ?? false;
        this.useHttps$.next(useHttps);

        const endpoint = useHttps ? config.backend?.https : config.backend?.http;
        if (endpoint) {
            this.backendProtocol$.next(endpoint.protocol);
            this.backendUrl$.next(endpoint.url);
            this.backendPort$.next(endpoint.port);
        }

        // Apply connection settings
        if (config.connection) {
            this.retryInterval$.next(config.connection.retryInterval);
            this.maxRetryTime$.next(config.connection.maxRetryTime);
            this.timeout$.next(config.connection.timeout);
        }
    }

    /**
     * Apply Tier 1 (build-time) defaults when no Tier 2 config exists.
     */
    private applyBuildTimeDefaults(): void {
        const useHttps = environment.backend?.preferHttps ?? false;
        this.useHttps$.next(useHttps);

        const endpoint = useHttps ? environment.backend?.https : environment.backend?.http;
        if (endpoint) {
            this.backendProtocol$.next(endpoint.protocol);
            this.backendUrl$.next(endpoint.url);
            this.backendPort$.next(endpoint.port);
        } else {
            // Legacy fallback
            this.backendProtocol$.next(environment.protocol || 'http');
            this.backendUrl$.next(environment.backendUrl || 'localhost');
            this.backendPort$.next(environment.backendPort || '3000');
        }

        // Apply connection settings from build-time config
        if (environment.connection) {
            this.retryInterval$.next(environment.connection.retryInterval);
            this.maxRetryTime$.next(environment.connection.maxRetryTime);
            this.timeout$.next(environment.connection.timeout);
        }
    }

    // =========================================================================
    // TIER 3: Runtime Configuration Methods
    // These methods allow changing configuration while the app is running
    // =========================================================================

    /**
     * Switch between HTTP and HTTPS backend connections.
     * Respects security settings - always allowed as it only switches protocol.
     */
    switchToHttps(useHttps: boolean): void {
        if (!this.isRuntimeConfigEnabled()) {
            console.warn('[RuntimeConfig] Runtime configuration is disabled');
            return;
        }

        this.useHttps$.next(useHttps);

        // Get the appropriate endpoint config
        const config = this.startupConfig || { backend: environment.backend } as RuntimeConfig;
        const endpoint = useHttps ? config.backend?.https : config.backend?.http;

        if (endpoint) {
            this.backendProtocol$.next(endpoint.protocol);
            this.backendPort$.next(endpoint.port);
            // URL typically stays the same
        }

        console.log(`[RuntimeConfig] Switched to ${useHttps ? 'HTTPS' : 'HTTP'}`);
    }

    /**
     * Update backend connection settings at runtime.
     * SECURITY: This method checks if backend changes are allowed.
     * Returns false if changes are blocked by security settings.
     */
    updateBackendConnection(url: string, port: string, protocol?: string): boolean {
        // Security check: Is backend change allowed?
        if (!this.isBackendChangeAllowed()) {
            console.warn('[RuntimeConfig] SECURITY: Backend changes are disabled');
            return false;
        }

        if (!this.isRuntimeConfigEnabled()) {
            console.warn('[RuntimeConfig] Runtime configuration is disabled');
            return false;
        }

        this.backendUrl$.next(url);
        this.backendPort$.next(port);
        if (protocol) {
            this.backendProtocol$.next(protocol);
            this.useHttps$.next(protocol === 'https');
        }
        console.log(`[RuntimeConfig] Updated backend: ${this.getBackendBaseUrl()}`);
        return true;
    }

    /**
     * Update connection retry settings at runtime.
     */
    updateConnectionSettings(retryInterval?: number, maxRetryTime?: number, timeout?: number): void {
        if (!this.isRuntimeConfigEnabled()) {
            console.warn('[RuntimeConfig] Runtime configuration is disabled');
            return;
        }

        if (retryInterval !== undefined) this.retryInterval$.next(retryInterval);
        if (maxRetryTime !== undefined) this.maxRetryTime$.next(maxRetryTime);
        if (timeout !== undefined) this.timeout$.next(timeout);
    }

    // =========================================================================
    // HELPER METHODS
    // =========================================================================

    /**
     * Get the current backend base URL.
     */
    getBackendBaseUrl(): string {
        const protocol = this.backendProtocol$.value;
        const url = this.backendUrl$.value;
        const port = this.backendPort$.value;

        // Don't include port in URL if it's the default for the protocol
        if ((protocol === 'http' && port === '80') || (protocol === 'https' && port === '443')) {
            return `${protocol}://${url}`;
        }
        return `${protocol}://${url}:${port}`;
    }

    /**
     * Get HTTP backend URL (useful when you specifically need HTTP).
     */
    getHttpBackendUrl(): string {
        const config = this.startupConfig || { backend: environment.backend } as RuntimeConfig;
        const http = config.backend?.http;
        if (http) {
            return `${http.protocol}://${http.url}:${http.port}`;
        }
        return `http://${environment.backendUrl}:${environment.backendPort}`;
    }

    /**
     * Get HTTPS backend URL (useful when you specifically need HTTPS).
     */
    getHttpsBackendUrl(): string {
        const config = this.startupConfig || { backend: environment.backend } as RuntimeConfig;
        const https = config.backend?.https;
        if (https) {
            return `${https.protocol}://${https.url}:${https.port}`;
        }
        // Fallback to HTTP with HTTPS port
        return `https://${environment.backendUrl}:2096`;
    }

    /**
     * Check if runtime configuration is enabled.
     */
    isRuntimeConfigEnabled(): boolean {
        return this.startupConfig?.features?.enableRuntimeConfig ??
               environment.features?.enableRuntimeConfig ?? true;
    }

    /**
     * SECURITY: Check if backend URL/port changes are allowed.
     * When false, users cannot change where the app connects to.
     * This prevents potential attack vectors where malicious users
     * could redirect the app to a rogue backend.
     */
    isBackendChangeAllowed(): boolean {
        return this.startupConfig?.features?.allowBackendChange ??
               (environment.features as any)?.allowBackendChange ?? true;
    }

    /**
     * Check if HTTPS option should be shown in UI.
     */
    isHttpsEnabled(): boolean {
        return this.startupConfig?.features?.enableHttps ??
               environment.features?.enableHttps ?? true;
    }

    /**
     * Check if app is running on localhost.
     */
    isRunningLocally(): boolean {
        return this.isLocalhost;
    }

    /**
     * Check if app is served over HTTPS.
     */
    isServedSecurely(): boolean {
        return this.isServedOverHttps;
    }

    /**
     * Observable that emits when config is loaded.
     */
    get isConfigLoaded$(): Observable<boolean> {
        return this.configLoaded.asObservable();
    }

    /**
     * Get the complete current configuration (for debugging).
     */
    getCurrentConfig(): object {
        return {
            tier1_buildTime: {
                environmentType: environment.environmentTypeName,
                backend: environment.backend,
                frontend: environment.frontend
            },
            tier2_startupTime: this.startupConfig,
            tier3_runtime: {
                backendProtocol: this.backendProtocol$.value,
                backendUrl: this.backendUrl$.value,
                backendPort: this.backendPort$.value,
                useHttps: this.useHttps$.value,
                retryInterval: this.retryInterval$.value,
                maxRetryTime: this.maxRetryTime$.value,
                timeout: this.timeout$.value
            }
        };
    }
}
