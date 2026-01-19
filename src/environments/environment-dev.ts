// ==============================================================================
// DEVELOPMENT ENVIRONMENT CONFIGURATION
// ==============================================================================
// This file contains BUILD-TIME defaults for the development environment.
// These values are baked into the Angular build and serve as Tier 1 defaults.
//
// ENVIRONMENT VARIABLE TIERS:
// ---------------------------
// Tier 1 (Build-time):    This file - Baked into build, requires rebuild to change
// Tier 2 (Startup-time):  runtime-config.json - Loaded at app startup
// Tier 3 (Runtime):       PolariService BehaviorSubjects - Change via UI while running
// ==============================================================================

export const environment = {
    // Environment identification
    environmentDisplayName: 'Developer Mode',
    environmentTypeName: 'dev',
    production: false,
    test: false,
    dev: true,
    default: true,

    // Backend HTTP configuration (Tier 1 defaults)
    backend: {
        http: {
            protocol: 'http',
            url: 'localhost',
            port: '3000'
        },
        https: {
            protocol: 'https',
            url: 'localhost',
            port: '2096'  // Cloudflare-compatible HTTPS port
        },
        // Which protocol to use by default
        preferHttps: false
    },

    // Frontend configuration
    // Note: Port 4201 to avoid conflict with PSC frontend on 4200
    frontend: {
        http: {
            protocol: 'http',
            url: 'localhost',
            port: '4201'
        },
        https: {
            protocol: 'https',
            url: 'localhost',
            port: '2087'  // Cloudflare-compatible HTTPS port
        }
    },

    // Connection settings (Tier 3 - can be changed at runtime)
    connection: {
        retryInterval: 3000,      // ms between retry attempts
        maxRetryTime: 60000,      // max time to retry (1 minute)
        timeout: 30000            // request timeout
    },

    // Feature flags and security settings
    features: {
        enableHttps: true,         // Show HTTPS option in config UI
        enableRuntimeConfig: true, // Allow runtime configuration changes
        allowBackendChange: true   // SECURITY: Allow users to change backend URL (set false in prod)
    },

    // Legacy compatibility - maps to old format
    protocol: 'http',
    backendUrl: 'localhost',
    backendPort: '3000'
}; 