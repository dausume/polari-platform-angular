import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { PolariService } from '@services/polari-service';

import {
  TechTreePayload, TechTreeSummary, TechTreeValidateReport,
} from '@models/techtree/techtree-types';

/**
 * Read access to the tech-tree API (tt-3/tt-4). Completion always
 * arrives DERIVED from the backend rollup — nothing is computed or
 * cached client-side, and gaps are suggestions with knob + action,
 * never applied from here.
 */
@Injectable({ providedIn: 'root' })
export class TechTreeService {

  constructor(private http: HttpClient,
              private polariService: PolariService) {}

  private url(path: string): string {
    return `${this.polariService.getBackendBaseUrl()}/api/techtree${path}`;
  }

  summary(): Promise<TechTreeSummary | null> {
    return firstValueFrom(this.http.get<TechTreeSummary>(
      this.url('/summary'), this.polariService.backendRequestOptions))
      .catch((err) => err?.error?.ok === false ? err.error : null);
  }

  tree(name?: string): Promise<TechTreePayload | null> {
    const query = name ? `?name=${encodeURIComponent(name)}` : '';
    return firstValueFrom(this.http.get<TechTreePayload>(
      this.url(`/tree${query}`),
      this.polariService.backendRequestOptions))
      .catch((err) => err?.error?.ok === false ? err.error : null);
  }

  /** B6: any org creates its own tree — a row write, nothing more.
   *  Nodes/segments follow via the node/assignment upserts. */
  createDefinition(name: string, owner: string, description: string):
      Promise<{ ok: boolean; error?: string } | null> {
    return firstValueFrom(this.http.post<{ ok: boolean }>(
      this.url('/definition'), { name, owner, description },
      this.polariService.backendRequestOptions))
      .catch((err) => err?.error?.ok === false ? err.error : null);
  }

  validate(name?: string): Promise<TechTreeValidateReport | null> {
    return firstValueFrom(this.http.post<TechTreeValidateReport>(
      this.url('/validate'), name ? { name } : {},
      this.polariService.backendRequestOptions))
      .catch((err) => err?.error?.ok === false ? err.error : null);
  }
}
