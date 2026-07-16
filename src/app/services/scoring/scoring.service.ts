import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { PolariService } from '@services/polari-service';
import {
  parseCrudeReadAllResponse,
} from '@services/sim-space/crude-response-parser';

import {
  ScoreConceptSummary,
  ConceptScoreReport,
  ScoreGroupRow,
  GroupAggregateReport,
  GroupCompareReport,
} from '@models/scoring/scoring-types';

/** Read access for the context-based scoring pages (scr-1). */
@Injectable({ providedIn: 'root' })
export class ScoringService {

  constructor(private http: HttpClient,
              private polariService: PolariService) {}

  concepts(): Promise<ScoreConceptSummary[]> {
    const url = `${this.polariService.getBackendBaseUrl()}`
      + '/api/scoring/concepts';
    return firstValueFrom(this.http.get<{
      ok: boolean; concepts: ScoreConceptSummary[];
    }>(url, this.polariService.backendRequestOptions))
      .then(res => res?.concepts ?? [])
      .catch(() => []);
  }

  score(name: string): Promise<ConceptScoreReport | null> {
    const url = `${this.polariService.getBackendBaseUrl()}`
      + `/api/scoring/concepts/${encodeURIComponent(name)}/score`;
    return firstValueFrom(this.http.get<ConceptScoreReport>(
      url, this.polariService.backendRequestOptions))
      .catch((err) => err?.error?.ok === false ? err.error : null);
  }

  groups(): Promise<ScoreGroupRow[]> {
    const url = `${this.polariService.getBackendBaseUrl()}/ScoreGroup`;
    return firstValueFrom(this.http.get<any>(
      url, this.polariService.backendRequestOptions))
      .then(res => parseCrudeReadAllResponse(
        res, 'ScoreGroup') as ScoreGroupRow[])
      .catch(() => []);
  }

  groupAggregate(name: string): Promise<GroupAggregateReport | null> {
    const url = `${this.polariService.getBackendBaseUrl()}`
      + `/api/scoring/groups/${encodeURIComponent(name)}/aggregate`;
    return firstValueFrom(this.http.get<GroupAggregateReport>(
      url, this.polariService.backendRequestOptions))
      .catch((err) => err?.error?.ok === false ? err.error : null);
  }

  groupsConsensus(): Promise<GroupAggregateReport | null> {
    const url = `${this.polariService.getBackendBaseUrl()}`
      + '/api/scoring/groups/consensus';
    return firstValueFrom(this.http.get<GroupAggregateReport>(
      url, this.polariService.backendRequestOptions))
      .catch((err) => err?.error?.ok === false ? err.error : null);
  }

  compareGroups(names: string[]): Promise<GroupCompareReport | null> {
    const url = `${this.polariService.getBackendBaseUrl()}`
      + '/api/scoring/groups/compare';
    return firstValueFrom(this.http.post<GroupCompareReport>(
      url, { names }, this.polariService.backendRequestOptions))
      .catch((err) => err?.error?.ok === false ? err.error : null);
  }
}
