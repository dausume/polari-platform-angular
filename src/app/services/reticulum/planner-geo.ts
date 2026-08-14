/**
 * ret-1f (plan §5q): pure rules for the configurable map planner —
 * polygon parsing/validation, lon/lat → local-meters conversion
 * (equirectangular at the centroid: fine at mesh scales, and the
 * backend does its own authoritative conversion; ours only feeds the
 * preview and click-to-place), SVG projection math, population-mix
 * arithmetic, and tolerant normalizers for the backend's placement /
 * population result sections (an older or newer backend must dim,
 * never silently blank).
 *
 * No Angular imports — everything here is spec-testable in isolation
 * (the arch-view.ts idiom).
 */

export type Ring = Array<[number, number]>;

export interface ParsedPolygon {
  /** closed ring in the source's own coordinates (lon/lat or meters) */
  ring: Ring;
  /** true when coordinates read as lon/lat (|x|<=180, |y|<=90) */
  geographic: boolean;
  error?: string;
}

export interface LocalPolygon {
  /** ring in local meters, x east / y north, origin at centroid */
  ringM: Ring;
  areaM2: number;
  bbox: { minX: number; minY: number; maxX: number; maxY: number };
  note: string;
}

const M_PER_DEG_LAT = 111_320;

/** Accepts a Feature, FeatureCollection (first Polygon wins, said in
 *  the error when none), bare Polygon geometry, or a raw ring array.
 *  Never throws — a parse problem is a value. */
export function parsePolygonGeojson(text: string): ParsedPolygon {
  const fail = (error: string): ParsedPolygon =>
    ({ ring: [], geographic: false, error });
  if (!text || !text.trim()) { return fail('no shape given'); }
  let doc: unknown;
  try {
    doc = JSON.parse(text);
  } catch {
    return fail('not parseable JSON');
  }
  const ring = extractRing(doc);
  if (!ring) {
    return fail('no Polygon found — expected a Feature, '
      + 'FeatureCollection, Polygon geometry, or a ring array');
  }
  const distinct = new Set(ring.map((p) => `${p[0]},${p[1]}`));
  if (distinct.size < 3) {
    return fail('a polygon needs at least 3 distinct vertices');
  }
  const closed: Ring = [...ring];
  const first = closed[0];
  const last = closed[closed.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) {
    closed.push([first[0], first[1]]);
  }
  const geographic = closed.every(
    (p) => Math.abs(p[0]) <= 180 && Math.abs(p[1]) <= 90);
  return { ring: closed, geographic };
}

function extractRing(doc: unknown): Ring | null {
  if (Array.isArray(doc)) {
    return looksLikeRing(doc) ? (doc as Ring) : null;
  }
  const obj = doc as Record<string, unknown>;
  if (!obj || typeof obj !== 'object') { return null; }
  if (obj['type'] === 'FeatureCollection'
      && Array.isArray(obj['features'])) {
    for (const feature of obj['features'] as unknown[]) {
      const ring = extractRing(feature);
      if (ring) { return ring; }
    }
    return null;
  }
  if (obj['type'] === 'Feature') {
    return extractRing(obj['geometry']);
  }
  if (obj['type'] === 'Polygon'
      && Array.isArray(obj['coordinates'])) {
    const rings = obj['coordinates'] as unknown[];
    return rings.length && looksLikeRing(rings[0])
      ? (rings[0] as Ring) : null;
  }
  return null;
}

function looksLikeRing(value: unknown): boolean {
  return Array.isArray(value) && value.length >= 3
    && value.every((p) => Array.isArray(p) && p.length >= 2
      && typeof p[0] === 'number' && typeof p[1] === 'number');
}

/** lon/lat ring → local meters at the centroid; meter rings pass
 *  through with their own origin note. */
export function toLocalMeters(parsed: ParsedPolygon): LocalPolygon {
  const ring = parsed.ring;
  if (!parsed.geographic) {
    const ringM = ring as Ring;
    return {
      ringM,
      areaM2: Math.abs(shoelaceArea(ringM)),
      bbox: ringBbox(ringM),
      note: 'coordinates read as local meters (not lon/lat) and were '
        + 'used as-is',
    };
  }
  const lng0 = ring.reduce((s, p) => s + p[0], 0) / ring.length;
  const lat0 = ring.reduce((s, p) => s + p[1], 0) / ring.length;
  const mPerDegLng = M_PER_DEG_LAT
    * Math.cos((lat0 * Math.PI) / 180);
  const ringM: Ring = ring.map((p) => [
    (p[0] - lng0) * mPerDegLng,
    (p[1] - lat0) * M_PER_DEG_LAT,
  ]);
  return {
    ringM,
    areaM2: Math.abs(shoelaceArea(ringM)),
    bbox: ringBbox(ringM),
    note: 'lon/lat converted equirectangularly at the centroid — '
      + 'fine at mesh scales; the backend converts authoritatively',
  };
}

