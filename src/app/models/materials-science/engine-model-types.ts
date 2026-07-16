/**
 * @cross-cutting
 * @tags @xc:bindings
 * @consumers
 *   - services/materials-science/engine-model.service.ts (the HTTP
 *     surface these shapes describe)
 *   - materials-science engine-template pickers (EngineTemplate is the
 *     widest-reused shape in the domain — 6 consumer files)
 * @impact-on-edit
 *   Moved out of engine-model.service.ts (2026-07-14, object/interface
 *   placement audit). Kept SEPARATE from materials-basis-types.ts —
 *   that file has its own, unrelated `EngineCapabilityLadders` shape
 *   (originally both were named `EngineCapability`, a same-name
 *   different-shape collision; renamed 2026-07-15 so a future
 *   consumer can't accidentally import the wrong one). Add new
 *   engine-model response shapes here, not back in the service.
 * @see /OVERLAP_MAP.md
 */

/** One catalog row from GET /api/msci/engine-templates. */
export interface EngineTemplate {
  name: string;
  displayName: string;
  description: string;
  engineKind: 'fem' | 'dft' | string;
  engineKey: string;
  parameterSchema: {
    section: string; key: string; type: string; unit?: string;
    required?: boolean; default?: unknown; min?: number; max?: number;
    description?: string;
  }[];
  sectionMap: Record<string, string>;
  outputs: { key: string; type: string; unit?: string;
             description?: string }[];
  costClass: string;
  capabilityRequirements: string[];
  capability: { ok: boolean; missing: any[]; suggestions: any[] };
  notes: string;
  enabled: boolean;
}

/** The specialized model-definition classes this layer routes to. */
export type EngineModelClass =
  'FEMModelDefinition' | 'DFTModelDefinition'
  | 'MDModelDefinition' | 'MesoModelDefinition';

/** A FEM/DFT/MD/Meso model definition row (backend field names). */
export interface EngineModelRow {
  id?: string;
  name: string;
  display_name: string;
  description: string;
  physics_ref?: string;       // FEM/MD/Meso ModelDefinition
  calculation_ref?: string;   // DFTModelDefinition
  domain_json?: string;
  materials_json?: string;
  boundary_conditions_json?: string;
  source_terms_json?: string;
  mesh_json?: string;
  solver_json?: string;
  structure_json?: string;
  method_json?: string;
  accuracy_json?: string;
  system_json?: string;                 // MD + Meso
  thermodynamic_state_json?: string;    // MD
  integration_json?: string;            // MD + Meso
  sampling_json?: string;               // Meso
  last_result_json: string;
  last_executed_at: string;
  notes: string;
  enabled: boolean;
}

/** One engine root from GET /api/msci/engines/capability. */
export interface EngineRootCapability {
  available?: boolean;
  [key: string]: unknown;
}
