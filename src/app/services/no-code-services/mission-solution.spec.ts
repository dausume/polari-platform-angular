/**
 * mis-0 - a Hardware Mission drawing (category 'mission') loads from and saves to its own doors
 * (GET/PUT /api/missions/{name}/solution), never by the generic CRUDE SolutionDefinition save; its worked-out cards are read-only;
 * a Purpose state links into that Purpose's own drawing.
 */
import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';

import { NoCodeSolutionStateService } from './no-code-solution-state.service';
import { SolutionManagerService } from './solution-manager.service';
import { PolariService } from '@services/polari-service';
import { missionPurposeLinks } from '../../components/custom-no-code/mission-links';

const CACHE_KEY = 'polari-no-code-solutions-cache';
const BASE = 'http://backend.test';
const CRUDE = `${BASE}/SolutionDefinition`;
const DOOR = `${BASE}/api/missions/uno-light-mission/solution`;
const NAME = 'mission-uno-light-mission';

function state(name: string, cls: string, extra: any = {}): any {
  return { stateName: name, id: name, index: 0, stateClass: cls, boundObjectClass: cls, shapeType: 'rectangle',
    stateLocationX: 10, stateLocationY: 10, slots: [], boundObjectFieldValues: {}, ...extra };
}

function drawing(resolution: string): any {
  return {
    id: 0, solutionName: NAME, xBounds: 1200, yBounds: 800,
    stateInstances: [
      state('settings', 'MissionSettingsState', { boundObjectFieldValues: { objective: 'minimum-resources' } }),
      state('purpose-initialization', 'MissionPurposeState', { boundObjectFieldValues: {
        purpose_name: 'initialization', importance: 'required', status: 'planned', displayName: 'Required: Initialization',
        links: [{ label: 'This Purpose\'s own drawing', route: '/display/hardware-solutions?solution=purpose-initialization' }] } }),
      state('resolution', 'MissionResolutionState', { boundObjectFieldValues: { resolution, kind: 'mission-resolution' } }),
    ],
  };
}

function crudeRows(): any {
  return { SolutionDefinition: [
    { id: 'm1', name: NAME, category: 'mission', definition: JSON.stringify(drawing('(worked out when asked)')) },
    { id: 'g1', name: 'Thing.generic', definition: JSON.stringify({ id: 1, solutionName: 'Thing.generic', xBounds: 100, yBounds: 100, stateInstances: [] }) },
  ] };
}

