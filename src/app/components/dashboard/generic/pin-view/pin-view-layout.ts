import { PvPayload, PvPin, PvSurface } from './pin-view.types';

/**
 * pv-1 layout — concentric nesting (PIN_VIEW_PLAN 2.6). Every position comes from the payload: a surface's
 * (x, y) is its origin inside its parent, the shape's vertices and each pin's (x, y) are local to that origin
 * (the board's origin is its top-left corner, every other surface's is its centre). Nothing is hand-placed here.
 *
 * One display-only rule: a die that would not fit inside its package (the 16U2's die knob equals its package
 * body) is drawn at a reduced scale about its centre so the pad ring sits inside the leg ring. The reduction
 * is reported on the placed surface (`shrunk`) and named in the legend; no value in the payload changes.
 */
export interface PlacedSurface {
  surface: PvSurface;
  ox: number; oy: number;          // absolute origin
  c: number; sn: number;           // absolute rotation (cos, sin): a surface turns with its parent (a rotated package turns its legs and its die)
  k: number;                       // display scale about the origin (1 unless a die was shrunk to fit)
  points: [number, number][];      // outline, absolute
  depth: number;
  shrunk: boolean;
}
export interface PlacedPin { pin: PvPin; x: number; y: number; r: number; surface: string; }
export interface Scene {
  surfaces: Map<string, PlacedSurface>;
  pins: Map<string, PlacedPin>;
  order: PlacedSurface[];          // draw order, outermost first
  bounds: { x0: number; y0: number; x1: number; y1: number };
}

const DIE_FIT = 0.55;   // a die may fill at most this share of its package's smaller side

type Xf = [number, number, number, number];   // ox, oy, cos, sin

/** A surface's absolute placement: its parent's placement, then its own offset (in the parent's turned frame) and its own rotation. */
function absOrigin(id: string, byId: Map<string, PvSurface>, memo: Map<string, Xf>): Xf {
  const hit = memo.get(id);
  if (hit) { return hit; }
  const s = byId.get(id)!;
  const [px, py, pc, ps] = s.parent && byId.has(s.parent) ? absOrigin(s.parent, byId, memo) : [0, 0, 1, 0] as Xf;
  const lx = s.x || 0, ly = s.y || 0, a = ((s.rot || 0) * Math.PI) / 180;
  const c = Math.cos(a), sn = Math.sin(a);
  const o: Xf = [px + pc * lx - ps * ly, py + ps * lx + pc * ly, pc * c - ps * sn, ps * c + pc * sn];
  memo.set(id, o);
  return o;
}

function depthOf(s: PvSurface, byId: Map<string, PvSurface>): number {
  let d = 0;
  for (let p = s; p.parent && byId.has(p.parent) && d < 6; p = byId.get(p.parent)!) { d++; }
  return d;
}

function outline(s: PvSurface, payload: PvPayload): [number, number][] {
  const v = payload.shapes?.[s.shape]?.parameters?.vertices;
  if (v && v.length >= 3) { return v.map(p => [p[0], p[1]] as [number, number]); }
  const hw = (s.w || 1) / 2, hh = (s.h || 1) / 2;
  return [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]];
}

/** Pin mark radius: a share of the nearest neighbour so marks never touch; a lone pin takes a share of its part. */
function radiusFor(pts: { x: number; y: number }[], s: PvSurface, k: number): number {
  if (pts.length < 2) { return clamp(0.25 * Math.min(s.w || 1, s.h || 1) * k, 0.2, 0.6); }
  let nn = Infinity;
  for (let i = 0; i < pts.length; i++) {
    for (let j = i + 1; j < pts.length; j++) {
      const d = Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y);
      if (d > 1e-6 && d < nn) { nn = d; }
    }
  }
  return clamp(0.4 * (isFinite(nn) ? nn : 1), 0.1, 0.9);
}
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function buildScene(payload: PvPayload): Scene {
  const byId = new Map(payload.surfaces.map(s => [s.id, s] as [string, PvSurface]));
  const memo = new Map<string, Xf>();
  const surfaces = new Map<string, PlacedSurface>();
  for (const s of payload.surfaces) {
    const [ox, oy, c, sn] = absOrigin(s.id, byId, memo);
    const parent = s.parent ? byId.get(s.parent) : undefined;
    let k = 1;
    if (s.kind === 'soc' && parent) {
      const ext = Math.max(s.w || 1, s.h || 1);
      k = Math.min(1, (DIE_FIT * Math.min(parent.w || ext, parent.h || ext)) / ext);
    }
    const points = outline(s, payload).map(p => [ox + k * (c * p[0] - sn * p[1]), oy + k * (sn * p[0] + c * p[1])] as [number, number]);
    surfaces.set(s.id, { surface: s, ox, oy, c, sn, k, points, depth: depthOf(s, byId), shrunk: k < 1 });
  }
  const pins = new Map<string, PlacedPin>();
  const bySurface = new Map<string, PvPin[]>();
  for (const p of payload.pins) { (bySurface.get(p.surface) || bySurface.set(p.surface, []).get(p.surface)!).push(p); }
  for (const [sid, list] of bySurface) {
    const ps = surfaces.get(sid);
    if (!ps) { continue; }
    const abs = list.map(p => ({ x: ps.ox + ps.k * (ps.c * p.x - ps.sn * p.y), y: ps.oy + ps.k * (ps.sn * p.x + ps.c * p.y) }));
    const r = radiusFor(abs, ps.surface, ps.k);
    list.forEach((p, i) => pins.set(p.id, { pin: p, x: abs[i].x, y: abs[i].y, r, surface: sid }));
  }
  const order = [...surfaces.values()].sort((a, b) => a.depth - b.depth);
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const ps of surfaces.values()) {
    for (const [x, y] of ps.points) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  }
  for (const p of pins.values()) { x0 = Math.min(x0, p.x - p.r); y0 = Math.min(y0, p.y - p.r); x1 = Math.max(x1, p.x + p.r); y1 = Math.max(y1, p.y + p.r); }
  // pv-2: a part's extent (box + pin labels + title, drawn in model units) belongs to the view's bounds - the bench parts at the right were clipped without it
  for (const ps of surfaces.values()) {
    const e = ps.surface.extent;
    if (!e) { continue; }
    for (const [ex, ey] of [[e.x0, e.y0], [e.x1, e.y0], [e.x1, e.y1], [e.x0, e.y1]]) {
      const ax = ps.ox + ps.c * ex - ps.sn * ey, ay = ps.oy + ps.sn * ex + ps.c * ey;
      x0 = Math.min(x0, ax); y0 = Math.min(y0, ay); x1 = Math.max(x1, ax); y1 = Math.max(y1, ay);
    }
  }
  if (!isFinite(x0)) { x0 = 0; y0 = 0; x1 = 100; y1 = 100; }
  return { surfaces, pins, order, bounds: { x0, y0, x1, y1 } };
}

/** A gently curved line between two pin centres; the bend alternates so crossing lines separate. */
export function linePath(a: { x: number; y: number }, b: { x: number; y: number }, bend: number): string {
  const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy);
  if (len < 1e-6) { return `M${a.x},${a.y}L${b.x},${b.y}`; }
  const off = Math.min(6, len * 0.12) * bend;
  const cx = (a.x + b.x) / 2 - (dy / len) * off, cy = (a.y + b.y) / 2 + (dx / len) * off;
  return `M${a.x},${a.y}Q${cx},${cy} ${b.x},${b.y}`;
}
