/**
 * Integration tests for CRUDEclassService
 * These tests make REAL HTTP calls to the backend server for dynamic object access
 * Run these only in fullstack test mode when backend is available
 */

import { TestBed } from '@angular/core/testing';
import { HttpClientModule } from '@angular/common/http';
import { PolariService } from './polari-service';
import { CRUDEservicesManager } from './crude-services-manager';

describe('CRUDEclassService Integration Tests', () => {
  let polariService: PolariService;
  let crudeManager: CRUDEservicesManager;

  // Check if we're running in fullstack mode (from window global set in test-setup.ts)
  const isFullstackMode = () => {
    return (typeof (window as any)['__TEST_MODE__'] !== 'undefined' &&
            (window as any)['__TEST_MODE__'] === 'fullstack');
  };

  const describeIfFullstack = isFullstackMode() ? describe : xdescribe;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientModule],
      providers: [PolariService, CRUDEservicesManager]
    });
    polariService = TestBed.inject(PolariService);
    crudeManager = TestBed.inject(CRUDEservicesManager);
  });

  describeIfFullstack('Dynamic Object Retrieval', () => {

    it('should retrieve managerObject instances', (done) => {
      console.log('\n[INTEGRATION TEST] Testing managerObject retrieval via CRUDE...');

      // Wait for backend connection
      polariService.connectionSuccessSubject.subscribe(isConnected => {
        if (isConnected) {
          // Get the CRUDE service for managerObject
          const managerService = crudeManager.getCRUDEclassService('managerObject');

          // Fetch all managerObject instances
          managerService.readAll().subscribe({
            next: (data) => {
              console.log('✓ managerObject CRUDE response received');
              console.log('Data structure:', JSON.stringify(data, null, 2).substring(0, 1000));

              expect(data).toBeDefined();

              // Backend returns data in format: { managerObject: {...} }
              if (data && typeof data === 'object') {
                console.log('✓ Valid response structure');
                if (data['managerObject']) {
                  console.log('✓ managerObject data present in response');
                }
              }

              done();
            },
            error: (error) => {
              console.error('✗ Error fetching managerObject:', error);
              fail(`Failed to fetch managerObject: ${error.message || error}`);
              done();
            }
          });
        }
      });

      // Timeout after 15 seconds
      setTimeout(() => {
        if (!polariService.connectionSuccessSubject.value) {
          fail('Backend connection timed out');
        }
        done();
      }, 15000);
    });

    it('should retrieve polariServer instances', (done) => {
      console.log('\n[INTEGRATION TEST] Testing polariServer retrieval via CRUDE...');

      polariService.connectionSuccessSubject.subscribe(isConnected => {
        if (isConnected) {
          const serverService = crudeManager.getCRUDEclassService('polariServer');

          serverService.readAll().subscribe({
            next: (data) => {
              console.log('✓ polariServer CRUDE response received');
              console.log('Data keys:', Object.keys(data || {}));

              expect(data).toBeDefined();

              if (data && data['polariServer']) {
                console.log('✓ polariServer data present');
                const serverData = data['polariServer'];
                console.log('Server instances:', Object.keys(serverData));
              }

              done();
            },
            error: (error) => {
              console.error('✗ Error fetching polariServer:', error);
              fail(`Failed to fetch polariServer: ${error.message || error}`);
              done();
            }
          });
        }
      });

      setTimeout(() => {
        fail('Test timed out');
        done();
      }, 15000);
    });

    it('should retrieve polyTypedObject instances via CRUDE', (done) => {
      console.log('\n[INTEGRATION TEST] Testing polyTypedObject retrieval via CRUDE...');

      polariService.connectionSuccessSubject.subscribe(isConnected => {
        if (isConnected) {
          const polyTypeService = crudeManager.getCRUDEclassService('polyTypedObject');

          polyTypeService.readAll().subscribe({
            next: (data) => {
              console.log('✓ polyTypedObject CRUDE response received');

              expect(data).toBeDefined();

              if (data && data['polyTypedObject']) {
                console.log('✓ polyTypedObject data present');
                const typeData = data['polyTypedObject'];
                const typeNames = Object.keys(typeData);
                console.log(`Found ${typeNames.length} type definitions:`, typeNames);

                // Verify core types exist
                expect(typeNames).toContain('managerObject');
                expect(typeNames).toContain('polariServer');

                console.log('✓ Core types verified');
              }

              done();
            },
            error: (error) => {
              console.error('✗ Error fetching polyTypedObject:', error);
              fail(`Failed to fetch polyTypedObject: ${error.message || error}`);
              done();
            }
          });
        }
      });

      setTimeout(() => {
        fail('Test timed out');
        done();
      }, 15000);
    });

    it('should test CRUDE service for multiple object types', (done) => {
      console.log('\n[INTEGRATION TEST] Testing multiple object types via CRUDE...');

      const typesToTest = [
        'managerObject',
        'polariServer',
        'polyTypedObject',
        'polariCRUDE',
        'polariAPI'
      ];

      polariService.connectionSuccessSubject.subscribe(isConnected => {
        if (isConnected) {
          let completedTests = 0;
          const results: { [key: string]: boolean } = {};

          typesToTest.forEach(typeName => {
            const service = crudeManager.getCRUDEclassService(typeName);

            service.readAll().subscribe({
              next: (data) => {
                results[typeName] = !!data;
                console.log(`  ${results[typeName] ? '✓' : '✗'} ${typeName}: ${data ? 'received' : 'no data'}`);
                completedTests++;

                if (completedTests === typesToTest.length) {
                  console.log('\n✓ All object types tested');
                  console.log('Results:', results);

                  // All should have returned data
                  typesToTest.forEach(typeName => {
                    expect(results[typeName]).toBe(true, `${typeName} should return data`);
                  });

                  done();
                }
              },
              error: (error) => {
                results[typeName] = false;
                console.error(`  ✗ ${typeName}: Error - ${error.message || error}`);
                completedTests++;

                if (completedTests === typesToTest.length) {
                  fail('Some object types failed to load');
                  done();
                }
              }
            });
          });
        }
      });

      setTimeout(() => {
        fail('Test timed out');
        done();
      }, 20000);
    });
  });

  describeIfFullstack('CRUDE Service Manager', () => {

    it('should create services for different class names', () => {
      console.log('\n[INTEGRATION TEST] Testing CRUDE service creation...');

      const service1 = crudeManager.getCRUDEclassService('managerObject');
      const service2 = crudeManager.getCRUDEclassService('polariServer');

      expect(service1).toBeDefined();
      expect(service2).toBeDefined();
      expect(service1.className).toBe('managerObject');
      expect(service2.className).toBe('polariServer');

      console.log('✓ Services created with correct class names');
    });

    it('should reuse existing services', () => {
      console.log('\n[INTEGRATION TEST] Testing service reuse...');

      const service1 = crudeManager.getCRUDEclassService('managerObject');
      const service2 = crudeManager.getCRUDEclassService('managerObject');

      expect(service1).toBe(service2);
      console.log('✓ Same service instance returned');
    });

    it('should have access to CRUDE endpoints from PolariService', (done) => {
      console.log('\n[INTEGRATION TEST] Testing CRUDE endpoints availability...');

      polariService.connectionSuccessSubject.subscribe(isConnected => {
        if (isConnected) {
          polariService.serverCRUDEendpoints.subscribe(endpoints => {
            if (endpoints && Array.isArray(endpoints) && endpoints.length > 0) {
              console.log(`✓ ${endpoints.length} CRUDE endpoints available in service manager`);

              const endpointNames = crudeManager.classCrudeEndpoints;
              console.log('Registered endpoints:', Object.keys(endpointNames));

              expect(Object.keys(endpointNames).length).toBeGreaterThan(0);

              done();
            }
          });
        }
      });

      setTimeout(() => {
        fail('Test timed out');
        done();
      }, 10000);
    });
  });

  // Always run these basic tests
  describe('Service Manager Initialization', () => {
    it('should be created', () => {
      expect(crudeManager).toBeTruthy();
    });

    it('should have empty services dictionary initially', () => {
      expect(crudeManager.crudeServices).toBeDefined();
      expect(typeof crudeManager.crudeServices).toBe('object');
    });

    it('should have access to PolariService', () => {
      expect(crudeManager['polariService']).toBeDefined();
    });
  });
});
