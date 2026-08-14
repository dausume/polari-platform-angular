import {
  mixSum,
  mixValid,
  normalizePlacement,
  normalizePopulation,
  parsePolygonGeojson,
  projectPoint,
  ringToSvgPath,
  shoelaceArea,
  svgProjection,
  toLocalMeters,
  unprojectPoint,
} from './planner-geo';

const SQUARE_METERS = JSON.stringify(
  [[0, 0], [1000, 0], [1000, 1000], [0, 1000]]);

const SQUARE_GEO = JSON.stringify({
  type: 'Feature',
  geometry: {
    type: 'Polygon',
    coordinates: [[[-77.01, 38.99], [-77.00, 38.99],
                   [-77.00, 39.00], [-77.01, 39.00],
                   [-77.01, 38.99]]],
  },
});

describe('planner-geo: polygon parsing', () => {
  it('parses Feature / raw-ring forms and closes an open ring', () => {
    const geo = parsePolygonGeojson(SQUARE_GEO);
    expect(geo.error).toBeUndefined();
    expect(geo.geographic).toBeTrue();

    const meters = parsePolygonGeojson(SQUARE_METERS);
    expect(meters.error).toBeUndefined();
    expect(meters.geographic).toBeFalse();
    const first = meters.ring[0];
    const last = meters.ring[meters.ring.length - 1];
    expect(first).toEqual(last);
  });

  it('refusals are values with reasons, never throws', () => {
    expect(parsePolygonGeojson('').error).toContain('no shape');
    expect(parsePolygonGeojson('{nope').error)
      .toContain('not parseable');
    expect(parsePolygonGeojson('{"type":"Point"}').error)
      .toContain('no Polygon');
    expect(parsePolygonGeojson('[[0,0],[1,1],[0,0]]').error)
      .toContain('3 distinct');
  });

  it('meter rings pass through; a ~1.1km geo square lands near '
     + '1.2e6 m² (equirect, stated as approximate)', () => {
    const local = toLocalMeters(parsePolygonGeojson(SQUARE_METERS));
    expect(local.areaM2).toBeCloseTo(1_000_000, -1);

    const geo = toLocalMeters(parsePolygonGeojson(SQUARE_GEO));
    // 0.01° lat ≈ 1113 m; 0.01° lng at 39° ≈ 865 m → ~963k m²
    expect(geo.areaM2).toBeGreaterThan(0.8e6);
    expect(geo.areaM2).toBeLessThan(1.2e6);
    expect(geo.note).toContain('equirect');
  });

  it('shoelace signs cancel: reversed ring, same magnitude', () => {
    const ring = parsePolygonGeojson(SQUARE_METERS).ring;
    const reversed = [...ring].reverse();
    expect(Math.abs(shoelaceArea(reversed)))
      .toBeCloseTo(Math.abs(shoelaceArea(ring)), 6);
  });
});

describe('planner-geo: svg projection', () => {
  const local = toLocalMeters(parsePolygonGeojson(SQUARE_METERS));
  const proj = svgProjection(local.bbox, 400, 300, 10);

  it('projects north-up (bigger y → smaller svg y) and round-trips '
     + 'through the inverse', () => {
    const [, syLow] = projectPoint(proj, 500, 0);
    const [, syHigh] = projectPoint(proj, 500, 1000);
    expect(syHigh).toBeLessThan(syLow);

    const [sx, sy] = projectPoint(proj, 250, 750);
    const [x, y] = unprojectPoint(proj, sx, sy);
    expect(x).toBeCloseTo(250, 6);
    expect(y).toBeCloseTo(750, 6);
  });

  it('renders a closed path and survives a degenerate bbox', () => {
    expect(ringToSvgPath(proj, local.ringM)).toMatch(/^M.*Z$/);
    const flat = svgProjection(
      { minX: 5, minY: 5, maxX: 5, maxY: 5 }, 400, 300);
    expect(flat.scale).toBe(1);
  });
});

describe('planner-geo: population mix', () => {
  it('sums and validates to exactly 100 with no negatives', () => {
    expect(mixSum({ lora: 60, wifi: 40 })).toBe(100);
    expect(mixValid({ lora: 60, wifi: 40 })).toBeTrue();
    expect(mixValid({ lora: 60, wifi: 39 })).toBeFalse();
    expect(mixValid({ lora: 110, wifi: -10 })).toBeFalse();
  });

  it('kit entries count by their pct — a person with several '
     + 'devices is still one share of the population', () => {
    const mix = {
      lora: 70,
      scout: { kit: { lora: 2, 'ham-rx': 1 }, pct: 30 },
    };
    expect(mixSum(mix)).toBe(100);
    expect(mixValid(mix)).toBeTrue();
    expect(mixValid({ lora: 70,
                      scout: { kit: {}, pct: 20 } })).toBeFalse();
  });
});

