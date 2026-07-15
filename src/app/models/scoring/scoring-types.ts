/**
 * @cross-cutting
 * @tags @xc:bindings
 * @consumers
 *   - services/scoring/accountability.service.ts, services/scoring/scoring.service.ts
 *     (the HTTP surfaces these shapes describe)
 *   - components/scoring/scoring-home.component.ts,
 *     survival-costs.component.ts, policy-accountability.component.ts
 * @impact-on-edit
 *   Moved out of accountability.service.ts + scoring.service.ts
 *   (2026-07-14, object/interface placement audit) — no models/scoring/
 *   existed at all before this; these two services had 20 and 8 inline
 *   interfaces respectively. Add new scoring/accountability response
 *   shapes here, not back in the services.
 * @see /OVERLAP_MAP.md
 *
 * Scoring + accountability-chain report shapes: concepts, groups,
 * assertions, policy/politician/cohort scores, worldview elections,
 * survival-cost profiles, outlet accuracy, group bias.
 */

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
