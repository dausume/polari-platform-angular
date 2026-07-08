import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { PolariService } from '@services/polari-service';

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
}
