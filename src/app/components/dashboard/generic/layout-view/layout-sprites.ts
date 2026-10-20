import { P, Pt, r1 } from './layout-geometry';

/**
 * lay-2 - parts as 2-D SPRITES derived from geometry, as PURE data: `spriteFor` returns shapes in the part's own frame (legs on the x axis), a transform that puts that frame on
 * the board, and the leg points. The drawing code turns a shape into one SVG element; nothing here touches the DOM, so every sprite is unit-testable.
 *   resistor     a body between its two legs with colour bands COMPUTED from its ohms (E-series 4-band code, gold tolerance)
 *   led          a round body over its two legs, the FLAT SIDE on the cathode side and the LONG LEG on the anode
 *   pushbutton   a square body across the trench on its four legs, a round cap that sinks when pressed
 *   potentiometer a knob over its three legs with a notch at the turn angle
 *   tmp36        a half-round body, its FLAT FACE toward the reader, the three legs labelled + / out / -
 *   transistor   the same body with E B C under the legs in terminal order
 *   (anything else) a generic labelled box over its legs
 */
export type Shape =
  | { k: 'line'; x1: number; y1: number; x2: number; y2: number; cls: string }
  | { k: 'rect'; x: number; y: number; w: number; h: number; r?: number; cls: string; fill?: string }
  | { k: 'circle'; cx: number; cy: number; r: number; cls: string; fill?: string }
  | { k: 'path'; d: string; cls: string; fill?: string }
  | { k: 'text'; x: number; y: number; t: string; cls: string };

export interface LegPt extends Pt { terminal: string; name: string; }
export interface Sprite { name: string; kind: string; transform: string; shapes: Shape[]; legs: LegPt[]; box: { x: number; y: number; w: number; h: number }; }
export interface SpriteState { lit?: boolean; dim?: number; pressed?: boolean; turn?: number; tone?: boolean; }

// ------------------------------------------------------------------------------------------------------------------ resistor colour code
export const BAND_COLOURS = ['black', 'brown', 'red', 'orange', 'yellow', 'green', 'blue', 'violet', 'grey', 'white'] as const;
const GOLD = 'gold', SILVER = 'silver';
/** The usual hexes of the colour code; drawn through a theme token with this as the fallback (`--band-<name>`). */
export const BAND_HEX: Record<string, string> = {
  black: '#212121', brown: '#6d4c41', red: '#d32f2f', orange: '#ef6c00', yellow: '#fbc02d', green: '#388e3c', blue: '#1976d2', violet: '#7b1fa2', grey: '#9e9e9e', white: '#f5f5f5', gold: '#c9a227', silver: '#b0bec5',
};

/** Ohms -> the 4 band colours: first digit, second digit, multiplier (10^n; gold = x0.1, silver = x0.01 below 10 ohms), tolerance gold (5 %). null for a value that cannot be coded (<= 0 or not finite). */
export function resistorBands(ohms: number): string[] | null {
  if (!isFinite(ohms) || ohms <= 0) { return null; }
  let exp = Math.floor(Math.log10(ohms)) - 1;                // two significant digits
  let sig = Math.round(ohms / Math.pow(10, exp));
  if (sig >= 100) { sig = Math.round(sig / 10); exp += 1; }
  if (exp < -2 || exp > 9) { return null; }
  const mult = exp === -1 ? GOLD : exp === -2 ? SILVER : BAND_COLOURS[exp];
  return [BAND_COLOURS[Math.floor(sig / 10)], BAND_COLOURS[sig % 10], mult, GOLD];
}

/** 220 -> "220 ohm", 4700 -> "4.7 kohm", 1e6 -> "1 Mohm". */
export function ohmsText(ohms: number): string {
  const f = (n: number) => String(Math.round(n * 100) / 100);
  return ohms >= 1e6 ? `${f(ohms / 1e6)} Mohm` : ohms >= 1e3 ? `${f(ohms / 1e3)} kohm` : `${f(ohms)} ohm`;
}

// ------------------------------------------------------------------------------------------------------------------ sprites
const bandFill = (c: string): string => `var(--band-${c}, ${BAND_HEX[c]})`;

function frameOf(a: Pt, b: Pt): { cx: number; cy: number; deg: number; d: number } {
  return { cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2, deg: Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI, d: Math.hypot(b.x - a.x, b.y - a.y) };
}
const tf = (cx: number, cy: number, deg: number): string => `translate(${r1(cx)} ${r1(cy)}) rotate(${r1(deg)})`;

/** The legs of a placement as picture points, ONE per terminal in terminal order (a switch's second leg per side is joined inside the part and is returned in `allLegs`). */
export function legPoints(legs: { terminal: string; name: string; hole: string }[], at: (hole: string) => Pt | null, order: string[]): { first: LegPt[]; all: LegPt[] } {
  const all: LegPt[] = [];
  for (const l of legs) { const p = at(l.hole); if (p) { all.push({ terminal: l.terminal, name: l.name, x: p.x, y: p.y }); } }
  const first = order.map(t => all.find(l => l.terminal === t)).filter((l): l is LegPt => !!l);
  return { first, all };
}

