import { isRailLink, DRIVE_WORDS, DRIVE_WORDS_SHORT, KIND_ORDER, KIND_WORDS, LIMIT_WORDS, RAIL_WORDS, SURFACE_WORDS, STAGE_WORDS, relevantIn } from './pin-view-encode';
import { PvConnection, PvMode, PvPayload, PvPin, PvSelection, PvSurface } from './pin-view.types';

/**
 * pv-1 side panel models (PIN_VIEW_PLAN 2.7 + 2.8). Pure functions: the payload and the selection in,
 * plain named fields out — the template renders them as lists and tables, never as JSON.
 *
 * Vocabulary (his ruling): DRIVE = electricity (current, supply, rail, pull, the class of the limit);
 * SIGNAL = outputs / inputs + the protocol signal; USE = tasks, Purposes, stage. Three separate sections.
 */
export interface PanelPinRow {
  id: string; label: string; canonical: string; level: string; stage: string; stageWhy: string; families: string[]; functions: string; consumers: string[];
  /** DRIVE columns (electricity) and SIGNAL columns - the template shows the pair for the mode. */
  driveStatus: string; rail: string; limitClass: string; activated: string; activatedFamily: string; locked: boolean;
}
export interface PanelGroup { kind: string; title: string; pins: PanelPinRow[]; }
export interface Field { name: string; value: string; }

export interface SurfacePanel {
  type: 'surface'; title: string; kindWord: string; parentTitle: string; counts: Field[]; groups: PanelGroup[];
  register: { text: string; route: string } | null; connectionCount: number; notes: string; rails: RailGroup[];
}
export interface RailGroup { rail: string; pins: string[]; }
export interface PanelConnRow { id: string; label: string; kind: string; via: string; other: string; }
export interface CapableRow { name: string; family: string; direction: string; active: boolean; }
export interface PinPanel {
  type: 'pin'; title: string; owner: string; fields: Field[]; families: string[]; consumers: string[]; connections: PanelConnRow[];
  /** pv-2: the Drive section (electricity), the Signal section (the activated function with the capable ones greyed) and the lifecycle rows. */
  drive: Field[]; signal: Field[]; capable: CapableRow[]; lifecycle: string[]; budgets: string[]; rails: RailGroup[];
}
export interface ConnPanel {
  type: 'connection'; title: string; kindWord: string; via: string;
  drive: Field[]; signal: Field[]; use: Field[]; family: string; electricalPlaceholder: string;
}
export type Panel = SurfacePanel | PinPanel | ConnPanel;

export class PvIndex {
  pins = new Map<string, PvPin>();
  surfaces = new Map<string, PvSurface>();
  conns = new Map<string, PvConnection>();
  byPin = new Map<string, PvConnection[]>();
  constructor(public payload: PvPayload) {
    payload.pins.forEach(p => this.pins.set(p.id, p));
    payload.surfaces.forEach(s => this.surfaces.set(s.id, s));
    for (const c of payload.connections) {
      this.conns.set(c.id, c);
      for (const id of [c.a, c.b]) { (this.byPin.get(id) || this.byPin.set(id, []).get(id)!).push(c); }
    }
  }
  owner(pinId: string): string { return this.pins.get(pinId)?.surface_title || this.surfaces.get(this.pins.get(pinId)?.surface || '')?.title || ''; }
  /** Connections with an end on this surface. */
  surfaceConnections(surfaceId: string): PvConnection[] {
    const out = new Map<string, PvConnection>();
    for (const p of this.pins.values()) {
      if (p.surface !== surfaceId) { continue; }
      for (const c of this.byPin.get(p.id) || []) { out.set(c.id, c); }
    }
    return [...out.values()];
  }
  /** The connections a selection draws (nothing is wired by default). */
  drawn(sel: PvSelection): PvConnection[] {
    if (!sel) { return []; }
    if (sel.kind === 'surface') { return this.surfaceConnections(sel.id); }
    if (sel.kind === 'pin') { return this.byPin.get(sel.id) || []; }
    const c = this.conns.get(sel.id);
    return c ? [c] : [];
  }
  /** Pins that stay at full strength for a selection. */
  focusPins(sel: PvSelection): Set<string> | null {
    if (!sel) { return null; }
    const out = new Set<string>();
    if (sel.kind === 'surface') { this.payload.pins.filter(p => p.surface === sel.id).forEach(p => out.add(p.id)); }
    if (sel.kind === 'pin') { out.add(sel.id); }
    for (const c of this.drawn(sel)) { out.add(c.a); out.add(c.b); }
    return out;
  }
}

const words = (m: Record<string, string>, k: string): string => m[k] || k || 'undetermined';

