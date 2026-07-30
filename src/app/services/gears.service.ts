import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { PolariService } from '@services/polari-service';

/**
 * gr-1/gr-5: the /api/gears surface (gears module seam).
 *
 * Refusal-shaped bodies ({ok:false, refusal, suggestion}) resolve
 * even on error statuses — a gated-off module renders as a message,
 * never a blank page. Same contract as MotorsService, deliberately:
 * the motor page consumes both, and one surprising failure shape
 * between them would be one too many.
 */
@Injectable({ providedIn: 'root' })
export class GearsService {
  constructor(private http: HttpClient,
              private polariService: PolariService) {}

  private url(path: string): string {
    return `${this.polariService.getBackendBaseUrl()}${path}`;
  }

  private get(path: string): Promise<any> {
    return firstValueFrom(this.http.get<any>(
      this.url(path), this.polariService.backendRequestOptions))
      .catch((err) => err?.error ?? {
        ok: false,
        refusal: `backend unreachable or module off (${err?.status
          ?? '?'}) — is 'gears' in POLARI_MODULES?`,
      });
  }

  types(): Promise<any> { return this.get('/api/gears/types'); }

  trains(): Promise<any> { return this.get('/api/gears/trains'); }

  solve(train: string, opts?: {
    torqueNm?: number; speedRpm?: number;
  }): Promise<any> {
    const params = new URLSearchParams();
    if (opts?.torqueNm != null) {
      params.set('torqueNm', String(opts.torqueNm));
    }
    if (opts?.speedRpm != null) {
      params.set('speedRpm', String(opts.speedRpm));
    }
    const qs = params.toString() ? `?${params.toString()}` : '';
    return this.get(`/api/gears/solve/${train}${qs}`);
  }

  /** gr-5: drive a train from a REAL motor design. */
  motorDrive(train: string, opts?: {
    design?: string; speedRpm?: number;
    requiredTorqueNm?: number;
  }): Promise<any> {
    const params = new URLSearchParams();
    if (opts?.design) { params.set('design', opts.design); }
    if (opts?.speedRpm != null) {
      params.set('speedRpm', String(opts.speedRpm));
    }
    if (opts?.requiredTorqueNm != null) {
      params.set('requiredTorqueNm', String(opts.requiredTorqueNm));
    }
    const qs = params.toString() ? `?${params.toString()}` : '';
    return this.get(`/api/gears/motor-drive/${train}${qs}`);
  }
}
