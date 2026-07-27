import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { PolariService } from '@services/polari-service';

/**
 * mlb-3/4: the lazy-boot bring-up surface.
 *
 * GET /api/modules/status — per-module lifecycle rows (pending /
 * loading / online / failed / blocked / disabled), deps, timing, and
 * the history-derived ETA (eta_s; absent = no prior boots recorded,
 * honestly no estimate). GET /api/health — core-ready phase (503
 * while the core data pass runs; that 503 body still carries the
 * snapshot, so the panel renders from the first listening moment).
 */
@Injectable({ providedIn: 'root' })
export class ModuleStatusService {
  constructor(private http: HttpClient,
              private polariService: PolariService) {}

  private url(path: string): string {
    return `${this.polariService.getBackendBaseUrl()}${path}`;
  }

  /** Boot/bring-up snapshot; resolves the body even on 503 (the
   *  health route answers 503-with-snapshot during core boot). */
  health(): Promise<any | null> {
    return firstValueFrom(this.http.get<any>(
      this.url('/api/health'),
      this.polariService.backendRequestOptions))
      .catch((err) => err?.error ?? null);
  }

  modulesStatus(): Promise<any | null> {
    return firstValueFrom(this.http.get<any>(
      this.url('/api/modules/status'),
      this.polariService.backendRequestOptions))
      .catch((err) => err?.error ?? null);
  }
}