export function spriteFor(name: string, kind: string, part: string, params: Record<string, any>, first: LegPt[], all: LegPt[], state: SpriteState = {}): Sprite {
  const mk = (transform: string, shapes: Shape[], box: Sprite['box']): Sprite => ({ name, kind, transform, shapes, legs: all, box });
  if (kind === 'resistor' && first.length === 2) { return resistor(name, kind, params, first, all, state); }
  if (kind === 'led' && first.length === 2) { return led(name, kind, first, all, state); }
  if ((kind === 'switch' || part === 'pushbutton') && all.length >= 2) { return pushbutton(name, kind, all, state); }
  if (kind === 'pot' || part === 'potentiometer') { if (first.length === 3) { return pot(name, kind, first, all, state); } }
  if (kind === 'tmp36' && first.length === 3) { return to92(name, kind, first, all, 'TMP36', ['+', 'out', '−']); }
  if (kind === 'transistor' && first.length === 3) { return to92(name, kind, first, all, '', ['E', 'B', 'C']); }
  return generic(name, kind, part, all, mk);
}

function resistor(name: string, kind: string, params: Record<string, any>, first: LegPt[], all: LegPt[], _s: SpriteState): Sprite {
  const f = frameOf(first[0], first[1]);
  const bodyL = Math.min(f.d * 0.6, 3.4 * P), bodyH = 1.1 * P, x0 = -bodyL / 2;
  const bands = resistorBands(Number(params['ohms'])) || [];
  const shapes: Shape[] = [
    { k: 'line', x1: -f.d / 2, y1: 0, x2: -bodyL / 2, y2: 0, cls: 'lv-lead' }, { k: 'line', x1: bodyL / 2, y1: 0, x2: f.d / 2, y2: 0, cls: 'lv-lead' },
    { k: 'rect', x: r1(x0), y: -bodyH / 2, w: r1(bodyL), h: bodyH, r: 0.45 * P, cls: 'lv-res-body' },
  ];
  const bw = Math.max(0.28 * P, bodyL * 0.085), step = bodyL * 0.16;
  bands.forEach((c, i) => shapes.push({ k: 'rect', x: r1(x0 + bodyL * 0.17 + i * step + (i === 3 ? bodyL * 0.12 : 0)), y: -bodyH / 2, w: r1(bw), h: bodyH, cls: `lv-band band-${c}`, fill: bandFill(c) }));
  shapes.push({ k: 'text', x: 0, y: r1(bodyH / 2 + 0.95 * P), t: name, cls: 'lv-part-label' });
  return { name, kind, transform: tf(f.cx, f.cy, f.deg), shapes, legs: all, box: { x: -f.d / 2, y: -bodyH / 2, w: f.d, h: bodyH } };
}

function led(name: string, kind: string, first: LegPt[], all: LegPt[], s: SpriteState): Sprite {
  // frame: x axis from the ANODE leg to the CATHODE leg; the cathode (flat) side is +x
  const f = frameOf(first[0], first[1]);
  const R = 0.95 * P;
  const shapes: Shape[] = [
    { k: 'circle', cx: 0, cy: 0, r: r1(R * 1.9), cls: 'lv-led-glow' },
    { k: 'line', x1: r1(-f.d / 2), y1: 0, x2: r1(-f.d / 2 - 1.9 * P), y2: 0, cls: 'lv-lead lv-lead-long' },       // the long leg = the anode
    { k: 'line', x1: r1(f.d / 2), y1: 0, x2: r1(f.d / 2 + 0.7 * P), y2: 0, cls: 'lv-lead lv-lead-short' },      // the short leg = the cathode
    { k: 'circle', cx: 0, cy: 0, r: R, cls: 'lv-led-body' },
    { k: 'line', x1: r1(R * 0.82), y1: r1(-R * 0.62), x2: r1(R * 0.82), y2: r1(R * 0.62), cls: 'lv-led-flat' },   // the flat side, on the cathode side
    { k: 'text', x: 0, y: r1(R + 1.1 * P), t: name, cls: 'lv-part-label' },
  ];
  void s;
  return { name, kind, transform: tf(f.cx, f.cy, f.deg), shapes, legs: all, box: { x: -R, y: -R, w: 2 * R, h: 2 * R } };
}

function pushbutton(name: string, kind: string, all: LegPt[], s: SpriteState): Sprite {
  const cx = all.reduce((a, l) => a + l.x, 0) / all.length, cy = all.reduce((a, l) => a + l.y, 0) / all.length;
  const xs = all.map(l => l.x), ys = all.map(l => l.y);
  const w = Math.max(...xs) - Math.min(...xs) + 0.9 * P, h = Math.max(...ys) - Math.min(...ys) + 0.9 * P;
  const capR = Math.min(w, h) * 0.34 * (s.pressed ? 0.85 : 1);
  const shapes: Shape[] = [
    { k: 'rect', x: r1(-w / 2), y: r1(-h / 2), w: r1(w), h: r1(h), r: 0.3 * P, cls: 'lv-btn-body' },
    ...all.map((l): Shape => ({ k: 'circle', cx: r1(l.x - cx), cy: r1(l.y - cy), r: 0.28 * P, cls: 'lv-btn-leg' })),
    { k: 'circle', cx: 0, cy: 0, r: r1(capR), cls: 'lv-btn-cap' },
    { k: 'text', x: 0, y: r1(h / 2 + 1.1 * P), t: name, cls: 'lv-part-label' },
  ];
  return { name, kind, transform: tf(cx, cy, 0), shapes, legs: all, box: { x: -w / 2, y: -h / 2, w, h } };
}

