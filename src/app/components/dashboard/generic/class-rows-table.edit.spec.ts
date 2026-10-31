import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';

import { ClassRowsTableComponent } from './class-rows-table.component';
import { PolariService } from '@services/polari-service';
import { CRUDEservicesManager } from '@services/crude-services-manager';
import { AuthSessionService } from '@services/auth/auth-session.service';
import { PeopleService } from '@services/people.service';
import { DisplayEvent, DisplayEventsService } from '@services/no-code-services/display-events.service';

/** fsc-3: class-rows-table's generic EDIT (editable numeric column -> a configured door) and ROW ACTION (Copy to edit) options. */
describe('ClassRowsTableComponent — editing and row actions (fsc-3)', () => {
  let fixture: ComponentFixture<ClassRowsTableComponent>;
  let component: ClassRowsTableComponent;
  let posts: { url: string; body: any }[];
  let events: DisplayEvent[];
  let postResult: any;
  let fetchedRows: any[];
  let fetches: number;

  const termRows = [
    { profile: 'my-fast', term: 'wires', label: 'Wires', weight: 1, editable: true },
    { profile: 'my-fast', term: 'bom-cost', label: 'Cost', weight: 0, editable: true },
    { profile: 'my-fast', term: 'mission-cycle', label: 'Cycle', weight: 2, editable: false },
  ];

  beforeEach(() => {
    posts = [];
    events = [];
    fetches = 0;
    fetchedRows = termRows;
    postResult = of({ ok: true, name: 'my-fsc-fastest' });
    TestBed.configureTestingModule({
      imports: [ClassRowsTableComponent],
      providers: [
        { provide: HttpClient, useValue: {
            get: () => { fetches++; return of({ ok: true, rows: fetchedRows }); },
            post: (url: string, body: any) => { posts.push({ url, body }); return postResult; },
          } },
        { provide: PolariService, useValue: { getBackendBaseUrl: () => 'https://api', backendRequestOptions: {} } },
        { provide: CRUDEservicesManager, useValue: {} },
        { provide: AuthSessionService, useValue: {} },
        { provide: PeopleService, useValue: {} },
        { provide: Router, useValue: { navigate: () => Promise.resolve(true) } },
      ],
    });
    TestBed.inject(DisplayEventsService).displayEvents$.subscribe((e) => events.push(e));
    fixture = TestBed.createComponent(ClassRowsTableComponent);
    component = fixture.componentInstance;
    component.dataPath = '/api/p/my-fast/terms';
    component.columns = 'label,weight';
  });

  function configureEdit(): void {
    component.editFields = 'weight';
    component.editEnabledField = 'editable';
    component.editAction = { method: 'POST', path: '/api/firmware-score-profiles', body_template: { name: '{profile}', weights: { '{term}': '{value}' } } };
  }

  function boxes(): HTMLInputElement[] {
    return Array.from(fixture.nativeElement.querySelectorAll('input.edit')) as HTMLInputElement[];
  }

  function type(box: HTMLInputElement, text: string): void {
    box.value = text;
    box.dispatchEvent(new Event('change'));
  }

  it('only rows whose enabling field is true get an edit box; the others show the plain number', () => {
    configureEdit();
    fixture.detectChanges();
    expect(boxes().length).toBe(2);
    expect(fixture.nativeElement.querySelectorAll('tbody tr')[2].textContent).toContain('2');
  });

  it('with no editAction the weight column is plain text', () => {
    fixture.detectChanges();
    expect(boxes().length).toBe(0);
  });

  it('leaving a box with a new number POSTs the templated body (the number as a number), then sets scope rev', () => {
    configureEdit();
    fixture.detectChanges();
    type(boxes()[1], '0.75');
    expect(posts.length).toBe(1);
    expect(posts[0].url).toBe('https://api/api/firmware-score-profiles');
    expect(posts[0].body).toEqual({ name: 'my-fast', weights: { 'bom-cost': 0.75 } });
    expect(typeof posts[0].body.weights['bom-cost']).toBe('number');
    expect(events.some((e) => e.name === 'setScope' && e.payload['key'] === 'rev' && !!e.payload['value'])).toBeTrue();
    expect(component.message).toBe('Saved.');
  });

  it('an unchanged number sends nothing', () => {
    configureEdit();
    fixture.detectChanges();
    type(boxes()[0], '1');
    expect(posts.length).toBe(0);
  });

  it('something that is not a number >= 0 sends nothing and says so, and the box goes back', () => {
    configureEdit();
    fixture.detectChanges();
    type(boxes()[0], 'lots');
    expect(posts.length).toBe(0);
    expect(component.message).toContain('number');
    expect(component.messageBad).toBeTrue();
    expect(boxes()[0].value).toBe('1');
  });

  it('a refused edit shows the door\'s own words and fetches the stored rows again', () => {
    configureEdit();
    postResult = throwError(() => ({ error: { ok: false, error: 'profile is seeded: copy it first' } }));
    fixture.detectChanges();
    const before = fetches;
    type(boxes()[0], '3');
    expect(component.message).toBe('profile is seeded: copy it first');
    expect(component.messageBad).toBeTrue();
    expect(fetches).toBe(before + 1);
    expect(events.some((e) => e.payload['key'] === 'rev')).toBeFalse();
  });

  it('a clicked edit box does not select the row', () => {
    configureEdit();
    component.selectField = 'term'; component.selectScope = 'term';
    fixture.detectChanges();
    boxes()[0].click();
    expect(events.length).toBe(0);
  });

  it('rowAction: the Copy button shows only where show_when_field is true, POSTs the templated body, then picks the new profile and sets rev', () => {
    fetchedRows = [{ name: 'fsc-fastest', seeded: true }, { name: 'mine', seeded: false }];
    component.columns = 'name';
    component.rowAction = { label: 'Copy to edit', path: '/api/firmware-score-profiles', show_when_field: 'seeded', body_template: { name: 'my-{name}', copy_of: '{name}' }, then_scope: { key: 'profile', from: 'name' } };
    fixture.detectChanges();
    const buttons = fixture.nativeElement.querySelectorAll('button.act');
    expect(buttons.length).toBe(1);
    expect(buttons[0].textContent).toContain('Copy to edit');
    (buttons[0] as HTMLElement).click();
    expect(posts[0].body).toEqual({ name: 'my-fsc-fastest', copy_of: 'fsc-fastest' });
    const keys = events.map((e) => `${e.payload['key']}=${e.payload['value'] === '' ? '' : (e.payload['key'] === 'profile' ? e.payload['value'] : 'n')}`);
    expect(keys).toContain('profile=my-fsc-fastest');
    expect(keys).toContain('rev=n');
  });

  it('a changed dataPath (a scope moved) fetches again; the same dataPath does not', () => {
    fixture.detectChanges();
    const before = fetches;
    component.ngOnChanges({ dataPath: { firstChange: false, previousValue: '/a', currentValue: '/b', isFirstChange: () => false } });
    expect(fetches).toBe(before + 1);
    component.ngOnChanges({ dataPath: { firstChange: false, previousValue: '/b', currentValue: '/b', isFirstChange: () => false } });
    expect(fetches).toBe(before + 1);
  });
  it('tmp-1: a row whose signed field is true takes a negative number (no min on its box); other rows still refuse one', () => {
    fetchedRows = [{ profile: 'b', term: 't_min_c', label: 'Min', weight: 0, editable: true, signed: true },
                   { profile: 'b', term: 'power', label: 'Power', weight: 1, editable: true, signed: false }];
    configureEdit();
    component.editSignedField = 'signed';
    fixture.detectChanges();
    const [signed, plain] = boxes();
    expect(signed.getAttribute('min')).toBeNull();
    expect(plain.getAttribute('min')).toBe('0');
    type(signed, '-40');
    expect(posts.length).toBe(1);
    expect(posts[0].body).toEqual({ name: 'b', weights: { t_min_c: -40 } });
    type(plain, '-1');
    expect(posts.length).toBe(1);
    expect(component.message).toBe('Type a number of 0 or more.');
  });
});
