/**
 * Unit tests for StompService — connection-status lifecycle, topic
 * path construction, and the ct-6 half: a bearer on CONNECT, gate notices
 * kept out of the refetch path, and a refused subscribe degrading to a tick
 * instead of a dead panel. The internal RxStomp is spied so no real
 * WebSocket is opened (isolation mode).
 */
import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { BehaviorSubject, Subject, of } from 'rxjs';
import { StompService } from './stomp.service';
import { RuntimeConfigService } from './runtime-config.service';
import { AuthSessionService } from './auth/auth-session.service';
import { SecurityAdvisoryService } from './security-advisory.service';
import { classOfDestination, gateNoticeOf } from './stomp-notices';

/** The gate's advisory MESSAGE frame, as stomp_gate.py builds it. */
const ADVISORY_FRAME = {
  headers: {
    'X-Polari-Permission-Advisory': 'would-deny MealEntry:read',
    destination: '/topic/MealEntry',
    'content-type': 'application/json',
    'message-id': 'permission-advisory',
  },
  body: JSON.stringify({
    polariNotice: 'permission-advisory',
    className: 'MealEntry',
    verb: 'events',
    derivedFrom: 'read',
    mode: 'advisory',
  }),
};

/** A real change notification, for contrast. */
const CHANGE_FRAME = {
  headers: { destination: '/topic/MealEntry', 'content-type': 'application/json' },
  body: JSON.stringify({
    className: 'MealEntry', formatType: '', operation: 'create',
    timestamp: '2026-09-19T00:00:00Z', instanceIds: ['a'],
  }),
};

describe('StompService', () => {
  let service: StompService;
  let token: string | null;

  beforeEach(() => {
    token = null;
    const runtimeStub: Partial<RuntimeConfigService> = {
      getWebSocketUrl: () => 'ws://test.local/ws',
      // ClassDirectoryService (pulled in via modsplit-3 routing)
      // subscribes to this on construction; false = never fetches.
      isConfigLoaded$: new BehaviorSubject<boolean>(false) as any,
    };
    const authStub: Partial<AuthSessionService> = {
      refreshAccessToken: () => Promise.resolve(token),
      get accessToken() { return token; },
    };
    TestBed.configureTestingModule({
      // StompService pulls ClassDirectoryService (modsplit-3
      // per-backend routing), which needs HttpClient.
      imports: [HttpClientTestingModule],
      providers: [
        StompService,
        SecurityAdvisoryService,
        { provide: RuntimeConfigService, useValue: runtimeStub },
        { provide: AuthSessionService, useValue: authStub },
      ],
    });
    service = TestBed.inject(StompService);
  });

  it('starts disconnected', () => {
    expect(service.connectionStatus$.value).toBe('disconnected');
  });

  it('watchTopic() builds /topic/{class} and /topic/{class}/{format}', () => {
    const rx = (service as any).rxStomp;
    const watchSpy = spyOn(rx, 'watch').and.returnValue(of({} as any));
    service.watchTopic('WidgetClass').subscribe();
    expect(watchSpy).toHaveBeenCalledWith('/topic/WidgetClass');
    service.watchTopic('WidgetClass', 'json').subscribe();
    expect(watchSpy).toHaveBeenCalledWith('/topic/WidgetClass/json');
  });

  it('watchChanges() parses the JSON message body', (done) => {
    const rx = (service as any).rxStomp;
    spyOn(rx, 'watch').and.returnValue(
      of({ body: JSON.stringify({ operation: 'create', className: 'W' }) } as any)
    );
    service.watchChanges('W').subscribe((n: any) => {
      expect(n.operation).toBe('create');
      expect(n.className).toBe('W');
      done();
    });
  });

  it('disconnect() deactivates and emits disconnected', () => {
    const rx = (service as any).rxStomp;
    const deactivateSpy = spyOn(rx, 'deactivate');
    service.connectionStatus$.next('connected');
    service.disconnect();
    expect(deactivateSpy).toHaveBeenCalled();
    expect(service.connectionStatus$.value).toBe('disconnected');
  });

  // ---- ct-6 ------------------------------------------------------------

  it('sends Authorization: Bearer on CONNECT when signed in', async () => {
    token = 'a.b.c';
    const headers = await (service as any).connectHeaders();
    expect(headers['Authorization']).toBe('Bearer a.b.c');
  });

  it('sends NO auth header at all when signed out', async () => {
    token = null;
    const headers = await (service as any).connectHeaders();
    expect(Object.keys(headers).length).toBe(0);
  });

  it('an advisory MESSAGE never reaches the refetch path', () => {
    const rx = (service as any).rxStomp;
    spyOn(rx, 'watch').and.returnValue(of(ADVISORY_FRAME as any, CHANGE_FRAME as any));
    const seen: any[] = [];
    service.watchChanges('MealEntry').subscribe(n => seen.push(n));
    expect(seen.length).toBe(1);               // the change only
    expect(seen[0].operation).toBe('create');
  });

  it('routes the advisory to SecurityAdvisoryService instead', () => {
    const advisories = TestBed.inject(SecurityAdvisoryService);
    const rx = (service as any).rxStomp;
    spyOn(rx, 'watch').and.returnValue(of(ADVISORY_FRAME as any));
    service.watchChanges('MealEntry').subscribe();
    expect(advisories.entries.length).toBe(1);
    expect(advisories.entries[0].value).toBe('would-deny MealEntry:read');
    expect(advisories.entries[0].kind).toBe('subscribe');
  });

  it('an ERROR frame marks the class refused without touching other watches',
     () => {
    const errors$ = new Subject<any>();
    const rx = (service as any).rxStomp;
    // Re-wire this client's error handling onto a subject we control.
    (service as any).wireGateErrors({ stompErrors$: errors$ });
    spyOn(rx, 'watch').and.returnValue(new Subject<any>());

    let otherAlive = true;
    service.watchChanges('OtherClass').subscribe({
      complete: () => { otherAlive = false; },
      error: () => { otherAlive = false; },
    });

    errors$.next({
      headers: {
        'X-Polari-Permission-Advisory': 'would-deny MealEntry:read',
        destination: '/topic/MealEntry',
        message: 'permission refused',
      },
      body: JSON.stringify({ polariNotice: 'permission-refused', className: 'MealEntry' }),
    });

    expect(service.isRefused('MealEntry')).toBeTrue();
    expect(service.isRefused('OtherClass')).toBeFalse();
    expect(otherAlive).toBeTrue();
  });

  it('classOfDestination() and gateNoticeOf() read the wire shapes', () => {
    expect(classOfDestination('/topic/MealEntry')).toBe('MealEntry');
    expect(classOfDestination('/topic/MealEntry/flatJson')).toBe('MealEntry');
    expect(classOfDestination('/queue/thing')).toBe('');

    expect(gateNoticeOf(CHANGE_FRAME)).toBeNull();
    const notice = gateNoticeOf(ADVISORY_FRAME)!;
    expect(notice.refused).toBeFalse();
    expect(notice.className).toBe('MealEntry');
    expect(notice.advisory).toBe('would-deny MealEntry:read');
  });
});
