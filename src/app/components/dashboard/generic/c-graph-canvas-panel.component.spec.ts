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
 * demo-4 — THE ADAPTER: a cmod CGraph opened in the EXISTING no-code canvas via a one-node SolutionDefinition.
 *
 * What must hold: on load it creates (once) a solution named `cmod.c-canvas.<graph>` holding exactly one
 * HardwareSubgraph node bound to that graph, then selects it through the SAME service the native selector uses — it
 * never duplicates the solution on a second load; picking a different graph from the dropdown swaps the open
 * solution; Render/Build/Prove call the graph's own doors and show the verdict as fields, never raw JSON; a refusal's
 * words are shown.
 */
describe('CGraphCanvasPanelComponent (demo-4)', () => {
  const BASE = 'http://backend.test';
  let fixture: ComponentFixture<CGraphCanvasPanelComponent>;
  let comp: CGraphCanvasPanelComponent;
  let http: HttpTestingController;
  let solutionState: jasmine.SpyObj<NoCodeSolutionStateService>;
  let loading$: BehaviorSubject<boolean>;
  let known: Set<string>;
  let navigateSpy: jasmine.Spy;

  async function make() {
    loading$ = new BehaviorSubject<boolean>(true);
    known = new Set<string>();
    navigateSpy = jasmine.createSpy('navigate');
    solutionState = jasmine.createSpyObj('NoCodeSolutionStateService', [
      'getSolutionData', 'createNewSolution', 'addStateToSolution', 'selectSolution',
    ], { loading$ });
    solutionState.getSolutionData.and.callFake((name: string) => (known.has(name) ? ({ solutionName: name } as any) : undefined));
    solutionState.createNewSolution.and.callFake((name: string) => { known.add(name); });

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

  afterEach(() => http.verify());

  it('creates ONE solution holding a HardwareSubgraph node bound to the default graph, then selects it', async () => {
    await make();
    expect(solutionState.createNewSolution).toHaveBeenCalledTimes(1);
    expect(solutionState.createNewSolution.calls.argsFor(0)[0]).toBe('cmod.c-canvas.uno-sim-rig-graph');
    expect(solutionState.addStateToSolution).toHaveBeenCalledTimes(1);
    const [name, state] = solutionState.addStateToSolution.calls.argsFor(0);
    expect(name).toBe('cmod.c-canvas.uno-sim-rig-graph');
    expect((state as any).stateClass).toBe('HardwareSubgraph');
    expect((state as any).boundObjectFieldValues.cgraph).toBe('uno-sim-rig-graph');
    expect(solutionState.selectSolution).toHaveBeenCalledWith('cmod.c-canvas.uno-sim-rig-graph');
  });

  it('a SECOND open of the same graph selects the existing solution — never a duplicate create', async () => {
    await make();
    (comp as any).openSolutionFor('uno-sim-rig-graph');
    expect(solutionState.createNewSolution).toHaveBeenCalledTimes(1);   // still just the once
    expect(solutionState.selectSolution).toHaveBeenCalledTimes(2);
  });

  it('ensures + selects exactly once across repeated change-detection cycles and loading$ re-emissions, and never navigates (demo-4 infinite-loop regression guard)', async () => {
    await make();

    // Churn the inputs the real app could churn without destroying this component
    // instance: more change-detection ticks, and loading$ toggling again (as it
    // would on a second initializeFromBackend() call). ngOnInit's take(1) on
    // loading$ — and the fact ngOnChanges only re-opens on an actual `graph`
    // input change — must keep ensure+select to exactly one call each.
    for (let i = 0; i < 5; i++) {
      loading$.next(true);
      loading$.next(false);
      fixture.detectChanges();
    }
    // ngOnChanges with no real change to `graph` must not re-open either.
    comp.ngOnChanges({});
    fixture.detectChanges();

    expect(solutionState.createNewSolution).toHaveBeenCalledTimes(1);
    expect(solutionState.addStateToSolution).toHaveBeenCalledTimes(1);
    expect(solutionState.selectSolution).toHaveBeenCalledTimes(1);
    expect(navigateSpy).not.toHaveBeenCalled();
  });

  it('picking a different graph opens a differently-named solution', async () => {
    await make();
    comp.pick('uno-temp-split-graph');
    expect(solutionState.createNewSolution).toHaveBeenCalledWith('cmod.c-canvas.uno-temp-split-graph', jasmine.anything());
    expect(solutionState.selectSolution).toHaveBeenCalledWith('cmod.c-canvas.uno-temp-split-graph');
  });

  it('Render shows the graph/files sha and cost as fields, never a JSON wall', async () => {
    await make();
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
    comp.doBuild();
    http.expectOne(`${BASE}/api/cmod/graphs/uno-sim-rig-graph/build`).flush(
      { ok: false, refused: 'uno-sim-rig-graph is not rendered yet' }, { status: 422, statusText: 'Unprocessable' });
    http.match(`${BASE}/api/cmod/graphs/uno-sim-rig-graph`).forEach(r => r.flush({ ok: true, glue_builds: [] }));
    expect(comp.buildResult.ok).toBeFalse();
    expect(comp.buildResult.refused).toContain('not rendered yet');
  });

  it('Prove posts to the prove door and shows EQUIVALENT with the frame count', async () => {
    await make();
    comp.doProve();
    http.expectOne(`${BASE}/api/cmod/graphs/uno-sim-rig-graph/prove`).flush(
      { ok: true, equivalent: true, frames_compared: 40, hex_identical: true, n_differences: 0, differences: [] });
    http.match(`${BASE}/api/cmod/graphs/uno-sim-rig-graph`).forEach(r => r.flush({ ok: true, glue_builds: [] }));
    expect(comp.proveResult.equivalent).toBeTrue();
    expect(comp.proveResult.frames_compared).toBe(40);
  });
});
