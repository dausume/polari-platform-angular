import { LvBoard, LvEnd } from './layout-view.types';

/**
 * lay-2 - the PURE geometry of the layout view: where a board sits in the picture, where a hole or a header pin is, which way a wire leaves it, and the curve it takes.
 * Units: ONE hole pitch (0.1 in = 2.54 mm, the breadboard's and the headers' own spacing) is P = 10 picture units, so every distance between holes is exact; the outline sizes
 * of a board and the gaps between header groups on the UNO are SCHEMATIC proportions (the frame says so on screen), not measured.
 */
export const P = 10;
const PAD = 1.5 * P;
export const COLS = 'abcdefghij';
export const RAILS = [['top', '+'], ['top', '-'], ['bottom', '-'], ['bottom', '+']] as const;

export interface Pt { x: number; y: number; }
export type Dir = 'up' | 'down' | 'left' | 'right';
export interface Anchor extends Pt { dir: Dir; }
export interface BoardFrame { board: LvBoard; x: number; y: number; w: number; h: number; }

export type Tie =
  | { t: 'hole'; row: number; col: string }
  | { t: 'strip'; row: number; side: 'L' | 'R' }
  | { t: 'rail'; pos: 'top' | 'bottom'; pol: '+' | '-'; n: number }
  | { t: 'pin'; label: string };

/** The tie-point grammar: r<N><a-j>, the older r<N>L / r<N>R, rail:<top|bottom>:<+|->:<N>; anything else is a header label (D6, GND, +5V ...). */
export function parseTie(tie: string): Tie {
  let m = /^r(\d+)([a-j])$/.exec(tie);
  if (m) { return { t: 'hole', row: +m[1], col: m[2] }; }
  m = /^r(\d+)([LR])$/.exec(tie);
  if (m) { return { t: 'strip', row: +m[1], side: m[2] as 'L' | 'R' }; }
  m = /^rail:(top|bottom):([+-]):(\d+)$/.exec(tie);
  if (m) { return { t: 'rail', pos: m[1] as 'top' | 'bottom', pol: m[2] as '+' | '-', n: +m[3] }; }
  return { t: 'pin', label: tie };
}

// ------------------------------------------------------------------------------------------------------------------ breadboard
/** Local y of a hole column (a-e above the trench, f-j below it; the trench is 3 pitches between e and f, the standard 0.3 in) and of each rail line. */
export function breadboardRows(): { colY: Record<string, number>; railY: Record<string, number>; h: number } {
  const railY: Record<string, number> = { 'top+': PAD, 'top-': PAD + P };
  const aY = PAD + P + 2.2 * P;
  const colY: Record<string, number> = {};
  for (let i = 0; i < 5; i++) { colY[COLS[i]] = aY + i * P; }
  const fY = colY['e'] + 3 * P;
  for (let i = 0; i < 5; i++) { colY[COLS[5 + i]] = fY + i * P; }
  railY['bottom-'] = colY['j'] + 2.2 * P;
  railY['bottom+'] = railY['bottom-'] + P;
  return { colY, railY, h: railY['bottom+'] + PAD };
}

/** Local x of a rail hole: groups of five with a half-pitch gap between groups (the printed rails), centred on the strips. */
export function railX(b: LvBoard, n: number): number {
  const total = (b.rail_holes - 1) * P + Math.floor((b.rail_holes - 1) / 5) * 0.5 * P;
  const x0 = (breadboardW(b) - total) / 2;
  return x0 + (n - 1) * P + Math.floor((n - 1) / 5) * 0.5 * P;
}
export function breadboardW(b: LvBoard): number { return 2 * PAD + (b.rows - 1) * P; }
export function stripX(row: number): number { return PAD + (row - 1) * P; }

// ------------------------------------------------------------------------------------------------------------------ the development board
/** The UNO's outline is 68.6 x 53.3 mm = 27 x 21 pitches. */
const UNO_W = 27 * P, UNO_H = 21 * P;
export interface HeaderPin { label: string; connector: string; index: number; x: number; y: number; dir: Dir; }

