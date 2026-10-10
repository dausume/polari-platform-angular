import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { of } from 'rxjs';

import { ClassRowsTableComponent } from './class-rows-table.component';
import { PolariService } from '@services/polari-service';
import { CRUDEservicesManager } from '@services/crude-services-manager';
import { AuthSessionService } from '@services/auth/auth-session.service';
import { PeopleService } from '@services/people.service';

/**
 * bugfix (his 2026-10-04 browser pass on /display/boards): a `dataPath` like
 * `/api/board/boards/readiness` was fetched with the bare path — relative to the
 * SPA's own origin (prf.…nip.io, which serves index.html for any unknown path),
 * never the BACKEND origin (api.prf.…nip.io) — so the browser's JSON.parse saw
 * index.html's `<!doctype …` and raised "Unrecognized token '<'". `dataPath`
 * must resolve through PolariService.getBackendBaseUrl() exactly like
 * api-svg-panel and named-graph-panel already do.
 */
describe('ClassRowsTableComponent — dataPath resolves through the backend base', () => {
  let fixture: ComponentFixture<ClassRowsTableComponent>;
  let component: ClassRowsTableComponent;
  let requestedUrl: string | undefined;

  function setup(backendBase: string): void {
    requestedUrl = undefined;
    TestBed.configureTestingModule({
      imports: [ClassRowsTableComponent],
      providers: [
        { provide: HttpClient, useValue: {
            get: (url: string) => { requestedUrl = url; return of({ ok: true, rows: [] }); },
          } },
        { provide: PolariService, useValue: { getBackendBaseUrl: () => backendBase, backendRequestOptions: {} } },
        { provide: CRUDEservicesManager, useValue: {} },
        { provide: AuthSessionService, useValue: {} },
        { provide: PeopleService, useValue: {} },
      ],
    });
    fixture = TestBed.createComponent(ClassRowsTableComponent);
    component = fixture.componentInstance;
  }

  it('prefixes a relative dataPath with the backend base (never the SPA origin)', () => {
    setup('https://api.prf.192.168.0.210.nip.io');
    component.dataPath = '/api/board/boards/readiness';
    component.ngOnInit();
    expect(requestedUrl).toBe('https://api.prf.192.168.0.210.nip.io/api/board/boards/readiness');
  });

  it('leaves an already-absolute dataPath unchanged', () => {
    setup('https://api.prf.192.168.0.210.nip.io');
    component.dataPath = 'https://other-host.example/api/thing';
    component.ngOnInit();
    expect(requestedUrl).toBe('https://other-host.example/api/thing');
  });

  it('with an empty backend base (dev proxy), still just appends the path — never bare', () => {
    setup('');
    component.dataPath = '/api/board/boards/readiness';
    component.ngOnInit();
    expect(requestedUrl).toBe('/api/board/boards/readiness');
  });
});

/**
 * ucd-iso-1: the `code` column format (his ruling 2026-10-10 — the C-atom code interface and C-isotopes need a
 * reusable "render this cell like real C source" widget). What must hold: a `col:code` cell preserves the
 * source's newlines (never collapsed/clamped like a long prose cell) and offers a "copy" control — the SAME
 * `code-block` component the CFunctionAtom section's own code-interface block uses, so one fix serves both.
 */
describe('ClassRowsTableComponent — the `code` column format (ucd-iso-1)', () => {
  let fixture: ComponentFixture<ClassRowsTableComponent>;
  let component: ClassRowsTableComponent;

  const multilineSource = 'void hal_adc_read(void) {\n  // ADC0 start\n  ADCSRA |= (1 << ADSC);\n}';

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ClassRowsTableComponent],
      providers: [
        { provide: HttpClient, useValue: { get: () => of({ ok: true, rows: [] }) } },
        { provide: PolariService, useValue: { getBackendBaseUrl: () => '', backendRequestOptions: {} } },
        { provide: CRUDEservicesManager, useValue: {} },
        { provide: AuthSessionService, useValue: {} },
        { provide: PeopleService, useValue: {} },
      ],
    });
    fixture = TestBed.createComponent(ClassRowsTableComponent);
    component = fixture.componentInstance;
    component.columns = 'name,source';
    component.columnFormats = 'source:code';
    component.dataPath = '/api/cmod/atoms/x/isotopes'; // any dataPath — the HttpClient stub answers every GET
    component.ngOnInit();
    fixture.detectChanges();
  });

  it('renders the cell as a code-block, preserving the source\'s newlines (never clamped)', () => {
    component['applyRows']([{ name: 'uno:hal.adc@uno', source: multilineSource }]);
    fixture.detectChanges();
    expect(component.kindOf({ source: multilineSource }, 'source')).toBe('code');
    expect(component.isLong({ source: multilineSource }, 'source')).toBe(false);
    const el: HTMLElement = fixture.nativeElement;
    const block = el.querySelector('code-block');
    expect(block).toBeTruthy();
    const pre = block!.querySelector('pre');
    expect(pre!.textContent).toContain('ADCSRA |= (1 << ADSC);');
  });

  it('offers a copy control on the code-block', () => {
    component['applyRows']([{ name: 'uno:hal.adc@uno', source: multilineSource }]);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    const copyBtn = el.querySelector('code-block button.copy');
    expect(copyBtn).toBeTruthy();
    expect((copyBtn!.textContent || '').trim()).toBe('copy');
  });
});
