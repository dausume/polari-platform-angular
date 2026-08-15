/**
 * sep-0 unit tests: the single-app clamp.
 *
 * The lock channel is `?shellApp=` persisted to sessionStorage for
 * the session; Karma cannot fake window.location.search, so these
 * tests seed the sessionStorage half (the same readLock path) and
 * pin: appForUrl clamps unconditionally, an unknown name falls OPEN,
 * and the route guard redirects foreign routes to the app home while
 * keeping the app's territory (nav routes, bringup, /callback).
 */
import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { Router, provideRouter, UrlTree } from '@angular/router';

import {
  AppNav, AppsNavPayload, AppsNavService,
} from './apps-nav.service';
import { PolariService } from './polari-service';
import { shellAppGuard } from '../guards/shell-app.guard';

const LOCK_KEY = 'polari.shellApp';

function appOf(name: string, routes: string[],
               bringup?: string): AppNav {
  return {
    name, title: name, useCase: '', discipline: 'd',
    personas: [], pages: [], modules: [], moduleStates: {},
    navSynthesized: false,
    nav: [{
      group: 'g', topMenu: false,
      items: routes.map(r => ({
        label: r, kind: 'page' as const,
        availability: 'enabled' as const, route: r,
        ...(bringup ? { bringup: { route: bringup } } : {}),
      })),
    }],
  };
}

function payloadOf(...apps: AppNav[]): AppsNavPayload {
  return { ok: true, gatingReadable: true, apps, personas: {} };
}

function setup(): AppsNavService {
  TestBed.configureTestingModule({
    imports: [HttpClientTestingModule],
    providers: [
      provideRouter([]),
      AppsNavService,
      { provide: PolariService, useValue: {
        getBackendBaseUrl: () => 'http://test.local/api',
        backendRequestOptions: {} as any,
      } },
    ],
  });
  return TestBed.inject(AppsNavService);
}

describe('AppsNavService single-app clamp (sep-0)', () => {
  afterEach(() => sessionStorage.removeItem(LOCK_KEY));

  it('is unlocked without a stored shellApp', () => {
    const svc = setup();
    svc.payload$.next(payloadOf(appOf('app-a', ['/magnetics'])));
    expect(svc.locked).toBeFalse();
    expect(svc.appForUrl('/magnetics')?.name).toBe('app-a');
    expect(svc.appForUrl('/topology')).toBeNull();
  });

  it('clamps appForUrl to the locked app unconditionally', () => {
    sessionStorage.setItem(LOCK_KEY, 'app-a');
    const svc = setup();
    svc.payload$.next(payloadOf(
      appOf('app-a', ['/magnetics']), appOf('app-b', ['/scoring'])));
    expect(svc.locked).toBeTrue();
    expect(svc.lockedAppName).toBe('app-a');
    expect(svc.appForUrl('/scoring')?.name).toBe('app-a');
    expect(svc.appForUrl('/topology')?.name).toBe('app-a');
  });

  it('falls open when the locked name is unknown to a loaded payload',
     () => {
    sessionStorage.setItem(LOCK_KEY, 'app-typo');
    const svc = setup();
    expect(svc.locked).toBeTrue();  // payload not loaded yet: hold
    svc.payload$.next(payloadOf(appOf('app-a', ['/magnetics'])));
    expect(svc.locked).toBeFalse();
    expect(svc.appForUrl('/magnetics')?.name).toBe('app-a');
  });
});

describe('shellAppGuard (sep-0)', () => {
  afterEach(() => sessionStorage.removeItem(LOCK_KEY));

  async function runGuard(_svc: AppsNavService, url: string):
      Promise<boolean | UrlTree> {
    return TestBed.runInInjectionContext(() =>
      shellAppGuard({} as any, { url } as any)) as
        Promise<boolean | UrlTree>;
  }

  it('allows everything when unlocked', async () => {
    const svc = setup();
    svc.payload$.next(payloadOf(appOf('app-a', ['/magnetics'])));
    expect(await runGuard(svc, '/topology')).toBeTrue();
  });

  it('keeps the locked app territory and redirects foreign routes',
     async () => {
    sessionStorage.setItem(LOCK_KEY, 'app-a');
    const svc = setup();
    svc.payload$.next(payloadOf(
      appOf('app-a', ['/magnetics'], '/modules/bringup')));

    expect(await runGuard(svc, '/app/app-a')).toBeTrue();
    expect(await runGuard(svc, '/magnetics/motor')).toBeTrue();
    expect(await runGuard(svc, '/modules/bringup')).toBeTrue();
    expect(await runGuard(svc, '/callback')).toBeTrue();

    const verdict = await runGuard(svc, '/topology');
    expect(verdict instanceof UrlTree).toBeTrue();
    const router = TestBed.inject(Router);
    expect(router.serializeUrl(verdict as UrlTree)).toBe('/app/app-a');
  });

  it('redirects the root URL to the app home', async () => {
    sessionStorage.setItem(LOCK_KEY, 'app-a');
    const svc = setup();
    svc.payload$.next(payloadOf(appOf('app-a', ['/magnetics'])));
    const verdict = await runGuard(svc, '/');
    expect(verdict instanceof UrlTree).toBeTrue();
  });

  it('allows freely when the locked name fell open', async () => {
    sessionStorage.setItem(LOCK_KEY, 'app-typo');
    const svc = setup();
    svc.payload$.next(payloadOf(appOf('app-a', ['/magnetics'])));
    expect(await runGuard(svc, '/topology')).toBeTrue();
  });
});
