import { Injectable } from '@angular/core';
import {
  HttpEvent, HttpHandler, HttpInterceptor, HttpRequest, HttpErrorResponse
} from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { AuthSessionService } from '@services/auth/auth-session.service';

/**
 * On 401 from a backend call, kick AuthSessionService to attempt a silent
 * token refresh. If silent refresh fails, the user lands as signed-out
 * (header shows Login) — we deliberately do NOT auto-redirect to Keycloak
 * here, matching PSC's soft-gating approach.
 */
@Injectable()
export class AuthErrorInterceptor implements HttpInterceptor {
  constructor(private authSession: AuthSessionService) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    return next.handle(req).pipe(
      catchError((err: HttpErrorResponse) => {
        if (err.status === 401) {
          this.authSession.onApiUnauthorized();
        }
        return throwError(() => err);
      })
    );
  }
}
