/**
 * cb-1 (AI-Notes/plans/COMPONENT_BINDING_PLAN.md §3): the pure half of a SCHEMATIC COMPONENT's small drawing, laid out the way the
 * user's drawing of 2026-11-24 draws one: the core part on a vertical line at the left, each signal port running right to its chip
 * pin, the conditioning part a port carries drawn on that port's line, and the supply below the last port. Unsolved paths are red.
 * cb-3: a port on the same circuit net as an earlier one is a TAP of that line (a junction, then its own pin), never a second end of
 * the core part - the UNO light's D3 sense wire joins D6's line, it does not run through the LED. With one line, the core part sits
 * on the vertical line between that line and the supply below. The chip's own pull resistor is drawn as a resistor.
 * No d3 and no network: rows in, a drawing model out; the component's template only paints the model.
 */

export interface SchematicComponentRow { name: string; title?: string; intent?: string; core_part?: string; protocol?: string;
  solve_state?: string; solved_by?: string; findings?: string; hardware_solution?: string; board?: string; description?: string; }
export interface SchematicPortRow { name?: string; component: string; port: string; kind?: string; chip?: string; pin?: string;
  pin_source?: string; order?: number; net?: string; }
/** cb-3: one decision of the schematic solver (SchematicComponentCheck). */
export interface SchematicCheckRow { name?: string; component: string; rule: string; status: string; subject?: string; detail?: string;
  cite?: string; order?: number; }
export interface SchematicPartRow { name?: string; component: string; ref: string; role?: string; part_kind?: string; value?: string;
  port?: string; placed_by?: string; rule?: string; order?: number; }

export interface Wire { x1: number; y1: number; x2: number; y2: number; }
export interface SymbolAt { kind: string; x: number; y: number; ref: string; role: string; vertical: boolean; }
export interface LabelAt { x: number; y: number; text: string; anchor: 'start' | 'middle' | 'end'; muted: boolean; }
export interface PinDot { x: number; y: number; source: string; pin?: string; chip?: string; }
export interface SchematicDrawing {
  width: number; height: number; wires: Wire[]; symbols: SymbolAt[]; labels: LabelAt[]; pins: PinDot[];
  junctions: { x: number; y: number }[]; state: string; red: boolean; words: string;
}

const BUS_X = 70;        // the vertical line the core part sits on
const PART_X = 150;      // where a port's conditioning part is drawn
const PART_GAP = 14;     // half the gap the part leaves in its line
const PIN_X = 212;       // the chip pin's dot
/** Where a component drawing's pin dots sit (the whole-solution view runs each line on from here to the chip). */
export const PIN_DOT_X = PIN_X;
const TOP = 28;
const STEP = 62;
const TAP_X = 186;       // where a tap leaves its net's line (between the part and the pin)
const CORE_DROP = 40;    // with one line: how far below it the core part sits
const PULL_RISE = 46;    // how far above its line a pull reaches its supply

const byOrder = (a: { order?: number }, b: { order?: number }) => (a.order ?? 0) - (b.order ?? 0);

/** What a component's state means, in words (no invented certainty: "solved" says by what). */
export function stateWords(c: SchematicComponentRow): string {
  const s = c.solve_state || 'unsolved';
  if (s === 'solved') { return c.findings || (c.solved_by ? `solved - ${c.solved_by}` : 'solved'); }
  if (s === 'blocked') { return c.findings || 'blocked - the solver needs a part it cannot place; see its checks'; }
  if (s === 'stale') { return 'stale - an input changed since it was solved; solve it again'; }
  return 'unsolved - nothing has worked out its conditioning parts yet';
}

