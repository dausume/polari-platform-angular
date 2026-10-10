/**
 * ucd-hdr2 (his report 2026-10-10, verbatim: "For some reason the nav from a composed by row on
 * composed by always goes to that url from the c-canvas. It also seems that deleting the extra
 * parameters ... are always taking us only to AdditionTester ... Also, the only interface I see has
 * an absurd amount of c-atoms ... disorganized"). Three pure, standalone functions exported from
 * custom-no-code.ts (same reasoning as runtime-options.spec.ts's dispatchHeaderSolution/
 * deriveRuntimeForSolution: they spec without mounting CustomNoCodeComponent's heavy dependency
 * graph) — one per defect: selection precedence, URL-writer gating, scope subset, staged layout
 * column assignment.
 */
import {
  resolveInitialSelection, shouldSyncUrlForOrigin, cScopeSubset, assignCStageColumns, C_STAGE_COLUMN_ORDER,
  SelectionOrigin, composeObjectOptions, solutionOptionsFor, isHiddenCanvasSolution, graphOfHiddenSolution,
} from './custom-no-code';

/** defect 1+2 — THE single ordered rule (deliverable 1): resolveInitialSelection's 4 cases. */
describe('custom-no-code — resolveInitialSelection (selection precedence, THE single ordered rule)', () => {
  it('(a) an explicit URL focusSolution wins outright, even over a page-provided graph/solution', () => {
    const r = resolveInitialSelection({
      queryParams: { focusSolution: 'AdditionTester.test_addition' },
      inputGraph: 'uno-sim-rig-graph', inputSolution: '',
    });
    expect(r).toEqual({ kind: 'focusSolution', value: 'AdditionTester.test_addition', origin: 'url' });
  });

  it('(a) alias `solution` query param (not just `focusSolution`) also wins', () => {
    const r = resolveInitialSelection({ queryParams: { solution: 'uno-temp-split' }, inputGraph: '', inputSolution: '' });
    expect(r).toEqual({ kind: 'focusSolution', value: 'uno-temp-split', origin: 'url' });
  });

  it('(b) URL graph (no focusSolution) opens the CGraph adapter, origin url', () => {
    const r = resolveInitialSelection({ queryParams: { graph: 'uno-sim-rig-graph', node: 'led' }, inputGraph: '', inputSolution: '' });
    expect(r).toEqual({ kind: 'graph', value: 'uno-sim-rig-graph', origin: 'graph' });
  });

  it('(c) no URL at all: the page\'s own `graph`/`solution` @Input decide, origin page', () => {
    expect(resolveInitialSelection({ queryParams: {}, inputGraph: 'uno-sim-rig-graph', inputSolution: '' }))
      .toEqual({ kind: 'graph', value: 'uno-sim-rig-graph', origin: 'page' });
    expect(resolveInitialSelection({ queryParams: {}, inputGraph: '', inputSolution: 'uno-temp-split' }))
      .toEqual({ kind: 'focusSolution', value: 'uno-temp-split', origin: 'page' });
  });

  it('(c) page `solution` wins over page `graph` when both @Inputs are set (hwnocode_page.py\'s own shape)', () => {
    const r = resolveInitialSelection({ queryParams: {}, inputGraph: 'uno-sim-rig-graph', inputSolution: 'uno-temp-split' });
    expect(r.kind).toBe('focusSolution');
    expect(r.value).toBe('uno-temp-split');
  });

  it('(d) neither the URL nor the page says anything: {kind:"none", origin:"default"} — the ' +
     'caller must leave the service\'s own default pick out of the URL entirely', () => {
    expect(resolveInitialSelection({ queryParams: {}, inputGraph: '', inputSolution: '' }))
      .toEqual({ kind: 'none', value: '', origin: 'default' });
  });

  it('the plain /custom-no-code editor route (no graph/solution/node anywhere) is case (d)', () => {
    const r = resolveInitialSelection({ queryParams: { someUnrelatedParam: 'x' }, inputGraph: '', inputSolution: '' });
    expect(r.origin).toBe('default');
  });
});