/** Every header pin of a development board, in drawing positions local to the board (a wire leaves a header pin TOWARD the bench below, across the board's body): the digital headers on the top edge (D0 at the right, the 0.16 in gap between D7 and D8),
 *  the power and analog headers on the bottom edge, the ICSP block at the right. Pin order within a header is the connector's own (board.custom.board_uno.CONNECTORS). */
export function headerPins(b: LvBoard): HeaderPin[] {
  const out: HeaderPin[] = [];
  const conns = b.connectors || [];
  const topY = 1.3 * P, botY = UNO_H - 1.3 * P;
  const by = (n: string) => conns.find(c => c.name === n);
  const d7x = UNO_W - 2 * P - 7 * P;
  const digL = by('DIGITAL_L');
  digL?.labels.forEach((l, i) => out.push({ label: l, connector: 'DIGITAL_L', index: i, x: UNO_W - 2 * P - i * P, y: topY, dir: 'down' }));
  const digH = by('DIGITAL_H');
  digH?.labels.forEach((l, i) => out.push({ label: l, connector: 'DIGITAL_H', index: i, x: d7x - 1.6 * P - i * P, y: topY, dir: 'down' }));
  const pow = by('POWER');
  pow?.labels.forEach((l, i) => out.push({ label: l, connector: 'POWER', index: i, x: 6 * P + i * P, y: botY, dir: 'down' }));
  const ana = by('ANALOG');
  ana?.labels.forEach((l, i) => out.push({ label: l, connector: 'ANALOG', index: i, x: 6 * P + 8 * P + 1 * P + i * P, y: botY, dir: 'down' }));
  const icsp = by('ICSP');
  icsp?.labels.forEach((l, i) => out.push({ label: l, connector: 'ICSP', index: i, x: UNO_W - 3 * P + (i % 2) * P, y: UNO_H / 2 - P + Math.floor(i / 2) * P, dir: 'right' }));
  // listed in the connectors' own order, so the FIRST pin of a label (headerIndex) is the one the layout's text names: GND is the POWER header's, not the digital header's
  const order = (p: HeaderPin): number => conns.findIndex(c => c.name === p.connector);
  return out.map((p, i) => ({ p, i })).sort((a, b) => order(a.p) - order(b.p) || a.i - b.i).map(x => x.p);
}

/** label -> the FIRST pin of that label in connector order (the layout's own rule: 'GND' is the POWER header's pin 6). */
export function headerIndex(pins: HeaderPin[]): Map<string, HeaderPin> {
  const m = new Map<string, HeaderPin>();
  for (const p of pins) { if (!m.has(p.label)) { m.set(p.label, p); } }
  return m;
}

// ------------------------------------------------------------------------------------------------------------------ N boards in one picture
export const BOARD_GAP = 7 * P;

/** Tile the boards top to bottom in the order given (the development board first, so its bottom edge faces the breadboard), left edges aligned. */
export function layoutBoards(boards: LvBoard[]): BoardFrame[] {
  const frames: BoardFrame[] = [];
  let y = 0;
  for (const b of boards) {
    const dev = b.kind === 'devboard';
    const w = dev ? UNO_W : breadboardW(b);
    const h = dev ? UNO_H : breadboardRows().h;
    frames.push({ board: b, x: 0, y, w, h });
    y += h + BOARD_GAP;
  }
  return frames;
}

