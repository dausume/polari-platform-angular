import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { PolariService } from '@services/polari-service';

/**
 * od-7: the business/odoo surface (odooconnect + sourcing seams).
 *
 * Every call resolves the BODY even on error statuses — the backend
 * answers refusals as {ok:false, refusal, suggestion} and a gated-off
 * module answers 503; both render, never blank.
 */
@Injectable({ providedIn: 'root' })
export class OdooBusinessService {
  constructor(private http: HttpClient,
              private polariService: PolariService) {}

  private url(path: string): string {
    return `${this.polariService.getBackendBaseUrl()}${path}`;
  }

  private get(path: string): Promise<any | null> {
    return firstValueFrom(this.http.get<any>(
      this.url(path), this.polariService.backendRequestOptions))
      .catch((err) => err?.error ?? {
        ok: false,
        refusal: `backend unreachable or module off (${err?.status
          ?? '?'}) — is odooconnect enabled?`,
      });
  }

  private post(path: string, body: any): Promise<any | null> {
    return firstValueFrom(this.http.post<any>(
      this.url(path), body, this.polariService.backendRequestOptions))
      .catch((err) => err?.error ?? {
        ok: false, refusal: `request failed (${err?.status ?? '?'})`,
      });
  }

  status(): Promise<any> { return this.get('/api/odoo/status'); }
  scenarios(): Promise<any> { return this.get('/api/odoo/scenarios'); }
  receipts(): Promise<any> { return this.get('/api/odoo/receipts'); }
  bindings(): Promise<any> { return this.get('/api/odoo/bindings'); }

  scenarioPlan(name: string): Promise<any> {
    return this.post('/api/odoo/scenario/plan', { scenario: name });
  }

  compare(itemRef: string): Promise<any> {
    return this.get(
      `/api/supplychain/sourcing/compare/${itemRef}`);
  }
}
