import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { PolariService } from '@services/polari-service';

/** One topology in the summary list (GET /api/topology/summary). */
export interface TopologyListEntry {
  name: string;
  status: string;
  isActive: boolean;
  description: string;
}

export interface TopologySummary {
  ok: boolean;
  activeTopology: string;
  topologies: TopologyListEntry[];
  counts: Record<string, number>;
}

/** The topology header row (GET /api/topology/graph). */
export interface TopologyMeta {
  name: string;
  description: string;
  defaultTarget: string;
  status: string;
  isActive: boolean;
  validatedAt: string;
  findings: unknown;
  schemaVersion: string;
}

export interface TopologyMachine {
  name: string;
  sshAlias: string;
  arch: string;
  memGb: number;
  roles: string[] | string;
  swarmRole: string;
  source: string;
  notes: string;
}

export interface TopologyInstance {
  name: string;
  kind: string;
  serviceKinds: string[];
  replicas: number;
  envTier: string;
  machineName: string;
  placementConstraint: string;
  dbBackend: string;
  imageTag: string;
  orchestrationTarget: string;
  notes: string;
}

export interface ModuleAssignment {
  name: string;
  moduleName: string;
  instanceName: string;
  state: string;
  notes: string;
}

export type EdgeStatus = 'resolved' | 'unresolved' | 'degraded';

export interface ModuleDependencyEdge {
  name: string;
  moduleName: string;
  consumerInstanceName: string;
  dependsOnModule: string;
  providerInstanceName: string;
  status: EdgeStatus;
  evidence: string;
}

export interface TopologyConnection {
  name: string;
  interconnectKey: string;
  fromKind: string;
  toKind: string;
  fromInstanceName: string;
  toInstanceName: string;
  artifact: string;
  notes: string;
}

export interface TopologyGraph {
  ok: boolean;
  error?: string;
  topology: TopologyMeta;
  machines: TopologyMachine[];
  instances: TopologyInstance[];
  assignments: ModuleAssignment[];
  edges: ModuleDependencyEdge[];
  connections: TopologyConnection[];
}

/** One validation finding (POST /api/topology/validate). */
export interface ValidationFinding {
  severity: string;
  check: string;
  subject: string;
  evidence: string;
  knob: string;
  action: string;
}

export interface ValidateReport {
  ok: boolean;
  error?: string;
  topology: string;
  valid: boolean;
  findings: ValidationFinding[];
  errorCount: number;
  warnCount: number;
}

/** One drift row (GET /api/topology/drift). */
export interface DriftRow {
  kind: 'unobserved' | 'missing-service' | 'unexpected-service';
  subject: string;
  machine: string;
  serviceKind?: string;
  evidence: string;
  suggestedCommand: string;
}

export interface DriftReport {
  ok: boolean;
  error?: string;
  topology: string;
  observedNodes: number;
  inDrift: boolean;
  rows: DriftRow[];
}

/** POST /api/topology/assign — writes rows only; deploy stays a
 *  human-run pol command (returned as suggestedCommand text). */
export interface AssignResult {
  ok: boolean;
  error?: string;
  topology: string;
  assignment: ModuleAssignment;
  disabled: string[];
  resolve: { changed: unknown[] };
  suggestedCommand: string;
}

export interface ResolveResult {
  ok: boolean;
  error?: string;
  edges: number;
  changed: unknown[];
}

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

  resolve(): Promise<ResolveResult | null> {
    return firstValueFrom(this.http.post<ResolveResult>(
      this.url('/resolve'), {},
      this.polariService.backendRequestOptions))
      .catch((err) => err?.error?.ok === false ? err.error : null);
  }
}
