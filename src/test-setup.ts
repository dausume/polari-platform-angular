/**
 * Test setup file for configuring fullstack integration tests
 * This file is loaded before test.ts and sets up the test environment
 */

// Get test configuration from Karma (passed via client.env in karma.conf.js)
// Karma makes these available via __karma__.config
const karmaConfig = (typeof (window as any).__karma__ !== 'undefined' &&
                     (window as any).__karma__.config) || {};

// Get TEST_MODE from Karma config (browser environment)
const testMode = karmaConfig.env?.TEST_MODE || 'isolation';
const backendUrl = karmaConfig.env?.BACKEND_URL || 'http://localhost:8000';

console.log('======================================================================');
console.log('POLARI FRONTEND TEST CONFIGURATION');
console.log('======================================================================');
console.log(`Test Mode: ${testMode}`);
console.log(`Backend URL: ${backendUrl}`);
console.log('======================================================================\n');

// Make test mode available globally for tests
(window as any)['__TEST_MODE__'] = testMode;
(window as any)['__BACKEND_URL__'] = backendUrl;

if (testMode === 'fullstack') {
  console.log('✓ Fullstack mode enabled - Integration tests will run');
  console.log('  Tests will make REAL HTTP calls to:', backendUrl);
  console.log('  Ensure backend server is running and accessible\n');
} else {
  console.log('✓ Isolation mode enabled - Integration tests will be skipped');
  console.log('  Unit tests will use mocked services\n');
}

// Export for use in tests
export const TEST_CONFIG = {
  mode: testMode,
  backendUrl: backendUrl,
  isFullstack: testMode === 'fullstack',
  isIsolation: testMode === 'isolation'
};
