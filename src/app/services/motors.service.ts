import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { PolariService } from '@services/polari-service';

/**
 * mag-7: the /magnetics/motor surface (motors module seam).
 *
 * Refusal-shaped bodies ({ok:false, refusal, suggestion}) resolve
 * even on error statuses — a gated-off module renders as a message,
 * never a blank page.
 */
@Injectable({ providedIn: 'root' })
export class MotorsService {
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
          ?? '?'}) — is 'motors' in POLARI_MODULES?`,
      });
  }

  designs(): Promise<any> { return this.get('/api/motors/designs'); }

  clockSim(design: string, pulses: number,
           alternating: boolean): Promise<any> {
    return this.get(
      `/api/motors/clock-sim/${design}?pulses=${pulses}` +
      `&alternating=${alternating}`);
  }

  torque(design: string): Promise<any> {
    return this.get(`/api/motors/torque/${design}`);
  }

  materials(design: string): Promise<any> {
    return this.get(`/api/motors/materials/${design}`);
  }
}
