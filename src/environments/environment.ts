// ==============================================================================
// ENVIRONMENT CONFIGURATION WITH AUTO-DETECTION
// ==============================================================================
// This file auto-detects the deployment mode based on the current URL:
// - Suite mode (Docker): Accessed via proxy at ports 2087 (frontend), 2096 (backend)
// - Bare metal mode: Accessed directly at ports 4201 (frontend), 3000 (backend)
//
// ENVIRONMENT VARIABLE TIERS:
// ---------------------------
// Tier 1 (Build-time):    This file - Auto-detects mode at runtime
// Tier 2 (Startup-time):  runtime-config.json - Loaded at app startup
// Tier 3 (Runtime):       PolariService BehaviorSubjects - Change via UI while running
// ==============================================================================

// Auto-detect mode based on current URL
// Suite mode uses proxy port 2087 for frontend
const isSuiteMode = typeof window !== 'undefined' && window.location.port === '2087';

// Suite mode configuration (Docker with proxy)
const suiteConfig = {
    environmentDisplayName: 'Suite Mode (Docker Proxy)',
    environmentTypeName: 'suite',
    production: false,
    test: false,
    dev: true,
    default: false,

    backend: {
        http: {
            protocol: 'http',
            url: 'localhost',
            port: '3000'
        },
        https: {
            protocol: 'https',
            url: 'localhost',
            port: '2096'
        },
        preferHttps: true  // Suite mode uses HTTPS through proxy
    },

    frontend: {
        http: {
            protocol: 'http',
            url: 'localhost',
            port: '4201'
        },
        https: {
            protocol: 'https',
            url: 'localhost',
            port: '2087'
        }
    },

    connection: {
        retryInterval: 3000,
        maxRetryTime: 60000,
        timeout: 30000
    },

    features: {
        enableHttps: true,
        enableRuntimeConfig: true,
        allowBackendChange: true
    },

    protocol: 'https',
    backendUrl: 'localhost',
    backendPort: '2096'
};

// Bare metal configuration (direct access)
const bareMetalConfig = {
    environmentDisplayName: 'Local Development (Bare Metal)',
    environmentTypeName: 'local',
    production: false,
    test: false,
    dev: true,
    default: true,

    backend: {
        http: {
            protocol: 'http',
            url: 'localhost',
            port: '3000'
        },
        https: {
            protocol: 'https',
            url: 'localhost',
            port: '2096'
        },
        preferHttps: false  // Bare metal uses HTTP by default (simpler setup)
    },

    frontend: {
        http: {
            protocol: 'http',
            url: 'localhost',
            port: '4201'
        },
        https: {
            protocol: 'https',
            url: 'localhost',
            port: '2087'
        }
    },

    connection: {
        retryInterval: 3000,
        maxRetryTime: 60000,
        timeout: 30000
    },

    features: {
        enableHttps: true,
        enableRuntimeConfig: true,
        allowBackendChange: true
    },

    protocol: 'http',
    backendUrl: 'localhost',
    backendPort: '3000'
};

// Export the appropriate config based on detected mode
export const environment = isSuiteMode ? suiteConfig : bareMetalConfig;

// Log the detected mode for debugging
if (typeof window !== 'undefined') {
    console.log(`PRF Environment: ${isSuiteMode ? 'Suite (Docker proxy)' : 'Bare metal'} mode detected`);
} 