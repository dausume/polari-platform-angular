import { PlacedPin, Scene } from './pin-view-layout';
import { PvBenchBridge, PvBridgeHop, PvPayload, PvStructBinding, PvStructDirection } from './pin-view.types';

/**
 * hsp-3b — the pin view's STRUCT LANE (HARDWARE_SYSTEM_PINS_PLAN §7.3): the struct fields as a column beside the board, an arrow pin <-> field per
 * binding (coloured by the lane that runs the change, stamped with the updater HW / US), and the bridge path as a chain of hops from the UART pins out
 * to the userspace box (the signal level on each hop, the mode on the last). Pure: the scene, the bindings and the chain in, placed marks out.
 * Every number is the door's: a binding names its SoC pin (PD2), matched to the payload's `soc_pin` (atmega328p:PD2); a pin the picture does not
 * hold is listed as unplaced, never guessed. Nothing here decides a binding - the backend derives them from the Catom assertions.
 */
export const LANE_WORDS: Record<string, string> = {
  isr: 'interrupt routine', loop: 'main loop', task: 'RTOS task', userspace: 'userspace (the host side)', init: 'start-up (init)',
};
export const DIRECTION_WORDS: Record<PvStructDirection, string> = {
  in: 'the pin\'s event changes the field', out: 'the field drives the pin', 'to-bridge': 'the field leaves through the bridge', 'from-bridge': 'the bridge brings the field in',
};
export const UPDATER_WORDS: Record<string, string> = { HW: 'hardware (a pin event)', US: 'userspace (a command from the host)' };
export const STATUS_WORDS: Record<string, string> = {
  verified: 'verified by the cycle record', unverified: 'asserted, not yet verified (a frame-decoding twin run verifies it)', false: 'false (the build has no such function)',
};

export interface LaneField { key: string; struct: string; field: string; label: string; x: number; y: number; w: number; h: number; pins: string[]; bridged: boolean; statuses: string[]; }
export interface LaneArrow {
  key: string; field: string; pinId: string; pinName: string; direction: PvStructDirection; lane: string; updater: string; event: string; status: string;
  atom: string; bridge: string; d: string; sx: number; sy: number;
}
export interface LaneHop { n: number; kind: string; what: string; level: string; mode: string; last: boolean; x: number; y: number; w: number; h: number; basis: string; }
export interface StructLane {
  font: number; fields: LaneField[]; arrows: LaneArrow[]; hops: LaneHop[]; hopLinks: { pinId: string; pinName: string; d: string }[]; hopEdges: string[];
  bridge: PvBenchBridge | null; structs: { name: string; x: number; y: number }[]; unplaced: { pin: string; why: string }[];
  bounds: { x0: number; y0: number; x1: number; y1: number };
}

const CHAR_EM = 0.58;
/** `*` is an assertion on the WHOLE struct (a frame of it crosses the bridge). */
export const fieldLabel = (field: string): string => (field === '*' ? '(the whole struct)' : field);
/** Which drawn copy of a SoC pin the arrow lands on: the package leg first (outside the die, on the board), then the die pad. */
const LEVEL_PREF = ['package', 'die', 'board'];
const OUTWARD: PvStructDirection[] = ['out', 'to-bridge'];

/** The drawn pin for a SoC pin name (PD2) - the package leg when there is one; null when the picture has no such pin. */
export function pinFor(scene: Scene, name: string, soc = ''): PlacedPin | null {
  const want = (s: string | undefined) => !!s && (s === name || s.endsWith(':' + name)) && (!soc || s.startsWith(soc + ':') || s === name);
  const hits = [...scene.pins.values()].filter(p => want(p.pin.soc_pin));
  hits.sort((a, b) => rank(a.pin.level) - rank(b.pin.level));
  return hits[0] || null;
}
const rank = (level: string): number => { const i = LEVEL_PREF.indexOf(level); return i < 0 ? LEVEL_PREF.length : i; };

/** A soft S-curve from (x1, y1) to (x2, y2), bending along x. */
const curve = (x1: number, y1: number, x2: number, y2: number): string => {
  const mx = (x1 + x2) / 2;
  return `M${x1},${y1}C${mx},${y1} ${mx},${y2} ${x2},${y2}`;
};

