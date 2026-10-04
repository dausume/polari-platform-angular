import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { StateSpacePaletteSourceService, metadataFromLiveConfig, LiveStateSpaceConfig } from './state-space-palette-source.service';
import { StateSpaceClassRegistry } from '../../components/custom-no-code/states/_shared/state-space-class-registry';
import { PolariService } from '../polari-service';

/**
 * hn-0 (D-hn-2) — THE PALETTE IS DATA, THE OLD KINDS STAY STATIC.
 *
 * What must hold: a class GET /stateSpaceClasses returns WITH a `palette` block becomes a palette entry (category,
 * icon, slots, variables, overlay, placement — exactly what the backend declared); a class the static registry
 * already knows is never replaced; a class without a palette is not a palette entry; a failed fetch adds nothing and
 * leaves the static palette working.
 */
describe('StateSpacePaletteSourceService (hn-0 data-driven palette)', () => {
  const BASE = 'http://backend.test';
  let svc: StateSpacePaletteSourceService;
  let http: HttpTestingController;
  const registry = StateSpaceClassRegistry.getInstance();

  const cAtom: LiveStateSpaceConfig = {
    className: 'CAtom', isStateSpaceObject: true, displayFields: ['atom', 'stage'], variables: ['name', 'atom', 'stage', 'bindings'],
    palette: {
      nodeKind: 'c-atom', displayName: 'C Atom', category: 'Hardware', icon: 'memory', color: '#5D4037', placement: 'board',
      language: 'C', overlay: 'c-atom', description: 'One C function of a normal C firmware project',
      displayFields: ['atom', 'stage'],
      variables: [{ name: 'atom', displayName: 'Atom', type: 'string', defaultValue: '' },
                  { name: 'stage', displayName: 'Stage', type: 'string', defaultValue: 'loop' }],
      slots: { inputs: 1, outputs: 1, inputLabels: ['in'], outputLabels: ['out'] },
    },
  };
  const hwi: LiveStateSpaceConfig = {
    className: 'HardwareInterface',
    palette: { nodeKind: 'hw-interface', displayName: 'Hardware Interface', category: 'Hardware', overlay: 'hw-interface',
               placement: 'bridge', slots: { inputs: 1, outputs: 1 }, variables: [{ name: 'binding', defaultValue: '' }] },
  };

  beforeEach(() => {
    registry.unregisterClass('CAtom');
    registry.unregisterClass('HardwareInterface');
    registry.unregisterClass('HardwareSubgraph');
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(), provideHttpClientTesting(),
        { provide: PolariService, useValue: { getBackendBaseUrl: () => BASE, backendRequestOptions: {} } },
      ],
    });
    svc = TestBed.inject(StateSpacePaletteSourceService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    registry.unregisterClass('CAtom');
    registry.unregisterClass('HardwareInterface');
  });

  it('maps a live palette block to registry metadata exactly as declared', () => {
    const m = metadataFromLiveConfig(cAtom)!;
    expect(m.className).toBe('CAtom');
    expect(m.displayName).toBe('C Atom');
    expect(m.category).toBe('Hardware');
    expect(m.icon).toBe('memory');
    expect(m.overlayKind).toBe('c-atom');
    expect(m.nodeKind).toBe('c-atom');
    expect(m.placement).toBe('board');
    expect(m.source).toBe('live');
    expect(m.slotConfiguration?.defaultInputCount).toBe(1);
    expect(m.slotConfiguration?.outputLabels).toEqual(['out']);
    expect(m.variables.map(v => v.name)).toEqual(['atom', 'stage']);
    expect(m.factory()).toEqual({ type: 'CAtom', atom: '', stage: 'loop' });
    // honest in the engine's terms: a hardware kind never runs in the solution engine
    expect(m.executionStatus).toBe('authoring-only');
  });

  it('a class without a palette is not a palette entry; an unknown category falls back to Custom', () => {
    expect(metadataFromLiveConfig({ className: 'AdditionTester', variables: ['num_a'] })).toBeNull();
    const odd = metadataFromLiveConfig({ className: 'Odd', palette: { category: 'NotACategory' } })!;
    expect(odd.category).toBe('Custom');
  });

  it('load() fetches GET /stateSpaceClasses and registers the new kinds — the palette learns c-atom + hw-interface', () => {
    let added: string[] = [];
    svc.load().subscribe(a => (added = a));
    const req = http.expectOne(`${BASE}/stateSpaceClasses`);
    expect(req.request.method).toBe('GET');
    req.flush({ success: true, stateSpaceClasses: [cAtom, hwi, { className: 'AdditionTester', variables: ['num_a'] }] });
    expect(added).toEqual(['CAtom', 'HardwareInterface']);
    expect(registry.getClass('CAtom')?.overlayKind).toBe('c-atom');
    expect(registry.getClass('HardwareInterface')?.placement).toBe('bridge');
    expect(registry.getClassesByCategory('Hardware').map(c => c.className).sort()).toEqual(['CAtom', 'HardwareInterface']);
    expect(registry.getClass('AdditionTester')).toBeUndefined();
  });

  it('the static kinds stay static: a live entry named like a built-in never replaces it', () => {
    const before = registry.getClass('ConditionalChain');
    expect(before).toBeDefined();
    const added = svc.register([{ className: 'ConditionalChain', palette: { displayName: 'HIJACK', category: 'Hardware' } }]);
    expect(added).toEqual([]);
    expect(registry.getClass('ConditionalChain')).toBe(before);
    expect(registry.getClass('ConditionalChain')?.displayName).not.toBe('HIJACK');
  });

  it('a failed fetch adds nothing and does not throw (the static palette keeps working)', () => {
    let added: string[] | null = null;
    const n = registry.getAllClasses().length;
    svc.load().subscribe(a => (added = a));
    http.expectOne(`${BASE}/stateSpaceClasses`).flush('down', { status: 503, statusText: 'Service Unavailable' });
    expect(added!).toEqual([]);
    expect(registry.getAllClasses().length).toBe(n);
  });
});
