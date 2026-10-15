/**
 * fgm-1b — a Purpose drawing (category 'purpose') loads from and saves to its own doors
 * (GET/PUT /api/capabilities/{name}/solution), never by the generic CRUDE SolutionDefinition save.
 */
import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';

import { NoCodeSolutionStateService } from './no-code-solution-state.service';
import { SolutionManagerService } from './solution-manager.service';
import { PolariService } from '@services/polari-service';

const CACHE_KEY = 'polari-no-code-solutions-cache';
const BASE = 'http://backend.test';
const CRUDE = `${BASE}/SolutionDefinition`;
const DOOR = `${BASE}/api/capabilities/ensure-polari-can-control-light/solution`;

function state(name: string, cls: string, extra: any = {}): any {
  return { stateName: name, id: name, index: 0, stateClass: cls, boundObjectClass: cls, shapeType: 'rectangle',
    stateLocationX: 10, stateLocationY: 10, slots: [], boundObjectFieldValues: {}, ...extra };
}

function drawing(proofText: string): any {
  return {
    id: 0, solutionName: 'purpose-ensure-polari-can-control-light', xBounds: 1200, yBounds: 800,
    stateInstances: [
      state('statement', 'PurposeStatementState', { boundObjectFieldValues: { text: 'light' } }),
      state('proof', 'PurposeProofState', { boundObjectFieldValues: { status: proofText, kind: 'purpose-proof' } }),
    ],
  };
}

function crudeRows(): any {
  return { SolutionDefinition: [
    { id: 'p1', name: 'purpose-ensure-polari-can-control-light', category: 'purpose',
      definition: JSON.stringify(drawing('(worked out when asked)')) },
    { id: 'g1', name: 'Thing.generic', definition: JSON.stringify({
      id: 1, solutionName: 'Thing.generic', xBounds: 100, yBounds: 100, stateInstances: [] }) },
  ] };
}

describe('Purpose drawings through their doors (fgm-1b)', () => {
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

  function loadAndSelectPurpose(): void {
    service.initializeFromBackend();
    http.expectOne(r => r.method === 'GET' && r.url === CRUDE).flush(crudeRows());
    // the first row is the Purpose: selecting it asks the door, and shows ITS drawing
    http.expectOne(r => r.method === 'GET' && r.url === DOOR).flush({ ok: true, definition: drawing('proved') });
  }

  beforeEach(() => localStorage.removeItem(CACHE_KEY));
  afterEach(() => localStorage.removeItem(CACHE_KEY));

  it('selecting a purpose drawing calls the GET door and renders its definition', () => {
    make();
    loadAndSelectPurpose();
    expect(service.getSelectedSolutionName()).toBe('purpose-ensure-polari-can-control-light');
    const proof = service.getSelectedSolutionData()!.stateInstances.find(s => s.stateName === 'proof') as any;
    expect(proof.boundObjectFieldValues.status).toBe('proved');
    http.verify();
  });

  it('an edit goes to the PUT door and never to the CRUDE SolutionDefinition save, then re-reads the door', fakeAsync(() => {
    make();
    loadAndSelectPurpose();
    const name = 'purpose-ensure-polari-can-control-light';
    service.updateStateFieldValues(name, 'statement', { text: 'light, on request' });
    tick(2000);
    const put = http.expectOne(r => r.method === 'PUT' && r.url === DOOR);
    expect(put.request.body.stateInstances.find((s: any) => s.stateName === 'statement').boundObjectFieldValues.text)
      .toBe('light, on request');
    put.flush({ ok: true });
    const again = drawing('proved');
    (again.stateInstances[0] as any).boundObjectFieldValues.text = 'light, on request';
    http.expectOne(r => r.method === 'GET' && r.url === DOOR).flush({ ok: true, definition: again });
    http.expectNone(r => r.url === CRUDE);
    http.verify();
  }));

  it('moving a card is not an edit to save', fakeAsync(() => {
    make();
    loadAndSelectPurpose();
    service.updateStatePosition('purpose-ensure-polari-can-control-light', 'statement', 300, 300);
    tick(2000);
    http.expectNone(r => r.method !== 'GET');
    http.verify();
    expect(service.getSelectedSolutionName()).toBe('purpose-ensure-polari-can-control-light');
  }));

  it('a 422 is shown to the person with the server\'s words', fakeAsync(() => {
    make();
    loadAndSelectPurpose();
    let notice = '';
    service.purposeNotice$.subscribe(m => notice = m);
    service.updateStateFieldValues('purpose-ensure-polari-can-control-light', 'statement', { text: 'x' });
    tick(2000);
    http.expectOne(r => r.method === 'PUT' && r.url === DOOR)
      .flush({ ok: false, refused: true, error: 'the state "proof" is worked out and cannot be edited' }, { status: 422, statusText: 'Unprocessable' });
    expect(notice).toContain('not saved');
    expect(notice).toContain('the state "proof" is worked out and cannot be edited');
    http.verify();
  }));

  it('the three worked-out cards cannot be edited or deleted', () => {
    make();
    loadAndSelectPurpose();
    const name = 'purpose-ensure-polari-can-control-light';
    let notice = '';
    service.purposeNotice$.subscribe(m => notice = m);
    service.removeStateFromSolution(name, 'proof');
    service.updateStateFieldValues(name, 'proof', { status: 'hacked' });
    expect(service.renameState(name, 'proof', 'other')).toBeFalse();
    const proof = service.getSolutionData(name)!.stateInstances.find(s => s.stateName === 'proof') as any;
    expect(proof).toBeTruthy();
    expect(proof.boundObjectFieldValues.status).toBe('proved');
    expect(notice).toContain('worked out');
    service.updateStatePosition(name, 'proof', 5, 5); // moving is fine
    expect((service.getSolutionData(name)!.stateInstances.find(s => s.stateName === 'proof') as any).stateLocationX).toBe(5);
  });

  it('a non-purpose solution still uses the generic CRUDE path, with no door calls', fakeAsync(() => {
    make();
    service.initializeFromBackend();
    http.expectOne(r => r.method === 'GET' && r.url === CRUDE).flush(crudeRows());
    http.expectOne(r => r.method === 'GET' && r.url === DOOR).flush({ ok: true, definition: drawing('proved') });
    service.selectSolution('Thing.generic');
    const data = service.getSolutionData('Thing.generic')!;
    service.updateSolutionData('Thing.generic', { ...data });
    tick(2000);
    const crude = http.expectOne(r => r.method === 'PUT' && r.url === CRUDE);
    expect(crude.request.body instanceof FormData).toBeTrue();
    crude.flush({});
    http.expectNone(r => r.url.includes('/api/capabilities'));
    http.verify();
  }));
});
