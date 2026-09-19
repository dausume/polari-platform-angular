/**
 * Unit tests for AdvisoryInterceptor — that it reads the advisory headers off
 * BOTH a success and an error response, and that it alters neither.
 */
import { HTTP_INTERCEPTORS, HttpClient } from '@angular/common/http';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { AdvisoryInterceptor } from './advisory.interceptor';
import { SecurityAdvisoryService } from '@services/security-advisory.service';

describe('AdvisoryInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let advisories: SecurityAdvisoryService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        SecurityAdvisoryService,
        { provide: HTTP_INTERCEPTORS, useClass: AdvisoryInterceptor, multi: true },
      ],
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
    advisories = TestBed.inject(SecurityAdvisoryService);
  });

  afterEach(() => httpMock.verify());

  it('records the advisory headers of a successful response', () => {
    http.get('/api/MealEntry').subscribe();
    httpMock.expectOne('/api/MealEntry').flush({ ok: true }, {
      headers: {
        'X-Polari-Permission-Advisory': 'would-deny MealEntry:read',
        'X-Polari-Owner-Advisory': 'would-project MealEntry:abc',
      },
    });
    expect(advisories.entries.length).toBe(2);
    expect(advisories.entries.map(e => e.outcome).sort())
      .toEqual(['would-deny', 'would-project']);
  });

  it('records them off an ERROR response too, and still surfaces the error', () => {
    let failed = false;
    http.get('/api/MealEntry').subscribe({ error: () => { failed = true; } });
    httpMock.expectOne('/api/MealEntry').flush('nope', {
      status: 403, statusText: 'Forbidden',
      headers: { 'X-Polari-Permission-Advisory': 'would-deny MealEntry:read' },
    });
    expect(failed).toBeTrue();
    expect(advisories.entries.length).toBe(1);
  });

  it('records nothing when the backend said nothing, and passes the body through', () => {
    let body: any = null;
    http.get('/api/MealEntry').subscribe(b => { body = b; });
    httpMock.expectOne('/api/MealEntry').flush({ ok: true });
    expect(body).toEqual({ ok: true } as any);
    expect(advisories.entries.length).toBe(0);
  });

  it('counts the same advisory across repeated requests', () => {
    for (let i = 0; i < 3; i++) {
      http.get('/api/MealEntry').subscribe();
      httpMock.expectOne('/api/MealEntry').flush({}, {
        headers: { 'X-Polari-Permission-Advisory': 'would-deny MealEntry:read' },
      });
    }
    expect(advisories.entries.length).toBe(1);
    expect(advisories.entries[0].count).toBe(3);
  });
});
