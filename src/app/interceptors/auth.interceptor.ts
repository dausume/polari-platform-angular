import { Injectable } from '@angular/core';
import {
  HttpEvent, HttpHandler, HttpInterceptor, HttpRequest
} from '@angular/common/http';
import { Observable, from } from 'rxjs';
import { switchMap } from 'rxjs/operators';

import { OidcService } from '@services/auth/oidc.service';
import { RuntimeConfigService } from '@services/runtime-config.service';

/**
 * Attaches `Authorization: Bearer <token>` to outgoing HTTP requests that
 * target the configured PRF backend. Skips third-party hosts, the runtime
 * config asset fetch, and the silent-refresh iframe.
 *
 * If no user is signed in, requests pass through unmodified — the backend
 * may still serve public routes. The error interceptor handles 401s.
 */
@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  constructor(
    private oidc: OidcService,
    private runtimeConfig: RuntimeConfigService
  ) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    if (!this.shouldAttachToken(req.url)) {
      return next.handle(req);
    }
    return from(this.oidc.getAccessToken()).pipe(
      switchMap(token => {
        const finalReq = token
          ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
          : req;
        return next.handle(finalReq);
      })
    );
  }

  private shouldAttachToken(url: string): boolean {
    // Skip the static runtime config fetch itself (a `?_=<ts>` cache-buster
    // may be appended, so match on the path prefix, not endsWith).
    if (url.includes('/assets/runtime-config.json')) return false;

    const backendBase = this.runtimeConfig.getBackendBaseUrl();
    // Relative URLs (no scheme) — treat as same-origin and tag them.
    if (!/^https?:\/\//i.test(url)) return true;
    return url.startsWith(backendBase);
  }
}