/** The drawing of one component from its own ports and parts (rows of other components are ignored). */
export function layoutSchematic(c: SchematicComponentRow, allPorts: SchematicPortRow[], allParts: SchematicPartRow[]): SchematicDrawing {
  const ports = (allPorts || []).filter((p) => p.component === c.name).sort(byOrder);
  const parts = (allParts || []).filter((p) => p.component === c.name).sort(byOrder);
  const signals = ports.filter((p) => (p.kind || 'signal') === 'signal');
  const supplies = ports.filter((p) => p.kind === 'supply' || p.kind === 'ground');
  const state = c.solve_state || 'unsolved';
  const out: SchematicDrawing = { width: 320, height: 0, wires: [], symbols: [], labels: [], pins: [], junctions: [], state,
    red: state !== 'solved', words: stateWords(c) };
  // a port on a net an earlier port already uses is a tap of that line; the others are lines of their own
  const leadOf = new Map<SchematicPortRow, SchematicPortRow>();
  signals.forEach((p, i) => {
    const lead = p.net ? signals.slice(0, i).find((q) => q.net === p.net && !leadOf.has(q)) : undefined;
    if (lead) { leadOf.set(p, lead); }
  });
  const leads = signals.filter((p) => !leadOf.has(p));
  const yOf = new Map<SchematicPortRow, number>();
  // a pull hangs ABOVE its line (from the line up to the supply), so a drawing with one leaves room for it at the top
  const isPull = (x: SchematicPartRow) => x.role === 'pull';
  const top = TOP + (parts.some(isPull) ? PULL_RISE : 0);
  let row = 0;
  leads.forEach((l) => {
    yOf.set(l, top + row++ * STEP);
    signals.filter((t) => leadOf.get(t) === l).forEach((t) => yOf.set(t, top + row++ * STEP));
  });
  const ys = leads.map((l) => yOf.get(l) as number);
  const yTop = ys.length ? ys[0] : top;
  let yBot = ys.length ? ys[ys.length - 1] : top;
  const core = parts.find((p) => (p.role || 'core') === 'core');
  if (ys.length > 1) {
    // the core part on the vertical line, centred between the first and last line
    const mid = (yTop + yBot) / 2;
    out.wires.push({ x1: BUS_X, y1: yTop, x2: BUS_X, y2: mid - PART_GAP }, { x1: BUS_X, y1: mid + PART_GAP, x2: BUS_X, y2: yBot });
    if (core) { out.symbols.push({ kind: symbolKind(core.part_kind) || 'part', x: BUS_X, y: mid, ref: core.ref, role: 'core', vertical: true }); }
    out.labels.push({ x: BUS_X - 22, y: mid + 4, text: core?.ref || c.core_part || '', anchor: 'end', muted: false });
  } else if (core) {
    // one line: the core part hangs below it, between the line and the supply
    const cy = yTop + CORE_DROP;
    out.wires.push({ x1: BUS_X, y1: yTop, x2: BUS_X, y2: cy - PART_GAP });
    out.symbols.push({ kind: symbolKind(core.part_kind) || 'part', x: BUS_X, y: cy, ref: core.ref, role: 'core', vertical: true });
    out.labels.push({ x: BUS_X - 22, y: cy + 4, text: core.ref, anchor: 'end', muted: false });
    yBot = cy + PART_GAP;
  }
  // each line: from the core to its pin, broken by the part that sits on it; a tap leaves its line at a junction
  signals.forEach((p) => {
    const y = yOf.get(p) as number;
    const lead = leadOf.get(p);
    const part = parts.find((x) => x.port === p.port && (x.role || 'core') !== 'core');
    const x0 = lead ? TAP_X : BUS_X;
    if (lead) {
      const ly = yOf.get(lead) as number;
      out.junctions.push({ x: TAP_X, y: ly });
      out.wires.push({ x1: TAP_X, y1: ly, x2: TAP_X, y2: y });
    }
    if (part && !lead && isPull(part)) {
      // a pull is not in series: the line runs straight to the pin; the resistor hangs from a junction on it up to the supply
      out.wires.push({ x1: x0, y1: y, x2: PIN_X, y2: y }, { x1: PART_X, y1: y, x2: PART_X, y2: y - PULL_RISE + 2 * PART_GAP + 4 });
      out.junctions.push({ x: PART_X, y });
      const sy = y - PULL_RISE / 2 - 4;
      out.symbols.push({ kind: symbolKind(part.part_kind) || 'part', x: PART_X, y: sy, ref: part.ref, role: 'pull', vertical: true });
      out.wires.push({ x1: PART_X, y1: sy - PART_GAP, x2: PART_X, y2: y - PULL_RISE - 2 });
      const inside = (part.part_kind || '').startsWith('internal-pull');
      out.labels.push({ x: PART_X + 12, y: sy + 4, text: part.ref + (inside ? ' (in the chip)' : ''), anchor: 'start', muted: true });
      out.labels.push({ x: PART_X, y: y - PULL_RISE - 6, text: (part.part_kind || '').endsWith('down') ? 'GND' : 'VCC', anchor: 'middle', muted: true });
    } else if (part && !lead) {
      out.wires.push({ x1: x0, y1: y, x2: PART_X - PART_GAP, y2: y }, { x1: PART_X + PART_GAP, y1: y, x2: PIN_X, y2: y });
      out.symbols.push({ kind: symbolKind(part.part_kind) || 'part', x: PART_X, y, ref: part.ref, role: part.role || '', vertical: false });
      out.labels.push({ x: PART_X, y: y - 16, text: part.ref, anchor: 'middle', muted: true });
    } else {
      out.wires.push({ x1: x0, y1: y, x2: PIN_X, y2: y });
    }
    out.pins.push({ x: PIN_X, y, source: p.pin_source || (p.pin ? 'chosen' : ''), pin: p.pin || '', chip: p.chip || '' });
    const where = [p.chip, p.pin].filter((v) => !!v).join(' ');
    out.labels.push({ x: PIN_X + 8, y: y + 4, text: where || 'open', anchor: 'start', muted: !p.pin });
  });
  const lowest = Math.max(yBot, ...signals.map((p) => yOf.get(p) as number));
  // the supply (or ground) below the last port, joined at a junction
  let y = yBot;
  supplies.forEach((p) => {
    const part = parts.find((x) => x.port === p.port);
    const sy = y + 46;
    out.junctions.push({ x: BUS_X, y });
    out.wires.push({ x1: BUS_X, y1: y, x2: BUS_X, y2: sy - PART_GAP });
    out.symbols.push({ kind: symbolKind(part?.part_kind) || (p.kind === 'ground' ? 'ground' : 'supply'), x: BUS_X, y: sy, ref: part?.ref || p.port,
      role: part?.role || p.kind || 'supply', vertical: true });
    out.labels.push({ x: BUS_X + 22, y: sy + 4, text: part?.ref || p.port, anchor: 'start', muted: true });
    y = sy + PART_GAP;
  });
  out.height = Math.max(y, lowest) + 26;
  return out;
}

/** The symbol a part kind is drawn with: the chip's own pull resistor is a resistor (inside the pin, but a resistor all the same). */
export function symbolKind(kind?: string): string {
  if (!kind) { return ''; }
  return kind.startsWith('internal-pull') ? 'resistor' : kind;
}
