/**
 * pv-1 — the shapes of the pin-view door (GET /api/board/{board}/pin-view, framework pv-0).
 * Only the fields the view reads are typed; extra fields the server sends are ignored.
 * SIGNAL words (outputs / inputs) and DRIVE words (current, supply) are separate fields on purpose.
 */
export type PvStage = 'base' | 'after-init' | 'tasks-assigned' | 'firmware-committed' | 'candidate';
export type PvPinStage = 'unassigned' | 'available' | 'proposed' | 'committed';

export interface PvFamily { family: string; token: string; text_token: string; fallback_hex: string; hex_is_drawing_knob?: boolean; }
export interface PvDriveVocabulary { drive_statuses: string[]; rails: string[]; pulls: string[]; limit_classes: string[]; note?: string; }
export interface PvVocabulary { families: PvFamily[]; sets: Record<string, string[]>; drive?: PvDriveVocabulary; note?: string; }
/** The view mode (pv-2): All, Drive (electricity: current and supply) or Signal (what the pin carries). */
export type PvMode = 'all' | 'drive' | 'signal';
/** Label drawing knobs of the payload (mm): part titles and pin labels are drawn in model units at this font size. */
export interface PvLayout { font: number; char_w: number; gap: number; max_title: number; max_pin: number; margin: number; }

export interface PvSurface {
  id: string; kind: string; level: string; title: string; parent: string; shape: string;
  x: number; y: number; rot?: number; w: number; h: number;
  ref?: string; component?: string; soc?: string; package?: string;
  pin_ids: string[]; notes?: string; links?: { register_profile?: string };
  stage_counts?: Record<PvPinStage, number>; pin_count?: number;
  /** Parts only (pv-2): the abbreviated title, where it sits under the box and the rectangle of box + labels + title (local frame). */
  short_title?: string; title_pos?: { x: number; y: number } | null; extent?: { x0: number; y0: number; x1: number; y1: number } | null;
}

export interface PvConsumer { kind: string; who: string; solution?: string; claim?: string; mode?: string; function?: string; pull?: string; task?: string; route?: string; why?: string; part?: string; }
export interface PvPinSignal { function: string; family: string; signal: string; direction: string; }
export interface PvLitChild { child: string; function: string; verdict: string; blocked_at?: number; blocked_why?: string; headline: string; protocol?: string; }
/** SIGNAL side (pv-2): the function in use at the stage, null at stage base. */
export interface PvActivated { function: string; resource: string; family: string; signal: string; direction: string; }
export interface PvCapable { function: string; family: string; direction: string; }
export interface PvLifecycle { name: string; phase: string; policy: string; condition: string; locks: boolean; }

export interface PvPin {
  id: string; level: string; surface: string; label: string; number: number | null;
  x: number; y: number; side: string; kind: string; bonded: boolean;
  soc?: string; soc_pin?: string; canonical: string; functions: string[]; default_function: string;
  drive_class: string; drive_role: string; notes: string; phase_basis?: string[];
  stage: PvPinStage; stage_why: string; consumers: PvConsumer[];
  lit: { family: string; families?: string[]; children: PvLitChild[] } | null; dim: boolean;
  signals: PvPinSignal[]; families: string[]; reach?: string; surface_title?: string; short_label?: string;
  /** DRIVE side (pv-2): electricity only - status, rail, pull, the class of the limit, the shared budgets. */
  drive_relevant: boolean; drive_status: string; drive_why: string; rail: string; pull: string; limit_class: string; limit_basis: string; group_budget: string[];
  /** SIGNAL side (pv-2). */
  signal_relevant: boolean; activated: PvActivated | null; capable: PvCapable[]; lifecycle: PvLifecycle[];
}

export interface PvConnection {
  id: string; a: string; b: string; kind: string; via: string; via_part: string; note?: string; dim?: boolean;
  signal: { a: string; b: string; family: string; token?: string; protocol_signal: string; function_a: string; function_b: string; capable?: string[]; note?: string };
  drive: { a: string; b: string; rail: string; domain: string; pull: string; via: string; via_part: string; limit_verdict: string; limit_basis?: string; note?: string };
  use: { tasks: { who: string; solution?: string; claim?: string; mode?: string; function?: string }[]; purposes: string[]; stage: string };
  stage: string; drive_relevant?: boolean; signal_relevant?: boolean;
}