export function buildStructLane(scene: Scene, payload: PvPayload, rows: PvStructBinding[], chain: { bridge: PvBenchBridge | null; hops: PvBridgeHop[] } | null): StructLane {
  const f = Math.max(payload.layout?.font ?? 1.2, 0.6), b = scene.bounds;
  const h = f * 2.2, gap = f * 1.1, pad = f;
  const unplaced: { pin: string; why: string }[] = [];
  const placedOf = new Map<string, PlacedPin | null>();
  const place = (name: string): PlacedPin | null => {
    if (!placedOf.has(name)) {
      const p = pinFor(scene, name);
      placedOf.set(name, p);
      if (!p) { unplaced.push({ pin: name, why: `the picture has no pin ${name} (the binding names a pin of another chip, or the board's payload is trimmed)` }); }
    }
    return placedOf.get(name)!;
  };

  // the fields, in the order that keeps the arrows least crossed: by the mean height of their pins
  const byKey = new Map<string, { struct: string; field: string; ys: number[]; pins: Set<string>; bridged: boolean; statuses: Set<string> }>();
  for (const r of rows) {
    const key = `${r.struct}.${r.field}`;
    const e = byKey.get(key) || byKey.set(key, { struct: r.struct, field: r.field, ys: [], pins: new Set(), bridged: false, statuses: new Set() }).get(key)!;
    const p = place(r.pin);
    if (p) { e.ys.push(p.y); e.pins.add(p.pin.id); }
    e.bridged = e.bridged || !!r.bridge || r.direction === 'to-bridge' || r.direction === 'from-bridge';
    e.statuses.add(r.status);
  }
  const mean = (ys: number[]) => (ys.length ? ys.reduce((a, y) => a + y, 0) / ys.length : Infinity);
  const ordered = [...byKey.entries()].sort((a, c) => mean(a[1].ys) - mean(c[1].ys) || a[0].localeCompare(c[0]));
  const fw = Math.max(8 * f, ...ordered.map(([, e]) => fieldLabel(e.field).length * f * CHAR_EM + 2 * pad));
  const total = ordered.length * (h + gap) - gap, cy = (b.y0 + b.y1) / 2;
  const fx = b.x1 + 8 * f, fy0 = cy - total / 2;
  const fields: LaneField[] = ordered.map(([key, e], i) => ({
    key, struct: e.struct, field: e.field, label: fieldLabel(e.field), x: fx, y: fy0 + i * (h + gap), w: fw, h, pins: [...e.pins], bridged: e.bridged, statuses: [...e.statuses],
  }));
  const fieldAt = new Map(fields.map(x => [x.key, x]));

  // one arrow per binding; the arrows meeting one field spread over its height so they stay apart
  const perField = new Map<string, PvStructBinding[]>();
  rows.forEach(r => { const k = `${r.struct}.${r.field}`; (perField.get(k) || perField.set(k, []).get(k)!).push(r); });
  const arrows: LaneArrow[] = [];
  for (const [k, rs] of perField) {
    const fl = fieldAt.get(k)!;
    rs.forEach((r, i) => {
      const p = placedOf.get(r.pin);
      if (!p) { return; }
      const ey = fl.y + (fl.h * (i + 1)) / (rs.length + 1), out = OUTWARD.includes(r.direction);
      const d = out ? curve(fl.x, ey, p.x, p.y) : curve(p.x, p.y, fl.x, ey);
      arrows.push({
        key: `${r.assertion}|${r.pin}|${r.field}`, field: k, pinId: p.pin.id, pinName: r.pin, direction: r.direction, lane: r.lane || 'loop', updater: r.updater, event: r.event,
        status: r.status, atom: r.atom, bridge: r.bridge, d, sx: fl.x - f * 0.4, sy: ey,
      });
    });
  }

  // the bridge chain: a column of hops right of the fields, wired from the bridge's chip pins to its first hop
  const hopsIn = chain?.hops || [];
  const hx = fx + fw + 8 * f;
  const hw = Math.max(10 * f, ...hopsIn.map(x => Math.max(`${x.n}. ${x.kind}`.length, hopLevel(x, hopsIn).length) * f * CHAR_EM + 2 * pad));
  const hh = f * 3.2, hgap = f * 1.6, htotal = hopsIn.length * (hh + hgap) - hgap, hy0 = cy - htotal / 2;
  const hops: LaneHop[] = hopsIn.map((x, i) => ({
    n: x.n, kind: x.kind, what: x.what, level: hopLevel(x, hopsIn), mode: x.mode, last: i === hopsIn.length - 1, x: hx, y: hy0 + i * (hh + hgap), w: hw, h: hh, basis: x.basis,
  }));
  const hopEdges = hops.slice(1).map((x, i) => `M${x.x + x.w / 2},${hops[i].y + hops[i].h}L${x.x + x.w / 2},${x.y}`);
  const hopLinks: { pinId: string; pinName: string; d: string }[] = [];
  if (hops.length && chain?.bridge) {
    for (const name of (chain.bridge.pins || '').split(',').map(s => s.trim()).filter(Boolean)) {
      const p = place(name);
      if (p) { hopLinks.push({ pinId: p.pin.id, pinName: name, d: curve(p.x, p.y, hops[0].x, hops[0].y + hops[0].h / 2) }); }
    }
  }

  const structs = [...new Set(fields.map(x => x.struct))].map((name, i) => ({ name, x: fx, y: fy0 - f * (1.2 + i * 1.3) }));
  const xs = [b.x0, b.x1, fx + fw, ...(hops.length ? [hx + hw] : [])];
  const ys = [b.y0, b.y1, ...(fields.length ? [fy0 - f * 2.5, fy0 + total] : []), ...(hops.length ? [hy0, hy0 + htotal] : [])];
  return {
    font: f, fields, arrows, hops, hopLinks, hopEdges, bridge: chain?.bridge || null, structs, unplaced,
    bounds: { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) },
  };
}