/** defect 1+2 — the URL writer only ever fires for a person-made selection. */
describe('custom-no-code — shouldSyncUrlForOrigin (the URL writer\'s own gate)', () => {
  it('syncs for "selector" (the native Object/Solution dropdown) and "url" (an explicit fast-nav)', () => {
    expect(shouldSyncUrlForOrigin('selector')).toBe(true);
    expect(shouldSyncUrlForOrigin('url')).toBe(true);
  });

  it('never syncs for "page" (a header/page-driven graph/solution open) or "default" (the ' +
     'service\'s own default-first-solution reselect — his report\'s AdditionTester leak)', () => {
    expect(shouldSyncUrlForOrigin('page')).toBe(false);
    expect(shouldSyncUrlForOrigin('default')).toBe(false);
  });

  it('ucd-hdr3: the "graph" origin (URL graph/node open) never syncs — no focusSolution/object write', () => {
    expect(shouldSyncUrlForOrigin('graph')).toBe(false);
  });

  it('covers exactly the 5 SelectionOrigin values (a change to the union type is caught here)', () => {
    const all: SelectionOrigin[] = ['url', 'selector', 'page', 'default', 'graph'];
    expect(all.map(shouldSyncUrlForOrigin)).toEqual([true, true, false, false, false]);
  });

  it('ucd-hdr3 hidden-name guard helpers: cmod.c-canvas.<g> is hidden and maps back to its graph', () => {
    expect(isHiddenCanvasSolution('cmod.c-canvas.uno-sim-rig-graph')).toBe(true);
    expect(isHiddenCanvasSolution('CalculusTester.derivative_test')).toBe(false);
    expect(isHiddenCanvasSolution('')).toBe(false);
    expect(graphOfHiddenSolution('cmod.c-canvas.uno-sim-rig-graph')).toBe('uno-sim-rig-graph');
    expect(graphOfHiddenSolution('AdditionTester.x')).toBe('');
  });
});

describe('custom-no-code — Object select composition + graph-mode Solution list (ucd-hdr3)', () => {
  const graphs = [{ name: 'uno-sim-rig-graph', node_count: 18, atom_count: 18 }, { name: 'uno-button-clock-graph' }];
  const objects = ['AdditionTester', 'CalculusTester'];

  it('lists the backend objects AND one option per C graph; a backend selection stays the object', () => {
    const o = composeObjectOptions(objects, graphs, 'CalculusTester.derivative_test', 'CalculusTester');
    expect(o.objects).toEqual(objects);
    expect(o.graphs.map(g => g.name)).toEqual(['uno-sim-rig-graph', 'uno-button-clock-graph']);
    expect(o.selected).toBe('CalculusTester');
  });

  it('selected value = the graph name while a cmod.c-canvas.<graph> solution is open (never AdditionTester)', () => {
    const o = composeObjectOptions(objects, graphs, 'cmod.c-canvas.uno-sim-rig-graph', 'AdditionTester');
    expect(o.selected).toBe('uno-sim-rig-graph');
  });

  it('a deep-linked graph the list has not delivered yet is still offered and selected', () => {
    const o = composeObjectOptions(objects, [], 'cmod.c-canvas.uno-sim-rig-graph', '');
    expect(o.graphs).toEqual([{ name: 'uno-sim-rig-graph', label: 'uno-sim-rig-graph' }]);
    expect(o.selected).toBe('uno-sim-rig-graph');
  });

  it('graph mode: the Solution select has exactly one option "atoms of <graph>" (value = the hidden name)', () => {
    const one = solutionOptionsFor('cmod.c-canvas.uno-sim-rig-graph', [{ name: 'AdditionTester.a', shortName: 'a' }]);
    expect(one).toEqual([{ name: 'cmod.c-canvas.uno-sim-rig-graph', shortName: 'atoms of uno-sim-rig-graph' }]);
  });

  it('backend mode: the object-filtered list passes through unchanged', () => {
    const f = [{ name: 'CalculusTester.derivative_test', shortName: 'derivative_test' }];
    expect(solutionOptionsFor('CalculusTester.derivative_test', f)).toBe(f);
  });
});

/** defect "scope" (deliverable 2) — the scope subset function, on a tiny fixture. */
describe('custom-no-code — cScopeSubset (task/purpose/graph scope, on a tiny fixture)', () => {
  const scope = { node: 'led', purposes: ['blink-on-command'], task_names: ['rx_pop', 'apply', 'led'], neighbours: ['apply'] };
  const purposes = [
    { name: 'blink-on-command', title: 'Blink the LED on command', task_names: ['rx_pop', 'apply', 'led'] },
    { name: 'temp-sensor-to-os', title: 'Temperature sensor to OS', task_names: ['adc_init', 'adc', 'temp', 'telemetry', 'frame', 'send'] },
  ];

  it('"graph" scope is unfiltered (null) regardless of node/scope/purposes', () => {
    expect(cScopeSubset('graph', 'led', scope, purposes, null)).toBeNull();
  });

  it('no node focused degrades to "graph" (null) even if mode says otherwise', () => {
    expect(cScopeSubset('task', '', scope, purposes, null)).toBeNull();
  });

  it('"task" scope is the node + its one-edge neighbours only', () => {
    const s = cScopeSubset('task', 'led', scope, purposes, null)!;
    expect(Array.from(s).sort()).toEqual(['apply', 'led']);
  });

  it('"task" scope with no backend scope data degrades to just the node itself', () => {
    const s = cScopeSubset('task', 'led', null, purposes, null)!;
    expect(Array.from(s)).toEqual(['led']);
  });

  it('"purpose" scope (no chip picked) is the union of every purpose naming the node, from the ' +
     'backend\'s own scope.task_names — always including the node', () => {
    const s = cScopeSubset('purpose', 'led', scope, purposes, null)!;
    expect(Array.from(s).sort()).toEqual(['apply', 'led', 'rx_pop']);
  });

  it('"purpose" scope with ONE chip hand-picked narrows to just that purpose\'s own task_names', () => {
    const s = cScopeSubset('purpose', 'led', scope, purposes, 'temp-sensor-to-os')!;
    expect(Array.from(s).sort()).toEqual(['adc', 'adc_init', 'frame', 'led', 'send', 'telemetry', 'temp']);
  });

  it('a hand-picked chip that does not actually exist degrades to just the node', () => {
    const s = cScopeSubset('purpose', 'led', scope, purposes, 'not-a-real-purpose')!;
    expect(Array.from(s)).toEqual(['led']);
  });
});

