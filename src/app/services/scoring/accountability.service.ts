import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { PolariService } from '@services/polari-service';
import {
  parseCrudeReadAllResponse,
} from '@services/sim-space/crude-response-parser';

/** One ScoreSubject row (CRUDE shape). */
export interface SubjectRow {
  name: string;
  display_name: string;
  kind: string;
  description: string;
}

/** One WorldviewElection row (CRUDE shape). */
export interface ElectionRow {
  name: string;
  display_name: string;
  group_name: string;
  mode: string;
  status: string;
  description: string;
}

/** One Contributor row (CRUDE shape). */
export interface ContributorRow {
  name: string;
  display_name: string;
  kind: string;
  pseudonymous: boolean;
  description: string;
}

/** One assertion (GET /api/scoring/assertions). */
export interface AssertionRow {
  name: string;
  displayName: string;
  subject: string;
  span: { start: number; end: number; quote: string } | null;
  intent: string;
  type: 'score-impact' | 'dependency' | 'decorative';
  direction: string;
  strength: number | null;
  conceptName: string;
  termName: string;
  dependsOn: string;
  evidence: string[];
  assertedBy: string;
  status: string;
  statusHistory: {
    from: string; to: string; by: string; note: string; at: string;
  }[];
}

/** GET /api/scoring/assertions/{name}/suggestions. */
export interface SuggestionReport {
  ok: boolean;
  error?: string;
  assertion: string;
  intent: string;
  alreadyBound: string | null;
  suggestions: {
    kind: 'term' | 'concept'; name: string; displayName: string;
    matchScore: number; evidence: unknown[]; knob: string;
    action: string;
  }[];
  note: string;
}

/** GET /api/scoring/assertions/{name}/validity. */
export interface ValidityReport {
  ok: boolean;
  error?: string;
  assertion: string;
  status: string;
  rounds: {
    round: number; valid: number; invalid: number; abstain: number;
    dominantFraction: number; leaning: string; band: string;
    voters: string[];
  }[];
  suggestion: { knob: string; action: string; evidence: string } | null;
  note: string;
}

/** GET /api/scoring/policies/{name}/score. */
export interface PolicyScoreReport {
  ok: boolean;
  error?: string;
  policy: string;
  displayName: string;
  concept: string;
  stance: number;
  score: number;
  totalWeight: number;
  includeStatuses: string[];
  assertionsUsed: {
    assertion: string; type: string; status: string; intent: string;
    quote: string; assertedBy: string; direction?: string;
    stance: number; strength: number; weight: number;
    term?: string; termShare?: number | null;
    dependsOn?: string; childScore?: number;
    evidence: { grade: string; items?: unknown[] };
  }[];
  excluded: {
    assertion: string; type: string; status: string; reason: string;
    quote?: string; suggestion?: { knob: string; action: string };
  }[];
  suggestion?: { knob: string; action: string };
  note: string;
}

/** GET /api/scoring/politicians/{name}/score. */
export interface PoliticianScoreReport {
  ok: boolean;
  error?: string;
  politician: string;
  displayName: string;
  concept: string;
  stance: number;
  score: number;
  decisiveVotes: number;
  participation: number | null;
  abstains: { policy: string; vote: string; voteDate: string }[];
  unscoreablePolicies: { policy: string; error: string }[];
  voteBreakdown: {
    policy: string; vote: string; voteDate: string;
    policyStance: number; policyScore: number; contribution: number;
  }[];
  note: string;
}

/** GET /api/scoring/cohorts/{name}/report. */
export interface CohortReport {
  ok: boolean;
  error?: string;
  group: string;
  displayName: string;
  concept: string;
  members: {
    politician: string; score: number | null; stance: number | null;
    participation: number | null; error: string | null;
  }[];
  cohortMeanScore: number | null;
  voteCohesion: {
    policy: string; yea: number; nay: number; abstain: number;
    dominantFraction: number; band: string;
  }[];
  note: string;
}

/** GET /api/scoring/concepts/{name}/specificity. */
export interface SpecificityReport {
  ok: boolean;
  error?: string;
  concept: string;
  findings: {
    kind: string; term: string; subject?: string; evidence: unknown;
    suggestion?: { knob: string; action: string };
  }[];
  clean: boolean;
  note: string;
}

/** GET /api/scoring/concepts/{name}/critical-contexts. */
export interface CriticalContextReport {
  ok: boolean;
  error?: string;
  concept: string;
  suggestions: {
    context: string; displayName: string; term: string;
    divergenceRatio: number; sampleCount: number; knob: string;
    action: string;
  }[];
  note: string;
}

