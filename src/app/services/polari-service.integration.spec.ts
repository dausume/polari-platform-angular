/**
 * Integration tests for PolariService
 * These tests make REAL HTTP calls to the backend server
 * Run these only in fullstack test mode when backend is available
 */

import { TestBed } from '@angular/core/testing';
import { HttpClientModule } from '@angular/common/http';
import { PolariService } from './polari-service';

describe('PolariService Integration Tests', () => {
  let service: PolariService;

  // Check if we're running in fullstack mode (from window global set in test-setup.ts)
  const isFullstackMode = () => {
    return (typeof (window as any)['__TEST_MODE__'] !== 'undefined' &&
            (window as any)['__TEST_MODE__'] === 'fullstack');
  };

  // Skip these tests if not in fullstack mode
  const describeIfFullstack = isFullstackMode() ? describe : xdescribe;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientModule],
      providers: [PolariService]
    });
    service = TestBed.inject(PolariService);
  });

  describeIfFullstack('Backend Connection', () => {

    it('should connect to backend successfully', (done) => {
      console.log('\n[INTEGRATION TEST] Testing backend connection...');

      // Subscribe to connection success
      service.connectionSuccessSubject.subscribe(isConnected => {
        if (isConnected) {
          console.log('✓ Backend connection successful');
          expect(isConnected).toBe(true);
          done();
        }
      });

      // Give it time to connect
      setTimeout(() => {
        if (!service.connectionSuccessSubject.value) {
          fail('Backend connection timed out after 5 seconds');
          done();
        }
      }, 5000);
    });

    it('should retrieve polyTypedObject data', (done) => {
      console.log('\n[INTEGRATION TEST] Testing polyTypedObject retrieval...');

      service.polyTypedObjectsData.subscribe(data => {
        if (data && data.length > 0) {
          console.log(`✓ Retrieved ${data.length} polyTypedObject definitions`);
          console.log('Available object types:', data.map((d: any) => d.className));

          expect(data).toBeDefined();
          expect(Array.isArray(data)).toBe(true);
          expect(data.length).toBeGreaterThan(0);

          // Check for essential types
          const classNames = data.map((d: any) => d.className);
          expect(classNames).toContain('polyTypedObject');
          expect(classNames).toContain('managerObject');

          done();
        }
      });

      // Timeout after 10 seconds
      setTimeout(() => {
        if (!service.polyTypedObjectsData.value || service.polyTypedObjectsData.value.length === 0) {
          fail('polyTypedObject data not retrieved after 10 seconds');
          done();
        }
      }, 10000);
    });

    it('should retrieve polyTypedVariable data', (done) => {
      console.log('\n[INTEGRATION TEST] Testing polyTypedVariable retrieval...');

      service.polyTypedVarsData.subscribe(data => {
        if (data && data.length > 0) {
          console.log(`✓ Retrieved ${data.length} polyTypedVariable definitions`);

          expect(data).toBeDefined();
          expect(Array.isArray(data)).toBe(true);
          expect(data.length).toBeGreaterThan(0);

          done();
        }
      });

      setTimeout(() => {
        if (!service.polyTypedVarsData.value || service.polyTypedVarsData.value.length === 0) {
          fail('polyTypedVariable data not retrieved after 10 seconds');
          done();
        }
      }, 10000);
    });

    it('should retrieve server data', (done) => {
      console.log('\n[INTEGRATION TEST] Testing polariServer data retrieval...');

      service.serverData.subscribe(data => {
        if (data && Array.isArray(data) && data.length > 0) {
          console.log(`✓ Retrieved ${data.length} polariServer instance(s)`);
          console.log('Server data:', JSON.stringify(data[0], null, 2).substring(0, 500) + '...');

          expect(data).toBeDefined();
          expect(Array.isArray(data)).toBe(true);

          done();
        }
      });

      setTimeout(() => {
        const currentData = service.serverData.value;
        if (!currentData || !Array.isArray(currentData) || currentData.length === 0) {
          fail('Server data not retrieved after 10 seconds');
          done();
        }
      }, 10000);
    });

    it('should retrieve CRUDE endpoints', (done) => {
      console.log('\n[INTEGRATION TEST] Testing CRUDE endpoints retrieval...');

      service.serverCRUDEendpoints.subscribe(data => {
        if (data && Array.isArray(data) && data.length > 0) {
          console.log(`✓ Retrieved ${data.length} CRUDE endpoint(s)`);
          console.log('CRUDE endpoints available:', data.map((d: any) => d.apiObject || d.apiName));

          expect(data).toBeDefined();
          expect(Array.isArray(data)).toBe(true);
          expect(data.length).toBeGreaterThan(0);

          done();
        }
      });

      setTimeout(() => {
        const currentData = service.serverCRUDEendpoints.value;
        if (!currentData || !Array.isArray(currentData) || currentData.length === 0) {
          fail('CRUDE endpoints not retrieved after 10 seconds');
          done();
        }
      }, 10000);
    });

    it('should retrieve API endpoints', (done) => {
      console.log('\n[INTEGRATION TEST] Testing API endpoints retrieval...');

      service.serverAPIendpoints.subscribe(data => {
        if (data && Array.isArray(data) && data.length > 0) {
          console.log(`✓ Retrieved ${data.length} API endpoint(s)`);

          expect(data).toBeDefined();
          expect(Array.isArray(data)).toBe(true);

          done();
        }
      });

      setTimeout(() => {
        const currentData = service.serverAPIendpoints.value;
        if (!currentData || !Array.isArray(currentData) || currentData.length === 0) {
          fail('API endpoints not retrieved after 10 seconds');
          done();
        }
      }, 10000);
    });
  });

  describeIfFullstack('Data Verification', () => {

    it('should have managerObject in type definitions', (done) => {
      console.log('\n[INTEGRATION TEST] Verifying managerObject type exists...');

      // Wait for connection first
      service.connectionSuccessSubject.subscribe(isConnected => {
        if (isConnected) {
          service.polyTypedObjectsData.subscribe(data => {
            if (data && data.length > 0) {
              const classNames = data.map((d: any) => d.className);
              console.log('Checking for managerObject in:', classNames);

              const hasManagerObject = classNames.includes('managerObject');
              console.log(hasManagerObject ? '✓ managerObject type found' : '✗ managerObject type NOT found');

              expect(hasManagerObject).toBe(true);
              done();
            }
          });
        }
      });

      setTimeout(() => {
        fail('Test timed out waiting for managerObject verification');
        done();
      }, 15000);
    });

    it('should verify all required core types exist', (done) => {
      console.log('\n[INTEGRATION TEST] Verifying core types exist...');

      const requiredTypes = [
        'polyTypedObject',
        'polyTypedVariable',
        'polariServer',
        'polariAPI',
        'polariCRUDE',
        'managerObject'
      ];

      service.connectionSuccessSubject.subscribe(isConnected => {
        if (isConnected) {
          service.polyTypedObjectsData.subscribe(data => {
            if (data && data.length > 0) {
              const classNames = data.map((d: any) => d.className);

              console.log('Checking for required types:');
              requiredTypes.forEach(typeName => {
                const exists = classNames.includes(typeName);
                console.log(`  ${exists ? '✓' : '✗'} ${typeName}`);
                expect(exists).toBe(true, `Required type ${typeName} not found`);
              });

              done();
            }
          });
        }
      });

      setTimeout(() => {
        fail('Test timed out waiting for core types verification');
        done();
      }, 15000);
    });
  });

  // Always run these basic tests
  describe('Service Initialization', () => {
    it('should be created', () => {
      expect(service).toBeTruthy();
    });

    it('should have required BehaviorSubjects', () => {
      expect(service.connectionSuccessSubject).toBeDefined();
      expect(service.polyTypedObjectsData).toBeDefined();
      expect(service.polyTypedVarsData).toBeDefined();
      expect(service.serverData).toBeDefined();
      expect(service.serverCRUDEendpoints).toBeDefined();
      expect(service.serverAPIendpoints).toBeDefined();
    });

    it('should have correct backend configuration', () => {
      expect(service.userEntry_ipv4NumSubject.value).toBeTruthy();
      expect(service.userEntry_portNumSubject.value).toBeTruthy();
      console.log(`Backend configured at: ${service.userEntry_ipv4NumSubject.value}:${service.userEntry_portNumSubject.value}`);
    });
  });
});
