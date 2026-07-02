/**
 * @cross-cutting
 * @tags @xc:bindings
 * @consumers
 *   - SimulationRunPanelComponent (the Step Once UX)
 *   - SimSpaceEditorSidebarComponent (per-class solutions list)
 *   - InitialStateOverlayComponent (simulationsUsingSolution)
 * @impact-on-edit
 *   Surface for simulation lifecycle calls — keep the call shape close
 *   to the backend endpoints so adding /run, /pause, /cancel later is
 *   a one-method-each change.
 *
 * Per-SimulationRun lifecycle operations plus the per-simulation
 * SimulationExecutionSolution CRUDE used by the sidebar.
 */

import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { RuntimeConfigService } from '@services/runtime-config.service';

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

@Injectable({ providedIn: 'root' })
export class SimulationRunService {
  constructor(
    private http: HttpClient,
    private runtimeConfig: RuntimeConfigService,
  ) {}

  /** Create a fresh SimulationRun for a SimulationDefinition.
   *
   *  Optional override layers, all per-run, all applied on top of the
   *  sim def's saved values:
   *    - initialConditionsOverrides: per-class field-value overrides
   *    - timeStepSeconds: dt override (0 = inherit)
   *    - fieldSaveOverrides: per-`<class>.<field>` save-rule overrides
   *      (policy + optional per-field interval) */
  async create(
    simulationRef: string,
    label?: string,
    initialConditionsOverrides?: Record<string, Record<string, unknown>>,
    timeStepSeconds?: number,
    fieldSaveOverrides?: Record<string, FieldSaveRule>,
    parameterOverrides?: Record<string, unknown>,
    coupledRunRefs?: Record<string, string>,
  ): Promise<{name: string; status: string}> {
    const url = `${this.runtimeConfig.getBackendBaseUrl()}/api/simulations/runs`;
    const resp = await firstValueFrom(
      this.http.post<{ success: boolean; data: { name: string; status: string } }>(
        url,
        {
          simulationRef,
          label: label || '',
          initialConditionsOverrides: initialConditionsOverrides || {},
          timeStepSeconds: timeStepSeconds ?? 0,
          fieldSaveOverrides: fieldSaveOverrides || {},
          // Per-run PARAMETER overrides (layered over the sim def's
          // parameters_json) — the material-picker channel.
          parameterOverrides: parameterOverrides || {},
          // Coupled source runs — a new run of a multi-scale sim must
          // name its sources or it runs uncoupled (defaults).
          coupledRunRefs: coupledRunRefs || {},
        },
      )
    );
    return resp.data;
  }

  /** Write per-run initial conditions onto an existing, uninitialized
   *  run (one created with no step 0 yet). Mirrors the override layers
   *  accepted by `create`. Backend 409s if the run is already locked
   *  (has a committed step 0). */
  async setInitialConditions(
    runName: string,
    initialConditionsOverrides?: Record<string, Record<string, unknown>>,
    timeStepSeconds?: number,
    fieldSaveOverrides?: Record<string, FieldSaveRule>,
  ): Promise<{ name: string; status: string }> {
    const url = `${this.runtimeConfig.getBackendBaseUrl()}`
      + `/api/simulations/runs/${encodeURIComponent(runName)}/initial-conditions`;
    const resp = await firstValueFrom(
      this.http.post<{ success: boolean; data: { name: string; status: string } }>(
        url,
        {
          initialConditionsOverrides: initialConditionsOverrides || {},
          timeStepSeconds: timeStepSeconds ?? 0,
          fieldSaveOverrides: fieldSaveOverrides || {},
        },
      )
    );
    return resp.data;
  }

  /** Live storage estimate for a hypothetical run configuration. The
   *  IC editor calls this on debounce so users see how their tweaks
   *  affect persisted bytes before committing. */
  async estimateStorage(
    simulationRef: string,
    fieldSaveOverrides: Record<string, FieldSaveRule>,
    timeStepSeconds?: number,
  ): Promise<StorageEstimate> {
    const url = `${this.runtimeConfig.getBackendBaseUrl()}`
      + `/api/simulations/${encodeURIComponent(simulationRef)}/storage-estimate`;
    const resp = await firstValueFrom(
      this.http.post<{ success: boolean; data: StorageEstimate }>(
        url,
        { fieldSaveOverrides, timeStepSeconds: timeStepSeconds ?? 0 },
      ),
    );
    return resp.data;
  }

  /** Loop run_step `steps` times in a single request. When
   *  `timeStepSeconds` is supplied, the run's dt is updated before the
   *  loop so subsequent Step Once calls inherit the new resolution.
   *  Aborts on the first failed step; the response carries committed
   *  step counts + the final time either way. */
  async runBatch(
    runName: string,
    steps: number,
    timeStepSeconds?: number,
  ): Promise<{
    committedSteps: number;
    finalStep: number | null;
    finalTime: number | null;
    warnings: string[];
    committed: Array<{ step: number | null; time: number | null }>;
    lastSolutionTraces?: any[];
    lastRowsByClass?: Record<string, Record<string, unknown>>;
    lastFailedStep?: number | null;
    error?: string | null;
  }> {
    const url = `${this.runtimeConfig.getBackendBaseUrl()}`
      + `/api/simulations/runs/${encodeURIComponent(runName)}/run`;
    const body: any = { steps };
    if (timeStepSeconds !== undefined) body.timeStepSeconds = timeStepSeconds;
    try {
      const resp = await firstValueFrom(
        this.http.post<{ success: boolean; data: any }>(url, body)
      );
      return resp.data;
    } catch (err: any) {
      // Falcon returns 400 + structured body on a mid-batch failure;
      // surface that body to the caller rather than throwing.
      if (err?.error?.data) return err.error.data;
      throw err;
    }
  }