export interface PvShape { name: string; display_name?: string; parameters: { vertices?: [number, number][]; holes?: { x: number; y: number; d: number; cited?: boolean }[]; [k: string]: unknown }; }

/** pv-4: the phases of a board's life (the lifecycle rows' phases) and the two blank baselines. */
export type PvPhase = 'power-up' | 'reset' | 'bootloader' | 'init' | 'runtime';
export type PvBlank = 'chip' | 'board';
export interface PvBlankFacts {
  baseline: PvBlank; label: string;
  bootloader: { present: string; running_in_phase: boolean; why: string; cites: { fact: string; value: string; document: string; where: string }[] };
  factory_sketch: { status: string; why?: string };
  registers: { register: string; reset_value: string; cite: string }[];
}
export interface PvPhaseInfo {
  phase: string; blank: PvBlank; blank_label: string; banner: string; decided_by: string[]; undetermined: string[]; notes: string[];
  pins_blank: number; pins_serving: number; requested_stage: string; effective_stage: string; blank_facts: PvBlankFacts;
}
/** pv-4: one pin an event changed, with the before / after in plain words (drive and signal kept apart). */
export interface PvEventPin { pin: string; label: string; level: string; surface: string; before: string; after: string; what: string[]; }
export interface PvConfigEvent {
  name: string; board: string; board_instance: string; kind: string; label: string; cause: string; refs: string[]; who: string; when: string; dated: boolean;
  provenance: string; pins_changed: PvEventPin[]; pins_basis: string; seq: number;
}
export interface PvEventsPayload { ok: boolean; error?: string; board: string; events: PvConfigEvent[]; count: number; derived: number; recorded: number; }

/** pv-5: the candidate stage - one candidate of a stored solution search (SolveRun), drawn as proposed. Plain-word fields only. */
export interface PvCandidateAssignment { need: string; role: string; part: string; pin: string; function: string; route: string; importance: string; purposes: string[]; why: string; }
export interface PvCandidatePick { rank: number; id: string; text: string; resources: number; cycle_us: number; placement: string; chosen: boolean; }
export interface PvCandidate {
  run: string; mission: string; objective: string; ran_at: string; id: string; rank: number; chosen: boolean; hardware: string; tier: string; variants: Record<string, string>; variants_text: string;
  placement: string; score: { objective: string; resources: number; cycle: string; cycle_us: number; rank: number; text: string };
  assignment: PvCandidateAssignment[]; risks: string[]; unchecked: string[]; what_lost: string[]; pins_marked: string[]; notes: string[]; candidates: PvCandidatePick[];
  links: { solutions_found: string; runs: string }; note?: string;
}
/** One stored run, from GET /api/missions/{mission}/solve-runs. */
export interface PvSolveRun { name: string; mission: string; objective: string; ran_at: string; candidate_count: number; chosen: string; chosen_text?: string; who?: string; }
export interface PvRunsPayload { ok: boolean; error?: string; mission: string; count: number; rows: PvSolveRun[]; }

export interface PvPayload {
  ok: boolean; error?: string; board: string; source?: string; system: string; binding: string; phase?: string; blank?: PvBlank; phase_info?: PvPhaseInfo;
  candidate?: PvCandidate | null;
  stage: { stage: PvStage; binding: string; claims: number; committed_claims: number; undetermined: string[]; notes: string[] };
  protocol: { protocol: string; protocols?: string[]; children: string[]; lit_pads: number; activated_only?: boolean; ladder?: string; note?: string } | null;
  layout?: PvLayout;
  vocabulary: PvVocabulary;
  surfaces: PvSurface[]; pins: PvPin[]; connections: PvConnection[];
  unresolved?: { source: string; reason: string }[];
  shapes: Record<string, PvShape>;
}

export type PvSelection = { kind: 'surface' | 'pin' | 'connection'; id: string } | null;

export interface PvQuery { system: string; binding: string; stage: PvStage; protocol: string; run?: string; candidate?: string; activated_only?: boolean; phase?: PvPhase; blank?: PvBlank; }
