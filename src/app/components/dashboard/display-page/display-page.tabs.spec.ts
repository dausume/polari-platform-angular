import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { BehaviorSubject, of } from 'rxjs';
import { convertToParamMap } from '@angular/router';

import { DisplayPageComponent } from './display-page';
import { PolariService } from '@services/polari-service';
import { CRUDEservicesManager } from '@services/crude-services-manager';
import { AuthSessionService } from '@services/auth/auth-session.service';
import { PeopleService } from '@services/people.service';
import { DisplayEventsService } from '@services/no-code-services/display-events.service';

/**
 * fsc-3b: the REAL display-page with a tabbed definition and two real class-rows-tables, over a stub backend. This is the test that was missing when a
 * picked row did nothing in the deployed build (the tab's inputs were rewritten in place, so the `{scope:..}` placeholders were gone after the first render).
 */
describe('DisplayPageComponent — tabs with two tables sharing a scope (fsc-3b)', () => {
  let fixture: ComponentFixture<DisplayPageComponent>;
  let requested: string[];
  let params$: BehaviorSubject<any>;
  let query$: BehaviorSubject<any>;
  let profiles: any[];

  const item = (id: string, inputs: any) => ({
    id, index: 0, type: 'component', rowSegmentsUsed: 12, gridColumnStart: null, title: id, description: '', visible: true, collapsed: false, cssClass: '',
    componentProps: { componentName: 'class-rows-table', inputs }, item: null, nestedRows: [],
  });
  const row = (index: number, items: any[]) => ({ index, rowSegments: 12, minRowHeight: 100, items });

  const definition = {
    tabs: [
      {
        key: 'rank', title: 'Rank', rows: [
          row(0, [item('ranked', { dataPath: '/api/ranked?rev=r{scope:rev}', columns: 'solution,score', selectField: 'solution', selectScope: 'solution', selectedValue: '{scope:solution}' })]),
          row(1, [item('breakdown', { dataPath: '/api/breakdown?solution={scope:solution}', columns: 'label,points', emptyText: 'Click a solution first.' })]),
        ],
      },
      {
        key: 'edit', title: 'Editor', rows: [
          row(0, [item('profiles', {
            dataPath: '/api/profiles?rev=r{scope:rev}', columns: 'name,seeded', selectField: 'name', selectScope: 'profile', selectedValue: '{scope:profile}',
            rowAction: { label: 'Copy to edit', method: 'POST', path: '/api/profiles', show_when_field: 'seeded', body_template: { name: 'my-{name}' }, then_scope: { key: 'profile', from: 'name' } },
          })]),
          row(1, [item('terms', { dataPath: '/api/terms/{scope:profile}/x?rev=r{scope:rev}', columns: 'label,weight', emptyText: 'Pick a profile.' })]),
        ],
      },
    ],
  };

  beforeEach(() => {
    requested = [];
    profiles = [{ name: 'fast', seeded: true }];
    params$ = new BehaviorSubject(convertToParamMap({ id: 'fw' }));
    query$ = new BehaviorSubject(convertToParamMap({ tab: 'rank' }));
    const http = {
      get: (url: string) => {
        requested.push(url);
        if (url.endsWith('/DisplayDefinition')) {
          return of([{ DisplayDefinition: [{ class: 'DisplayDefinition', data: [{ id: 'fw', name: 'fw', definition: JSON.stringify(definition) }] }] }]);
        }
        if (url.includes('/api/ranked')) { return of({ ok: true, rows: [{ solution: 's1', score: 100 }, { solution: 's2', score: 40 }] }); }
        if (url.includes('/api/breakdown')) { return of({ ok: true, rows: [{ label: 'cycle', points: 3 }] }); }
        if (url.includes('/api/profiles')) { return of({ ok: true, rows: profiles.map((p) => ({ ...p })) }); }
        if (url.includes('/x?rev')) { return of({ ok: true, rows: [{ label: 'cost', weight: 1 }] }); }
        return of({ ok: true, rows: [] });
      },
      post: (url: string, body: any) => {
        profiles = [...profiles, { name: body.name, seeded: false }];
        return of({ ok: true, name: body.name });
      },
    };
    TestBed.configureTestingModule({
      imports: [DisplayPageComponent],
      providers: [
        { provide: HttpClient, useValue: http },
        { provide: PolariService, useValue: { getBackendBaseUrl: () => '', backendRequestOptions: {} } },
        { provide: CRUDEservicesManager, useValue: {} },
        { provide: AuthSessionService, useValue: {} },
        { provide: PeopleService, useValue: {} },
        { provide: Router, useValue: { navigate: () => Promise.resolve(true) } },
        { provide: ActivatedRoute, useValue: { paramMap: params$.asObservable(), queryParamMap: query$.asObservable() } },
      ],
    });
    fixture = TestBed.createComponent(DisplayPageComponent);
    fixture.detectChanges(false);   // no checkNoChanges: the renderer measures its own width after view init (a dev-mode-only complaint)
  });

  const el = (): HTMLElement => fixture.nativeElement;
  const tableRows = (n: number) => Array.from(el().querySelectorAll('class-rows-table')[n].querySelectorAll('tbody tr')) as HTMLElement[];
  const settle = () => { fixture.detectChanges(false); fixture.detectChanges(false); };

  it('clicking a ranked row highlights it and loads the second table for that row', () => {
    settle();
    expect(tableRows(0).length).toBe(2);
    expect(el().querySelectorAll('class-rows-table')[1].textContent).toContain('Click a solution first.');
    tableRows(0)[1].click();
    settle();
    expect(tableRows(0)[1].classList).toContain('selected');
    expect(requested.some((u) => u.includes('/api/breakdown?solution=s2'))).toBeTrue();
    expect(tableRows(1).length).toBe(1);
  });

  it('a second click on the same row puts it down again, and the ranked table is not fetched again', () => {
    settle();
    const rankedFetches = () => requested.filter((u) => u.includes('/api/ranked')).length;
    const before = rankedFetches();
    tableRows(0)[0].click(); settle();
    tableRows(0)[0].click(); settle();
    expect(tableRows(0)[0].classList).not.toContain('selected');
    expect(el().querySelectorAll('class-rows-table')[1].textContent).toContain('Click a solution first.');
    expect(rankedFetches()).toBe(before);
  });

  it('picking works more than once (the placeholders survive every render)', () => {
    settle();
    tableRows(0)[0].click(); settle();
    tableRows(0)[1].click(); settle();
    expect(tableRows(0)[1].classList).toContain('selected');
    expect(tableRows(0)[0].classList).not.toContain('selected');
    expect(requested.some((u) => u.includes('/api/breakdown?solution=s2'))).toBeTrue();
  });

  it('Copy to edit refreshes the list, picks the copy and loads its terms', () => {
    query$.next(convertToParamMap({ tab: 'edit' }));
    settle();
    expect(tableRows(0).length).toBe(1);
    expect(el().querySelectorAll('class-rows-table')[1].textContent).toContain('Pick a profile.');
    (el().querySelector('button.act') as HTMLElement).click();
    settle();
    expect(tableRows(0).length).toBe(2);
    expect(requested.some((u) => u.includes('/api/terms/my-fast/x'))).toBeTrue();
    expect(tableRows(0)[1].classList).toContain('selected');
  });

  it('a scope event from outside re-renders the open tab without a new page load', () => {
    settle();
    const loads = () => requested.filter((u) => u.endsWith('/DisplayDefinition')).length;
    const before = loads();
    TestBed.inject(DisplayEventsService).dispatch({ name: 'setScope', payload: { key: 'solution', value: 's1' }, sourceState: '', channel: 'frontend' });
    settle();
    expect(loads()).toBe(before);
    expect(tableRows(0)[0].classList).toContain('selected');
  });
});