function pot(name: string, kind: string, first: LegPt[], all: LegPt[], s: SpriteState): Sprite {
  const f = frameOf(first[0], first[2]);
  const R = 1.5 * P, cy = -1.9 * P;
  const a = ((s.turn ?? 50) / 100 * 270 - 135) * Math.PI / 180;
  const shapes: Shape[] = [
    ...first.map((l): Shape => ({ k: 'line', x1: r1((first.indexOf(l) - 1) * f.d / 2), y1: 0, x2: r1((first.indexOf(l) - 1) * f.d / 2), y2: r1(cy + R * 0.6), cls: 'lv-lead' })),
    { k: 'circle', cx: 0, cy: cy, r: R, cls: 'lv-pot-body' },
    { k: 'line', x1: 0, y1: cy, x2: r1(Math.sin(a) * R * 0.85), y2: r1(cy - Math.cos(a) * R * 0.85), cls: 'lv-pot-notch' },
    { k: 'text', x: 0, y: r1(cy + R + 1.1 * P), t: name, cls: 'lv-part-label' },
  ];
  return { name, kind, transform: tf(f.cx, f.cy, f.deg), shapes, legs: all, box: { x: -R, y: cy - R, w: 2 * R, h: 2 * R } };
}

/** TO-92 style body, FLAT FACE toward the reader: a half-round top and a flat bottom edge on the legs' side, the part name on the flat face. */
function to92(name: string, kind: string, first: LegPt[], all: LegPt[], face: string, legLabels: string[]): Sprite {
  const f = frameOf(first[0], first[2]);
  const w = Math.max(f.d + 0.8 * P, 2.6 * P), r = w / 2, h = 1.7 * P;
  // frame: x along the three legs, y toward the body (negative = away from the legs' holes)
  const d = `M${r1(-r)},${r1(-1.0 * P)} L${r1(-r)},${r1(-1.0 * P - h * 0.5)} A${r1(r)},${r1(r)} 0 0 1 ${r1(r)},${r1(-1.0 * P - h * 0.5)} L${r1(r)},${r1(-1.0 * P)} Z`;
  const shapes: Shape[] = [
    ...first.map((l, i): Shape => ({ k: 'line', x1: r1((i - 1) * f.d / 2), y1: 0, x2: r1((i - 1) * f.d / 2), y2: r1(-1.0 * P), cls: 'lv-lead' })),
    { k: 'path', d, cls: 'lv-to92-body' },
    ...(face ? [{ k: 'text', x: 0, y: r1(-1.0 * P - h * 0.28), t: face, cls: 'lv-to92-face' } as Shape] : []),
    ...legLabels.map((t, i): Shape => ({ k: 'text', x: r1((i - 1) * f.d / 2), y: r1(0.95 * P), t, cls: 'lv-leg-label' })),
    { k: 'text', x: 0, y: r1(-1.0 * P - h * 0.5 - r - 0.5 * P), t: name, cls: 'lv-part-label' },
  ];
  return { name, kind, transform: tf(f.cx, f.cy, f.deg), shapes, legs: all, box: { x: -r, y: -1.0 * P - h * 0.5 - r, w, h: h * 0.5 + r + P } };
}

function generic(name: string, kind: string, part: string, all: LegPt[], mk: (t: string, s: Shape[], b: Sprite['box']) => Sprite): Sprite {
  if (!all.length) { return mk(tf(0, 0, 0), [], { x: 0, y: 0, w: 0, h: 0 }); }
  const xs = all.map(l => l.x), ys = all.map(l => l.y);
  const x0 = Math.min(...xs) - 0.7 * P, y0 = Math.min(...ys) - 0.7 * P, w = Math.max(...xs) - Math.min(...xs) + 1.4 * P, h = Math.max(...ys) - Math.min(...ys) + 1.4 * P;
  const shapes: Shape[] = [
    { k: 'rect', x: r1(x0), y: r1(y0), w: r1(w), h: r1(h), r: 0.3 * P, cls: 'lv-generic-body' },
    ...all.map((l): Shape => ({ k: 'circle', cx: r1(l.x), cy: r1(l.y), r: 0.28 * P, cls: 'lv-btn-leg' })),
    { k: 'text', x: r1(x0 + w / 2), y: r1(y0 + h / 2 + 0.3 * P), t: part || kind || name, cls: 'lv-generic-label' },
    { k: 'text', x: r1(x0 + w / 2), y: r1(y0 + h + 1.1 * P), t: name, cls: 'lv-part-label' },
  ];
  return mk('', shapes, { x: x0, y: y0, w, h });
}
