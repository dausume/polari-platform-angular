import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { of } from 'rxjs';

import { ClassRowsTableComponent } from './class-rows-table.component';
import { PolariService } from '@services/polari-service';
import { CRUDEservicesManager } from '@services/crude-services-manager';
import { AuthSessionService } from '@services/auth/auth-session.service';
import { PeopleService } from '@services/people.service';
import { DisplayEvent, DisplayEventsService } from '@services/no-code-services/display-events.service';

/** fsc-3: class-rows-table's optional row interaction (page-scope selection, tab link, empty-scope words). */
describe('ClassRowsTableComponent — row interaction (fsc-3)', () => {
  let fixture: ComponentFixture<ClassRowsTableComponent>;
  let component: ClassRowsTableComponent;
  let requested: string[];
  let events: DisplayEvent[];
  let navigated: any[];
  const rows = [{ solution: 's1', label: 'one' }, { solution: 's2', label: 'two' }];

  beforeEach(() => {
    requested = [];
    events = [];
    navigated = [];
    TestBed.configureTestingModule({
      imports: [ClassRowsTableComponent],
      providers: [
        { provide: HttpClient, useValue: { get: (url: string) => { requested.push(url); return of({ ok: true, rows }); } } },
        { provide: PolariService, useValue: { getBackendBaseUrl: () => '', backendRequestOptions: {} } },
        { provide: CRUDEservicesManager, useValue: {} },
        { provide: AuthSessionService, useValue: {} },
        { provide: PeopleService, useValue: {} },
        { provide: Router, useValue: { navigate: (cmds: any[], extras: any) => { navigated.push(extras); return Promise.resolve(true); } } },
      ],
    });
    TestBed.inject(DisplayEventsService).displayEvents$.subscribe((e) => events.push(e));
    fixture = TestBed.createComponent(ClassRowsTableComponent);
    component = fixture.componentInstance;
    component.dataPath = '/api/x?profile=p';
    component.columns = 'solution,label';
  });

  function clickRow(i: number): void {
    fixture.detectChanges();
    (fixture.nativeElement.querySelectorAll('tbody tr')[i] as HTMLElement).click();
  }

  it('a table without the options is not clickable and a click does nothing', () => {
    clickRow(0);
    expect(component.clickable).toBeFalse();
    expect(events.length).toBe(0);
    expect(navigated.length).toBe(0);
  });

  it('a click sets the page scope key to the row value', () => {
    component.selectField = 'solution'; component.selectScope = 'solution';
    clickRow(1);
    expect(events.length).toBe(1);
    expect(events[0].name).toBe('setScope');
    expect(events[0].payload).toEqual({ key: 'solution', value: 's2' });
  });

  it('a second click on the selected row clears it (click-toggle rule), and the selected row is marked', () => {
    component.selectField = 'solution'; component.selectScope = 'solution'; component.selectedValue = 's1';
    clickRow(0);
    expect(events[0].payload).toEqual({ key: 'solution', value: '' });
    expect(fixture.nativeElement.querySelectorAll('tbody tr')[0].classList).toContain('selected');
    expect(fixture.nativeElement.querySelectorAll('tbody tr')[1].classList).not.toContain('selected');
  });

  it('Escape clears a selection, and does nothing when nothing is selected', () => {
    component.selectField = 'solution'; component.selectScope = 'solution'; component.selectedValue = 's1';
    component.onEscape();
    expect(events[0].payload).toEqual({ key: 'solution', value: '' });
    component.selectedValue = '';
    component.onEscape();
    expect(events.length).toBe(1);
  });

  it('rowLinkTabField opens the tab named by the row (?tab=), without a scope event', () => {
    component.rowLinkTabField = 'solution';
    clickRow(1);
    expect(navigated[0].queryParams).toEqual({ tab: 's2' });
    expect(events.length).toBe(0);
  });

  it('a dataPath with an empty param shows emptyText and does not ask the door', () => {
    component.dataPath = '/api/x?solution=&profile=p';
    component.emptyText = 'Pick a row first.';
    fixture.detectChanges();
    expect(requested.length).toBe(0);
    expect(fixture.nativeElement.textContent).toContain('Pick a row first.');
  });
});
