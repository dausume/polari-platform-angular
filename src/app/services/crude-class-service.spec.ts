/**
 * Unit tests for CRUDEclassService (isolation mode — no backend).
 * Pins the REAL CRUDE protocol (matching the backend's polariCRUDE +
 * tests/test_api_sweep.py): every route is /{ClassName} (no per-id
 * paths), writes are multipart form-data — POST initParamSets,
 * PUT polariId+updateData, DELETE targetInstance.
 */
import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';

import { CRUDEclassService } from './crude-class-service';
import { PolariService } from './polari-service';

const BASE = 'http://test.local/api';

/** The standard CRUDE GET envelope for one class. */
function envelopeOf(className: string, rows: any[]): any {
  return [{ [className]: [{ class: className, data: rows }] }];
}

describe('CRUDEclassService', () => {
  let service: CRUDEclassService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    const polariStub: Partial<PolariService> = {
      getBackendBaseUrl: () => BASE,
      getBackendBaseUrlForClass: () => BASE,
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

  it('create() POSTs multipart initParamSets to /{className}', () => {
    const payload = { name: 'w1', value: 3 };
    let got: any;
    service.create(payload).subscribe((r) => (got = r));
    const req = httpMock.expectOne(`${BASE}/WidgetClass`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body instanceof FormData).toBeTrue();
    expect(req.request.body.get('initParamSets'))
      .toBe(JSON.stringify([payload]));
    req.flush({ ok: true, id: 'abc' });
    expect(got).toEqual({ ok: true, id: 'abc' });
  });

  it('read(id) GETs /{className} and resolves the row client-side '
      + '(no per-id route exists)', () => {
    let got: any;
    service.read('abc').subscribe((r) => (got = r));
    const req = httpMock.expectOne(`${BASE}/WidgetClass`);
    expect(req.request.method).toBe('GET');
    req.flush(envelopeOf('WidgetClass',
      [{ id: 'abc', name: 'w1' }, { id: 'def', name: 'w2' }]));
    expect(got).toEqual({ id: 'abc', name: 'w1' });
  });

  it('read(id) resolves null for an unknown id', () => {
    let got: any = 'unset';
    service.read('nope').subscribe((r) => (got = r));
    httpMock.expectOne(`${BASE}/WidgetClass`)
      .flush(envelopeOf('WidgetClass', [{ id: 'abc' }]));
    expect(got).toBeNull();
  });

  it('readAll() GETs /{className}', () => {
    let got: any;
    service.readAll().subscribe((r) => (got = r));
    const req = httpMock.expectOne(`${BASE}/WidgetClass`);
    expect(req.request.method).toBe('GET');
    req.flush(envelopeOf('WidgetClass', [{ id: 'a' }, { id: 'b' }]));
    expect(got[0]['WidgetClass'][0].data.length).toBe(2);
  });

  it('update(id, data) PUTs multipart polariId+updateData to '
      + '/{className}', () => {
    const patch = { value: 9 };
    service.update('abc', patch).subscribe();
    const req = httpMock.expectOne(`${BASE}/WidgetClass`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body instanceof FormData).toBeTrue();
    expect(req.request.body.get('polariId')).toBe('abc');
    expect(req.request.body.get('updateData')).toBe(JSON.stringify(patch));
    req.flush({ ok: true });
  });

  it('delete(id) DELETEs /{className} with multipart targetInstance',
      () => {
    service.delete('abc').subscribe();
    const req = httpMock.expectOne(`${BASE}/WidgetClass`);
    expect(req.request.method).toBe('DELETE');
    expect(req.request.body instanceof FormData).toBeTrue();
    expect(req.request.body.get('targetInstance'))
      .toBe(JSON.stringify({ id: 'abc' }));
    req.flush({ ok: true });
  });
});
