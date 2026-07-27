import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { PolariService } from '@services/polari-service';

import {
  TopologyListEntry,
  TopologySummary,
  TopologyMeta,
  TopologyMachine,
  TopologyInstance,
  ModuleAssignment,
  EdgeStatus,
  ModuleDependencyEdge,
  ModuleGraphReport,
  TopologyConnection,
  TopologyGraph,
  ValidationFinding,
  ValidateReport,
  DriftRow,
  DriftReport,
  AssignResult,
  MoveRequest,
  MoveResult,
  ResolveResult,
  TestRunResult,
  TopologyTestingReport,
} from '@models/topology/topology-types';

/**
 * Read/write access to the topology-as-data API (top-5/6). Every
 * method maps to one /api/topology endpoint; nothing here shells
 * out — deploys are always the human's pol command, shown as text.
 */
@Injectable({ providedIn: 'root' })
export class TopologyService {

  constructor(private http: HttpClient,
              private polariService: PolariService) {}

  private url(path: string): string {
    return `${this.polariService.getBackendBaseUrl()}/api/topology${path}`;
  }

  summary(): Promise<TopologySummary | null> {
    return firstValueFrom(this.http.get<TopologySummary>(
      this.url('/summary'), this.polariService.backendRequestOptions))
      .catch((err) => err?.error?.ok === false ? err.error : null);
  }

  graph(name?: string): Promise<TopologyGraph | null> {
    const query = name ? `?name=${encodeURIComponent(name)}` : '';
    return firstValueFrom(this.http.get<TopologyGraph>(
      this.url(`/graph${query}`),
      this.polariService.backendRequestOptions))
      .catch((err) => err?.error?.ok === false ? err.error : null);
  }

  moduleGraph(name?: string): Promise<ModuleGraphReport | null> {
    const query = name ? `?name=${encodeURIComponent(name)}` : '';
    return firstValueFrom(this.http.get<ModuleGraphReport>(
      this.url(`/module-graph${query}`),
      this.polariService.backendRequestOptions))
      .catch((err) => err?.error?.ok === false ? err.error : null);
  }

  validate(name?: string): Promise<ValidateReport | null> {
    return firstValueFrom(this.http.post<ValidateReport>(
      this.url('/validate'), name ? { name } : {},
      this.polariService.backendRequestOptions))
      .catch((err) => err?.error?.ok === false ? err.error : null);
  }

  drift(name?: string): Promise<DriftReport | null> {
    const query = name ? `?name=${encodeURIComponent(name)}` : '';
    return firstValueFrom(this.http.get<DriftReport>(
      this.url(`/drift${query}`),
      this.polariService.backendRequestOptions))
      .catch((err) => err?.error?.ok === false ? err.error : null);
  }

  assign(module: string, toInstance: string,
         fromInstance?: string): Promise<AssignResult | null> {
    const body: Record<string, string> = {
      module, to_instance: toInstance,
    };
    if (fromInstance) { body['from_instance'] = fromInstance; }
    return firstValueFrom(this.http.post<AssignResult>(
      this.url('/assign'), body,
      this.polariService.backendRequestOptions))
      .catch((err) => err?.error?.ok === false ? err.error : null);
  }

  /** tt-13: dynamic move — the backend plans module-reassignment
   *  vs engine-relocation from the target kind; rows persist so
   *  the move IS the configuration that comes back up. */
  move(request: MoveRequest): Promise<MoveResult | null> {
    const body: Record<string, string> = { module: request.module };
    if (request.toInstance) { body['to_instance'] = request.toInstance; }
    if (request.toMachine) { body['to_machine'] = request.toMachine; }
    return firstValueFrom(this.http.post<MoveResult>(
      this.url('/move'), body,
      this.polariService.backendRequestOptions))
      .catch((err) => err?.error?.ok === false ? err.error : null);
  }

  /** gm-2-lite: the move ledger — recent MoveOperations with step
   *  receipts + expected step durations from prior verified moves
   *  (no history = {}). ?active=true filters to in-flight moves. */
  moveOperations(activeOnly = false): Promise<any | null> {
    return firstValueFrom(this.http.get<any>(
      this.url(`/move-operations${activeOnly ? '?active=true' : ''}`),
      this.polariService.backendRequestOptions))
      .catch((err) => err?.error?.ok === false ? err.error : null);
  }

  /** gm-6: preview a graceful move BEFORE anything runs — planned
   *  steps, expected durations from history, statefulness (typed
   *  confirmation), and the exact command. No subject = the
   *  relocatable-subject catalog. */
  movePlan(subject?: string, machine?: string): Promise<any | null> {
    const q: string[] = [];
    if (subject) { q.push(`subject=${encodeURIComponent(subject)}`); }
    if (machine) { q.push(`machine=${encodeURIComponent(machine)}`); }
    return firstValueFrom(this.http.get<any>(
      this.url(`/move-operations/plan${q.length ? '?' + q.join('&') : ''}`),
      this.polariService.backendRequestOptions))
      .catch((err) => err?.error?.ok === false ? err.error : null);
  }

  /** tt-11: run the foundational ping pass (machines + dep edges) —
   *  gm-6 runs it automatically when a move verifies, so every flow
   *  ends with the verification painted. */
  pingRun(name?: string): Promise<any | null> {
    return firstValueFrom(this.http.post<any>(
      this.url(`/testing/ping${name ? '?name=' + encodeURIComponent(name) : ''}`),
      {}, this.polariService.backendRequestOptions))
      .catch((err) => err?.error?.ok === false ? err.error : null);
  }

  /** tt-11: derived test states + latest integration pings. */
  testing(name?: string): Promise<TopologyTestingReport | null> {
    const query = name ? `?name=${encodeURIComponent(name)}` : '';
    return firstValueFrom(this.http.get<TopologyTestingReport>(
      this.url(`/testing${query}`),
      this.polariService.backendRequestOptions))
      .catch((err) => err?.error?.ok === false ? err.error : null);
  }

  /** Run one module's selftest suites (or 'all') in-container —
   *  synchronous; the response carries the refreshed report. */
  runTests(module: string): Promise<TestRunResult | null> {
    return firstValueFrom(this.http.post<TestRunResult>(
      this.url('/testing/run'), { module },
      this.polariService.backendRequestOptions))
      .catch((err) => err?.error?.ok === false ? err.error : null);
  }

  /** The foundational integration pass — pinging only. */
  runPings(): Promise<TestRunResult | null> {
    return firstValueFrom(this.http.post<TestRunResult>(
      this.url('/testing/ping'), {},
      this.polariService.backendRequestOptions))
      .catch((err) => err?.error?.ok === false ? err.error : null);
  }

  resolve(): Promise<ResolveResult | null> {
    return firstValueFrom(this.http.post<ResolveResult>(
      this.url('/resolve'), {},
      this.polariService.backendRequestOptions))
      .catch((err) => err?.error?.ok === false ? err.error : null);
  }
}
