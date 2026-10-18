import { expandTabs, listRowsOf, pickTab, syncInputs, templateRows } from './display-tabs';

describe('display-tabs (fsc-3)', () => {
  const template = [{ index: 0, items: [{ title: 'Ranked: {title}', componentProps: { inputs: { dataPath: '/api/x?profile={key}&solution={scope:solution}' } } }] }];
  const staticTabs = [
    { key: 'top', title: 'Top scorers', rows: [] },
    { key: 'failures', title: 'Failures', rows: [] },
    { key: 'editor', title: 'Profile editor', rows: [] },
  ];

  it('templates {key} and {title} into every nested string and leaves {scope:...} alone', () => {
    const out = templateRows(template, 'fsc-fastest', 'Fastest');
    expect(out[0].items[0].title).toBe('Ranked: Fastest');
    expect(out[0].items[0].componentProps.inputs.dataPath).toBe('/api/x?profile=fsc-fastest&solution={scope:solution}');
  });

  it('escapes a key or title that carries quotes, so the rows stay valid', () => {
    const out = templateRows(template, 'a"b', 'Say "hi"\\');
    expect(out[0].items[0].title).toBe('Ranked: Say "hi"\\');
    expect(out[0].items[0].componentProps.inputs.dataPath).toContain('profile=a"b');
  });

  it('does not change the template it is given (one template, many tabs)', () => {
    templateRows(template, 'k', 'T');
    expect(JSON.stringify(template)).toContain('{key}');
  });

  it('with no tabs_from the static tabs come back as they are', () => {
    expect(expandTabs(staticTabs, undefined, []).map((t) => t.key)).toEqual(['top', 'failures', 'editor']);
  });

  it('a page with neither tabs nor tabs_from has no tabs', () => {
    expect(expandTabs(undefined, undefined, [])).toEqual([]);
  });

  it('splices the generated tabs in after insert_at static tabs, in list order', () => {
    const from = { data_path: '/api/p', key_field: 'name', title_field: 'display_name', rows_template: template, insert_at: 1 };
    const tabs = expandTabs(staticTabs, from, [{ name: 'p1', display_name: 'One' }, { name: 'p2', display_name: 'Two' }]);
    expect(tabs.map((t) => t.key)).toEqual(['top', 'p1', 'p2', 'failures', 'editor']);
    expect(tabs[1].title).toBe('One');
    expect((tabs[2].rows[0] as any).items[0].componentProps.inputs.dataPath).toContain('profile=p2');
  });

  it('puts generated tabs after every static tab when insert_at is absent, and clamps an oversized insert_at', () => {
    const base = { data_path: '/api/p', key_field: 'name', title_field: 't', rows_template: [] };
    expect(expandTabs(staticTabs, base, [{ name: 'p1' }]).map((t) => t.key)).toEqual(['top', 'failures', 'editor', 'p1']);
    expect(expandTabs(staticTabs, { ...base, insert_at: 99 }, [{ name: 'p1' }]).map((t) => t.key)).toEqual(['top', 'failures', 'editor', 'p1']);
  });

  it('skips list rows with no key or a repeated key, and falls back to the key for a missing title', () => {
    const from = { data_path: '/api/p', key_field: 'name', title_field: 't', rows_template: [] };
    const tabs = expandTabs([], from, [{ name: '' }, { name: 'a' }, { name: 'a', t: 'again' }, { name: 'b', t: 'Bee' }]);
    expect(tabs.map((t) => [t.key, t.title])).toEqual([['a', 'a'], ['b', 'Bee']]);
  });

  it('a new list row (the person saved their own profile) is a new tab', () => {
    const from = { data_path: '/api/p', key_field: 'name', title_field: 't', rows_template: [] };
    expect(expandTabs([], from, [{ name: 'a' }]).length).toBe(1);
    expect(expandTabs([], from, [{ name: 'a' }, { name: 'mine' }]).length).toBe(2);
  });

  it('pickTab: the named tab, else the first (no ?tab=, or an unknown one)', () => {
    const tabs = expandTabs(staticTabs, undefined, []);
    expect(pickTab(tabs, 'failures')?.key).toBe('failures');
    expect(pickTab(tabs, null)?.key).toBe('top');
    expect(pickTab(tabs, 'nope')?.key).toBe('top');
    expect(pickTab([], 'x')).toBeNull();
  });

  it('listRowsOf reads {rows}, {data} and a bare list', () => {
    expect(listRowsOf({ rows: [1] })).toEqual([1]);
    expect(listRowsOf({ data: [2] })).toEqual([2]);
    expect(listRowsOf([3])).toEqual([3]);
    expect(listRowsOf({ ok: false })).toEqual([]);
  });
});

describe('syncInputs (fsc-3)', () => {
  const mk = (path: string, sel: string) => ({ rows: [{ dashboardItems: [{ title: 'T', componentProps: { inputs: { dataPath: '/ranked', selectedValue: sel } } }, { title: 'B', componentProps: { inputs: { dataPath: path } } }] }] });

  it('copies only the changed inputs into the items on screen, and counts the items that changed', () => {
    const onScreen = mk('/breakdown?solution=', '');
    const fresh = mk('/breakdown?solution=s1', 's1');
    const first = onScreen.rows[0].dashboardItems[0];
    expect(syncInputs(onScreen, fresh)).toBe(2);
    expect(first.componentProps.inputs.selectedValue).toBe('s1');
    expect(first.componentProps.inputs.dataPath).toBe('/ranked');
    expect(onScreen.rows[0].dashboardItems[1].componentProps.inputs.dataPath).toBe('/breakdown?solution=s1');
  });

  it('changes nothing (and keeps the same item objects) when the inputs are the same', () => {
    const onScreen = mk('/b', 's1');
    const item = onScreen.rows[0].dashboardItems[0];
    expect(syncInputs(onScreen, mk('/b', 's1'))).toBe(0);
    expect(onScreen.rows[0].dashboardItems[0]).toBe(item);
  });

  it('copes with a missing side', () => {
    expect(syncInputs(null, mk('/b', ''))).toBe(0);
    expect(syncInputs(mk('/b', ''), null)).toBe(0);
  });
});