/** defect "layout" (deliverable 3) — the staged layout column assignment. */
describe('custom-no-code — assignCStageColumns (the staged C lane layout)', () => {
  const n = (instance: string, stage: string, order: number) => ({ instance, kind: 'c-atom', atom: '', stage, order, bindings: '', params: '' });
  const e = (from_node: string, to_node: string) => ({ kind: 'calls', from_node, from_port: '', to_node, to_port: '', order: 0 });

  it('the fixed column order is init -> loop -> called -> "" (glue-generated), matching the real ' +
     'stage values graph_seed.py\'s own _n() ever writes', () => {
    expect(C_STAGE_COLUMN_ORDER).toEqual(['init', 'loop', 'called', '']);
  });

  it('buckets nodes into columns by stage, in that fixed order, dropping any EMPTY column (a ' +
     'graph with no "called" nodes has 3 columns, not a gap)', () => {
    const nodes = [n('usart_init', 'init', 1), n('rx_pop', 'loop', 10), n('state', '', 6)];
    const cols = assignCStageColumns(nodes, []);
    expect(cols.map(c => c.map(x => x.instance))).toEqual([['usart_init'], ['rx_pop'], ['state']]);
  });

  it('glue-generated kinds (class/parser/frame/tick/rule) land in the LAST ("") column, after ' +
     'every real init/loop/called c-atom', () => {
    const nodes = [n('frame', '', 25), n('apply', 'loop', 11), n('led', 'called', 12), n('usart_init', 'init', 1)];
    const cols = assignCStageColumns(nodes, []);
    expect(cols.map(c => c[0].instance)).toEqual(['usart_init', 'apply', 'led', 'frame']);
  });

  it('an unknown/future stage value degrades into the same last "" column rather than a 5th', () => {
    const nodes = [n('mystery', 'isr', 99), n('usart_init', 'init', 1)];
    const cols = assignCStageColumns(nodes, []);
    expect(cols.length).toBe(2);
    expect(cols[1].map(x => x.instance)).toEqual(['mystery']);
  });

  it('orders a column TOPOLOGICALLY over edges restricted to that same column — a caller before ' +
     'what it calls (uno-button-clock-graph\'s own "called" column: events_drain -> queue_pop / ' +
     'usart_send)', () => {
    const nodes = [
      n('queue_pop', 'called', 15), n('usart_send', 'called', 17), n('events_drain', 'called', 16),
    ];
    const edges = [e('events_drain', 'queue_pop'), e('events_drain', 'usart_send')];
    const cols = assignCStageColumns(nodes, edges);
    const order = cols[0].map(x => x.instance);
    expect(order[0]).toBe('events_drain');
    expect(new Set(order.slice(1))).toEqual(new Set(['queue_pop', 'usart_send']));
  });

  it('a cross-column edge (the overwhelming majority — e.g. loop calls called) is ignored for ' +
     'ordering WITHIN a column; ties fall back to the node\'s own declared order', () => {
    const nodes = [n('pwm', 'called', 13), n('led', 'called', 12), n('apply', 'loop', 11)];
    const edges = [e('apply', 'led'), e('apply', 'pwm')]; // both cross-column — no intra-column edge at all
    const cols = assignCStageColumns(nodes, edges);
    const calledCol = cols.find(c => c.every(x => x.stage === 'called'))!;
    expect(calledCol.map(x => x.instance)).toEqual(['led', 'pwm']); // order 12 before 13
  });

  it('a cycle\'s leftover members (should never happen for a real call graph) still all come out, ' +
     'by declared order, rather than being dropped', () => {
    const nodes = [n('a', 'loop', 2), n('b', 'loop', 1)];
    const edges = [e('a', 'b'), e('b', 'a')];
    const cols = assignCStageColumns(nodes, edges);
    expect(cols[0].map(x => x.instance).sort()).toEqual(['a', 'b']);
  });
});
