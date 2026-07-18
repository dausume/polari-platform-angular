/**
 * @cross-cutting
 * @tags @xc:bindings
 * @consumers
 *   - services/topology/topology.service.ts (the HTTP surface these
 *     shapes describe)
 *   - components/topology/topology-home.component.ts,
 *     topology-graph-view.component.ts
 * @impact-on-edit
 *   Moved out of topology.service.ts (2026-07-14, object/interface
 *   placement audit) — no models/topology/ existed before this. Add
 *   new topology-as-data response shapes here, not back in the
 *   service.
 * @see /OVERLAP_MAP.md
 *
 * Topology-as-data shapes (top-5/6): machines, instances, module
 * assignments/dependency edges, validate/drift reports.
 */

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
  /** tt-1 designation: a dependency shared by N>1 consumers keeps ONE
   *  primary edge; the other N-1 render as dashed transient copies. */
  isPrimary: boolean;
  isTransient: boolean;
  evidence: string;
}

/** tt-1 module-level graph (GET /api/topology/module-graph) — the
 *  bidirectional view the circle/nesting renderer draws. */
export type ModuleClassification =
  'consumer' | 'provider' | 'hybrid' | 'independent' | 'data-only';

export interface ModulePlacement {
  instance: string;
  state: string;
}

export interface ModuleGraphModule {
  name: string;
  placements: ModulePlacement[];
  dependsOn: string[];
  dependents: string[];
  outDegree: number;
  inDegree: number;
  dataOnly: boolean;
  classification: ModuleClassification;
}

export interface ModuleGraphEdge {
  name: string;
  moduleName: string;
  consumerInstanceName: string;
  dependsOnModule: string;
  providerInstanceName: string;
  status: EdgeStatus;
  isPrimary: boolean;
  isTransient: boolean;
}

export interface ModuleGraphReport {
  ok: boolean;
  error?: string;
  topology: string;
  modules: ModuleGraphModule[];
  edges: ModuleGraphEdge[];
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
