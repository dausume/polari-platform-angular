// Karma configuration file for fullstack integration testing
// This extends the base karma.conf.js with fullstack-specific settings

const baseConfig = require('./karma.conf.js');

module.exports = function (config) {
  // Force TEST_MODE to fullstack if not already set
  if (!process.env.TEST_MODE) {
    process.env.TEST_MODE = 'fullstack';
  }

  // Get backend URL from environment
  const backendUrl = process.env.BACKEND_URL || 'http://localhost:8000';

  console.log('Karma Fullstack Configuration:');
  console.log('  TEST_MODE: fullstack (forced)');
  console.log('  BACKEND_URL:', backendUrl);

  // Start with base configuration
  baseConfig(config);

  // Override/add fullstack-specific settings
  config.set({
    // Increase timeout for integration tests (they make real HTTP calls)
    browserNoActivityTimeout: 60000,
    browserDisconnectTimeout: 10000,
    browserDisconnectTolerance: 3,
    captureTimeout: 60000,

    // Only run integration tests in fullstack mode
    // (tests will self-skip if not in fullstack mode via describeIfFullstack)

    // More verbose logging for debugging
    logLevel: config.LOG_DEBUG,

    // Single run with coverage
    singleRun: true,
    autoWatch: false,

    // Use ChromeHeadless for CI/Docker
    browsers: ['ChromeHeadless'],

    // Custom environment variables (passed via command line or docker-compose)
    client: {
      env: {
        TEST_MODE: 'fullstack',
        BACKEND_URL: backendUrl
      },
      jasmine: {
        random: false,  // Run tests in order for better debugging
        seed: 42,
        stopSpecOnExpectationFailure: false
      },
      clearContext: false
    }
  });
};
