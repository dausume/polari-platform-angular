/**
 * @cross-cutting
 * @tags @xc:bindings
 * @consumers
 *   - services/sim-space/simulation-run.service.ts (the HTTP surface
 *     these shapes describe)
 *   - SimulationRunPanelComponent, SimSpaceInitialConditionsPanelComponent,
 *     SimSpaceEditorSidebarComponent, RunInitialConditionsEditorComponent,
 *     msim-* (multi-scale reuses the same run/step/IC shapes)
 * @impact-on-edit
 *   Moved out of simulation-run.service.ts (2026-07-14, object/interface
 *   placement audit) — this domain's own service was the one file
 *   breaking sim-space's own models/<domain>/ convention. Keep this the
 *   single source of truth for run/step/IC/storage-estimate shapes;
 *   the service imports from here, it does not redeclare them.
 * @see /OVERLAP_MAP.md
 *
 * SimulationRun lifecycle + per-simulation SimulationExecutionSolution
 * shapes — everything services/sim-space/simulation-run.service.ts's
 * HTTP calls send/receive.
 */

/** simStepRole values surfaced by the backend's /solutions response.
 *  `null` when the row is unwired OR the linked solution doesn't
 *  declare a role the SimulationRunner would accept — see
 *  `simStepRoleError` for the human-readable detail. */
export type SimStepRoleHint =
  | 'simStepComplete'
  | 'simStepPartial'
  | 'simStepComposition'
  | null;

/** One entry from /api/simulations/{simRef}/solutions — a
 *  SimulationExecutionSolution row plus role detection. */
export interface SimulationExecutionSolutionEntry {
  name: string;
  description: string;
  simStateClassName: string;
  solutionDefinitionRef: string;
  expectedInputs: string[];
  expectedOutputs: string[];
  orderIndex: number;
  dependsOn: string[];
  enabled: boolean;
  /** Detected role of this row's underlying step solution. Drives the
   *  sidebar's per-row role pill and the per-class coordination
   *  summary (e.g. "2 Partials + 1 Composition"). */
  simStepRole: SimStepRoleHint;
  /** Reason the role couldn't be detected, if `simStepRole === null`.
   *  E.g. "no solution wired", "solution 'x' not found". */
  simStepRoleError: string | null;
}

/** Hybrid initial-conditions view: class declares a baseline,
 *  SimulationDefinition can override per-class. The runner applies
 *  baseline first, then overrides (sim wins). */
export interface InitialConditionsForClass {
  classDefaults: Record<string, unknown>;
  simOverrides: Record<string, unknown>;
}

/** Per-field save policy decision. */
export type FieldSavePolicy = 'core' | 'derivable' | 'skip';

/** A single field's effective save rule. */
export interface FieldSaveRule {
  policy?: FieldSavePolicy;
  /** Per-field recording interval; 0 / missing = inherit
   *  sim def's recording_interval_steps. */
  interval?: number;
}

/** Hybrid field-policy view, mirrors InitialConditionsForClass. */
export interface FieldPoliciesForClass {
  /** Class-declared default per field. Missing entries default to 'core'. */
  classDefaults: Record<string, FieldSavePolicy>;
  /** Sim-def-level overrides. Keyed by FIELD name (not <class>.<field>). */
  simOverrides: Record<string, FieldSaveRule>;
}

export interface SimulationSolutionsResponse {
  solutions: SimulationExecutionSolutionEntry[];
  availableSolutions: Array<{ name: string; targetRuntime: string }>;
  simStateClasses: string[];
  initialConditions: Record<string, InitialConditionsForClass>;
  fieldPolicies?: Record<string, FieldPoliciesForClass>;
}

/** Source tag on a per-field byte estimate. Drives the UI warning
 *  when the predictor is using conservative static defaults. */
export type StorageEstimateSource =
  | 'static'                  // no measurements; using TYPE_BYTES table
  | 'measured-insufficient'   // < threshold samples; still using static
  | 'measured';               // running average from PolyTyping

export interface StorageEstimateFieldEntry {
  policy: FieldSavePolicy;
  /** Per-field recording interval; 0 = inherit sim def's. */
  interval: number;
  rowsPersisted: number;
  bytes: number;
  minBytes: number;
  maxBytes: number;
  source: StorageEstimateSource;
  sampleCount: number;
}

export interface StorageEstimateClassEntry {
  rowOverheadBytes: number;
  rowsPersisted: number;
  normalCaseBytes: number;
  minBytes: number;
  maxBytes: number;
  fields: Record<string, StorageEstimateFieldEntry>;
}

export interface StorageEstimate {
  totalSteps: number;
  normalCaseBytes: number;
  minBytes: number;
  maxBytes: number;
  normalCaseHuman: string;
  minCaseHuman: string;
  maxCaseHuman: string;
  usesStaticEstimates: boolean;
  perClass: Record<string, StorageEstimateClassEntry>;
  notes: string[];
}

export interface CreateSolutionRowRequest {
  simStateClassName: string;
  solutionDefinitionRef?: string;
  orderIndex?: number;
  dependsOn?: string[];
  name?: string;
  description?: string;
  enabled?: boolean;
  expectedInputs?: string[];
  expectedOutputs?: string[];
}

export interface SimulationRunSummary {
  name: string;
  simulationRef: string;
  status: string;
  startedAt: string;
  completedAt: string;
  totalSteps: number;
  recordedSteps: number;
  lastRecordedStep: number;
  label: string;
  errorMessage: string;
  /** {source_sim: source_run} — non-empty means this run is a COUPLED
   *  (multi-scale) run whose sources lazy-pull with it. */
  coupledRunRefs?: Record<string, string>;
}

/** One entry in the per-solution trace summary returned by /step. */
export interface SimulationStepSolutionTrace {
  solution: string;
  simStateClass: string;
  status: 'completed' | 'skipped' | 'initial-conditions' | string;
  role?: string;
  orderIndex?: number;
  traceId?: string;
  stepCount?: number;
  reason?: string;
  error?: string;
  contributionsEmitted?: number;
  partialsMerged?: number;
}

/** /step response payload — what the panel reads to render a result. */
export interface SimulationStepResult {
  success: boolean;
  step: number | null;
  time: number | null;
  /** Each participating SimState class's new row fields. */
  rowsByClass: Record<string, Record<string, unknown>>;
  solutionTraces: SimulationStepSolutionTrace[];
  warnings: string[];
  error: string | null;
}
