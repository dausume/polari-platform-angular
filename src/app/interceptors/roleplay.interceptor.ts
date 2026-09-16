import { Injectable, Injector } from '@angular/core';
import {
  HttpEvent, HttpHandler, HttpInterceptor, HttpRequest
} from '@angular/common/http';
import { Observable } from 'rxjs';

import { RuntimeConfigService } from '@services/runtime-config.service';
import { RoleplayService } from '@services/roleplay.service';

/**
 * Attaches `X-Polari-Roleplay: <role>` to backend requests while a person
 * is acting as a prototype role (dev posture only — see RoleplayService).
 * The backend middleware (`accessControl/roleplay_observer.py`) attributes
 * everything the request does to `roleplay:<role>`.
 *
 * Mirrors AuthInterceptor's idea of "is this the backend": relative URLs
 * count, the runtime-config asset never does.
 *
 * RoleplayService is resolved lazily through the Injector — it talks HTTP
 * itself, so injecting it in the constructor would be a cycle.
 */
@Injectable()
export class RoleplayInterceptor implements HttpInterceptor {
  private roleplay: RoleplayService | null = null;

  constructor(
    private injector: Injector,
    private runtimeConfig: RuntimeConfigService
  ) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    const role = this.currentRole();
    if (!role || !this.isBackend(req.url)) {
      return next.handle(req);
    }
    return next.handle(req.clone({
      setHeaders: { 'X-Polari-Roleplay': role }
    }));
  }

  private currentRole(): string {
    try {
      if (!this.roleplay) {
        this.roleplay = this.injector.get(RoleplayService);
      }
      return this.roleplay.role$.value || '';
    } catch {
      return '';
    }
  }

  private isBackend(url: string): boolean {
    if (url.includes('/assets/runtime-config.json')) return false;
    const backendBase = this.runtimeConfig.getBackendBaseUrl();
    if (!/^https?:\/\//i.test(url)) return true;
    return !!backendBase && url.startsWith(backendBase);
  }
}