  /** Run the sim def's initial-conditions validator (if any) against
   *  the given per-class override proposal. Used by the live debounced
   *  editor to surface "valid" / "invalid: <reason>" as the user edits.
   *
   *  Returns `hasValidator=false` when the sim def doesn't have a
   *  validator wired — in that case the editor should treat any
   *  proposed values as trivially acceptable. */
  async validateInitialConditions(
    simulationRef: string,
    overrides: Record<string, Record<string, unknown>>,
    parameterOverrides?: Record<string, unknown>,
  ): Promise<{
    valid: boolean;
    hasValidator: boolean;
    reason: string;
    repairedValues: Record<string, Record<string, unknown>> | null;
    error: string | null;
    mergedInitialConditions: Record<string, Record<string, unknown>>;
  }> {
    const url = `${this.runtimeConfig.getBackendBaseUrl()}`
      + `/api/simulations/${encodeURIComponent(simulationRef)}/validate-initial-conditions`;
    const body: any = { overrides };
    if (parameterOverrides && Object.keys(parameterOverrides).length) {
      // Validated exactly as they'll run (backend layers them over the
      // sim def's parameters before invoking the validator).
      body.parameterOverrides = parameterOverrides;
    }
    const resp = await firstValueFrom(
      this.http.post<{ success: boolean; data: any }>(url, body)
    );
    return resp.data;
  }

  /** List SimulationExecutionSolution rows for a SimulationDefinition,
   *  plus the available SolutionDefinition pool, participating SimState
   *  classes, and per-class hybrid initial-conditions view. */
  async solutionsFor(simulationRef: string): Promise<SimulationSolutionsResponse> {
    const url = `${this.runtimeConfig.getBackendBaseUrl()}`
      + `/api/simulations/${encodeURIComponent(simulationRef)}/solutions`;
    const resp = await firstValueFrom(
      this.http.get<{ success: boolean; data: SimulationSolutionsResponse }>(url)
    );
    return resp.data ?? {
      solutions: [],
      availableSolutions: [],
      simStateClasses: [],
      initialConditions: {},
    };
  }

  /** Create a new SimulationExecutionSolution row. */
  async createSolutionRow(
    simulationRef: string,
    req: CreateSolutionRowRequest,
  ): Promise<{name: string}> {
    const url = `${this.runtimeConfig.getBackendBaseUrl()}`
      + `/api/simulations/${encodeURIComponent(simulationRef)}/solutions`;
    const resp = await firstValueFrom(
      this.http.post<{ success: boolean; data: { name: string } }>(url, req)
    );
    return resp.data;
  }

  /** List the SimulationExecutionSolution rows that reference a given
   *  SolutionDefinition. Used by the no-code editor's
   *  SimulationStateStep overlay. */
  async simulationsUsingSolution(solutionName: string): Promise<Array<{
    solutionRowName: string;
    simulationRef: string;
    simStateClassName: string;
    enabled: boolean;
    orderIndex: number;
  }>> {
    const url = `${this.runtimeConfig.getBackendBaseUrl()}`
      + `/api/simulations/by-solution/${encodeURIComponent(solutionName)}`;
    const resp = await firstValueFrom(
      this.http.get<{ success: boolean; data: Array<any> }>(url)
    );
    return resp.data ?? [];
  }

  /** Delete a SimulationExecutionSolution row by name. */
  async deleteSolutionRow(name: string): Promise<void> {
    const url = `${this.runtimeConfig.getBackendBaseUrl()}`
      + `/api/simulations/solutions/${encodeURIComponent(name)}`;
    await firstValueFrom(
      this.http.delete<{ success: boolean }>(url)
    );
  }

  /** Committed row per participating *SimState class for a run. Without
   *  `step`, returns the most-recent row (drives the live current-state
   *  display). With `step`, returns the row at exactly that step — the
   *  IC editor uses `step=0` to show a locked run's initial conditions. */
  async currentStateFor(runName: string, step?: number): Promise<{
    step: number | null;
    time: number | null;
    perClass: Record<string, Record<string, unknown>>;
  }> {
    const qs = step !== undefined ? `?step=${step}` : '';
    const url = `${this.runtimeConfig.getBackendBaseUrl()}`
      + `/api/simulations/runs/${encodeURIComponent(runName)}/current-state${qs}`;
    const resp = await firstValueFrom(
      this.http.get<{ success: boolean; data: any }>(url),
    );
    return resp.data ?? { step: null, time: null, perClass: {} };
  }

  /** List runs, optionally filtered to a SimulationDefinition. */
  async list(simulationRef?: string): Promise<SimulationRunSummary[]> {
    const qs = simulationRef ? `?simulationRef=${encodeURIComponent(simulationRef)}` : '';
    const url = `${this.runtimeConfig.getBackendBaseUrl()}/api/simulations/runs${qs}`;
    const resp = await firstValueFrom(
      this.http.get<{ success: boolean; data: SimulationRunSummary[] }>(url)
    );
    return resp.data ?? [];
  }

  /** Advance one timestep. When `targetStep` is omitted the backend
   *  picks `run.last_recorded_step + 1` (or 0 if the run is empty). */
  async step(runName: string, targetStep?: number): Promise<SimulationStepResult> {
    const url = `${this.runtimeConfig.getBackendBaseUrl()}`
      + `/api/simulations/runs/${encodeURIComponent(runName)}/step`;
    const body = targetStep !== undefined ? { targetStep } : {};
    const resp = await firstValueFrom(
      this.http.post<{ success: boolean; data: SimulationStepResult }>(url, body)
    );
    return resp.data;
  }
}
