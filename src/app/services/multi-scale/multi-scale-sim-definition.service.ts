import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, firstValueFrom, throwError } from 'rxjs';
import { map, tap, catchError } from 'rxjs/operators';
import { PolariService } from '@services/polari-service';
import {
  MultiScaleSimSummary,
  NamedMultiScaleSimConfig,
} from '@models/multi-scale/NamedMultiScaleSimConfig';

/** Verdict of a stage's no-code gate solution (backend
 *  POST /api/simulations/multi-scale/{msim}/stages/{key}/gate). */
export interface StageGateVerdict {
  complete: boolean;
  hasGate: boolean;
  reason: string;
  derivedValues: Record<string, unknown> | null;
  error: string | null;
  deriveResolved: {
    params: Record<string, Record<string, unknown>>;
    fields: Record<string, Record<string, Record<string, unknown>>>;
  };
}

/** One attempt of a stage's solution search. */
export interface StageSearchAttempt {
  run: string;
  candidate: Record<string, number>;
  stepped: number;
  complete: boolean;
  reason: string;
  error: string | null;
}

/** Progress/result of a stage's solution search (one batch per call). */
export interface StageSearchReport {
  achieved: boolean;
  winner: { run: string; candidate: Record<string, number>;
            derivedValues: Record<string, unknown> | null } | null;
  exhausted: boolean;
  totalCandidates: number;
  attempted: number;
  advancedThisCall: number;
  attempts: StageSearchAttempt[];
  error: string | null;
  /** Present when achieved: the winner's derive map resolved into
   *  per-simulation parameter/field bundles (the PROVEN values). */
  deriveResolved?: {
    params: Record<string, Record<string, number>>;
    fields: Record<string, unknown>;
  } | null;
}

/**
 * MultiScaleSimulationDefinition service — same CRUDE-backed shape as
 * GraphDefinitionService, plus the stage-gate and stage-search endpoints.
 */
@Injectable({ providedIn: 'root' })
export class MultiScaleSimDefinitionService {

  allConfigList$ = new BehaviorSubject<MultiScaleSimSummary[]>([]);
  loading$ = new BehaviorSubject<boolean>(false);

  private readonly className = 'MultiScaleSimulationDefinition';

  constructor(private http: HttpClient, private polariService: PolariService) {}

  private get baseUrl(): string {
    return `${this.polariService.getBackendBaseUrl()}/${this.className}`;
  }

  fetchAllConfigs(): void {
    this.loading$.next(true);
    this.http.get<any>(this.baseUrl, this.polariService.backendRequestOptions).subscribe({
      next: (response: any) => {
        const items = this.parseReadAllResponse(response);
        const summaries: MultiScaleSimSummary[] = items.map((item: any) => {
          const cfg = NamedMultiScaleSimConfig.fromBackend(item);
          return {
            id: cfg.id,
            name: cfg.name,
            description: cfg.description,
            primary_simulation_ref: cfg.primarySimulationRef,
            memberCount: cfg.members.length,
            couplingCount: cfg.couplings.length,
          };
        });
        this.allConfigList$.next(summaries);
        this.loading$.next(false);
      },
      error: (err: any) => {
        console.error('[MultiScaleSimDefinitionService] fetchAllConfigs failed:', err);
        this.loading$.next(false);
      },
    });
  }

  /** Load one definition by NAME (the page routes by name — the
   *  human-stable identity every other sim object uses). */
  loadByName(name: string): Observable<NamedMultiScaleSimConfig> {
    this.loading$.next(true);
    return this.http.get<any>(this.baseUrl, this.polariService.backendRequestOptions).pipe(
      map((response: any) => {
        const items = this.parseReadAllResponse(response);
        const backendObj = items.find((item: any) => (item.name || '') === name);
        if (!backendObj) {
          throw new Error(`MultiScaleSimulationDefinition "${name}" not found`);
        }
        return NamedMultiScaleSimConfig.fromBackend(backendObj);
      }),
      tap(() => this.loading$.next(false)),
      catchError((err: any) => {
        this.loading$.next(false);
        return throwError(() => err);
      }),
    );
  }

  /** Evaluate a stage's no-code gate against a run's results. */
  async evaluateStageGate(
    msimName: string,
    stageKey: string,
    runName: string,
  ): Promise<StageGateVerdict> {
    const url = `${this.polariService.getBackendBaseUrl()}`
      + `/api/simulations/multi-scale/${encodeURIComponent(msimName)}`
      + `/stages/${encodeURIComponent(stageKey)}/gate`;
    const resp = await firstValueFrom(
      this.http.post<{ success: boolean; data: StageGateVerdict }>(
        url, { run: runName },
      ),
    );
    return resp.data;
  }

  /** Advance a stage's solution search by ONE batch (stateless —
   *  repeat calls continue the search until achieved/exhausted).
   *  `fixedParams` pin a substance's identity under every candidate;
   *  `attemptTag` namespaces that substance's resumable attempt set. */
  async runStageSearch(
    msimName: string,
    stageKey: string,
    batchSize?: number,
    fixedParams?: Record<string, number>,
    attemptTag?: string,
  ): Promise<StageSearchReport> {
    const url = `${this.polariService.getBackendBaseUrl()}`
      + `/api/simulations/multi-scale/${encodeURIComponent(msimName)}`
      + `/stages/${encodeURIComponent(stageKey)}/search`;
    const body: Record<string, unknown> = {};
    if (batchSize) body['batchSize'] = batchSize;
    if (fixedParams && Object.keys(fixedParams).length) {
      body['fixedParams'] = fixedParams;
    }
    if (attemptTag) body['attemptTag'] = attemptTag;
    const resp = await firstValueFrom(
      this.http.post<{ success: boolean; data: StageSearchReport }>(url, body),
    );
    return resp.data;
  }

  private parseReadAllResponse(response: any): any[] {
    let unwrapped = response;
    if (Array.isArray(response) && response.length === 1 && response[0] && response[0][this.className]) {
      unwrapped = response[0];
    }
    if (unwrapped && unwrapped[this.className]) {
      const classData = unwrapped[this.className];
      if (Array.isArray(classData)) {
        const instances: any[] = [];
        classData.forEach((dataSet: any) => {
          if (dataSet.data && Array.isArray(dataSet.data)) {
            instances.push(...dataSet.data);
          } else if (dataSet.id !== undefined) {
            instances.push(dataSet);
          }
        });
        return instances;
      }
      const keys = Object.keys(classData);
      return keys.map(key => ({ id: key, ...classData[key] }));
    }
    if (Array.isArray(response)) return response;
    if (response && response.data && Array.isArray(response.data)) return response.data;
    return [];
  }
}
