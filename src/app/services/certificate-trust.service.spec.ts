import { fakeAsync, flushMicrotasks, tick } from '@angular/core/testing';
import { BehaviorSubject } from 'rxjs';
import { CertificateTrustService } from './certificate-trust.service';

describe('Service connection diagnostics', () => {
  let service: CertificateTrustService;
  let runtime: any;
  let fetchSpy: jasmine.Spy;
  beforeEach(() => {
    runtime = { isConfigLoaded$: new BehaviorSubject(true),
      getBackendBaseUrl: () => 'https://api.example.test', getKeycloakConfig: () => null };
    service = new CertificateTrustService(runtime);
    fetchSpy = spyOn(window, 'fetch').and.resolveTo(new Response('{}', { status: 200 }));
  });
  it('does not prompt for a healthy backend', fakeAsync(() => {
    void service.checkAllEndpoints(); flushMicrotasks();
    expect(service.showPrompt).toBeFalse();
    expect(service.endpointStatuses[0].state).toBe('reachable');
  }));
  it('waits for runtime configuration instead of probing build defaults', fakeAsync(() => {
    runtime.isConfigLoaded$.next(false);
    void service.checkAllEndpoints(); flushMicrotasks();
    expect(fetchSpy).not.toHaveBeenCalled();
    runtime.isConfigLoaded$.next(true); flushMicrotasks();
    expect(fetchSpy).toHaveBeenCalled();
  }));
  it('recovers from a startup outage before showing any dialog', fakeAsync(() => {
    let calls = 0;
    fetchSpy.and.callFake(() => ++calls <= 2 ? Promise.reject(new TypeError('Failed to fetch')) : Promise.resolve(new Response('{}')));
    void service.checkAllEndpoints(); flushMicrotasks();
    expect(service.showPrompt).toBeFalse();
    tick(1500); flushMicrotasks();
    expect(service.showPrompt).toBeFalse();
    expect(service.endpointStatuses[0].state).toBe('reachable');
  }));
  it('does not call an HTTP 503 a certificate failure', fakeAsync(() => {
    fetchSpy.and.resolveTo(new Response('', { status: 503 }));
    void service.checkAllEndpoints(); flushMicrotasks(); tick(19500); flushMicrotasks();
    expect(service.showPrompt).toBeTrue();
    expect(service.endpointStatuses[0].trusted).toBeTrue();
    expect(service.endpointStatuses[0].error).toContain('HTTP 503');
  }));
  it('treats a rejected fetch as unknown connection failure, not proof of bad TLS', fakeAsync(() => {
    fetchSpy.and.rejectWith(new TypeError('Failed to fetch'));
    void service.checkAllEndpoints(); flushMicrotasks(); tick(19500); flushMicrotasks();
    expect(service.endpointStatuses[0].state).toBe('unreachable');
    expect(service.showPrompt).toBeTrue();
  }));
  it('recognizes a CORS-blocked response with accepted transport', fakeAsync(() => {
    fetchSpy.and.callFake((_url, init: any) => init.mode === 'cors'
      ? Promise.reject(new TypeError('Failed to fetch')) : Promise.resolve(new Response()));
    void service.checkAllEndpoints(); flushMicrotasks(); tick(19500); flushMicrotasks();
    expect(service.endpointStatuses[0].state).toBe('blocked');
    expect(service.endpointStatuses[0].trusted).toBeTrue();
  }));
  it('checks configured Keycloak and retries it independently', fakeAsync(() => {
    runtime.getKeycloakConfig = () => ({ authority: 'https://login.example.test/realms/isle/' });
    fetchSpy.and.callFake((url: any) => String(url).includes('login.')
      ? Promise.resolve(new Response('', { status: 503 })) : Promise.resolve(new Response('{}')));
    void service.checkAllEndpoints(); flushMicrotasks(); tick(19500); flushMicrotasks();
    expect(service.failedEndpoints.map(e => e.name)).toEqual(['Keycloak sign-in']);
    expect(service.failedEndpoints[0].url).toBe('https://login.example.test/realms/isle/.well-known/openid-configuration');
    fetchSpy.and.resolveTo(new Response('{}'));
    void service.retry(); flushMicrotasks();
    expect(service.showPrompt).toBeFalse();
  }));
  it('allows a lazy backend to recover across the startup grace period', fakeAsync(() => {
    let calls = 0;
    fetchSpy.and.callFake(() => ++calls <= 4 ? Promise.resolve(new Response('', { status: 503 })) : Promise.resolve(new Response('{}')));
    void service.checkAllEndpoints(); flushMicrotasks(); tick(10500); flushMicrotasks();
    expect(service.showPrompt).toBeFalse();
    tick(9000); flushMicrotasks();
    expect(service.endpointStatuses[0].state).toBe('reachable');
  }));
  it('reports a hung endpoint as timeout, not certificate rejection', fakeAsync(() => {
    fetchSpy.and.callFake((_url, init: any) => new Promise((_resolve, reject) =>
      init.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))));
    void service.checkAllEndpoints(); flushMicrotasks(); tick(44500); flushMicrotasks();
    expect(service.endpointStatuses[0].state).toBe('timeout');
    expect(service.showPrompt).toBeTrue();
  }));
  it('keeps the diagnostic visible while retrying and closes it on recovery', fakeAsync(() => {
    fetchSpy.and.resolveTo(new Response('', {status: 503}));
    void service.checkAllEndpoints(); flushMicrotasks(); tick(19500); flushMicrotasks();
    let finish!: (response: Response) => void;
    fetchSpy.and.returnValue(new Promise<Response>(resolve => finish = resolve));
    void service.retry(); flushMicrotasks();
    expect(service.showPrompt).toBeTrue();
    expect(service.checking).toBeTrue();
    finish(new Response('{}')); flushMicrotasks();
    expect(service.showPrompt).toBeFalse();
    expect(service.checking).toBeFalse();
  }));
  it('clears timeout handles on rejection' , fakeAsync(() => {
    fetchSpy.and.rejectWith(new TypeError('Failed to fetch'));
    void service.checkAllEndpoints(); flushMicrotasks(); tick(19500); flushMicrotasks();
    expect(service.checking).toBeFalse();
    // fakeAsync fails this test if the 5s abort timers are left queued.
  }));
});
