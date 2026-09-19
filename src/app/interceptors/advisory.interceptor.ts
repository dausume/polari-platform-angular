import { Injectable } from '@angular/core';
import {
  HttpErrorResponse, HttpEvent, HttpHandler, HttpInterceptor, HttpRequest, HttpResponse
} from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';

import { SecurityAdvisoryService } from '@services/security-advisory.service';

/**
 * Reads the backend's four security advisory headers off every response and
 * hands them to SecurityAdvisoryService. Registered LAST in HTTP_INTERCEPTORS
 * so it sees the response after every other interceptor has had its turn (the
 * auth-error interceptor may retry a 401 — this counts what actually came
 * back, both times).
 *
 * Read-only by construction: it never alters a request or a response, and it
 * never swallows an error. An error response carries the headers too — an
 * enforcing verdict IS a failed request — so the error path records as well.
 *
 * The headers are only readable cross-origin because the backend exposes them
 * (`Access-Control-Expose-Headers`, polariApiServer/polariServer.py
 * CORSExtraHeadersMiddleware). Same-origin they are always readable.
 */
@Injectable()
export class AdvisoryInterceptor implements HttpInterceptor {

  constructor(private advisories: SecurityAdvisoryService) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    return next.handle(req).pipe(
      tap(event => {
        if (event instanceof HttpResponse) {
          this.read(event.headers, event.url || req.url);
        }
      }),
      catchError((err: unknown) => {
        if (err instanceof HttpErrorResponse) {
          this.read(err.headers, err.url || req.url);
        }
        return throwError(() => err);
      })
    );
  }

  /** Never let a notice-bar feature break a request. */
  private read(headers: any, url: string): void {
    try { this.advisories.recordResponse(headers, url); }
    catch { /* an advisory is never worth an exception in the HTTP path */ }
  }
}
