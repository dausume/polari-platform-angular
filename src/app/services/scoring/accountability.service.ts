import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { PolariService } from '@services/polari-service';
import {
  parseCrudeReadAllResponse,
} from '@services/sim-space/crude-response-parser';

import {
  SubjectRow,
  ElectionRow,
  ContributorRow,
  AssertionRow,
  SuggestionReport,
  ValidityReport,
  PolicyScoreReport,
  PoliticianScoreReport,
  CohortReport,
  SpecificityReport,
  CriticalContextReport,
  ContributorRecord,
  OutletAccuracyReport,
  GroupBiasReport,
  SurvivalWalkthrough,
  SurvivalSubmitResult,
  SurvivalReport,
  ContextRow,
  ElectionTally,
} from '@models/scoring/scoring-types';

/**
 * Read/act access for the accountability chain (scr-5/6/8):
 * assertions, evidence-weighted policy scores, politician votes,
 * cohorts, worldview elections. Transitions and election apply are
 * the only writes — explicit knob actions, everything else is CRUDE.
 */
@Injectable({ providedIn: 'root' })
export class AccountabilityService {

  constructor(private http: HttpClient,
              private polariService: PolariService) {}

  private base(): string {
    return this.polariService.getBackendBaseUrl();
  }

  private get<T>(path: string): Promise<T | null> {
    return firstValueFrom(this.http.get<T>(
      `${this.base()}${path}`,
      this.polariService.backendRequestOptions))
      .catch((err) => err?.error?.ok === false ? err.error : null);
  }

  private post<T>(path: string, body: unknown): Promise<T | null> {
    return firstValueFrom(this.http.post<T>(
      `${this.base()}${path}`, body,
      this.polariService.backendRequestOptions))
      .catch((err) => err?.error?.ok === false ? err.error : null);
  }

  private crudeAll<T>(className: string): Promise<T[]> {
    return firstValueFrom(this.http.get<unknown>(
      `${this.base()}/${className}`,
      this.polariService.backendRequestOptions))
      .then(res => parseCrudeReadAllResponse(res, className) as T[])
      .catch(() => []);
  }

  subjects(kind?: string): Promise<SubjectRow[]> {
    return this.crudeAll<SubjectRow>('ScoreSubject')
      .then(rows => kind
        ? rows.filter(r => r.kind === kind) : rows);
  }

  elections(): Promise<ElectionRow[]> {
    return this.crudeAll<ElectionRow>('WorldviewElection');
  }

  contributors(): Promise<ContributorRow[]> {
    return this.crudeAll<ContributorRow>('Contributor');
  }

  assertions(subject?: string): Promise<AssertionRow[]> {
    const query = subject
      ? `?subject=${encodeURIComponent(subject)}` : '';
    return this.get<{ ok: boolean; assertions: AssertionRow[] }>(
      `/api/scoring/assertions${query}`)
      .then(res => res?.assertions ?? []);
  }

  suggestions(assertion: string): Promise<SuggestionReport | null> {
    return this.get(`/api/scoring/assertions/`
      + `${encodeURIComponent(assertion)}/suggestions`);
  }

  validity(assertion: string): Promise<ValidityReport | null> {
    return this.get(`/api/scoring/assertions/`
      + `${encodeURIComponent(assertion)}/validity`);
  }

  transition(assertion: string, to: string, by: string, note: string):
      Promise<{ ok: boolean; error?: string; status?: string } | null> {
    return this.post(`/api/scoring/assertions/`
      + `${encodeURIComponent(assertion)}/transition`,
      { to, by, note });
  }

  policyScore(policy: string, concept: string):
      Promise<PolicyScoreReport | null> {
    return this.get(`/api/scoring/policies/`
      + `${encodeURIComponent(policy)}/score`
      + `?concept=${encodeURIComponent(concept)}`);
  }

  politicianScore(politician: string, concept: string):
      Promise<PoliticianScoreReport | null> {
    return this.get(`/api/scoring/politicians/`
      + `${encodeURIComponent(politician)}/score`
      + `?concept=${encodeURIComponent(concept)}`);
  }

  cohortReport(group: string, concept: string):
      Promise<CohortReport | null> {
    return this.get(`/api/scoring/cohorts/`
      + `${encodeURIComponent(group)}/report`
      + `?concept=${encodeURIComponent(concept)}`);
  }

  specificity(concept: string): Promise<SpecificityReport | null> {
    return this.get(`/api/scoring/concepts/`
      + `${encodeURIComponent(concept)}/specificity`);
  }

  criticalContexts(concept: string):
      Promise<CriticalContextReport | null> {
    return this.get(`/api/scoring/concepts/`
      + `${encodeURIComponent(concept)}/critical-contexts`);
  }

  contributorRecord(name: string): Promise<ContributorRecord | null> {
    return this.get(`/api/scoring/contributors/`
      + `${encodeURIComponent(name)}/record`);
  }

  contexts(type?: string): Promise<ContextRow[]> {
    return this.crudeAll<ContextRow>('ScoreContext')
      .then(rows => type
        ? rows.filter(r => r.context_type === type) : rows);
  }

  survivalWalkthrough(): Promise<SurvivalWalkthrough | null> {
    return this.get('/api/scoring/survival/walkthrough');
  }

  survivalSubmit(payload: unknown):
      Promise<SurvivalSubmitResult | null> {
    return this.post('/api/scoring/survival/submit', payload);
  }

  survivalReport(location: string, month: string):
      Promise<SurvivalReport | null> {
    const monthQuery = month
      ? `&month=${encodeURIComponent(month)}` : '';
    return this.get(`/api/scoring/survival/report`
      + `?location=${encodeURIComponent(location)}${monthQuery}`);
  }

  outletAccuracy(name: string): Promise<OutletAccuracyReport | null> {
    return this.get(`/api/scoring/outlets/`
      + `${encodeURIComponent(name)}/accuracy`);
  }

  groupBias(name: string): Promise<GroupBiasReport | null> {
    return this.get(`/api/scoring/groups/`
      + `${encodeURIComponent(name)}/bias`);
  }

  electionTally(name: string): Promise<ElectionTally | null> {
    return this.get(`/api/scoring/elections/`
      + `${encodeURIComponent(name)}/tally`);
  }

  electionApply(name: string): Promise<{
    ok: boolean; error?: string; appliedWeights?: Record<string, number>;
    weightsProvenance?: string; suggestion?: { action: string };
  } | null> {
    return this.post(`/api/scoring/elections/`
      + `${encodeURIComponent(name)}/apply`, {});
  }
}