export function shoelaceArea(ring: Ring): number {
  let sum = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    sum += ring[i][0] * ring[i + 1][1]
      - ring[i + 1][0] * ring[i][1];
  }
  return sum / 2;
}

function ringBbox(ring: Ring) {
  const xs = ring.map((p) => p[0]);
  const ys = ring.map((p) => p[1]);
  return {
    minX: Math.min(...xs), minY: Math.min(...ys),
    maxX: Math.max(...xs), maxY: Math.max(...ys),
  };
}

export interface SvgProjection {
  scale: number;
  viewW: number;
  viewH: number;
  pad: number;
  minX: number;
  minY: number;
}

/** Fit the bbox into a viewbox, y flipped (SVG y grows down, north
 *  grows up). Degenerate bboxes get scale 1 so nothing divides by
 *  zero. */
export function svgProjection(
  bbox: LocalPolygon['bbox'], viewW: number, viewH: number,
  pad = 16,
): SvgProjection {
  const w = bbox.maxX - bbox.minX;
  const h = bbox.maxY - bbox.minY;
  const scale = (w > 0 && h > 0)
    ? Math.min((viewW - 2 * pad) / w, (viewH - 2 * pad) / h)
    : 1;
  return { scale, viewW, viewH, pad,
           minX: bbox.minX, minY: bbox.minY };
}

export function projectPoint(
  proj: SvgProjection, x: number, y: number,
): [number, number] {
  return [
    proj.pad + (x - proj.minX) * proj.scale,
    proj.viewH - proj.pad - (y - proj.minY) * proj.scale,
  ];
}

/** Inverse of projectPoint — what click-to-place needs. */
export function unprojectPoint(
  proj: SvgProjection, sx: number, sy: number,
): [number, number] {
  return [
    proj.minX + (sx - proj.pad) / proj.scale,
    proj.minY + (proj.viewH - proj.pad - sy) / proj.scale,
  ];
}

export function ringToSvgPath(proj: SvgProjection, ring: Ring): string {
  if (!ring.length) { return ''; }
  return ring
    .map((p, i) => {
      const [sx, sy] = projectPoint(proj, p[0], p[1]);
      return `${i === 0 ? 'M' : 'L'}${sx.toFixed(1)},${sy.toFixed(1)}`;
    })
    .join(' ') + ' Z';
}

// ---- population mix --------------------------------------------------

export const POPULATION_BUILDS =
  ['lora', 'ham-rx', 'ham-tx', 'wifi', 'wifi-halow', 'lorawan'] as
  const;

/** A mix value is a plain percentage, or a KIT entry — a person
 *  carrying several devices ({kit: {lora: 2, wifi: 1}, pct: 30}). */
export type MixValue = number | { kit?: Record<string, number>;
                                  pct: number };

function mixPct(v: MixValue): number {
  const pct = typeof v === 'number' ? v : v?.pct;
  return Number.isFinite(pct) ? (pct as number) : 0;
}

export function mixSum(mix: Record<string, MixValue>): number {
  return Object.values(mix)
    .reduce((s: number, v: MixValue) => s + mixPct(v), 0);
}

/** A mix must account for the whole population — 100% within a
 *  rounding hair — whether the shares are plain builds or kits. */
export function mixValid(mix: Record<string, MixValue>): boolean {
  return Math.abs(mixSum(mix) - 100) < 0.01
    && Object.values(mix).every((v) => mixPct(v) >= 0);
}

// ---- tolerant result normalizers ------------------------------------

export interface PlacementOption {
  model: string;
  count?: number;
  spacingM?: number;
  totalCost?: number;
  /** loadouts: several units of a device per node */
  unitsPerNode?: number;
  unitsCap?: number;
  perNodeCostUsd?: number;
  reason?: string;
}

export interface PlacementWinner {
  model?: string;
  positions: Array<[number, number]>;
  totalCost?: number;
  count?: number;
  rangeM?: number;
  unitsPerNode?: number;
  unitsCap?: number;
  perNodeCostUsd?: number;
}

