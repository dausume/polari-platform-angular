/**
 * pv-1 — the shapes of the pin-view door (GET /api/board/{board}/pin-view, framework pv-0).
 * Only the fields the view reads are typed; extra fields the server sends are ignored.
 * SIGNAL words (outputs / inputs) and DRIVE words (current, supply) are separate fields on purpose.
 */
export type PvStage = 'base' | 'after-init' | 'tasks-assigned' | 'firmware-committed';
export type PvPinStage = 'unassigned' | 'available' | 'proposed' | 'committed';

export interface PvFamily { family: string; token: string; text_token: string; fallback_hex: string; hex_is_drawing_knob?: boolean; }
export interface PvVocabulary { families: PvFamily[]; sets: Record<string, string[]>; note?: string; }

export interface PvSurface {
  id: string; kind: string; level: string; title: string; parent: string; shape: string;
  x: number; y: number; rot?: number; w: number; h: number;
  ref?: string; component?: string; soc?: string; package?: string;
  pin_ids: string[]; notes?: string; links?: { register_profile?: string };
  stage_counts?: Record<PvPinStage, number>; pin_count?: number;
}

export interface PvConsumer { kind: string; who: string; solution?: string; claim?: string; mode?: string; function?: string; pull?: string; task?: string; }
export interface PvPinSignal { function: string; family: string; signal: string; direction: string; }
export interface PvLitChild { child: string; function: string; verdict: string; blocked_at?: number; blocked_why?: string; headline: string; }

export interface PvPin {
  id: string; level: string; surface: string; label: string; number: number | null;
  x: number; y: number; side: string; kind: string; bonded: boolean;
  soc?: string; soc_pin?: string; canonical: string; functions: string[]; default_function: string;
  drive_class: string; drive_role: string; notes: string;
  stage: PvPinStage; stage_why: string; consumers: PvConsumer[];
  lit: { family: string; children: PvLitChild[] } | null; dim: boolean;
  signals: PvPinSignal[]; families: string[]; reach?: string; surface_title?: string;
}

export interface PvConnection {
  id: string; a: string; b: string; kind: string; via: string; via_part: string; note?: string; dim?: boolean;
  signal: { a: string; b: string; family: string; token?: string; protocol_signal: string; function_a: string; function_b: string; note?: string };
  drive: { a: string; b: string; rail: string; domain: string; pull: string; via: string; via_part: string; limit_verdict: string; limit_basis?: string; note?: string };
  use: { tasks: { who: string; solution?: string; claim?: string; mode?: string; function?: string }[]; purposes: string[]; stage: string };
  stage: string;
}

export interface PvShape { name: string; display_name?: string; parameters: { vertices?: [number, number][]; holes?: { x: number; y: number; d: number; cited?: boolean }[]; [k: string]: unknown }; }

export interface PvPayload {
  ok: boolean; error?: string; board: string; source?: string; system: string; binding: string; phase?: string;
  stage: { stage: PvStage; binding: string; claims: number; committed_claims: number; undetermined: string[]; notes: string[] };
  protocol: { protocol: string; children: string[]; lit_pads: number; ladder?: string } | null;
  vocabulary: PvVocabulary;
  surfaces: PvSurface[]; pins: PvPin[]; connections: PvConnection[];
  unresolved?: { source: string; reason: string }[];
  shapes: Record<string, PvShape>;
}

export type PvSelection = { kind: 'surface' | 'pin' | 'connection'; id: string } | null;

export interface PvQuery { system: string; binding: string; stage: PvStage; protocol: string; }
