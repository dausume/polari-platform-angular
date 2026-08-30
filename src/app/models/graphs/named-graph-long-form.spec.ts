import { NamedGraphConfig } from './NamedGraphConfig';
import { PlotDimensionRenderer } from './plotDimensionRenderer';
import {
  CNT_TRANSFER_STATES_ROWS, SI_TRANSFER_STATES_ROWS,
  TRANSFER_STATES_GRAPHDEF,
} from './named-graph-long-form.fixtures';

/**
 * Long-form graph regression: `cnt-device-transfer-states` (line +
 * band + guide rows, log Y) rendered EMPTY except the two guide rules
 * on the Si device page although its 39 rows were fine.
 *
 * The path mirrors named-graph-panel exactly:
 *   NamedGraphConfig.fromBackend(row)  →  buildPlotFigure(rows, {})
 *   →  figure.render()  (graph-renderer)
 * and asserts on the figure (groups, points) AND on what Observable
 * Plot actually drew (the line path, the band areas, the log y scale).
 */
describe('NamedGraphConfig long-form (transfer-states)', () => {
  const cases: Array<[string, any[]]> = [
    ['si-nmos-planar-90', SI_TRANSFER_STATES_ROWS],
    ['cnt-aligned-s1', CNT_TRANSFER_STATES_ROWS],
  ];

  function build(rows: any[]) {
    const config = NamedGraphConfig.fromBackend(TRANSFER_STATES_GRAPHDEF);
    return { config, figure: config.buildPlotFigure(rows, {}) };
  }

  function lineRows(rows: any[]): any[] {
    return rows.filter(r => r.style === 'line');
  }

  /** The PLOT svg. Plot returns a <figure> when a legend is on; its
   *  swatches are tiny <svg>s too, so pick the classed plot svg. */
  function plotSvg(el: any): SVGSVGElement {
    if (el.tagName === 'svg') { return el; }
    const svgs = Array.from(el.querySelectorAll('svg')) as SVGSVGElement[];
    return svgs.find(s => (s.getAttribute('class') || '').startsWith('plot'))
      || svgs[svgs.length - 1];
  }

  for (const [device, rows] of cases) {
    describe(device, () => {
      it('parses the definition as a long-form log-Y line graph', () => {
        const { config } = build(rows);
        const gc = config.graphConfig;
        expect(gc.seriesDimension).toBe('series');
        expect(gc.styleDimension).toBe('style');
        expect(gc.xDimension).toBe('x');
        expect(gc.yDimensions).toEqual(['y']);
        expect(gc.options.yType).toBe('log');
        // "aggregation": null in the stored JSON must not break the merge
        expect(gc.aggregation.enabled).toBeFalse();
      });

      it('builds one lineY group with 31 finite points and 3 lo/hi bands', () => {
        const { figure } = build(rows);
        expect(rows.length).toBe(39);
        const lines = figure.longForm.filter(g => g.style === 'lineY');
        expect(lines.length).toBe(1);
        const finite = lines[0].points.filter(
          p => typeof p.x === 'number' && Number.isFinite(p.x)
            && Number.isFinite(p.y) && p.y > 0);
        expect(finite.length).toBe(31);

        const bands = figure.longForm.filter(g => g.style === 'band');
        expect(bands.map(b => b.label))
          .toEqual(['off', 'transition-on', 'on-saturation']);
        for (const b of bands) {
          expect(b.points.length).toBe(2);
          for (const p of b.points) {
            expect(Number.isFinite(p.lo as number)).toBeTrue();
            expect(Number.isFinite(p.hi as number)).toBeTrue();
            expect((p.lo as number) > 0).toBeTrue();
            expect((p.hi as number) > (p.lo as number)).toBeTrue();
          }
        }
        const guides = figure.longForm.filter(g => g.style === 'guide');
        expect(guides.length).toBe(2);
        // guide rows carry y: null — that must stay NaN, never 0
        for (const g of guides) {
          expect(Number.isNaN(g.points[0].y)).toBeTrue();
        }
      });

      it('renders the line, the bands and a finite log y scale covering the line', async () => {
        const loaded = await PlotDimensionRenderer.loadPlotLibrary();
        expect(loaded).toBeTrue();
        const { figure } = build(rows);

        // mark set: 3 bands + 2 guides (rule + text each) + 1 line
        const marks = figure.getAllPlotMarks();
        expect(marks.length).toBe(3 + 2 * 2 + 1);

        const el: any = await figure.render();
        expect(el).not.toBeNull();
        const svg = plotSvg(el);
        expect(svg).toBeDefined();

        // y scale: log, finite, covering min..max of the line
        const y = el.scale('y');
        expect(y.type).toBe('log');
        const [d0, d1] = y.domain as [number, number];
        expect(Number.isFinite(d0)).toBeTrue();
        expect(Number.isFinite(d1)).toBeTrue();
        const ys = lineRows(rows).map(r => r.y as number);
        expect(d0 <= Math.min(...ys)).toBeTrue();
        expect(d1 >= Math.max(...ys)).toBeTrue();

        // the line: one <path> with 31 vertices (M + 30 L)
        const linePath = Array.from(svg.querySelectorAll('g[aria-label="line"] path'));
        expect(linePath.length).toBe(1);
        const d = linePath[0].getAttribute('d') || '';
        const vertices = (d.match(/[ML]/g) || []).length;
        expect(vertices).toBe(31);
        expect(d).not.toContain('NaN');

        // the bands: three shaded areas
        const areas = Array.from(svg.querySelectorAll('g[aria-label="area"] path'));
        expect(areas.length).toBe(3);
        for (const a of areas) {
          expect(a.getAttribute('d') || '').not.toContain('NaN');
        }

        // the guides: two vertical rules
        const rules = svg.querySelectorAll('g[aria-label="rule"] line');
        expect(rules.length).toBe(2);
      });
    });
  }

  it('skips non-finite and log-floor values instead of poisoning the scale', async () => {
    await PlotDimensionRenderer.loadPlotLibrary();
    const rows = [
      ...SI_TRANSFER_STATES_ROWS,
      { series: 'Id, Vd = 0.6 V', style: 'line', x: 0.61, y: 0 },
      { series: 'Id, Vd = 0.6 V', style: 'line', x: 0.62, y: null },
      { series: 'Id, Vd = 0.6 V', style: 'line', x: 0.63, y: 'nope' },
      { series: 'off', style: 'band', x: 0.7, lo: 0, hi: 1 },
    ];
    const config = NamedGraphConfig.fromBackend(TRANSFER_STATES_GRAPHDEF);
    const figure = config.buildPlotFigure(rows, {});
    const el: any = await figure.render();
    expect(el).not.toBeNull();
    const [d0, d1] = el.scale('y').domain as [number, number];
    expect(Number.isFinite(d0) && d0 > 0).toBeTrue();
    expect(Number.isFinite(d1)).toBeTrue();
    const d = plotSvg(el).querySelector('g[aria-label="line"] path')?.getAttribute('d') || '';
    expect((d.match(/[ML]/g) || []).length).toBe(31);
  });
});