export function bounds(frames: BoardFrame[]): { x: number; y: number; w: number; h: number } {
  if (!frames.length) { return { x: 0, y: 0, w: 100, h: 100 }; }
  const x0 = Math.min(...frames.map(f => f.x)), y0 = Math.min(...frames.map(f => f.y));
  const x1 = Math.max(...frames.map(f => f.x + f.w)), y1 = Math.max(...frames.map(f => f.y + f.h));
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/** The picture position of a hole / rail hole / header pin on a named board, and the way a wire leaves it. null when the tie is not on that board. */
export function tieAnchor(frames: BoardFrame[], end: LvEnd): Anchor | null {
  const f = frames.find(fr => fr.board.name === end.board);
  if (!f) { return null; }
  const t = parseTie(end.tie);
  if (f.board.kind === 'devboard') {
    const p = headerIndex(headerPins(f.board)).get(end.tie);
    return p ? { x: f.x + p.x, y: f.y + p.y, dir: p.dir } : null;
  }
  const g = breadboardRows();
  if (t.t === 'hole' || t.t === 'strip') {
    const col = t.t === 'hole' ? t.col : (t.side === 'L' ? 'a' : 'f');
    if (t.row < 1 || t.row > f.board.rows) { return null; }
    return { x: f.x + stripX(t.row), y: f.y + g.colY[col], dir: COLS.indexOf(col) < 5 ? 'up' : 'down' };
  }
  if (t.t === 'rail') {
    if (t.n < 1 || t.n > f.board.rail_holes) { return null; }
    return { x: f.x + railX(f.board, t.n), y: f.y + g.railY[t.pos + t.pol], dir: t.pos === 'top' ? 'up' : 'down' };
  }
  return null;
}

/** Strip identity of a hole: `<board>:<row><L|R>` (a-e one strip, f-j the other); a rail hole's identity is the whole rail line. null for a header pin. */
export function stripKey(board: string, tie: string): string | null {
  const t = parseTie(tie);
  if (t.t === 'hole') { return `${board}:${t.row}${COLS.indexOf(t.col) < 5 ? 'L' : 'R'}`; }
  if (t.t === 'strip') { return `${board}:${t.row}${t.side}`; }
  if (t.t === 'rail') { return `${board}:rail:${t.pos}:${t.pol}`; }
  return null;
}

/** The hole a pointer hit, as a tie name, from a picture position on a breadboard frame (nearest hole within a third of a pitch... 0.45 P); null off the grid. */
export function holeAt(f: BoardFrame, x: number, y: number): string | null {
  if (f.board.kind === 'devboard') { return null; }
  const lx = x - f.x, ly = y - f.y;
  const g = breadboardRows();
  const row = Math.round((lx - PAD) / P) + 1;
  if (row >= 1 && row <= f.board.rows && Math.abs(lx - stripX(row)) <= 0.45 * P) {
    for (const c of COLS) { if (Math.abs(ly - g.colY[c]) <= 0.45 * P) { return `r${row}${c}`; } }
  }
  for (const [pos, pol] of RAILS) {
    if (Math.abs(ly - g.railY[pos + pol]) <= 0.45 * P) {
      for (let n = 1; n <= f.board.rail_holes; n++) { if (Math.abs(lx - railX(f.board, n)) <= 0.45 * P) { return `rail:${pos}:${pol}:${n}`; } }
    }
  }
  return null;
}

// ------------------------------------------------------------------------------------------------------------------ wires
const OUT: Record<Dir, Pt> = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };

/** A wire as a cubic curve: it leaves each end in the direction of its edge (a pin out of its header, a hole out of the strip's side), with a loop proportional to the distance. */
export function wirePath(a: Anchor, b: Anchor): string {
  const d = Math.hypot(b.x - a.x, b.y - a.y);
  const k = Math.max(3 * P, Math.min(d * 0.4, 14 * P));
  const c1 = { x: a.x + OUT[a.dir].x * k, y: a.y + OUT[a.dir].y * k };
  const c2 = { x: b.x + OUT[b.dir].x * k, y: b.y + OUT[b.dir].y * k };
  return `M${r1(a.x)},${r1(a.y)} C${r1(c1.x)},${r1(c1.y)} ${r1(c2.x)},${r1(c2.y)} ${r1(b.x)},${r1(b.y)}`;
}
export const r1 = (n: number): number => Math.round(n * 10) / 10;
