// ==============================================================================
// TEST ENVIRONMENT CONFIGURATION
// ==============================================================================
// This file is used for automated testing (unit tests, integration tests).
// Configured to work with mock backends or isolated test servers.
//
// ENVIRONMENT VARIABLE TIERS:
// ---------------------------
// Tier 1 (Build-time):    This file - Used for test builds
// Tier 2 (Startup-time):  runtime-config.json - Loaded at app startup
// Tier 3 (Runtime):       PolariService BehaviorSubjects - Change via UI while running
// ==============================================================================

export const environment = {
    // Environment identification
    environmentDisplayName: 'Test Mode',
    environmentTypeName: 'test',
    production: false,
    test: true,
    dev: false,
    default: false,

    // Backend configuration - test environment defaults
    backend: {
        http: {
            protocol: 'http',
            url: 'localhost',
            port: '3001'  // Different port for test backend
        },
        https: {
            protocol: 'https',
            url: 'localhost',
            port: '2097'  // Different HTTPS port for test
        },
        preferHttps: false
    },

    // Frontend configuration
    frontend: {
        http: {
            protocol: 'http',
            url: 'localhost',
            port: '4201'  // Different port for test frontend
        },
        https: {
            protocol: 'https',
            url: 'localhost',
            port: '2088'
        }
    },

    // Connection settings - faster timeouts for tests
    connection: {
        retryInterval: 500,       // Faster retries for tests
        maxRetryTime: 5000,       // Shorter max retry time
        timeout: 5000             // Shorter timeout
    },

    // Feature flags and security settings
    features: {
        enableHttps: false,        // Disable HTTPS in tests by default
        enableRuntimeConfig: true,
        allowBackendChange: true   // Allow backend changes in test mode
    },

    // Legacy compatibility
    protocol: 'http',
    backendUrl: 'localhost',
    backendPort: '3001'
}; 