describe('planner-geo: tolerant normalizers', () => {
  it('placement: reads options+winner in either casing; positions '
     + 'as arrays or {x_m,y_m}', () => {
    const norm = normalizePlacement({
      mode: 'cheapest-coverage',
      ranked: [{ model: 'a', total_cost: 120 },
               { model: 'b', refusal: 'no price on file' }],
      winner: { model: 'a', totalCost: 120,
                positions: [[0, 0], { x_m: 700, y_m: 0 }] },
      assumptions: ['hex packing'],
    });
    expect(norm?.options.length).toBe(2);
    expect(norm?.options[0].totalCost).toBe(120);
    expect(norm?.options[1].reason).toContain('no price');
    expect(norm?.winner?.positions).toEqual([[0, 0], [700, 0]]);
  });

  it('placement loadouts: units + per-node cost surface on options '
     + 'and winner; totalCostUsd wins the fallback chain; perNode '
     + 'entries carry units and costUsd-as-cost', () => {
    const norm = normalizePlacement({
      options: [{ model: 'a', unitsPerNode: 2, unitsCap: 4,
                  perNodeCostUsd: 55.98, totalCostUsd: 167.94 }],
      winner: { model: 'a', unitsPerNode: 2, perNodeCostUsd: 55.98,
                totalCostUsd: 167.94, positions: [[0, 0]] },
      per_node: { barn: { type: 'a', units: 2, costUsd: 55.98 } },
    });
    expect(norm?.options[0].unitsPerNode).toBe(2);
    expect(norm?.options[0].unitsCap).toBe(4);
    expect(norm?.options[0].totalCost).toBe(167.94);
    expect(norm?.winner?.unitsPerNode).toBe(2);
    expect(norm?.winner?.perNodeCostUsd).toBe(55.98);
    expect(norm?.fixed?.perNode['barn'].units).toBe(2);
    expect(norm?.fixed?.perNode['barn'].cost).toBe(55.98);
  });

  it('placement: fixed-locations facts surface gaps and isolated '
     + 'nodes; absent sections stay absent, not invented', () => {
    const norm = normalizePlacement({
      covered_pct: 82.5,
      uncovered_gaps: [{ centroid: [10, 20], size_m2: 4000 }],
      isolated_nodes: ['barn'],
      per_node: { barn: { type: 'dsd-tech-sh-l1a', cost: 27.99 } },
    });
    expect(norm?.fixed?.coveredPct).toBe(82.5);
    expect(norm?.fixed?.uncoveredGaps[0].centroid).toEqual([10, 20]);
    expect(norm?.fixed?.isolatedNodes).toEqual(['barn']);
    expect(norm?.winner).toBeUndefined();
    expect(normalizePlacement(null)).toBeNull();
  });

  it('population: rows from object or array shapes; a build with no '
     + 'peers reads as isolated with its why', () => {
    const norm = normalizePopulation({
      perBuild: {
        lorawan: { count: 5, peers: [], isolated: true,
                   reason: 'LoRaWAN is not peer-to-peer' },
        'ham-rx': { count: 20, listensTo: ['ham-tx'] },
      },
      isolated_share: 0.1,
    });
    expect(norm?.rows.length).toBe(2);
    const lorawan = norm?.rows.find((r) => r.build === 'lorawan');
    expect(lorawan?.isolated).toBeTrue();
    expect(lorawan?.why).toContain('not peer-to-peer');
    const hamRx = norm?.rows.find((r) => r.build === 'ham-rx');
    expect(hamRx?.oneWayListensTo).toEqual(['ham-tx']);
    expect(norm?.isolatedShare).toBe(0.1);
    expect(normalizePopulation({})).toBeNull();
  });

  it('population loadouts: kit rows echo their devices and carry '
     + 'the capacity note', () => {
    const norm = normalizePopulation({
      builds: [{ build: 'scout', count: 15,
                 devices: { lora: 2, 'ham-rx': 1 },
                 capacityNote: '2× lora on distinct channels',
                 peers: ['lora'] }],
    });
    expect(norm?.rows[0].devices).toEqual({ lora: 2, 'ham-rx': 1 });
    expect(norm?.rows[0].capacityNote)
      .toContain('distinct channels');
  });
});
