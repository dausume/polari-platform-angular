import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { of } from 'rxjs';

import { ClassRowsTableComponent } from './class-rows-table.component';
import { escapeFirst } from './escape-first';
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

  it('an Escape a picture already spent on its own selection leaves the picked row alone (one Escape clears one thing)', () => {
    component.selectField = 'session'; component.selectScope = 'session'; component.selectedValue = 'uno-light-ab12cd';
    const spent = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true });
    spent.preventDefault();
    component.onEscape(spent);
    expect(events.length).toBe(0);
    component.onEscape(new KeyboardEvent('keydown', { key: 'Escape', cancelable: true }));
    expect(events[0].payload).toEqual({ key: 'session', value: '' });
  });

  it('the page as it is wired: a picture takes the Escape in a listener that cannot prevent it, and the table\'s own document listener still leaves the row', () => {
    // On the live page every capture listener for keydown on the document is passive (the Material focus monitor registered first), so preventDefault()
    // does nothing there. An event that is not cancelable behaves the same way in a spec: the mark has to be the picture's own.
    component.selectField = 'session'; component.selectScope = 'session'; component.selectedValue = 'uno-light-ab12cd';
    fixture.detectChanges();
    let picture = true;                                         // the picture has a wire selected
    const drop = escapeFirst(() => { const had = picture; picture = false; return had; });
    const first = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
    document.body.dispatchEvent(first);
    expect(first.defaultPrevented).toBeFalse();
    expect(picture).toBeFalse();                                // the wire is cleared
    expect(events.length).toBe(0);                              // the session stays picked
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(events.map(e => e.payload)).toEqual([{ key: 'session', value: '' }]);   // the next Escape, nothing selected in the picture: the table's
    drop();
  });

  it('rowLinkTabField opens the tab named by the row (?tab=), without a scope event', () => {
    component.rowLinkTabField = 'solution';
    clickRow(1);
    expect(navigated[0].queryParams).toEqual({ tab: 's2' });
    expect(events.length).toBe(0);
  });

  it('rowLinkTabField + a selection: the click sets the scope to the row (even when it is already selected) AND opens the tab (hsp-3b)', () => {
    component.rowLinkTabField = 'label'; component.selectField = 'solution'; component.selectScope = 'solution'; component.selectedValue = 's2';
    clickRow(1);
    expect(events.length).toBe(1);
    expect(events[0].payload).toEqual({ key: 'solution', value: 's2' });
    expect(navigated[0].queryParams).toEqual({ tab: 'two' });
  });

  it('a dataPath with an empty param shows emptyText and does not ask the door', () => {
    component.dataPath = '/api/x?solution=&profile=p';
    component.emptyText = 'Pick a row first.';
    fixture.detectChanges();
    expect(requested.length).toBe(0);
    expect(fixture.nativeElement.textContent).toContain('Pick a row first.');
  });

  it('columnFormats score:fixed:1 shows one decimal and keeps the precise value in the tooltip', () => {
    component.dataPath = '/api/x?profile=p';
    component.columns = 'solution,score';
    component.columnFormats = 'score:fixed:1';
    (TestBed.inject(HttpClient) as any).get = () => of({ ok: true, rows: [{ solution: 's1', score: 99.9535 }] });
    fixture.detectChanges();
    const cell = fixture.nativeElement.querySelectorAll('tbody td')[1] as HTMLElement;
    expect(cell.textContent?.trim()).toBe('100.0');
    expect(cell.title).toBe('99.9535');
  });

  it('maxHeight caps the table box (it scrolls inside); without it there is no cap', () => {
    fixture.detectChanges();
    expect((fixture.nativeElement.querySelector('.class-rows-table') as HTMLElement).style.maxHeight).toBe('');
    component.maxHeight = 600;
    fixture.detectChanges();
    const box = fixture.nativeElement.querySelector('.class-rows-table') as HTMLElement;
    expect(box.style.maxHeight).toBe('600px');
    expect(box.classList).toContain('scrolls');
  });
});
