/**
 * Regression specs — prf-urgent selfix 2026-10-05 (dev-selfix).
 *
 * Live symptom: on the deployed no-code canvas, clicking a different Object in the dropdown did
 * nothing (stuck on whatever was selected), and a FRESH page load got its URL rewritten away from
 * the requested `object=`/`focusSolution=` to a stale/unrelated solution with an EMPTY canvas.
 *
 * Root cause (confirmed via a live localStorage dump + browser repro): c-graph-canvas-panel shares
 * the GLOBAL NoCodeSolutionStateService singleton with /custom-no-code. Its "ensure" adapter path
 * creates a synthesized, read-only `cmod.c-canvas.<graph>` solution and selects it through that SAME
 * service — which (a) wrote it to the backend SolutionDefinition table (`createSolution` fired by
 * `scheduleBackendSave()`), making `cmod` show up as a real Object for EVERY visitor, and (b) wrote
 * the panel's selection into the `polari-no-code-solutions-cache` localStorage key as the user's
 * "last selected solution" — so visiting a /display page and then reloading /custom-no-code restored
 * a solution that has nothing to do with the object actually requested, with nothing on the canvas.
 *
 * Also covers dev-loopfix's own regression spec intent (no reload storm) so the fix here doesn't
 * reintroduce it: a locally-created, not-yet-backend-confirmed solution must still survive a
 * same-session initializeFromBackend() refresh.
 */
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { NoCodeSolutionStateService } from './no-code-solution-state.service';
import { SolutionManagerService } from './solution-manager.service';
import { NoCodeSolutionRawData } from '@models/noCode/mock-NCS-data';

const CACHE_KEY = 'polari-no-code-solutions-cache';
const CURRENT_CACHE_VERSION = 10;

function sol(name: string, id: number): NoCodeSolutionRawData {
  return { id, solutionName: name, xBounds: 100, yBounds: 100, stateInstances: [] };
}

