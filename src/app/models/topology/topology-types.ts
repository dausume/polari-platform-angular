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
  /** tt-14: synthetic (sim) rows are never deploy targets. */
  isReal: boolean;
  sshAlias: string;
  arch: string;
  memGb: number;
  roles: string[] | string;
  swarmRole: string;
  source: string;
  notes: string;
}

/** tt-14 instance categories: only 'polari' can receive modules;
 *  integrated apps (PSC/Odoo-style), auth containers (Keycloak),
 *  and infrastructure are non-adaptive. */
export type InstanceAppKind =
  'polari' | 'integrated-app' | 'auth' | 'infrastructure'
  | 'unknown';

export interface InstanceStorage {
  kind: string;
  name: string;
  shared: boolean;
  note: string;
}

export interface TopologyInstance {
  name: string;
  appKind: InstanceAppKind;
  isPolari: boolean;
  /** Named storage identity ('sqlite-prf-a' vs shared mariadb);
   *  null for non-Polari containers (no object tree). */
  storage: InstanceStorage | null;
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
  /** tt-14: engine capabilities only live on engine/worker hosts. */
  engineCapability: boolean;
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

/** tt-13: dynamic move (POST /api/topology/move) — container
 *  target = module reassignment (former spots become transient
 *  ghosts); device target = engine relocation (instance re-pins;
 *  stack redeploy stays a human pol command). */
export interface MoveRequest {
  module: string;
  toInstance?: string;
  toMachine?: string;
}

export interface MoveResult {
  ok: boolean;
  error?: string;
  moveKind?: 'module-reassignment' | 'engine-relocation';
  module?: string;
  toInstance?: string;
  fromInstances?: string[];
  instance?: string;
  fromMachine?: string;
  toMachine?: string;
  placementConstraint?: string;
  suggestedCommand?: string;
  suggestedCommands?: string[];
  note?: string;
}

/** tt-11: testing over topology (GET /api/topology/testing) — the
 *  graph doubles as the progress visualization of testing. */
export type ModuleTestState = 'pass' | 'fail' | 'never-run'
  | 'no-suites';
export type RollupTestState = 'pass' | 'fail' | 'unknown';

export interface SuiteResult {
  suite: string;
  status: string;
  checksPassed: number;
  checksTotal: number;
  ranAt: string;
  outputTail: string;
}

export interface ModuleTestReport {
  module: string;
  state: ModuleTestState;
  instances: string[];
  suites: SuiteResult[];
}

/** One foundational integration ping — connectivity only, with the
 *  protocol and its security notated. */
export interface IntegrationLink {
  kind: 'machine' | 'dep-edge' | 'connection';
  subject: string;
  target: string;
  protocol: string;
  secured: boolean;
  securityNote: string;
  status: 'ok' | 'failed' | 'unpingable' | 'static-artifact';
  evidence: string;
  checkedAt: string;
}

export interface TopologyTestingReport {
  ok: boolean;
  error?: string;
  topology: string;
  modules: ModuleTestReport[];
  instances: Record<string, RollupTestState>;
  hosts: Record<string, RollupTestState>;
  links: IntegrationLink[];
}

export interface TestRunResult {
  ok: boolean;
  error?: string;
  ran?: number;
  checked?: number;
  results?: Array<{ suite: string; status: string;
    checksPassed: number; checksTotal: number }>;
  report: TopologyTestingReport;
}

/** Where an instance's objects actually land. `shared` distinguishes a
 *  backend several instances sit on from a store local to one
 *  instance — sqlite is local by construction and can never be pointed
 *  elsewhere. `cache` and `blob` are not yet assignable and come back
 *  empty, meaning ABSENT rather than defaulted. */
export interface InstanceStorage {
  relational: string;
  shared: boolean;
  identity: string;
  note: string;
  /** '' = genuinely not assigned. The technology is not a choice —
   *  cache is always keydb, blob always minio — so what is recorded
   *  is the BINDING, not a vendor. */
  cache: string;
  /** True when the cache came from the `mariadb+keydb` relational
   *  choice rather than its own field, so it is not separately
   *  editable and the two can never disagree. */
  cacheImplied: boolean;
  blob: string;
  /** Which optional tiers are unbound — named, not inferred. */
  unbound: string[];
}

export interface OwnedObject {
  class: string;
  module: string;
  rows: number;
}

export interface OwnershipInstance {
  instance: string;
  kind: string;
  machine: string;
  storage: InstanceStorage;
  modules: string[];
  objectCount: number;
  rowCount: number;
  objects: OwnedObject[];
}

/** Instances grouped by the storage they genuinely share. */
export interface StorageGroup {
  identity: string;
  relational: string;
  shared: boolean;
  instances: string[];
  objectCount: number;
  rowCount: number;
}

export interface OwnershipReport {
  ok: boolean;
  error?: string;
  topology: string;
  instances: OwnershipInstance[];
  storageGroups: StorageGroup[];
  /** A class defined by more than one module: a coherence fault,
   *  reported rather than merged. */
  contested: Array<{ class: string; modules: string[] }>;
  /** Owning module is on no instance here — nobody holds them. */
  unassigned: OwnedObject[];
  /** Owned by the framework itself, so not assignable to a module. */
  coreObjects: Array<{ class: string; package: string; rows: number }>;
  /** Live rows nothing claims. */
  orphans: Array<{ class: string; rows: number }>;
  note: string;
}
