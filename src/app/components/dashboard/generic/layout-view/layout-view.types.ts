/**
 * lay-2 / sim-3 - the shapes of the layout door (GET /api/layout/{config}, framework lay-1 + the `scene` of lay-2), the steps door and the twin-session doors.
 * Only the fields the view reads are typed; extra fields the server sends are ignored. Part knowledge lives on the server (`scene.parts[ref].interaction / output`,
 * derived from the KitPart): the browser draws the overlay kinds below and nothing else.
 */
export interface LvBoard {
  name: string; role: 'header' | 'bench'; model: string; kind: string; size: string; label: string;
  rows: number; holes_per_side: number; rail_holes: number; pitch_mm: number; reserved?: boolean;
  connectors?: { name: string; ref: string; labels: string[]; order: string }[];
}
export interface LvLeg { terminal: string; name: string; net: string; hole: string; row: number; col: string; side: string; }
export interface LvPlacement {
  name: string; part: string; kind: string; row: string; kit_part: string; params: Record<string, any>; legs: LvLeg[]; ties: string[]; internal: string[][]; rows: number[];
  straddles_trench: boolean; terminal_order: string[]; terminal_ids: string[]; job?: string;
}
export interface LvEnd { board: string; tie: string; }
export interface LvWire { name: string; kind: string; from: LvEnd; to: LvEnd; net: string; class: string; note: string; colour: string; colour_override: string; colour_effective: string; hex: string; }

/** The overlays the browser knows how to draw (D-hbc-3). */
export type LvControl = 'press' | 'toggle' | 'slider';
export interface LvInteraction {
  control: LvControl; label: string; pin: string; twin_pin?: string; note?: string;
  pressed_level?: number;                                                      // press / toggle
  adc?: number | null; unit?: string; min?: number; max?: number; step?: number; initial?: number; offset_mv?: number; per_unit_mv?: number; basis?: string;   // slider
}
export interface LvOutput { kind: 'led' | 'tone'; pin: string; twin_pin: string; note: string; }
export interface LvPartScene { kit_key: string; interface?: string; interaction: LvInteraction | null; output: LvOutput | null; }
export interface LvScene { boards: LvBoard[]; parts: Record<string, LvPartScene>; pins: Record<string, { twin_pin: string; adc: number | null }>; watch: string[]; adc_max_mv: number; }

export interface LvVerdict { ok: boolean; words: string; }
export interface LvPayload {
  ok: boolean; config: string; board: { name: string; model: string; kind: string; size: string; rows: number; rail_holes: number; label: string; ties: number }; header_board: string; scheme: string;
  placements: LvPlacement[]; wires: LvWire[]; strips: Record<string, string>; nets: Record<string, string[]>; assignment: Record<string, string>; notes: string[];
  verdict: LvVerdict; scene: LvScene; sha: string; steps_count: number; error?: string;
}
export interface LvStep { index: number; kind: string; title: string; text: string; adds: { parts: string[]; wires: string[] }; draw: { parts: string[]; wires: string[] }; checks?: string[]; }
export interface LvSteps { ok: boolean; config: string; steps: LvStep[]; sha: string; error?: string; }

/** The twin-session row as GET /api/board/twins?name= serves it (the fields the bench panel reads). */
export interface LvSession { name: string; config: string; state: string; participant: string; hex_sha256: string; remaining_s: number; running_now: boolean; watch: string[]; end_reason?: string; }
/** One line of the session's SSE stream. */
export interface LvTwinEvent { t: string; pin?: string; level?: number; cycle?: number; session?: string; why?: string; events?: number; }
export interface LvInjectReply { ok: boolean; sent?: any; reply?: { t: string; cycle?: number; why?: string }; error?: string; interaction?: any; }

export type LvSelection = { kind: 'hole' | 'part' | 'wire' | 'pin'; id: string; board?: string } | null;
export type LvMode = 'build' | 'bench';
