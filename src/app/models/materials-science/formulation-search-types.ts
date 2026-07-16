/**
 * @cross-cutting
 * @tags @xc:bindings
 * @consumers
 *   - services/materials-science/formulation-search.service.ts (the
 *     HTTP surface these shapes describe)
 *   - materials-science formulation-search workbench + its panels
 *     (workbench, knobs form, run controls, winners table) and the
 *     multi-scale formulation-search panel that reuses the same run
 *     shape
 * @impact-on-edit
 *   Moved out of formulation-search.service.ts (2026-07-15, object/
 *   interface placement audit — completing the same extraction
 *   already done for engine-model-types.ts/materials-basis-types.ts).
 *   Add new formulation-search response shapes here, not back in the
 *   service.
 * @see /OVERLAP_MAP.md
 */

/** A FormulationSearchDefinition row (backend field names). */
export interface FormulationSearchDef {
  id?: string;
  name: string;
  display_name: string;
  description: string;
  target_profile_id: string;
  targets_json: string;
  base_material_name: string;
  base_properties_json: string;
  additive_pool_json: string;
  sourcing_policy: string;
  mode: string;
  knobs_json: string;
  process: string;
  thermal_knobs_json: string;
  fidelity_stages_json: string;
  results_keep_top_n: number;
  enabled: boolean;
}

/** One persisted candidate (GET .../runs payload shape). */
export interface FormulationCandidate {
  name: string;
  rank: number;
  components: { materialId: string; weightPercent: number }[];
  predicted: Record<string, number>;
  score: number;
  meetsTargets: boolean;
  violations: any[];
  unpredicted: string[];
  thermalVerdict: Record<string, any>;
  fidelity: {
    screening?: { status: string };
    femVerify?: { status: string; components?: any[]; reason?: string };
    dftEvidence?: { status: string };
  };
  isWinner: boolean;
  promotedScaleDef: string;
}

/** One persisted run (GET .../runs payload shape). */
export interface FormulationRun {
  name: string;
  mode: string;
  status: string;
  outcome: string;
  evaluated: number;
  sweepCapped: boolean;
  winnersCount: number;
  sourcingPolicy: string;
  startedAt: string;
  finishedAt: string;
  error: string;
  fidelitySummary: Record<string, any>;
  gapAnalysis: any[];
  trajectory: any[];
  excludedBySourcing: string[];
  predictableProperties: string[];
  assumptions: string[];
  candidates: FormulationCandidate[];
}
