import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { BehaviorSubject } from 'rxjs';

import { CGraphCanvasPanelComponent } from './c-graph-canvas-panel.component';
import { PolariService } from '@services/polari-service';
import { NoCodeSolutionStateService } from '@services/no-code-services/no-code-solution-state.service';

/**
 * demo-4b — THE ADAPTER, atoms-as-real-nodes shape (his ruling 2026-10-04: he opened /display/c-canvas and saw ONE
 * state instead of the atoms).
 *
 * What must hold, no `solution` input (the default — /display/c-atoms, /display/c-canvas): on load it fetches the
 * graph's detail (GET /api/cmod/graphs/{graph}) and creates (once — `ensure`) a solution named `cmod.c-canvas.<graph>`
 * holding ONE `CAtom` state PER CGraphNode (never a single HardwareSubgraph wrapper), wired by its edges, then selects
 * it (once) through the SAME service the native selector uses; it never duplicates the solution on a second load;
 * picking a different graph swaps the open solution; Render/Build/Prove call the graph's own doors and show the
 * verdict as fields, never raw JSON; a refusal's words are shown; it never navigates.
 *
 * What must hold, a `solution` input (/display/hardware-solutions): the REAL, already-seeded solution opens by name —
 * no synthesis, no `createNewSolution` call at all.
 */