/** GET /api/scoring/contributors/{name}/record. */
export interface ContributorRecord {
  ok: boolean;
  error?: string;
  contributor: string;
  displayName: string;
  kind: string;
  pseudonymous: boolean;
  assertions: {
    total: number; byStatus: Record<string, number>;
    confirmationRate: number | null; reviewed: number; names: string[];
  };
  validityVotesCast: number;
  evidenceSubmitted: string[];
  valuesContributed: number;
  note: string;
}

/** GET /api/scoring/outlets/{name}/accuracy (scr-15). */
export interface OutletAccuracyReport {
  ok: boolean;
  error?: string;
  outlet: string;
  displayName: string;
  claimsTotal: number;
  checked: number;
  unverifiable: number;
  verdicts: Record<string, number>;
  meanRelativeError: number | null;
  perTerm: Record<string, {
    claims: number; meanRelativeError: number | null;
  }>;
  checks: {
    claim: string; statement: string; verdict: string;
    claimedValue: number | null; measuredValue: number | null;
    relativeError: number | null; reason: string | null;
  }[];
  note: string;
}

/** GET /api/scoring/groups/{name}/bias (scr-16). */
export interface GroupBiasReport {
  ok: boolean;
  error?: string;
  group: string;
  displayName: string;
  memberContributors: string[];
  biasPolicy: string | null;
  stanceSkew: {
    terms: {
      key: string; groupStance: number; consensusStance: number;
      groupShare: number; consensusShare: number; shareGap: number;
      reading: string;
    }[];
    opposedTerms: number;
    vsConsensusOf: number | null;
  };
  oneSidedness: {
    targetKind: string; supports: number; harms: number;
    dominantFraction: number; band: string; smallSample: boolean;
    assertions: string[];
  }[];
  voteAlignment: {
    decisiveVotes: number; selfServing: number; counterStance: number;
    alignmentRate: number | null; band: string; smallSample: boolean;
    votes: {
      voter: string; assertion: string; direction: string;
      term: string; favorableToGroup: boolean; castVote: string;
      selfServing: boolean;
    }[];
    skipped: { vote: string; reason: string }[];
    reading: string;
  };
  sourceQuality: {
    gradeDistribution: Record<string, number>;
    unevidencedAssertions: number;
    outletsCited: Record<string, {
      citations: number; meanRelativeError: number | null;
      verdicts: Record<string, number> | null; note: string | null;
    }>;
  };
  note: string;
}

/** GET /api/scoring/survival/walkthrough (scr-12a). */
export interface SurvivalWalkthrough {
  ok: boolean;
  error?: string;
  householdKnobs: { knob: string; prompt: string }[];
  method: string;
  steps: {
    category: string; displayName: string; kind: string;
    guidance: string; examples: string; required: boolean;
    description: string;
  }[];
  note: string;
}

/** POST /api/scoring/survival/submit result. */
export interface SurvivalSubmitResult {
  ok: boolean;
  error?: string;
  profile?: string;
  totalMonthly?: number;
  entered?: string[];
  skipped?: string[];
  requiredGaps?: string[];
  refused?: { category: string; error: string }[];
  suggestion?: { knob: string; action: string };
  note?: string;
}

/** GET /api/scoring/survival/report. */
export interface SurvivalReport {
  ok: boolean;
  error?: string;
  location: string;
  month: string;
  profiles: number;
  smallSample: boolean;
  totalMonthly: { n: number; mean: number; median: number };
  categories: {
    category: string; displayName: string; kind: string; n: number;
    mean: number; median: number; enteredBy: number;
    ofProfiles: number;
  }[];
  subtotalsByKind: Record<string, number>;
  pseudoTaxShare: number | null;
  note: string;
  suggestion?: { knob: string; action: string };
}

/** One ScoreContext row (CRUDE shape). */
export interface ContextRow {
  name: string;
  display_name: string;
  context_type: string;
}

/** GET /api/scoring/elections/{name}/tally. */
export interface ElectionTally {
  ok: boolean;
  error?: string;
  election: string;
  displayName: string;
  group: string;
  mode: string;
  status: string;
  candidates: string[];
  ballotsCast: number;
  ballotsCounted: number;
  refusedBallots: { ballot: string; error: string }[];
  results: Record<string, unknown>[];
  winners: string[];
  electedWeights: Record<string, number>;
  note: string;
  suggestion: { knob: string; action: string };
}

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
