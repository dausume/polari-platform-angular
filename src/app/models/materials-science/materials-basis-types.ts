/**
 * @cross-cutting
 * @tags @xc:bindings
 * @consumers
 *   - services/materials-science/materials-basis.service.ts (the HTTP
 *     surface these shapes describe)
 *   - materials-science browser components
 * @impact-on-edit
 *   Moved out of materials-basis.service.ts (2026-07-14, object/
 *   interface placement audit). Kept SEPARATE from engine-model-types.ts
 *   rather than merged — both files independently declare an unrelated
 *   `EngineCapability` shape; merging them would collide. Add new
 *   materials-basis response shapes here, not back in the service.
 * @see /OVERLAP_MAP.md
 */

/** One MaterialScaleDefinition row (backend CRUDE shape, camel-safe). */
export interface ScaleDefinitionRow {
  name: string;
  material_name: string;
  scale_level: number;
  scale_category: string;
  definition_class: string;
  definition_ref: string;
  status: string;               // defined | partial | planned
  derived_from_name: string;
  derivation_method: string;
  parameters_json: string;
  notes: string;
}

/** One ThermalProcessingProfile row. */
export interface ThermalProfileRow {
  name: string;
  material_name: string;
  melt_low_c: number;
  melt_high_c: number;
  smoke_low_c: number;
  smoke_high_c: number;
  provenance: string;
}

/** Honest engine capability report (FEM + DFT ladders). */
export interface EngineCapability {
  fem: Record<string, unknown>;
  dft: Record<string, unknown>;
}

/** One MaterialsScienceMaterial identity row (msci-22 fields). */
export interface MaterialIdentityRow {
  name: string;
  display_name: string;
  description: string;
  material_kind: string;
  category: string;
  tags_json: string;
}

/** One scale-row summary as the presence endpoints return it. */
export interface PresenceRowSummary {
  name: string;
  status: string;               // defined | partial | planned
  derivationMethod: string;
  derivedFrom: string;
  definitionClass: string;
  definitionRef: string;
  hasResult: boolean;
  provenance: string;
  notes: string;
}

/** One level of the presence matrix (taxonomy + rollup counts). */
export interface PresenceLevel {
  level: number;
  name: string;
  lengthRange: string;
  methods: string;
  earnedBy: string;
  engines: string[];
  defined: number;
  partial: number;
  missing: number;
}

/** The materials x levels accountability matrix. */
export interface PresenceMatrix {
  levels: PresenceLevel[];
  materials: {
    name: string;
    displayName: string;
    category: string;
    tags: string[];
    presence: Record<string, {
      status: 'defined' | 'partial' | 'missing';
      rows: PresenceRowSummary[];
    }>;
  }[];
}

/** One material's entry on a level page. */
export interface LevelEntry {
  material: string;
  displayName: string;
  category: string;
  rows: PresenceRowSummary[];
  suggestion?: {
    level: number; category: string;
    evidence: string; knob: string; action: string;
  };
}

/** One level's accountability page data. */
export interface LevelAccountability {
  ok: boolean;
  level: number;
  detail: Omit<PresenceLevel, 'level' | 'defined' | 'partial' | 'missing'>;
  defined: LevelEntry[];
  partial: LevelEntry[];
  missing: LevelEntry[];
  error?: string;
}

/** One property value on the material detail view (msci-28). */
export interface MaterialProperty {
  key: string;
  label: string;
  value: string | number | boolean | null;
  units: string;
  source: string;
  sourceRow?: string;
  level?: number;
  provenance: string;
  meaning: string | null;
  scenarioContext: string | null;
}

/** One quantified blend effect (the additive scenario). */
export interface BlendEffect {
  property: string;
  label: string;
  meaning: string | null;
  intent: string;
  perWtPercent: number;
  unit: string;
  normalizedStrength: number | null;
  conditions: string;
  provenance: string;
}

/** One scale row, fully opened, on the detail view. */
export interface DetailLevelRow {
  name: string;
  status: string;
  definitionClass: string;
  definitionRef: string;
  derivedFrom: string;
  derivationMethod: string;
  parameters: Record<string, unknown>;
  result: Record<string, unknown> | null;
  provenance: string;
  notes: string;
}

/** One level's detail (taxonomy + this material's rows there). */
export interface DetailLevel {
  level: number;
  name: string;
  lengthRange: string;
  methods: string;
  earnedBy: string;
  engines: string[];
  status: 'defined' | 'partial' | 'missing';
  rows: DetailLevelRow[];
  earnHint?: {
    evidence: string; knob: string; action: string;
  };
}

/** GET /api/msci/materials/{name}/detail (msci-28). */
export interface MaterialDetail {
  ok: boolean;
  error?: string;
  knownMaterials?: string[];
  material: {
    name: string; displayName: string; description: string;
    kind: string; category: string; tags: string[];
    elements: string[]; notes: string;
  };
  properties: MaterialProperty[];
  thermal: {
    melts: boolean;
    meltLowC: number | null; meltHighC: number | null;
    smokeLowC: number | null; smokeHighC: number | null;
    mfiNote: string; provenance: string; scenarioNote: string;
  } | null;
  rawFacts: Record<string, unknown> | null;
  blendEffects: {
    available: boolean; additiveName?: string; note?: string;
    effects?: BlendEffect[];
  } | null;
  levels: DetailLevel[];
  hiddenLevels: { levels: number[]; note: string } | null;
  suggestions: { evidence: string; knob: string; action: string }[];
}
