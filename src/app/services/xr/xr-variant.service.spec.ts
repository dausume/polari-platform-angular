/**
 * Protocol pins for XrVariantService (xr-2): the CRUDE reality —
 * every route at /XrInterfaceVariant, GET returns the table envelope,
 * POST = multipart initParamSets (create on first write), PUT =
 * multipart polariId + updateData (merge into an existing row).
 * mergeConfig must PRESERVE unknown config keys (other phases'
 * configuration is never clobbered).
 */
import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule, HttpTestingController,
} from '@angular/common/http/testing';

import { XrVariantService, variantName } from './xr-variant.service';
import { RuntimeConfigService } from '@services/runtime-config.service';

const BASE = 'https://backend.test';
const URL = `${BASE}/XrInterfaceVariant`;

function tableEnvelope(rows: any[]): any {
  return [{ XrInterfaceVariant: [{ data: rows }] }];
}

describe('XrVariantService (CRUDE protocol)', () => {
  let service: XrVariantService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        {
          provide: RuntimeConfigService,
          useValue: { getBackendBaseUrl: () => BASE },
        },
      ],
    });
    service = TestBed.inject(XrVariantService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('reads the table and resolves the canonical row client-side',
      async () => {
    const promise = service.getConfig('sim-space', 'pendulum', 'vr');
    const req = http.expectOne(URL);
    expect(req.request.method).toBe('GET');
    req.flush(tableEnvelope([
      {
        id: '1', name: variantName('sim-space', 'pendulum', 'vr'),
        config_json: '{"entry_scale": 2.5}',
      },
      { id: '2', name: 'xr-variant:sim-space:other:vr' },
    ]));
    expect(await promise).toEqual({ entry_scale: 2.5 });
  });

  /** The write request is issued in a continuation after the GET
   *  resolves — yield a macrotask so it exists before expectOne. */
  function tick(): Promise<void> {
    return new Promise(resolve => setTimeout(resolve));
  }

  it('first write CREATES via multipart initParamSets', async () => {
    const promise = service.mergeConfig(
      'sim-space', 'pendulum', 'vr', { entry_scale: 3 });
    http.expectOne(URL).flush(tableEnvelope([])); // no row yet
    await tick();
    const post = http.expectOne(
      r => r.method === 'POST' && r.url === URL);
    const body = post.request.body as FormData;
    const initParamSets =
      JSON.parse(body.get('initParamSets') as string);
    expect(initParamSets.length).toBe(1);
    expect(initParamSets[0].name)
      .toBe(variantName('sim-space', 'pendulum', 'vr'));
    expect(initParamSets[0].mode).toBe('vr');
    expect(JSON.parse(initParamSets[0].config_json))
      .toEqual({ entry_scale: 3 });
    post.flush({});
    expect(await promise).toEqual({ entry_scale: 3 });
  });

  it('later writes UPDATE via multipart polariId + updateData and '
      + 'PRESERVE unknown config keys', async () => {
    const promise = service.mergeConfig(
      'sim-space', 'pendulum', 'vr',
      { bookmarks: [{ name: 'top', pose: {
        position: [0, 0, 0], yaw: 0, scale: 1 } }] });
    http.expectOne(URL).flush(tableEnvelope([{
      id: '42', name: variantName('sim-space', 'pendulum', 'vr'),
      // an xr-3 panel-placement key rides along untouched
      config_json: '{"entry_scale": 2, "panels": {"run": [1, 2]}}',
    }]));
    await tick();
    const put = http.expectOne(
      r => r.method === 'PUT' && r.url === URL);
    const body = put.request.body as FormData;
    expect(body.get('polariId')).toBe('42');
    const updated =
      JSON.parse(JSON.parse(body.get('updateData') as string)
        .config_json);
    expect(updated.entry_scale).toBe(2);        // preserved
    expect(updated.panels).toEqual({ run: [1, 2] }); // preserved
    expect(updated.bookmarks.length).toBe(1);   // merged
    put.flush({});
    await promise;
  });
});
