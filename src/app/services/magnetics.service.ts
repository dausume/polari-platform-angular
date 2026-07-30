import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { PolariService } from '@services/polari-service';

/**
 * mag-7: the /api/magnetics surface (field views first; circuits
 * ride the same seam later). Refusal-shaped bodies resolve even on
 * error statuses — a gated-off module renders as a message, never
 * a blank page (same contract as MotorsService).
 */
@Injectable({ providedIn: 'root' })
export class MagneticsService {
  constructor(private http: HttpClient,
              private polariService: PolariService) {}

  private get(path: string): Promise<any> {
    return firstValueFrom(this.http.get<any>(
      `${this.polariService.getBackendBaseUrl()}${path}`,
      this.polariService.backendRequestOptions))
      .catch((err) => err?.error ?? {
        ok: false,
        refusal: `backend unreachable or module off (${err?.status
          ?? '?'}) — is 'magnetics' in POLARI_MODULES?`,
      });
  }

  fieldViews(): Promise<any> {
    return this.get('/api/magnetics/fieldviews');
  }

  fieldView(name: string): Promise<any> {
    return this.get(`/api/magnetics/fieldview/${name}`);
  }

  fieldViewGroup(name: string): Promise<any> {
    return this.get(`/api/magnetics/fieldview-group/${name}`);
  }
}
