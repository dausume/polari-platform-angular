import { Injectable } from '@angular/core';
import {
  HttpEvent, HttpHandler, HttpInterceptor, HttpRequest, HttpErrorResponse
} from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { AuthSessionService } from '@services/auth/auth-session.service';

/**
 * On 401 from a call we actually signed, kick AuthSessionService to attempt a
 * single silent token refresh. If the refresh fails AND the stored session is
 * genuinely dead, the user lands as signed-out (header shows Login) — we
 * deliberately do NOT auto-redirect to Keycloak here, matching PSC's
 * soft-gating approach.
 *
 * Scoped to requests that carry an Authorization header, which AuthInterceptor
 * (registered ahead of this one) attaches only to the configured PRF backend.
 * An unrelated 401 — a third-party fetch, an endpoint answering 401 for its own
 * reasons — must not be able to tear down a perfectly valid session; deciding
 * whether the session is really gone is AuthSessionService's job, and it now
 * checks the store before clearing.
 */
@Injectable()
export class AuthErrorInterceptor implements HttpInterceptor {
  constructor(private authSession: AuthSessionService) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    return next.handle(req).pipe(
      catchError((err: HttpErrorResponse) => {
        if (err.status === 401 && req.headers.has('Authorization')) {
          this.authSession.onApiUnauthorized();
        }
        return throwError(() => err);
      })
    );
  }
}
