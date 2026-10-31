import * as d3 from 'd3';

import { buildScene } from './pin-view-layout';
import { drawThermal, MAX_OPACITY } from './pin-view-thermal';
import { FIXTURE_PCB_THERMAL } from './pin-view-thermal.fixture';
import { PvPayload } from './pin-view.types';

/**
 * bob-3f — a PCB's temperature-rise field on the pin view (BENCH_BOARDS_PLAN bob-3). What must hold: one shaded cell per map point that is on the board
 * and above ambient, none off the board; the hottest cell is the most saturated (MAX_OPACITY) and opacity is proportional to the rise; the shading is
 * clipped to the board's outline and takes no clicks; a field that is absent (its `why` says so) draws nothing. The data is real framework output
 * (pin-view-thermal.fixture.ts: ecc83 with two resistors heating it).
 */
const PAYLOAD = FIXTURE_PCB_THERMAL as unknown as PvPayload;

describe('pin view thermal field (bob-3f)', () => {
  const scene = buildScene(PAYLOAD);
  const ps = scene.surfaces.get('pcb:ecc83')!;
  let svg: d3.Selection<SVGSVGElement, unknown, null, undefined>;

  beforeEach(() => { svg = d3.select(document.body).append('svg'); });
  afterEach(() => svg.remove());

  it('shades every on-board point above ambient, the hottest at full strength', () => {
    const g = svg.append('g');
    drawThermal(g, ps, PAYLOAD.thermal!, 'clip-test');
    const t = PAYLOAD.thermal!;
    const on = t.rise!.flat().filter(r => r !== null && r > 0) as number[];
    const rects = g.selectAll<SVGRectElement, unknown>('g.pv-thermal rect').nodes();
    expect(rects.length).toBe(on.length);
    const ops = rects.map(r => +r.getAttribute('fill-opacity')!);
    expect(Math.max(...ops)).toBeCloseTo((MAX_OPACITY * Math.max(...on)) / t.max!, 6);
    expect(Math.max(...ops)).toBeLessThanOrEqual(MAX_OPACITY + 1e-9);
  });

  it('is clipped to the board outline and sits in the surface frame', () => {
    const g = svg.append('g');
    drawThermal(g, ps, PAYLOAD.thermal!, 'clip-test');
    expect(g.select('clipPath#clip-test path').attr('d')).toContain('Z');
    expect(g.select('g.pv-thermal').attr('clip-path')).toBe('url(#clip-test)');
    expect(g.select('g.pv-thermal').attr('transform')).toContain(`translate(${ps.ox} ${ps.oy})`);
  });

  it('draws nothing when the field is absent and says why in the payload', () => {
    const g = svg.append('g');
    drawThermal(g, ps, { surface: 'pcb:ecc83', why: 'no finished run kept for ecc83', unit: 'K above ambient' }, 'clip-none');
    expect(g.selectAll('rect').size()).toBe(0);
  });

  it('gives every pad the rise where it sits in its notes', () => {
    const r4 = PAYLOAD.pins.filter(p => p.label.startsWith('R4.'));
    expect(r4.length).toBe(2);
    r4.forEach(p => expect(p.notes).toMatch(/rise \+\d+\.\d\d K here/));
  });
});
