import { MonoTypeOperatorFunction, throwError, timer } from 'rxjs';
import { retry } from 'rxjs/operators';

/**
 * A request the browser cancelled or could not complete (status 0), or a 5xx, is worth one or two more
 * tries; a 4xx is an answer and is never retried. Found by the 2026-10-19 Chrome sweep: accepting the
 * demo terms re-initialises the app and aborts in-flight reads, so a page's first DisplayDefinition read
 * failed and the page showed "Display Not Found" until reloaded.
 */
export function isTransientHttpError(err: any): boolean {
  const status = typeof err?.status === 'number' ? err.status : -1;
  return status === 0 || status >= 500;
}

export function retryTransient<T>(count = 2, delayMs = 800): MonoTypeOperatorFunction<T> {
  return retry<T>({
    count,
    delay: (err: any, attempt: number) => isTransientHttpError(err) ? timer(delayMs * attempt) : throwError(() => err),
  });
}