function consumersOf(ix: PvIndex, p: PvPin): string[] {
  const out: string[] = [];
  for (const c of p.consumers) { out.push(c.kind === 'task' ? `task ${c.who}${c.route ? ' via ' + c.route : ''}${c.function ? ' (' + c.function + ')' : ''}` : `Purpose ${c.who}`); }
  for (const c of ix.byPin.get(p.id) || []) {
    const other = ix.pins.get(c.a === p.id ? c.b : c.a);
    if (!other) { continue; }
    if (c.kind === 'to-board-part') { out.push(`board part ${other.surface_title || other.label}`); }
    else if (c.kind === 'pad-to-leg' && p.level === 'die') { out.push(`enclosure ${other.surface_title || ''}`.trim()); }
    else if (c.kind === 'chip-to-chip') { out.push(`the other chip (${other.surface_title || other.label})`); }
    else if (c.kind === 'to-bench') { out.push(`bench part ${other.surface_title || other.label}`); }
  }
  if (!p.bonded) { out.push('enclosure: not bonded, internal only'); }
  else if (p.reach === 'internal') { out.push('board: internal only, no header'); }
  return [...new Set(out)];
}

/** The rail links of some pins as lists (outside Drive mode they are not drawn as lines): per rail, the OTHER pins on it with their owner. */
function railGroups(ix: PvIndex, ids: string[]): RailGroup[] {
  const own = new Set(ids), by = new Map<string, Set<string>>();
  for (const id of ids) {
    const me = ix.pins.get(id);
    for (const c of ix.byPin.get(id) || []) {
      if (!isRailLink(c)) { continue; }
      const other = ix.pins.get(c.a === id ? c.b : c.a);
      if (!other || own.has(other.id)) { continue; }
      const rail = me?.rail && me.rail !== 'undetermined' ? me.rail : (c.signal.family === 'ground' ? 'GND' : 'supply');
      (by.get(rail) || by.set(rail, new Set()).get(rail)!).add(`${other.label} (${other.surface_title || other.level})`);
    }
  }
  return [...by].map(([rail, s]) => ({ rail, pins: [...s].sort() }));
}

function pinRow(ix: PvIndex, p: PvPin): PanelPinRow {
  return {
    id: p.id, label: p.label, canonical: p.canonical, level: p.level, stage: p.stage, stageWhy: p.stage_why, families: p.families, functions: p.functions.join(' · '), consumers: consumersOf(ix, p),
    driveStatus: p.drive_status || 'undetermined', rail: p.rail || 'undetermined', limitClass: p.limit_class || 'unchecked',
    activated: p.activated?.function || '', activatedFamily: p.activated?.family || '', locked: (p.lifecycle || []).some(l => l.locks),
  };
}

function surfacePanel(ix: PvIndex, s: PvSurface, mode: PvMode): SurfacePanel {
  const mine = ix.payload.pins.filter(p => p.surface === s.id && relevantIn(p, mode));   // a mode lists only the pins it shows
  const conns = ix.surfaceConnections(s.id);
  const groups = new Map<string, PanelPinRow[]>();
  for (const p of mine) {
    const kinds = new Set((ix.byPin.get(p.id) || []).map(c => c.kind));
    if (!kinds.size) { kinds.add('none'); }
    for (const k of kinds) { (groups.get(k) || groups.set(k, []).get(k)!).push(pinRow(ix, p)); }
  }
  const order = [...KIND_ORDER, ...[...groups.keys()].filter(k => !KIND_ORDER.includes(k) && k !== 'none'), 'none'];
  const stageCounts = mine.reduce((a, p) => (a[p.stage] = (a[p.stage] || 0) + 1, a), {} as Record<string, number>);
  const rp = s.links?.register_profile;
  return {
    type: 'surface', title: s.title, kindWord: words(SURFACE_WORDS, s.kind), parentTitle: ix.surfaces.get(s.parent)?.title || '',
    counts: [{ name: 'Pins', value: String(mine.length) }, ...['unassigned', 'available', 'proposed', 'committed'].map(k => ({ name: k, value: String(stageCounts[k] || 0) }))],
    groups: order.filter(k => groups.has(k)).map(k => ({ kind: k, title: words(KIND_WORDS, k), pins: groups.get(k)! })),
    register: rp ? (rp.includes('/socs/atmega328p/')
      ? { text: 'Register profile: what each register of this SoC is for', route: '/display/register-profile' }
      : { text: `Register profile door: ${rp}`, route: '' }) : null,
    connectionCount: conns.length, notes: s.notes || '', rails: railGroups(ix, mine.map(x => x.id)),
  };
}