describe('NoCodeSolutionStateService', () => {
  let service: NoCodeSolutionStateService;
  let manager: jasmine.SpyObj<SolutionManagerService>;

  function make(): NoCodeSolutionStateService {
    manager = jasmine.createSpyObj('SolutionManagerService', [
      'loadAllSolutions', 'createSolution', 'saveSolution', 'deleteSolution',
    ]);
    manager.loadAllSolutions.and.returnValue(of([]));
    manager.createSolution.and.returnValue(of({ id: 'backend-id' }));
    manager.saveSolution.and.returnValue(of({}));
    manager.deleteSolution.and.returnValue(of({}));

    TestBed.configureTestingModule({
      providers: [
        NoCodeSolutionStateService,
        { provide: SolutionManagerService, useValue: manager },
      ],
    });
    return TestBed.inject(NoCodeSolutionStateService);
  }

  beforeEach(() => {
    localStorage.removeItem(CACHE_KEY);
  });

  afterEach(() => {
    localStorage.removeItem(CACHE_KEY);
  });

  describe('object/solution selection after a backend load', () => {
    it('selecting the second object\'s solution actually changes the selection (dropdown onObjectChange flow)', () => {
      service = make();
      manager.loadAllSolutions.and.returnValue(of([
        sol('AdditionTester.test_addition', 1),
        sol('pendulum-2d.bob.gravity-force', 2),
        sol('pendulum-2d.bob.integrator', 3),
      ]));
      service.initializeFromBackend();
      expect(service.getSelectedSolutionName()).toBe('AdditionTester.test_addition');

      // Mirrors CustomNoCodeComponent.onObjectChange('pendulum-2d') picking the first
      // solution filtered for that object and calling selectSolution() on it.
      service.selectSolution('pendulum-2d.bob.gravity-force');

      expect(service.getSelectedSolutionName()).toBe('pendulum-2d.bob.gravity-force');
      expect(service.getSelectedSolutionData()?.solutionName).toBe('pendulum-2d.bob.gravity-force');
    });
  });

  describe('synthesized canvas solutions never pollute the Object/Solution list', () => {
    it('a `cmod.c-canvas.<graph>` solution created locally does not appear in availableSolutions$', () => {
      service = make();
      manager.loadAllSolutions.and.returnValue(of([sol('AdditionTester.test_addition', 1)]));
      service.initializeFromBackend();

      service.createNewSolution('cmod.c-canvas.uno-sim-rig-graph', { targetRuntime: 'typescript_frontend' as any });

      const names = service.getAvailableSolutions().map(s => s.name);
      expect(names).toContain('AdditionTester.test_addition');
      expect(names).not.toContain('cmod.c-canvas.uno-sim-rig-graph');
    });

    it('a `cmod.c-canvas.<graph>` row that already leaked onto the BACKEND is also hidden from the list', () => {
      service = make();
      manager.loadAllSolutions.and.returnValue(of([
        sol('AdditionTester.test_addition', 1),
        sol('cmod.c-canvas.uno-sim-rig-graph', 2),
      ]));
      service.initializeFromBackend();

      const names = service.getAvailableSolutions().map(s => s.name);
      expect(names).toContain('AdditionTester.test_addition');
      expect(names).not.toContain('cmod.c-canvas.uno-sim-rig-graph');
    });
  });

  describe('persistence: the panel must not poison the shared "last selected solution"', () => {
    it('selectSolution(name, false) updates the live selection but does NOT persist it to localStorage', () => {
      service = make();
      manager.loadAllSolutions.and.returnValue(of([
        sol('AdditionTester.test_addition', 1),
        sol('uno-temp-split', 2),
      ]));
      service.initializeFromBackend();

      // Simulates c-graph-canvas-panel opening a real solution by name on a /display page.
      service.selectSolution('uno-temp-split', false);
      expect(service.getSelectedSolutionName()).toBe('uno-temp-split');

      const raw = localStorage.getItem(CACHE_KEY);
      expect(raw).not.toBeNull();
      const cached = JSON.parse(raw!);
      expect(cached.selectedSolutionName).not.toBe('uno-temp-split');
    });

    it('a synthesized `cmod.c-canvas.*` solution is never written into the persisted cache, selected or not', () => {
      service = make();
      manager.loadAllSolutions.and.returnValue(of([sol('AdditionTester.test_addition', 1)]));
      service.initializeFromBackend();

      service.createNewSolution('cmod.c-canvas.uno-sim-rig-graph', { targetRuntime: 'typescript_frontend' as any });
      service.selectSolution('cmod.c-canvas.uno-sim-rig-graph', false);

      const cached = JSON.parse(localStorage.getItem(CACHE_KEY)!);
      expect(cached.solutions['cmod.c-canvas.uno-sim-rig-graph']).toBeUndefined();
      expect(cached.selectedSolutionName).not.toBe('cmod.c-canvas.uno-sim-rig-graph');
    });
  });

  describe('cache version bump discards already-poisoned caches', () => {
    it('reports the bumped CACHE_VERSION so an old (poisoned) cache is ignored on first load after the roll', () => {
      localStorage.setItem(CACHE_KEY, JSON.stringify({
        solutions: { 'uno-temp-split': sol('uno-temp-split', 2) },
        selectedSolutionName: 'uno-temp-split',
        lastUpdated: Date.now(),
        version: 9,
      }));
      service = make();
      // A stale v9 cache must not seed the selection before the backend ever responds.
      expect(service.getSelectedSolutionName()).toBeNull();
      expect(service.getAvailableSolutions().length).toBe(0);
    });

    it('a cache already saved under the CURRENT version is still honored (sanity check on the constant)', () => {
      localStorage.setItem(CACHE_KEY, JSON.stringify({
        solutions: { 'AdditionTester.test_addition': sol('AdditionTester.test_addition', 1) },
        selectedSolutionName: 'AdditionTester.test_addition',
        lastUpdated: Date.now(),
        version: CURRENT_CACHE_VERSION,
      }));
      service = make();
      expect(service.getSelectedSolutionName()).toBe('AdditionTester.test_addition');
    });
  });

  describe('a restored/previous selection must be dropped if the backend no longer knows its object', () => {
    it('falls back to a real backend solution when the sticky selection\'s object is gone from the backend', () => {
      // Seed a persisted cache the way a poisoned prior session would (pre-fix) — a selection
      // left over from a /display page, for an object the CURRENT backend response doesn't have.
      localStorage.setItem(CACHE_KEY, JSON.stringify({
        solutions: {
          'uno-temp-split': sol('uno-temp-split', 2),
          'AdditionTester.test_addition': sol('AdditionTester.test_addition', 1),
        },
        selectedSolutionName: 'uno-temp-split',
        lastUpdated: Date.now(),
        version: CURRENT_CACHE_VERSION,
      }));
      service = make();
      expect(service.getSelectedSolutionName()).toBe('uno-temp-split'); // tentative, pre-backend

      // The backend's current object list no longer includes `uno-temp-split` at all.
      manager.loadAllSolutions.and.returnValue(of([sol('AdditionTester.test_addition', 1)]));
      service.initializeFromBackend();

      expect(service.getSelectedSolutionName()).toBe('AdditionTester.test_addition');
    });

    it('keeps the sticky selection when the backend DOES still confirm that object (no unnecessary reselect)', () => {
      localStorage.setItem(CACHE_KEY, JSON.stringify({
        solutions: { 'pendulum-2d.bob.integrator': sol('pendulum-2d.bob.integrator', 3) },
        selectedSolutionName: 'pendulum-2d.bob.integrator',
        lastUpdated: Date.now(),
        version: CURRENT_CACHE_VERSION,
      }));
      service = make();
      manager.loadAllSolutions.and.returnValue(of([
        sol('pendulum-2d.bob.integrator', 3),
        sol('AdditionTester.test_addition', 1),
      ]));
      service.initializeFromBackend();

      expect(service.getSelectedSolutionName()).toBe('pendulum-2d.bob.integrator');
    });
  });

  describe('dev-loopfix regression guard — must still pass', () => {
    it('preserves a locally-created, not-yet-backend-confirmed solution across a same-session backend refresh', () => {
      service = make();
      manager.loadAllSolutions.and.returnValue(of([sol('AdditionTester.test_addition', 1)]));
      service.initializeFromBackend();

      // User creates a brand-new, real (non-hidden) solution this session; its backend create is
      // debounced 2s out, so it has no backendId yet when a refresh lands.
      service.createNewSolution('NewThing.do_it', { targetRuntime: 'typescript_frontend' as any });
      service.selectSolution('NewThing.do_it');

      // A refresh (e.g. a STOMP SolutionDefinition notification) runs before the debounced save.
      manager.loadAllSolutions.and.returnValue(of([sol('AdditionTester.test_addition', 1)]));
      service.initializeFromBackend();

      expect(service.getSolutionData('NewThing.do_it')).toBeDefined();
      expect(service.getSelectedSolutionName()).toBe('NewThing.do_it');
    });
  });
});
