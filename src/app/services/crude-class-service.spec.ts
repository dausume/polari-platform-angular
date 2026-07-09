/**
 * Unit tests for CRUDEclassService (isolation mode — no backend).
 * Verifies each CRUDE op issues the correct HTTP method, URL
 * (baseUrl/className[/id]) and body, via HttpClientTestingModule.
 */
import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';

import { CRUDEclassService } from './crude-class-service';
import { PolariService } from './polari-service';

const BASE = 'http://test.local/api';

describe('CRUDEclassService', () => {
  let service: CRUDEclassService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    const polariStub: Partial<PolariService> = {
      getBackendBaseUrl: () => BASE,
      backendRequestOptions: {} as any,
    };
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        CRUDEclassService,
        { provide: PolariService, useValue: polariStub },
      ],
    });
    service = TestBed.inject(CRUDEclassService);
    service.className = 'WidgetClass';
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('is created', () => {
    expect(service).toBeTruthy();
    expect(service.className).toBe('WidgetClass');
  });

  it('create() POSTs the body to /{className}', () => {
    const payload = { name: 'w1', value: 3 };
    let got: any;
    service.create(payload).subscribe((r) => (got = r));
    const req = httpMock.expectOne(`${BASE}/WidgetClass`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    req.flush({ ok: true, id: 'abc' });
    expect(got).toEqual({ ok: true, id: 'abc' });
  });

  it('read(id) GETs /{className}/{id}', () => {
    service.read('abc').subscribe();
    const req = httpMock.expectOne(`${BASE}/WidgetClass/abc`);
    expect(req.request.method).toBe('GET');
    req.flush({ id: 'abc' });
  });

  it('readAll() GETs /{className}', () => {
    let got: any;
    service.readAll().subscribe((r) => (got = r));
    const req = httpMock.expectOne(`${BASE}/WidgetClass`);
    expect(req.request.method).toBe('GET');
    req.flush([{ id: 'a' }, { id: 'b' }]);
    expect(got.length).toBe(2);
  });

  it('update(id, data) PUTs to /{className}/{id}', () => {
    const patch = { value: 9 };
    service.update('abc', patch).subscribe();
    const req = httpMock.expectOne(`${BASE}/WidgetClass/abc`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual(patch);
    req.flush({ ok: true });
  });

  it('delete(id) DELETEs /{className}/{id}', () => {
    service.delete('abc').subscribe();
    const req = httpMock.expectOne(`${BASE}/WidgetClass/abc`);
    expect(req.request.method).toBe('DELETE');
    req.flush({ ok: true });
  });
});
