import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { PolariService } from '@services/polari-service';

import {
  TopologyListEntry,
  TopologySummary,
  TopologyMeta,
  TopologyMachine,
  TopologyInstance,
  ModuleAssignment,
  EdgeStatus,
  ModuleDependencyEdge,
  TopologyConnection,
  TopologyGraph,
  ValidationFinding,
  ValidateReport,
  DriftRow,
  DriftReport,
  AssignResult,
  ResolveResult,
} from '@models/topology/topology-types';

/**
 * Read/write access to the topology-as-data API (top-5/6). Every
 * method maps to one /api/topology endpoint; nothing here shells
 * out — deploys are always the human's pol command, shown as text.
 */
@Injectable({ providedIn: 'root' })
export class TopologyService {

  constructor(private http: HttpClient,
              private polariService: PolariService) {}

  private url(path: string): string {
    return `${this.polariService.getBackendBaseUrl()}/api/topology${path}`;
  }

  summary(): Promise<TopologySummary | null> {
    return firstValueFrom(this.http.get<TopologySummary>(
      this.url('/summary'), this.polariService.backendRequestOptions))
      .catch((err) => err?.error?.ok === false ? err.error : null);
  }

  graph(name?: string): Promise<TopologyGraph | null> {
    const query = name ? `?name=${encodeURIComponent(name)}` : '';
    return firstValueFrom(this.http.get<TopologyGraph>(
      this.url(`/graph${query}`),
      this.polariService.backendRequestOptions))
      .catch((err) => err?.error?.ok === false ? err.error : null);
  }

  validate(name?: string): Promise<ValidateReport | null> {
    return firstValueFrom(this.http.post<ValidateReport>(
      this.url('/validate'), name ? { name } : {},
      this.polariService.backendRequestOptions))
      .catch((err) => err?.error?.ok === false ? err.error : null);
  }

  drift(name?: string): Promise<DriftReport | null> {
    const query = name ? `?name=${encodeURIComponent(name)}` : '';
    return firstValueFrom(this.http.get<DriftReport>(
      this.url(`/drift${query}`),
      this.polariService.backendRequestOptions))
      .catch((err) => err?.error?.ok === false ? err.error : null);
  }

  assign(module: string, toInstance: string,
         fromInstance?: string): Promise<AssignResult | null> {
    const body: Record<string, string> = {
      module, to_instance: toInstance,
    };
    if (fromInstance) { body['from_instance'] = fromInstance; }
    return firstValueFrom(this.http.post<AssignResult>(
      this.url('/assign'), body,
      this.polariService.backendRequestOptions))
      .catch((err) => err?.error?.ok === false ? err.error : null);
  }

  resolve(): Promise<ResolveResult | null> {
    return firstValueFrom(this.http.post<ResolveResult>(
      this.url('/resolve'), {},
      this.polariService.backendRequestOptions))
      .catch((err) => err?.error?.ok === false ? err.error : null);
  }
}
