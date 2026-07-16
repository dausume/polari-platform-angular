/**
 * @cross-cutting
 * @tags @xc:bindings
 * @consumers
 *   - services/multi-scale/*.service.ts (the HTTP/local surfaces these
 *     shapes describe — several previously imported these shapes FROM
 *     each other's service files rather than a shared location)
 *   - components/multi-scale/*
 * @impact-on-edit
 *   Moved out of 10 separate msim-*.service.ts files (2026-07-14,
 *   object/interface placement audit) — no models/multi-scale/ existed
 *   for these before this (NamedMultiScaleSimConfig.ts already existed
 *   separately). Add new multi-scale shapes here, not back in a
 *   service.
 * @see /OVERLAP_MAP.md
 *
 * Multi-scale simulation shapes: IC-interface config/choices, stage
 * gate/search results, proof events, family-series/graph-page data,
 * member info, profile/conformance, authoring (intents/composition/
 * coupling).
 */

/** One choice of a choicePreset IC interface (e.g. a bob material). */
export interface IcChoice {
  key: string;
  label: string;
  description?: string;
  setParams?: Record<string, number>;
  setFields?: Record<string, Record<string, unknown>>;
  /** Milestone B: the substance's physical identity (melting line,
   *  density behavior) — used as the material space's search
   *  fixedParams. A choice carrying this can be PROVEN by the
   *  first-principles stage. */
  substanceParams?: Record<string, number>;
}

/** Milestone B: which composition + stage proves this picker's choices. */
export interface IcProvingStage {
  msim: string;
  stageKey: string;
}

/** Parsed InitialConditionInterfaceDefinition. */
export interface IcInterfaceConfig {
  id: string;
  name: string;
  description: string;
  targetSimulationRef: string;
  targetClassName: string;
  interfaceKind: string; // 'choicePreset' | 'fieldEditor'
  label: string;
  choices: IcChoice[];
  derivedParams: Record<string, string>;
  provingStage: IcProvingStage | null;
}

/** Substance identity needed to draw the analytic melting line. */
export interface MeltLineParams {
  melt_temp_ref: number;
  melt_slope_k_per_pa: number;
}

/** The simulation-intents taxonomy (GET /api/simulations/intents). */
export interface IntentInfo {
  label: string;
  question: string;
  requires: string[];
  produces: string;
  plugPoints: string;
}
export interface IntentsCatalog {
  intents: Record<string, IntentInfo>;
  productBearing: string[];
  continuous: string[];
}

/** One composition-coherence finding (plain language). */
export interface CompositionFinding {
  level: 'error' | 'warning';
  message: string;
}

/** A member simulation as the authoring surfaces need it. */
export interface SimDefLite {
  id: string;
  name: string;
  intent: string;
  timeStepSeconds: number;
  participatingClasses: string[];
}

/** Parsed SimulationCouplingDefinition for the weaving editor. */
export interface CouplingConfig {
  id: string;
  name: string;
  description: string;
  sourceSimulationRef: string;
  sourceClassName: string;
  targetSimulationRef: string;
  targetClassName: string;
  samplerEquationRef: string;
  /** The raw config_json object (sampler operands / inject / defaults). */
  config: Record<string, any>;
  enabled: boolean;
}

/** One family member's fetched series, labeled for the legend. */
export interface FamilyMemberSeries {
  /** Legend-facing name, e.g. 'Paraffin wax'. */
  label: string;
  page: SeriesPage;
}

/** One page of a per-run timeseries from GET /runs/{run}/series. */
export interface SeriesPage {
  run: string;
  class: string;
  steps: number[];
  times: Array<number | null>;
  fields: Record<string, Array<number | null>>;
  lastStep: number | null;
}

/** The explainability slice of a SimulationDefinition row. */
export interface MemberSimInfo {
  name: string;
  description: string;
  /** The sim's declared role-intent (observe | search | …). */
  intent: string;
}

/** A MultiScaleSimulationProfile row (backend field names, parsed). */
export interface MsimProfile {
  name: string;
  display_name: string;
  description: string;
  scaleLevels: { key: string; label: string; units: string;
                 order: number }[];
  stageTemplates: any[];
  fidelityLadder: { rung: number; level: string; engines: string[];
                    costClass: string; purpose: string }[];
  panelRoster: { kind: string; slot: string; required: boolean }[];
  couplingShapes: any[];
  defaultSearchPolicy: Record<string, unknown>;
}

/** One conformance finding (profile_api contract). */
export interface ConformanceFinding {
  level: 'ok' | 'gap' | 'note';
  slot: string;
  message: string;
  evidence: unknown;
}

export interface ConformanceReport {
  conforms: boolean | null;
  profile: string;
  msim: string;
  findings: ConformanceFinding[];
  suggestions: { action: string; reason: string; evidence: unknown }[];
}

/** A substance's proof state changed (search finished or was cleared). */
export interface ProofEvent {
  msim: string;
  stageKey: string;
  substanceKey: string;
  substanceLabel: string;
  /** The substance's physical identity (melting line etc.) — lets
   *  explainability views draw the analytic melt line the attempts
   *  were judged against. */
  substanceParams?: Record<string, number>;
  /** null = proof was cleared ("Try again"). */
  report: StageSearchReport | null;
}

/** A stage's best-known run changed (a proof landed or was cleared). */
export interface StageRunChange {
  msim: string;
  stageKey: string;
  /** The proof winner's run, or null when the proof was cleared. */
  run: string | null;
}

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

/** One valid solution a stage search found. */
export interface StageSearchWinner {
  run: string;
  candidate: Record<string, number>;
  derivedValues: Record<string, unknown> | null;
}

/** Progress/result of a stage's solution search (one batch per call). */
export interface StageSearchReport {
  achieved: boolean;
  /** The FIRST valid solution (what derive flows consume). */
  winner: StageSearchWinner | null;
  /** EVERY valid solution found so far (grows under
   *  continueAfterWinner / search.stopPolicy 'exhaustive'). */
  winners?: StageSearchWinner[];
  /** True once every candidate has been attempted. */
  searchComplete?: boolean;
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