describe('CGraphCanvasPanelComponent (demo-4b)', () => {
  const BASE = 'http://backend.test';
  let fixture: ComponentFixture<CGraphCanvasPanelComponent>;
  let comp: CGraphCanvasPanelComponent;
  let http: HttpTestingController;
  let solutionState: jasmine.SpyObj<NoCodeSolutionStateService>;
  let loading$: BehaviorSubject<boolean>;
  let known: Set<string>;
  let navigateSpy: jasmine.Spy;

  const GRAPH_DETAIL = {
    ok: true, graph: { name: 'uno-sim-rig-graph' },
    nodes: [
      { instance: 'adc', kind: 'c-atom', atom: 'uno:hal.hal_adc_read', stage: 'tick', order: 0, bindings: 'channel=ADC_CHANNEL', params: '' },
      { instance: 'temp', kind: 'c-atom', atom: 'uno:hal.sensor_value', stage: 'tick', order: 1, bindings: '', params: '' },
      { instance: 'send', kind: 'frame', atom: '', stage: '', order: 2, bindings: '', params: 'fields=temp_c' },
    ],
    edges: [
      { kind: 'data', from_node: 'adc', from_port: 'return', to_node: 'temp', to_port: 'raw', order: 0 },
      { kind: 'field', from_node: 'temp', from_port: 'return', to_node: 'send', to_port: 'temp_c', order: 1 },
    ],
    used_by: [],
  };

  async function make() {
    loading$ = new BehaviorSubject<boolean>(true);
    known = new Set<string>();
    navigateSpy = jasmine.createSpy('navigate');
    solutionState = jasmine.createSpyObj('NoCodeSolutionStateService', [
      'getSolutionData', 'createNewSolution', 'addStateToSolution', 'addConnector', 'selectSolution',
      'getSolutionStateInstances', 'updateStateInstance', 'updateStatePositions',
    ], { loading$ });
    solutionState.getSolutionData.and.callFake((name: string) => (known.has(name) ? ({ solutionName: name } as any) : undefined));
    solutionState.createNewSolution.and.callFake((name: string) => { known.add(name); });
    solutionState.getSolutionStateInstances.and.returnValue([]);

    await TestBed.configureTestingModule({
      declarations: [CGraphCanvasPanelComponent],
      schemas: [NO_ERRORS_SCHEMA],   // <custom-no-code> is a huge real component — not under test here
      providers: [provideHttpClient(), provideHttpClientTesting(),
                  { provide: PolariService, useValue: { getBackendBaseUrl: () => BASE, backendRequestOptions: {} } },
                  { provide: NoCodeSolutionStateService, useValue: solutionState },
                  // The panel must never navigate on its own — the demo-4 infinite-loop bug traced to
                  // custom-no-code's URL sync + display-page's unconditional reload-on-any-query-param,
                  // not to this panel, but it stays unprovoked here as a regression guard.
                  { provide: Router, useValue: { navigate: navigateSpy } }],
    }).compileComponents();
    fixture = TestBed.createComponent(CGraphCanvasPanelComponent);
    comp = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    http.expectOne(`${BASE}/api/cmod/graphs`).flush({ ok: true, graphs: [
      { name: 'uno-sim-rig-graph', title: 'x', status: 'proven', node_count: 18, edge_count: 15, atom_count: 13 },
    ] });
    loading$.next(false);
  }

  function flushGraphDetail(graph = 'uno-sim-rig-graph', body: any = GRAPH_DETAIL) {
    http.expectOne(`${BASE}/api/cmod/graphs/${graph}`).flush(body);
  }

  afterEach(() => http.verify());

  it('fetches the graph detail and creates ONE solution holding one CAtom state PER CGraphNode (never a single '
     + 'HardwareSubgraph wrapper), wired by the edges, then selects it', async () => {
    await make();
    flushGraphDetail();
    expect(solutionState.createNewSolution).toHaveBeenCalledTimes(1);
    expect(solutionState.createNewSolution.calls.argsFor(0)[0]).toBe('cmod.c-canvas.uno-sim-rig-graph');
    expect(solutionState.addStateToSolution).toHaveBeenCalledTimes(3);
    const classes = solutionState.addStateToSolution.calls.allArgs().map(a => (a[1] as any).stateClass);
    expect(classes).toEqual(['CAtom', 'CAtom', 'CAtom']);
    const names = solutionState.addStateToSolution.calls.allArgs().map(a => (a[1] as any).stateName);
    expect(names).toEqual(['adc', 'temp', 'send']);
    // the glue-owned 'frame' node (not kind c-atom) is read-only, named so
    const sendState = solutionState.addStateToSolution.calls.allArgs().map(a => a[1] as any).find(s => s.stateName === 'send');
    expect(sendState.notes).toContain('read-only');
    expect(solutionState.addConnector).toHaveBeenCalledTimes(2);
    expect(solutionState.addConnector).toHaveBeenCalledWith('cmod.c-canvas.uno-sim-rig-graph', 'adc', 1, 'temp', 0);
    expect(solutionState.selectSolution).toHaveBeenCalledWith('cmod.c-canvas.uno-sim-rig-graph');
  });

  it('a SECOND open of the same graph selects the existing solution — never a duplicate create or a second fetch', async () => {
    await make();
    flushGraphDetail();
    (comp as any).openSolutionFor('uno-sim-rig-graph');
    expect(solutionState.createNewSolution).toHaveBeenCalledTimes(1);   // still just the once
    expect(solutionState.selectSolution).toHaveBeenCalledTimes(2);
  });

  it('ensures + selects exactly once across repeated change-detection cycles and loading$ re-emissions, and never '
     + 'navigates (demo-4 infinite-loop regression guard)', async () => {
    await make();
    flushGraphDetail();

    for (let i = 0; i < 5; i++) {
      loading$.next(true);
      loading$.next(false);
      fixture.detectChanges();
    }
    comp.ngOnChanges({});
    fixture.detectChanges();

    expect(solutionState.createNewSolution).toHaveBeenCalledTimes(1);
    expect(solutionState.selectSolution).toHaveBeenCalledTimes(1);
    expect(navigateSpy).not.toHaveBeenCalled();
  });

  it('picking a different graph opens a differently-named solution, fetching ITS detail', async () => {
    await make();
    flushGraphDetail();
    comp.pick('uno-temp-split-graph');
    flushGraphDetail('uno-temp-split-graph', { ok: true, graph: {}, nodes: [], edges: [], used_by: [] });
    expect(solutionState.createNewSolution).toHaveBeenCalledWith('cmod.c-canvas.uno-temp-split-graph', jasmine.anything());
    expect(solutionState.selectSolution).toHaveBeenCalledWith('cmod.c-canvas.uno-temp-split-graph');
  });

  it('with a `solution` input, opens the REAL solution by name — no synthesis, no createNewSolution at all', async () => {
    await make();
    flushGraphDetail();   // still fetched once on init (no solution input the first time)
    comp.solution = 'uno-temp-split';
    comp.ngOnChanges({ solution: { firstChange: false } as any });
    expect(solutionState.selectSolution).toHaveBeenCalledWith('uno-temp-split');
    const createCallsForReal = solutionState.createNewSolution.calls.allArgs().filter(a => a[0] === 'uno-temp-split');
    expect(createCallsForReal.length).toBe(0);
  });

  it('groups the open solution into lanes by runtime (c-device/java-bridge/python-backend), colours states and '
     + 'lists crossing interfaces', async () => {
    await make();
    flushGraphDetail();
    solutionState.getSolutionStateInstances.and.returnValue([
      { stateName: 'sim-rig', stateClass: 'HardwareSubgraph', slots: [{ connectors: [{ targetStateName: 'uno-twin' }] }] },
      { stateName: 'uno-twin', stateClass: 'HardwareInterface', slots: [{ connectors: [{ targetStateName: 'on-temp' }] }] },
      { stateName: 'on-temp', stateClass: 'BackendStateChange', slots: [{ connectors: [] }] },
    ] as any);
    comp.solution = 'uno-temp-split';
    comp.ngOnChanges({ solution: { firstChange: false } as any });
    expect(comp.lanes.map(l => l.runtime)).toEqual(['c-device', 'java-bridge', 'python-backend']);
    expect(solutionState.updateStateInstance).toHaveBeenCalled();
    expect(solutionState.updateStatePositions).toHaveBeenCalled();
    expect(comp.crossings.length).toBe(2);
    expect(comp.crossings[0]).toEqual(jasmine.objectContaining({ from: 'sim-rig', to: 'uno-twin', fromRuntime: 'c-device', toRuntime: 'java-bridge' }));
  });

  it('Render shows the graph/files sha and cost as fields, never a JSON wall', async () => {
    await make();
    flushGraphDetail();
    comp.doRender();
    http.expectOne(`${BASE}/api/cmod/graphs/uno-sim-rig-graph/render`).flush({
      ok: true, graph_sha256: 'abc123def456', files_sha256: '112233445566', unchanged: true,
      cost_before_building: { total_bytes: 3144 }, files: [],
    });
    expect(comp.renderResult.graph_sha256).toBe('abc123def456');
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).not.toContain('{');
  });

  it('Build posts to the build door and shows the verdict; a refusal shows its words', async () => {
    await make();
    flushGraphDetail();
    comp.doBuild();
    http.expectOne(`${BASE}/api/cmod/graphs/uno-sim-rig-graph/build`).flush(
      { ok: false, refused: 'uno-sim-rig-graph is not rendered yet' }, { status: 422, statusText: 'Unprocessable' });
    http.match(`${BASE}/api/cmod/graphs/uno-sim-rig-graph`).forEach(r => r.flush({ ok: true, glue_builds: [] }));
    expect(comp.buildResult.ok).toBeFalse();
    expect(comp.buildResult.refused).toContain('not rendered yet');
  });

  it('Prove posts to the prove door and shows EQUIVALENT with the frame count', async () => {
    await make();
    flushGraphDetail();
    comp.doProve();
    http.expectOne(`${BASE}/api/cmod/graphs/uno-sim-rig-graph/prove`).flush(
      { ok: true, equivalent: true, frames_compared: 40, hex_identical: true, n_differences: 0, differences: [] });
    http.match(`${BASE}/api/cmod/graphs/uno-sim-rig-graph`).forEach(r => r.flush({ ok: true, glue_builds: [] }));
    expect(comp.proveResult.equivalent).toBeTrue();
    expect(comp.proveResult.frames_compared).toBe(40);
  });
});