export interface FixedAssessment {
  coveredPct?: number;
  uncoveredGaps: Array<{ centroid?: [number, number];
                         size?: number; note?: string }>;
  connected?: boolean;
  isolatedNodes: string[];
  perNode: Record<string, { type?: string; cost?: number;
                            units?: number }>;
  totalCost?: number;
  verdict?: string;
}

export interface NormalizedPlacement {
  mode?: string;
  options: PlacementOption[];
  winner?: PlacementWinner;
  fixed?: FixedAssessment;
  resilience?: Array<{ node?: string; evidence?: string }>;
  assumptions: string[];
  error?: string;
}

/** perNode entries may be arrays or keyed objects, and cost arrives
 *  as cost or costUsd (loadouts add units). */
function normalizePerNode(raw: unknown): FixedAssessment['perNode'] {
  const out: FixedAssessment['perNode'] = {};
  const fold = (name: string, e: Record<string, unknown>) => {
    out[name] = {
      type: strOr(e['type'] ?? e['model']),
      cost: numOr(e['costUsd'] ?? e['cost']),
      units: numOr(e['units']),
    };
  };
  if (Array.isArray(raw)) {
    for (const e of raw as Array<Record<string, unknown>>) {
      fold(String(e['name'] ?? e['node'] ?? '?'), e);
    }
  } else if (raw && typeof raw === 'object') {
    for (const [name, e] of
        Object.entries(raw as Record<string, unknown>)) {
      if (e && typeof e === 'object') {
        fold(name, e as Record<string, unknown>);
      }
    }
  }
  return out;
}

function asPosition(raw: unknown): [number, number] | null {
  if (Array.isArray(raw) && raw.length >= 2) {
    return [Number(raw[0]), Number(raw[1])];
  }
  const obj = raw as Record<string, number>;
  if (obj && typeof obj === 'object') {
    const x = obj['x'] ?? obj['x_m'] ?? obj['xM'];
    const y = obj['y'] ?? obj['y_m'] ?? obj['yM'];
    if (x != null && y != null) { return [Number(x), Number(y)]; }
  }
  return null;
}

export function normalizePlacement(
  raw: unknown,
): NormalizedPlacement | null {
  if (!raw || typeof raw !== 'object') { return null; }
  const p = raw as Record<string, unknown>;
  const optionsRaw = (p['options'] ?? p['ranked']
    ?? p['rankedOptions'] ?? []) as Array<Record<string, unknown>>;
  const options: PlacementOption[] = Array.isArray(optionsRaw)
    ? optionsRaw.map((o) => ({
      model: String(o['model'] ?? o['name'] ?? '?'),
      count: numOr(o['count']),
      spacingM: numOr(o['spacingM'] ?? o['spacing_m']),
      totalCost: numOr(o['totalCostUsd'] ?? o['totalCost']
        ?? o['total_cost'] ?? o['costUsd']),
      unitsPerNode: numOr(o['unitsPerNode'] ?? o['units_per_node']),
      unitsCap: numOr(o['unitsCap'] ?? o['units_cap']),
      perNodeCostUsd: numOr(o['perNodeCostUsd']
        ?? o['per_node_cost_usd']),
      reason: strOr(o['reason'] ?? o['refusal']),
    }))
    : [];
  const winnerRaw = p['winner'] as Record<string, unknown> | undefined;
  const winner: PlacementWinner | undefined = winnerRaw
    ? {
      model: strOr(winnerRaw['model']),
      totalCost: numOr(winnerRaw['totalCostUsd']
        ?? winnerRaw['totalCost'] ?? winnerRaw['total_cost']),
      count: numOr(winnerRaw['count']),
      rangeM: numOr(winnerRaw['rangeM'] ?? winnerRaw['range_m']),
      unitsPerNode: numOr(winnerRaw['unitsPerNode']
        ?? winnerRaw['units_per_node']),
      unitsCap: numOr(winnerRaw['unitsCap']
        ?? winnerRaw['units_cap']),
      perNodeCostUsd: numOr(winnerRaw['perNodeCostUsd']
        ?? winnerRaw['per_node_cost_usd']),
      positions: (Array.isArray(winnerRaw['positions'])
        ? (winnerRaw['positions'] as unknown[]) : [])
        .map(asPosition)
        .filter((v): v is [number, number] => v !== null),
    }
    : undefined;
  const gapsRaw = (p['uncoveredGaps'] ?? p['uncovered_gaps']
    ?? p['gaps'] ?? []) as Array<Record<string, unknown>>;
  const hasFixed = p['coveredPct'] != null
    || p['covered_pct'] != null || p['perNode'] != null
    || p['per_node'] != null || gapsRaw.length > 0
    || p['connected'] != null;
  const fixed: FixedAssessment | undefined = hasFixed
    ? {
      coveredPct: numOr(p['coveredPct'] ?? p['covered_pct']),
      uncoveredGaps: Array.isArray(gapsRaw)
        ? gapsRaw.map((g) => ({
          centroid: asPosition(g['centroid']) ?? undefined,
          size: numOr(g['size'] ?? g['sizeM2'] ?? g['size_m2']),
          note: strOr(g['note'] ?? g['evidence']),
        }))
        : [],
      connected: p['connected'] as boolean | undefined,
      isolatedNodes: ((p['isolatedNodes'] ?? p['isolated_nodes']
        ?? p['isolated'] ?? []) as unknown[]).map(String),
      perNode: normalizePerNode(p['perNode'] ?? p['per_node']),
      totalCost: numOr(p['totalCostUsd'] ?? p['totalCost']
        ?? p['total_cost']),
      verdict: strOr(p['verdict']),
    }
    : undefined;
  const resilienceRaw = (p['resilience'] ?? p['articulation']
    ?? p['findings'] ?? null) as Array<Record<string, unknown>> | null;
  return {
    mode: strOr(p['mode']),
    options,
    winner,
    fixed,
    resilience: Array.isArray(resilienceRaw)
      ? resilienceRaw.map((f) => ({
        node: strOr(f['node'] ?? f['name']),
        evidence: strOr(f['evidence'] ?? f['detail']),
      }))
      : undefined,
    assumptions: ((p['assumptions'] ?? []) as unknown[]).map(String),
    error: strOr(p['error']),
  };
}

