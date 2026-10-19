import { defer, of, throwError } from 'rxjs';
import { fakeAsync, tick } from '@angular/core/testing';
import { isTransientHttpError, retryTransient } from './http-retry';

describe('retryTransient', () => {
  function flaky(failures: any[], value = 'ok') {
    let calls = 0;
    const src = defer(() => {
      const err = failures[calls++];
      return err ? throwError(() => err) : of(value);
    });
    return { src, calls: () => calls };
  }

  it('retries an aborted read (status 0) and a 5xx, then succeeds', fakeAsync(() => {
    const f = flaky([{ status: 0 }, { status: 503 }]);
    let got = '';
    f.src.pipe(retryTransient(2, 10)).subscribe(v => got = v);
    tick(100);
    expect(got).toBe('ok');
    expect(f.calls()).toBe(3);
  }));

  it('never retries a 4xx (an answer, not a failure)', fakeAsync(() => {
    const f = flaky([{ status: 404 }]);
    let err: any = null;
    f.src.pipe(retryTransient(2, 10)).subscribe({ error: e => err = e });
    tick(100);
    expect(err?.status).toBe(404);
    expect(f.calls()).toBe(1);
  }));

  it('gives up after the stated count', fakeAsync(() => {
    const f = flaky([{ status: 0 }, { status: 0 }, { status: 0 }]);
    let err: any = null;
    f.src.pipe(retryTransient(2, 10)).subscribe({ error: e => err = e });
    tick(100);
    expect(err?.status).toBe(0);
    expect(f.calls()).toBe(3);
  }));

  it('classifies statuses', () => {
    expect([0, 500, 502, 404, 401, undefined].map(s => isTransientHttpError({ status: s }))).toEqual([true, true, true, false, false, false]);
  });
});
