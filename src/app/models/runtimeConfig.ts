/**
 * @cross-cutting
 * @tags @xc:bindings
 * @consumers
 *   - services/runtime-config.service.ts (loads + exposes this shape)
 *   - auth/oidc.service.ts (KeycloakConfig)
 * @impact-on-edit
 *   Moved out of runtime-config.service.ts (2026-07-14, object/interface
 *   placement audit) — this is the single most cross-cutting config
 *   shape in the app (Tier 2/3 startup + runtime config) and was
 *   entirely undomained. Add new config fields here, not back in the
 *   service.
 * @see /OVERLAP_MAP.md
 *
 * Runtime configuration shape — Tier 2 (startup-time, loaded from
 * /assets/runtime-config.json) + Tier 3 (runtime-configurable via UI,
 * gated by features.enableRuntimeConfig / features.allowBackendChange).
 */

export interface EndpointConfig {
    protocol: string;
    url: string;
    port: string;
}

export interface BackendConfig {
    http: EndpointConfig;
    https: EndpointConfig;
    ws?: EndpointConfig;
    preferHttps: boolean;
}

export interface FrontendConfig {
    http: EndpointConfig;
    https: EndpointConfig;
}

export interface ConnectionConfig {
    retryInterval: number;
    maxRetryTime: number;
    timeout: number;
}

/** Feature flags and security settings. */
export interface FeaturesConfig {
    enableHttps: boolean;
    enableRuntimeConfig: boolean;
    // Security: When false, users cannot change the backend URL/port via UI
    allowBackendChange: boolean;
}

/** Keycloak / OIDC configuration. */
export interface KeycloakConfig {
    authority: string;
    clientId: string;
    realm: string;
    redirectUri: string;
    postLogoutRedirectUri: string;
    responseType: string;
    scope: string;
    silentRedirectUri?: string;
}

/** Complete runtime configuration. */
export interface RuntimeConfig {
    backend: BackendConfig;
    frontend: FrontendConfig;
    connection: ConnectionConfig;
    features: FeaturesConfig;
    keycloak?: KeycloakConfig;
}
