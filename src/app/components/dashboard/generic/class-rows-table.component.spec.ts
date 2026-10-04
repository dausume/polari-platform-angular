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
