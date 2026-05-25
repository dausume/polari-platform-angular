/**
 * @cross-cutting
 * @tags @xc:bindings
 * @consumers
 *   - SimulationRunPanelComponent (the Step Once UX)
 *   - (future) live-run controller subscribing to STOMP progress events
 * @impact-on-edit
 *   Surface for simulation lifecycle calls — keep the call shape close
 *   to the backend endpoints so adding /run, /pause, /cancel later is
 *   a one-method-each change.
 *
 * Per-SimulationRun lifecycle operations. v1 ships just `step()`; the
 * background-run + STOMP-streamed `run()` endpoint lands in the next
 * phase and gets methods here without disturbing the call sites.
 */

import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { RuntimeConfigService } from '@services/runtime-config.service';

/** simStepRole values surfaced by the backend's /solutions response.
 *  `null` when the binding is unwired OR the linked solution doesn't
 *  declare a role the SimulationRunner would accept — see
 *  `simStepRoleError` for the human-readable detail. */
export type SimStepRoleHint =
  | 'simStepComplete'
  | 'simStepPartial'
  | 'simStepComposition'
  | null;

/** One entry from /api/simulations/{simRef}/solutions — a per-binding
 *  view of which step solution drives each *SimState class. The editor
 *  sidebar lists these so the user can jump straight to the linked
 *  SimulationExecutionSolution in the no-code editor. */
export interface SimulationStepSolutionEntry {
  bindingName: string;
  simStateClassName: string;
  stepSolutionRef: string;
  dependsOn: string[];
  enabled: boolean;
  orderIndex: number;
  /** Detected role of this binding's step solution. Drives the
   *  sidebar's per-binding role pill and the per-class coordination
   *  summary (e.g. "2 Partials + 1 Composition"). */
  simStepRole: SimStepRoleHint;
  /** Reason the role couldn't be detected, if `simStepRole === null`.
   *  E.g. "no solution wired", "solution 'x' not found",
   *  or "SimulationStateStep entry 'Start' has no simStepRole declared". */
  simStepRoleError: string | null;
  solution: {
    name: string;
    description: string;
    simStateClassName: string;
    expectedInputs: string[];
    expectedOutputs: string[];
  } | null;
}

export interface SimulationSolutionsResponse {
  bindings: SimulationStepSolutionEntry[];
  availableSolutions: Array<{ name: string; targetRuntime: string }>;
  simStateClasses: string[];
}

export interface CreateBindingRequest {
  simStateClassName: string;
  stepSolutionRef?: string;
  orderIndex?: number;
  dependsOn?: string[];
  name?: string;
  description?: string;
  enabled?: boolean;
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
}

/** One entry in the per-binding trace summary returned by /step. */
export interface SimulationStepBindingTrace {
  binding: string;
  simStateClass: string;
  status: 'completed' | 'skipped' | string;
  traceId?: string;
  stepCount?: number;
  reason?: string;
  error?: string;
}

/** /step response payload — what the panel reads to render a result. */
export interface SimulationStepResult {
  success: boolean;
  step: number | null;
  time: number | null;
  /** Each participating SimState class's new row fields. */
  rowsByClass: Record<string, Record<string, unknown>>;
  bindingTraces: SimulationStepBindingTrace[];
  warnings: string[];
  error: string | null;
}

@Injectable({ providedIn: 'root' })
export class SimulationRunService {
  constructor(
    private http: HttpClient,
    private runtimeConfig: RuntimeConfigService,
  ) {}

  /** Create a fresh SimulationRun for a SimulationDefinition. Returns
   *  the new run's name + status so the panel can select it
   *  immediately. */
  async create(simulationRef: string, label?: string): Promise<{name: string; status: string}> {
    const url = `${this.runtimeConfig.getBackendBaseUrl()}/api/simulations/runs`;
    const resp = await firstValueFrom(
      this.http.post<{ success: boolean; data: { name: string; status: string } }>(
        url, { simulationRef, label: label || '' }
      )
    );
    return resp.data;
  }

  /** List the bindings + linked step solutions for a SimulationDefinition,
   *  plus the available solution pool + participating SimState classes
   *  the sidebar needs to render an "add binding" picker. */
  async solutionsFor(simulationRef: string): Promise<SimulationSolutionsResponse> {
    const url = `${this.runtimeConfig.getBackendBaseUrl()}`
      + `/api/simulations/${encodeURIComponent(simulationRef)}/solutions`;
    const resp = await firstValueFrom(
      this.http.get<{ success: boolean; data: SimulationSolutionsResponse }>(url)
    );
    return resp.data ?? { bindings: [], availableSolutions: [], simStateClasses: [] };
  }

  /** Create a new SimStateStepBinding row. */
  async createBinding(simulationRef: string, req: CreateBindingRequest): Promise<{name: string}> {
    const url = `${this.runtimeConfig.getBackendBaseUrl()}`
      + `/api/simulations/${encodeURIComponent(simulationRef)}/bindings`;
    const resp = await firstValueFrom(
      this.http.post<{ success: boolean; data: { name: string } }>(url, req)
    );
    return resp.data;
  }

  /** List the bindings that reference a given SolutionDefinition (or
   *  SimulationExecutionSolution wrapping it). Used by the no-code
   *  editor's SimulationStateStep overlay so the user can see every
   *  simulation that consumes the solution they're editing. */
  async simulationsUsingSolution(solutionName: string): Promise<Array<{
    bindingName: string;
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

  /** Delete a SimStateStepBinding by name. */
  async deleteBinding(bindingName: string): Promise<void> {
    const url = `${this.runtimeConfig.getBackendBaseUrl()}`
      + `/api/simulations/bindings/${encodeURIComponent(bindingName)}`;
    await firstValueFrom(
      this.http.delete<{ success: boolean }>(url)
    );
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
