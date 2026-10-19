import { NamedGraphConfig } from './NamedGraphConfig';

/**
 * fsc-3 Chrome check: the Firmware Scores "twelve best" bars came out in
 * alphabetical order, not rank order, because Observable Plot sorts an
 * ordinal domain by default. `options.categoryOrder: 'data'` keeps the
 * rows' own order (the door already serves them best first).
 */
describe('PlotFigure categoryOrder', () => {
  const rows = [
    { short_label: 'zeta route', score: 100 },
    { short_label: 'alpha route', score: 80 },
    { short_label: 'mid route', score: 40 },
  ];

  function graphDef(categoryOrder?: string) {
    const options: any = { width: 600, height: 200, marginLeft: 120, showLegend: false };
    if (categoryOrder) { options.categoryOrder = categoryOrder; }
    return {
      name: 'order-test', source_class: 'ScoreConcept', description: '',
      definition: JSON.stringify({ graphConfig: {
        renderStyle: 'barX', xDimension: 'short_label', yDimensions: ['score'], seriesColors: [], options,
        aggregation: { enabled: false, strategy: 'average' } } }),
    };
  }

  async function yTicks(categoryOrder?: string): Promise<string[]> {
    const figure = NamedGraphConfig.fromBackend(graphDef(categoryOrder) as any).buildPlotFigure(rows, {});
    const el: any = await figure.render();
    expect(el).toBeTruthy();
    const svg: Element = el.tagName === 'svg' ? el : el.querySelector('svg');
    const axis = Array.from(svg.querySelectorAll('g[aria-label="y-axis tick label"] text'));
    return axis.map(t => (t.textContent || '').trim());
  }

  it('keeps the rows in their served (ranked) order with categoryOrder "data"', async () => {
    expect(await yTicks('data')).toEqual(['zeta route', 'alpha route', 'mid route']);
  });

  it('leaves the default (alphabetical) order alone without the option', async () => {
    expect(await yTicks()).toEqual(['alpha route', 'mid route', 'zeta route']);
  });
});
