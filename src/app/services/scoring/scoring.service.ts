import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { PolariService } from '@services/polari-service';
import {
  parseCrudeReadAllResponse,
} from '@services/sim-space/crude-response-parser';

/** One concept summary (GET /api/scoring/concepts). */
export interface ScoreConceptSummary {
  name: string;
  displayName: string;
  description: string;
  subjectKind: string;
  termWeights: { term: string; weight: number }[];
  requiredContexts: string[];
  aggregation: string;
  levelize: boolean;
}

/** One term's line in a subject's breakdown. */
export interface ScoreBreakdownEntry {
  term: string;
  kind?: 'concept';
  concept?: string;
  childTermsMissing?: string[];
  label?: string;
  weight: number;
  isPositive?: boolean;
  raw?: number;
  unit?: string;
  normalized?: number;
  weighted?: number;
  normalization?: {
    method: string; min: number; max: number; inverted: boolean;
  };
  found: boolean;
  source?: string;
  valueRow?: string;
  provenance?: string;
  error?: string;
}

/** One scored subject. */
export interface ScoredSubject {
  subject: string;
  displayName: string;
  kind: string;
  weightedSum: number;
  initialScore: number;
  levelizedScore: number | null;
  termsMissing: string[];
  breakdown: ScoreBreakdownEntry[];
}

/** GET /api/scoring/concepts/{name}/score. */
export interface ConceptScoreReport {
  ok: boolean;
  error?: string;
  knownConcepts?: string[];
  concept: string;
  displayName: string;
  description: string;
  aggregation: string;
  aggregationNote: string;
  totalWeight: number;
  requiredContexts: string[];
  levelized: boolean;
  subjects: ScoredSubject[];
}

/** One ScoreGroup row (CRUDE shape). */
export interface ScoreGroupRow {
  name: string;
  display_name: string;
  group_type: string;
  member_concept_names_json: string;
  description: string;
}

/** One term's agreement line in a group aggregate. */
export interface GroupTermReport {
  key: string;
  label: string;
  participation: number;
  holders: number;
  positiveMembers: string[];
  negativeMembers: string[];
  dominantStance: 'positive' | 'negative' | 'split';
  dominantFraction: number;
  directionClass: string;
  meanWeightShare: number;
  weightShareSpread: number;
  weightClass: string;
}

/** GET /api/scoring/groups/{name}/aggregate (+ /groups/consensus). */
export interface GroupAggregateReport {
  ok: boolean;
  error?: string;
  group: string;
  displayName: string;
  groupType: string;
  members: string[];
  missingMembers: string[];
  memberCount: number;
  policy: string;
  terms: GroupTermReport[];
  agreementIndex: number | null;
}

/** POST /api/scoring/groups/compare. */
export interface GroupCompareReport {
  ok: boolean;
  error?: string;
  policy: string;
  note: string;
  pairs: {
    groups: string[];
    similarity: number;
    similarityClass: string;
    topDisagreements: {
      key: string; gap: number; a: number; b: number;
    }[];
  }[];
}

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
