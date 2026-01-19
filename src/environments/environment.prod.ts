// ==============================================================================
// PRODUCTION ENVIRONMENT CONFIGURATION
// ==============================================================================
// This file contains BUILD-TIME defaults for the production environment.
// Production uses HTTPS by default with proper domain names.
//
// ENVIRONMENT VARIABLE TIERS:
// ---------------------------
// Tier 1 (Build-time):    This file - Baked into build, requires rebuild to change
// Tier 2 (Startup-time):  runtime-config.json - Loaded at app startup
// Tier 3 (Runtime):       PolariService BehaviorSubjects - Change via UI while running
// ==============================================================================

export const environment = {
    // Environment identification
    environmentDisplayName: 'Production Mode',
    environmentTypeName: 'prod',
    production: true,
    test: false,
    dev: false,
    default: false,

    // Backend configuration (Tier 1 defaults)
    backend: {
        http: {
            protocol: 'http',
            url: 'api.prf.polari-systems.org',
            port: '80'
        },
        https: {
            protocol: 'https',
            url: 'api.prf.polari-systems.org',
            port: '443'
        },
        // Production uses HTTPS by default
        preferHttps: true
    },

    // Frontend configuration
    frontend: {
        http: {
            protocol: 'http',
            url: 'prf.polari-systems.org',
            port: '80'
        },
        https: {
            protocol: 'https',
            url: 'prf.polari-systems.org',
            port: '443'
        }
    },

    // Connection settings (Tier 3 - can be changed at runtime)
    connection: {
        retryInterval: 3000,
        maxRetryTime: 60000,
        timeout: 30000
    },

    // Feature flags and security settings
    features: {
        enableHttps: true,
        enableRuntimeConfig: false,  // Disable runtime config in production
        allowBackendChange: false    // SECURITY: Prevent users from redirecting to rogue backends
    },

    // Legacy compatibility
    protocol: 'https',
    backendUrl: 'api.prf.polari-systems.org',
    backendPort: '443'
};
