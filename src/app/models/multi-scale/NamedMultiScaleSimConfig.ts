/**
 * Frontend model for MultiScaleSimulationDefinition — the object that
 * ties a multi-scale simulation together as configuration: member
 * spaces, couplings, the primary (user-driven) simulation, the no-code
 * stage progression, and the page's panels. Mirrors the parse-the-
 * backend-JSON-blobs shape of NamedGraphConfig.
 */

export interface MultiScaleSimSummary {
  id: string;
  name: string;
  description: string;
  primary_simulation_ref: string;
  memberCount: number;
  couplingCount: number;
}

/** One entry of stages_json — the no-code multi-scale progression. */
export interface MsimStage {
  key: string;
  label?: string;
  /** 'runToCompletion' (precondition space + gate) | 'coStep' (live coupled stepping). */
  kind: string;
  /** The stage's role-intent in THIS composition (observe | search | …).
   *  Checked for compatibility against the sim's own declared intent. */
  intent?: string;
  simulationRef?: string;
  primarySimulationRef?: string;
  couplingRefs?: string[];
  gate?: { solutionRef?: string; failReason?: string };
  derive?: {
    params?: Record<string, string>;
    fields?: Record<string, string>;
  };
  /** Solution search: attempt multiple candidates to reach one valid
   *  solution (grid/list of parameter points; batched; resumable). */
  search?: {
    candidates?: {
      kind?: string; // 'grid' | 'list'
      parameters?: Record<string, { from: number; to: number; steps: number }>;
      values?: Record<string, number>[];
    };
    stepsPerAttempt?: number;
    batchSize?: number;
  };
}

/** One entry of panels_json — a ref to another definition object. */
export interface MsimPanel {
  kind: string; // 'scene' | 'graph' | 'ic' | 'explainer' | 'display'
  simSpaceRef?: string;
  /** 'primary' | 'stage:<stageKey>' | a run name. */
  run?: string;
  graphRef?: string;
  sourceClass?: string;
  /** 'primary' | 'compare' | 'stage:<stageKey>' | run names. */
  runs?: string[];
  icInterfaceRef?: string;
  displayId?: string;
  /** kind:'graph' only — pivot this graph across a FAMILY of materials
   *  (the IC interface's choices) tied to a stage: per-material tabs +
   *  an all-materials comparison chart. */
  family?: {
    icInterfaceRef: string;
    stageKey: string;
    /** Fields joining the combined chart (default: the graph's own
     *  yDimensions). */
    combineFields?: string[];
  };
  // --- kind:'explainer' — a stage's narrative + live config facts.
  // All show* flags are knobs (default true); body is editable config.
  stageKey?: string;
  title?: string;
  body?: string;
  showSearchSpace?: boolean;
  showGate?: boolean;
  showDerive?: boolean;
  showConditionMap?: boolean;
  showMeltLine?: boolean;
}

export class NamedMultiScaleSimConfig {
  id = '';
  name = '';
  description = '';
  members: string[] = [];
  couplings: string[] = [];
  primarySimulationRef = '';
  stages: MsimStage[] = [];
  panels: MsimPanel[] = [];
  displayRef = '';
  compareRuns: string[] = [];
  enabled = true;

  static fromBackend(obj: any): NamedMultiScaleSimConfig {
    const cfg = new NamedMultiScaleSimConfig();
    cfg.id = obj.id ?? '';
    cfg.name = obj.name ?? '';
    cfg.description = obj.description ?? '';
    cfg.primarySimulationRef = obj.primary_simulation_ref ?? '';
    cfg.displayRef = obj.display_ref ?? '';
    cfg.enabled = obj.enabled !== false;
    cfg.members = parseJsonArray(obj.member_simulation_refs_json);
    cfg.couplings = parseJsonArray(obj.coupling_refs_json);
    cfg.stages = parseJsonArray<MsimStage>(obj.stages_json)
      .filter(s => s && typeof s === 'object' && s.key);
    cfg.panels = parseJsonArray<MsimPanel>(obj.panels_json)
      .filter(p => p && typeof p === 'object' && p.kind);
    const policy = parseJsonObject(obj.compare_run_policy_json);
    cfg.compareRuns = Array.isArray(policy['runs'])
      ? policy['runs'].filter((r: any) => typeof r === 'string')
      : [];
    return cfg;
  }

  /** Serialize back to the backend's field shape for a CRUDE PUT. */
  toUpdateData(): Record<string, string | boolean> {
    return {
      name: this.name,
      description: this.description,
      member_simulation_refs_json: JSON.stringify(this.members),
      coupling_refs_json: JSON.stringify(this.couplings),
      primary_simulation_ref: this.primarySimulationRef,
      stages_json: JSON.stringify(this.stages),
      panels_json: JSON.stringify(this.panels),
      display_ref: this.displayRef,
      compare_run_policy_json: JSON.stringify(
        this.compareRuns.length
          ? { mode: 'fanOutSteps', runs: this.compareRuns }
          : {},
      ),
      enabled: this.enabled,
    };
  }
}

function parseJsonArray<T = string>(raw: any): T[] {
  if (Array.isArray(raw)) return raw;
  if (typeof raw !== 'string' || !raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseJsonObject(raw: any): Record<string, any> {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) return raw;
  if (typeof raw !== 'string' || !raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed : {};
  } catch {
    return {};
  }
}
