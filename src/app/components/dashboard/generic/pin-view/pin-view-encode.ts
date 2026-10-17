import { PvConnection, PvPayload, PvPin } from './pin-view.types';

/**
 * pv-1 encodings (PIN_VIEW_PLAN 2.2).
 *   colour  = signal family (a theme token, `--pin-<family>` + `-text`)
 *   symbol  = what the pin is doing (a small glyph; direction words are SIGNAL words — never "drive")
 *   fill    = assignment: hollow ring (nothing assigned) · tinted (proposed) · solid (committed) · hatched (blocked / undetermined on the ladder)
 */
export type PvRole = 'output' | 'input' | 'inout' | 'analog' | 'clock' | 'reset' | 'power' | 'ground' | 'reserved' | 'not-bonded' | 'none';
export type PvFill = 'hollow' | 'proposed' | 'committed' | 'hatched';

/** Unit glyphs in a [-1, 1] box, stroked; scaled by the pin radius where drawn. */
export const GLYPHS: Record<Exclude<PvRole, 'none'>, string> = {
  output: 'M-0.6,0H0.45M0.1,-0.38L0.55,0L0.1,0.38',
  input: 'M0.6,0H-0.45M-0.1,-0.38L-0.55,0L-0.1,0.38',
  inout: 'M-0.6,0H0.6M-0.25,-0.32L-0.6,0L-0.25,0.32M0.25,-0.32L0.6,0L0.25,0.32',
  analog: 'M-0.7,0.15C-0.45,-0.65 -0.2,-0.65 0,0S0.45,0.65 0.7,-0.15',
  clock: 'M-0.7,0.4V-0.4H-0.25V0.4H0.25V-0.4H0.7V0.4',
  reset: 'M0.5,-0.25A0.55,0.55 0 1 0 0.5,0.25M0.5,-0.6V-0.25H0.15',
  power: 'M0,-0.7V0.7M-0.7,0H0.7',
  ground: 'M0,-0.7V0M-0.65,0H0.65M-0.42,0.32H0.42M-0.2,0.64H0.2',
  reserved: 'M-0.5,0H0.5V0.72H-0.5ZM-0.3,0V-0.3A0.3,0.3 0 0 1 0.3,-0.3V0',
  'not-bonded': 'M-0.6,-0.6L0.6,0.6M0.6,-0.6L-0.6,0.6',
};
export const ROLE_WORDS: Record<PvRole, string> = {
  output: 'outputs a signal', input: 'takes a signal in', inout: 'both ways', analog: 'analog', clock: 'clock', reset: 'reset',
  power: 'power', ground: 'ground', reserved: 'reserved by a lifecycle phase', 'not-bonded': 'not bonded out of the package', none: 'no direction known',
};
export const STAGE_WORDS: Record<string, string> = {
  unassigned: 'unassigned (no way out, nothing claims it)', available: 'available (reaches a header, nothing claims it)',
  proposed: 'proposed by a task', committed: 'committed by the firmware',
};
export const FILL_WORDS: Record<PvFill, string> = {
  hollow: 'hollow ring: nothing assigned yet', proposed: 'tinted: proposed by a task', committed: 'solid: committed by the firmware', hatched: 'hatched: blocked or undetermined on the ladder',
};

const POWER_KINDS = ['power', 'analog-supply', 'usb-supply', 'regulator-output'];
const GROUND_KINDS = ['ground', 'usb-ground', 'thermal-pad'];
const DRIVE_FAMILY: Record<string, string> = { supplies: 'power', supplied: 'power', returns: 'ground', reference: 'analog' };

/** Family of the connection ends, from the server's own `signal.family` (the one vocabulary). */
export function connectionFamilies(payload: PvPayload): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const c of payload.connections) {
    const f = c.signal?.family;
    if (!f) { continue; }
    for (const id of [c.a, c.b]) { (out.get(id) || out.set(id, []).get(id)!).push(f); }
  }
  return out;
}

/** The function the pin is (or would be) carrying: the claimed one, else its default. */
function activeFunction(p: PvPin): string {
  return p.consumers.find(c => c.kind === 'task' && c.function)?.function || p.default_function || '';
}