describe('Mission drawings through their doors (mis-0)', () => {
  let service: NoCodeSolutionStateService;
  let http: HttpTestingController;

  function make(): void {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        NoCodeSolutionStateService, SolutionManagerService,
        { provide: PolariService, useValue: { getBackendBaseUrl: () => BASE, backendRequestOptions: {} } },
      ],
    });
    service = TestBed.inject(NoCodeSolutionStateService);
    http = TestBed.inject(HttpTestingController);
  }

  function loadAndSelectMission(): void {
    service.initializeFromBackend();
    http.expectOne(r => r.method === 'GET' && r.url === CRUDE).flush(crudeRows());
    http.expectOne(r => r.method === 'GET' && r.url === DOOR).flush({ ok: true, definition: drawing('resolved') });
  }

  beforeEach(() => localStorage.removeItem(CACHE_KEY));
  afterEach(() => localStorage.removeItem(CACHE_KEY));

  it('selecting a mission drawing calls the GET door and renders its definition', () => {
    make();
    loadAndSelectMission();
    expect(service.getSelectedSolutionName()).toBe(NAME);
    expect(service.isMissionSolution(NAME)).toBeTrue();
    expect(service.isPurposeSolution(NAME)).toBeFalse();
    const res = service.getSelectedSolutionData()!.stateInstances.find(s => s.stateName === 'resolution') as any;
    expect(res.boundObjectFieldValues.resolution).toBe('resolved');
    http.verify();
  });

  it('an edit goes to the PUT door (debounced), never to the CRUDE save, then re-reads the door', fakeAsync(() => {
    make();
    loadAndSelectMission();
    service.updateStateFieldValues(NAME, 'settings', { objective: 'fastest-cycle' });
    tick(2000);
    const put = http.expectOne(r => r.method === 'PUT' && r.url === DOOR);
    expect(put.request.body.stateInstances.find((s: any) => s.stateName === 'settings').boundObjectFieldValues.objective).toBe('fastest-cycle');
    put.flush({ ok: true });
    const again = drawing('resolved');
    (again.stateInstances[0] as any).boundObjectFieldValues.objective = 'fastest-cycle';
    http.expectOne(r => r.method === 'GET' && r.url === DOOR).flush({ ok: true, definition: again });
    http.expectNone(r => r.url === CRUDE);
    http.verify();
  }));

  it('moving a card is not an edit to save', fakeAsync(() => {
    make();
    loadAndSelectMission();
    service.updateStatePosition(NAME, 'settings', 300, 300);
    tick(2000);
    http.expectNone(r => r.method !== 'GET');
    http.verify();
  }));

  it('a 422 is shown to the person with the server\'s words', fakeAsync(() => {
    make();
    loadAndSelectMission();
    let notice = '';
    service.purposeNotice$.subscribe(m => notice = m);
    service.updateStateFieldValues(NAME, 'settings', { objective: 'cheapest' });
    tick(2000);
    http.expectOne(r => r.method === 'PUT' && r.url === DOOR)
      .flush({ ok: false, refused: true, error: "state 'settings' - aim 'cheapest' is not one of minimum-resources, fastest-cycle" }, { status: 422, statusText: 'Unprocessable' });
    expect(notice).toContain('not saved');
    expect(notice).toContain('cheapest');
    http.verify();
  }));

  it('the resolution card and the worked-out fields of a Purpose card cannot be edited; importance can', fakeAsync(() => {
    make();
    loadAndSelectMission();
    let notice = '';
    service.purposeNotice$.subscribe(m => notice = m);
    service.updateStateFieldValues(NAME, 'resolution', { resolution: 'hacked' });
    service.updateStateFieldValues(NAME, 'purpose-initialization', { status: 'proven-on-hardware' });
    const get = (n: string) => service.getSolutionData(NAME)!.stateInstances.find(s => s.stateName === n) as any;
    expect(get('resolution').boundObjectFieldValues.resolution).toBe('resolved');
    expect(get('purpose-initialization').boundObjectFieldValues.status).toBe('planned');
    expect(notice).toContain('worked out');
    service.updateStateFieldValues(NAME, 'purpose-initialization', { importance: 'safety' });
    expect(get('purpose-initialization').boundObjectFieldValues.importance).toBe('safety');
    tick(2000);
    http.expectOne(r => r.method === 'PUT' && r.url === DOOR).flush({ ok: true });
    http.expectOne(r => r.method === 'GET' && r.url === DOOR).flush({ ok: true, definition: drawing('resolved') });
    http.verify();
  }));

  it('a non-mission solution still uses the generic CRUDE path, with no door calls', fakeAsync(() => {
    make();
    service.initializeFromBackend();
    http.expectOne(r => r.method === 'GET' && r.url === CRUDE).flush(crudeRows());
    http.expectOne(r => r.method === 'GET' && r.url === DOOR).flush({ ok: true, definition: drawing('resolved') });
    service.selectSolution('Thing.generic');
    const data = service.getSolutionData('Thing.generic')!;
    service.updateSolutionData('Thing.generic', { ...data });
    tick(2000);
    const crude = http.expectOne(r => r.method === 'PUT' && r.url === CRUDE);
    crude.flush({});
    http.expectNone(r => r.url.includes('/api/missions'));
    http.verify();
  }));

  it('a Mission Purpose state links into that Purpose\'s own drawing', () => {
    const links = missionPurposeLinks(drawing('resolved').stateInstances);
    expect(links).toEqual([{ label: 'Required: Initialization', solution: 'purpose-initialization' }]);
    expect(missionPurposeLinks(null)).toEqual([]);
    expect(missionPurposeLinks([state('x', 'MissionSettingsState')])).toEqual([]);
  });
});