function pinPanel(ix: PvIndex, p: PvPin): PinPanel {
  const conns = (ix.byPin.get(p.id) || []).map(c => {
    const other = ix.pins.get(c.a === p.id ? c.b : c.a);
    return { id: c.id, label: `${p.label} ↔ ${other?.label ?? ''}`, kind: words(KIND_WORDS, c.kind), via: [c.via, c.via_part].filter(Boolean).join(' '), other: other?.surface_title || '' };
  });
  return {
    type: 'pin', title: `${p.label}${p.canonical ? ' (' + p.canonical + ')' : ''}${p.number != null ? ' · pin ' + p.number : ''}`, owner: p.surface_title || '',
    fields: [
      { name: 'Level', value: p.level }, { name: 'Stage', value: `${words(STAGE_WORDS, p.stage)}${p.stage_why ? ' — ' + p.stage_why : ''}` },
      { name: 'Can do', value: p.functions.join(' · ') || 'nothing documented' }, { name: 'Pad class', value: p.drive_class || 'undetermined' },
    ],
    families: p.families, consumers: consumersOf(ix, p), connections: conns,
    drive: [
      { name: 'Status', value: words(DRIVE_WORDS_SHORT, p.drive_status) }, { name: 'Rail', value: words(RAIL_WORDS, p.rail) },
      { name: 'Pull', value: p.pull && p.pull !== 'none' ? p.pull.replace('-', ' ') : 'none set' }, { name: 'Limit class', value: words(LIMIT_WORDS, p.limit_class) },
      ...(p.limit_basis ? [{ name: 'Judged by', value: p.limit_basis }] : []), { name: 'Why', value: p.drive_why || 'undetermined' },
    ],
    signal: [
      { name: 'Activated', value: p.activated ? `${p.activated.function} (${p.activated.family}, ${p.activated.direction})` : 'nothing activated at this stage' },
      { name: 'Carries a signal', value: p.signal_relevant === false ? 'no (a supply, ground or regulator pin)' : 'yes' },
    ],
    capable: (p.capable || []).map(c => ({ name: c.function, family: c.family, direction: c.direction, active: !!p.activated && p.activated.resource === c.function })),
    lifecycle: (p.lifecycle || []).map(l => `${l.policy}${l.condition ? ' if ' + l.condition : ''} (${l.phase})${l.locks ? ' — locked' : ''}`),
    budgets: p.group_budget || [], rails: railGroups(ix, [p.id]),
  };
}

function connPanel(ix: PvIndex, c: PvConnection): ConnPanel {
  const a = ix.pins.get(c.a), b = ix.pins.get(c.b);
  const la = `${a?.label ?? c.a} (${a?.surface_title ?? ''})`, lb = `${b?.label ?? c.b} (${b?.surface_title ?? ''})`;
  const d = c.drive, s = c.signal, u = c.use;
  return {
    type: 'connection', title: `${a?.label ?? ''} ↔ ${b?.label ?? ''}`, kindWord: words(KIND_WORDS, c.kind), via: [c.via, c.via_part].filter(Boolean).join(' '),
    drive: [
      { name: la, value: words(DRIVE_WORDS, d.a) }, { name: lb, value: words(DRIVE_WORDS, d.b) },
      { name: 'Rail', value: d.rail || 'none named' }, { name: 'Domain', value: d.domain || 'undetermined' }, { name: 'Pull', value: d.pull || 'undetermined' },
      { name: 'In the path', value: [d.via, d.via_part].filter(x => x && x !== 'direct').join(' ') || 'nothing (direct)' },
      { name: 'Limit class', value: words(LIMIT_WORDS, d.limit_verdict) },
    ],
    signal: [
      { name: la, value: s.a || 'undetermined' }, { name: lb, value: s.b || 'undetermined' },
      { name: 'Protocol signal', value: s.protocol_signal || 'none' }, { name: 'Family', value: s.family || 'none' },
    ],
    use: [
      { name: 'Tasks', value: u.tasks.map(t => `${t.who}${t.solution ? ' of ' + t.solution : ''}${t.function ? ' (' + t.function + ')' : ''}`).join('; ') || 'no task claims this' },
      { name: 'Purposes', value: u.purposes.join(', ') || 'none' }, { name: 'Stage', value: u.stage || c.stage },
    ],
    family: s.family || '', electricalPlaceholder: 'Electrical view (levels, currents, limits and the rule verdicts live there; not built yet)',
  };
}

export function buildPanel(ix: PvIndex, sel: PvSelection, mode: PvMode = 'all'): Panel | null {
  if (!sel) { return null; }
  if (sel.kind === 'surface') { const s = ix.surfaces.get(sel.id); return s ? surfacePanel(ix, s, mode) : null; }
  if (sel.kind === 'pin') { const p = ix.pins.get(sel.id); return p ? pinPanel(ix, p) : null; }
  const c = ix.conns.get(sel.id);
  return c ? connPanel(ix, c) : null;
}