export interface PopulationRow {
  build: string;
  count?: number;
  peersWith: string[];
  oneWayListensTo: string[];
  isolated?: boolean;
  why?: string;
  /** loadouts: a kit row echoes its device counts */
  devices?: Record<string, number>;
  capacityNote?: string;
}

export interface NormalizedPopulation {
  rows: PopulationRow[];
  largestInterconnected?: number;
  isolatedShare?: number;
  notes: string[];
}

export function normalizePopulation(
  raw: unknown,
): NormalizedPopulation | null {
  if (!raw || typeof raw !== 'object') { return null; }
  const p = raw as Record<string, unknown>;
  const source = p['perBuild'] ?? p['builds'] ?? p['rows'] ?? p;
  const rows: PopulationRow[] = [];
  const pushRow = (build: string, r: Record<string, unknown>) => {
    rows.push({
      build,
      count: numOr(r['count'] ?? r['n']),
      peersWith: ((r['peersWith'] ?? r['peers_with'] ?? r['peers']
        ?? []) as unknown[]).map(String),
      oneWayListensTo: ((r['oneWayListensTo']
        ?? r['one_way_listens_to'] ?? r['listensTo']
        ?? []) as unknown[]).map(String),
      isolated: Boolean(r['isolated']),
      why: strOr(r['why'] ?? r['reason']
        ?? (typeof r['isolated'] === 'string'
          ? r['isolated'] : undefined)),
      devices: (r['devices'] && typeof r['devices'] === 'object')
        ? r['devices'] as Record<string, number> : undefined,
      capacityNote: strOr(r['capacityNote'] ?? r['capacity_note']),
    });
  };
  if (Array.isArray(source)) {
    for (const r of source as Array<Record<string, unknown>>) {
      pushRow(String(r['build'] ?? r['name'] ?? '?'), r);
    }
  } else if (source && typeof source === 'object') {
    for (const [build, r] of
        Object.entries(source as Record<string, unknown>)) {
      if (r && typeof r === 'object' && !Array.isArray(r)) {
        pushRow(build, r as Record<string, unknown>);
      }
    }
  }
  if (!rows.length) { return null; }
  return {
    rows,
    largestInterconnected: numOr(p['largestInterconnected']
      ?? p['largest_interconnected']),
    isolatedShare: numOr(p['isolatedShare'] ?? p['isolated_share']),
    notes: ((p['notes'] ?? []) as unknown[]).map(String),
  };
}

function numOr(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}

function strOr(v: unknown): string | undefined {
  return typeof v === 'string' && v ? v : undefined;
}