/** The hop's second line: the signal level, and on the last hop the mode (serial | simulated). A level nobody cited stays -1, said. */
function hopLevel(x: PvBridgeHop, all: PvBridgeHop[]): string {
  const level = x.signal_level && x.signal_level !== '-1' ? x.signal_level : 'level -1';
  return x === all[all.length - 1] ? `${x.mode || 'serial'} · ${level}` : level;
}

/** The pins a field touches, and the fields a pin touches (the two ways the selection reads the lane). */
export function fieldPins(lane: StructLane | null, key: string): Set<string> {
  const out = new Set<string>();
  if (!lane) { return out; }
  lane.arrows.filter(a => a.field === key).forEach(a => out.add(a.pinId));
  const fl = lane.fields.find(x => x.key === key);
  if (fl?.bridged) { lane.hopLinks.forEach(l => out.add(l.pinId)); }
  return out;
}

/** The SoC pin name a drawn pin stands for (atmega328p:PD2 -> PD2): any copy of the pin (die pad, package leg) reads the same bindings. */
export const socPinName = (socPin: string | undefined): string => (socPin || '').split(':').pop() || '';

/** The side panel rows of one field, or of one pin - plain named fields, never JSON. */
export interface StructRow { field: string; fieldLabel: string; pin: string; direction: string; event: string; lane: string; updater: string; atom: string; status: string; }
export function structRows(lane: StructLane | null, by: { field?: string; pinName?: string }): StructRow[] {
  if (!lane) { return []; }
  return lane.arrows.filter(a => (by.field ? a.field === by.field : true) && (by.pinName ? a.pinName === by.pinName : true)).map(a => ({
    field: a.field, fieldLabel: fieldLabel(a.field.split('.').slice(1).join('.') || a.field), pin: a.pinName, direction: DIRECTION_WORDS[a.direction] || a.direction, event: a.event || 'none named', lane: LANE_WORDS[a.lane] || a.lane,
    updater: UPDATER_WORDS[a.updater] || a.updater || 'none named', atom: a.atom, status: STATUS_WORDS[a.status] || a.status,
  }));
}