export function familyOf(p: PvPin, viaConnections: Map<string, string[]>): string {
  if (POWER_KINDS.includes(p.kind)) { return 'power'; }
  if (GROUND_KINDS.includes(p.kind)) { return 'ground'; }
  if (p.kind === 'usb-data') { return 'usb'; }
  if (p.kind === 'clock-input') { return 'clock'; }
  if (p.kind === 'analog-reference') { return 'analog'; }
  const fn = activeFunction(p);
  const own = p.signals.find(s => s.function === fn)?.family;
  if (own) { return own; }
  const dr = DRIVE_FAMILY[p.drive_role];
  if (dr && !p.families.length) { return dr; }
  const viaConn = viaConnections.get(p.id);
  if (viaConn && viaConn.length) { return viaConn[0]; }
  return p.families[0] || '';
}

export function directionOf(p: PvPin): string {
  const fn = activeFunction(p);
  return p.signals.find(s => s.function === fn)?.direction || 'undetermined';
}

export function roleOf(p: PvPin, family: string): PvRole {
  if (!p.bonded) { return 'not-bonded'; }
  if (/reserv/i.test(`${p.stage_why} ${p.notes}`) || p.lit?.children.some(c => /reserv/i.test(c.blocked_why || ''))) { return 'reserved'; }
  if (POWER_KINDS.includes(p.kind) || family === 'power') { return 'power'; }
  if (GROUND_KINDS.includes(p.kind) || family === 'ground') { return 'ground'; }
  if (family === 'clock') { return 'clock'; }
  if (family === 'reset-programming' && /reset/i.test(`${p.label} ${activeFunction(p)}`)) { return 'reset'; }
  if (family === 'analog') { return 'analog'; }
  const d = directionOf(p);
  if (d === 'out') { return 'output'; }
  if (d === 'in') { return 'input'; }
  if (d === 'inout') { return 'inout'; }
  return 'none';
}

/** The ladder's verdict for the pin in the current protocol context ('' when no protocol is asked). */
export function ladderVerdict(p: PvPin): '' | 'blocked' | 'undetermined' | 'ok' {
  const kids = p.lit?.children;
  if (!kids || !kids.length) { return ''; }
  if (kids.every(c => c.verdict === 'blocked')) { return 'blocked'; }
  if (kids.every(c => c.verdict === 'undetermined')) { return 'undetermined'; }
  return 'ok';
}

export function fillOf(p: PvPin): PvFill {
  const v = ladderVerdict(p);
  if (v === 'blocked' || v === 'undetermined') { return 'hatched'; }
  if (p.stage === 'committed') { return 'committed'; }
  if (p.stage === 'proposed') { return 'proposed'; }
  return 'hollow';
}

export const isHollow = (p: PvPin): boolean => p.stage === 'unassigned' || p.stage === 'available';
export const isInternal = (p: PvPin): boolean => p.reach === 'internal';

/** Plain words for the three kinds of connection summary. */
export const DRIVE_WORDS: Record<string, string> = {
  'sources-and-sinks': 'sources and sinks current', returns: 'returns current (the ground side)', supplied: 'is supplied', supplies: 'supplies current',
  sources: 'sources current', 'draws-leakage-only': 'draws leakage only', 'differential-pair': 'one of a differential pair', reference: 'is a reference',
  unconnected: 'is not connected', undetermined: 'undetermined',
};
export const LIMIT_WORDS: Record<string, string> = {
  'within-recommended': 'within the recommended limit', undetermined: 'undetermined', over: 'over a limit', unchecked: 'unchecked (no check has run)',
};
export const KIND_ORDER = ['pad-to-leg', 'to-header', 'to-board-part', 'chip-to-chip', 'on-board', 'to-bench'];
export const KIND_WORDS: Record<string, string> = {
  'pad-to-leg': 'Pad to leg (inside the package)', 'to-header': 'Leg to a header pin', 'to-board-part': 'To a part on the board',
  'chip-to-chip': 'Chip to chip', 'on-board': 'On the board', 'to-bench': 'To the bench', none: 'No connection',
};
export const SURFACE_WORDS: Record<string, string> = {
  board: 'Board', enclosure: 'Enclosure (chip package)', soc: 'SoC (the silicon die)', 'board-part': 'Board part', 'bench-part': 'Bench part',
};

export function connectionLabel(c: PvConnection, byId: Map<string, PvPin>): string {
  return `${byId.get(c.a)?.label ?? c.a} ↔ ${byId.get(c.b)?.label ?? c.b}`;
}
