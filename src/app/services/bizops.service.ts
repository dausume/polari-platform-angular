import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { PolariService } from '@services/polari-service';

/**
 * biz-3: the business-operations surface (bizops module).
 * Bodies resolve even on error statuses — refusals render, never
 * blank; a gated-off module answers as a sentence.
 */
@Injectable({ providedIn: 'root' })
export class BizopsService {
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
          ?? '?'}) — is bizops enabled?`,
      });
  }

  walkthrough(business: string, budgetUsd: number): Promise<any> {
    return this.get(
      `/api/bizops/walkthrough/${business}?budgetUsd=${budgetUsd}`);
  }

  flows(business: string): Promise<any> {
    return this.get(`/api/bizops/flows/${business}`);
  }

  economy(): Promise<any> {
    return this.get('/api/bizops/economy');
  }

  readiness(business: string): Promise<any> {
    return this.get(`/api/bizops/readiness/${business}`);
  }

  partnerships(): Promise<any> {
    return this.get('/api/bizops/partnerships');
  }

  partnershipSuggestions(): Promise<any> {
    return this.get('/api/bizops/partnership-suggestions');
  }
}
