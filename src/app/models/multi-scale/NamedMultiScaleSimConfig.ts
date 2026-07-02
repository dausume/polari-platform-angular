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
  simulationRef?: string;
  primarySimulationRef?: string;
  couplingRefs?: string[];
  gate?: { solutionRef?: string };
  derive?: {
    params?: Record<string, string>;
    fields?: Record<string, string>;
  };
}

/** One entry of panels_json — a ref to another definition object. */
export interface MsimPanel {
  kind: string; // 'scene' | 'graph' | 'ic' | 'display'
  simSpaceRef?: string;
  run?: string; // 'primary' | a run name
  graphRef?: string;
  sourceClass?: string;
  runs?: string[];
  icInterfaceRef?: string;
  displayId?: string;
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
