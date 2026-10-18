/**
 * fsc-3: TABS for configured pages - the pure half (no Angular), so it is unit-tested alone (display-tabs.spec.ts).
 *
 * A page definition may carry (module_pages_seed `_tab` / `_tabs_from`):
 *   tabs       - static tabs, in order: { key, title, rows, description? } - `rows` are exactly a page's rows.
 *   tabs_from  - GENERATED tabs: { data_path, key_field, title_field, rows_template, insert_at? } - one tab per row of the list door
 *                `data_path`; every `{key}` / `{title}` inside `rows_template` is replaced by that row's key / title; the generated
 *                tabs are spliced into the static ones after `insert_at` static tabs (default: after all of them).
 * A page with neither renders exactly as before.
 */

/** A static tab exactly as the definition JSON carries it (rows are still raw row JSON). */
export interface DisplayTabDef {
  key: string;
  title: string;
  rows: any[];
  description?: string;
}

/** The generated-tabs source exactly as the definition JSON carries it. */
export interface DisplayTabsFrom {
  data_path: string;
  key_field: string;
  title_field: string;
  rows_template: any[];
  insert_at?: number;
}

/** A tab ready to show: raw rows (templated), turned into a Display by the page. */
export type ResolvedTab = DisplayTabDef;

/** JSON-string-safe form of a value, for splicing into JSON text (quotes, backslashes, control characters escaped). */
function jsonSafe(value: string): string {
  return JSON.stringify(value).slice(1, -1);
}

/** The rows with every `{key}` and `{title}` replaced - done on the JSON text so it reaches every nested string (data_path, titles, descriptions). */
export function templateRows(rows: any[], key: string, title: string): any[] {
  const text = JSON.stringify(rows ?? [])
    .split('{key}').join(jsonSafe(key))
    .split('{title}').join(jsonSafe(title));
  return JSON.parse(text);
}

/** Rows of a list door's payload: `{rows: [...]}`, `{data: [...]}` or a bare list. */
export function listRowsOf(payload: any): any[] {
  if (Array.isArray(payload)) { return payload; }
  if (Array.isArray(payload?.rows)) { return payload.rows; }
  if (Array.isArray(payload?.data)) { return payload.data; }
  return [];
}

/** Static + generated tabs, in page order. A list row without a key is skipped; a missing title falls back to the key; a repeated key is kept once. */
export function expandTabs(tabs: DisplayTabDef[] | undefined, from: DisplayTabsFrom | undefined, listRows: any[]): ResolvedTab[] {
  const staticTabs: ResolvedTab[] = (tabs ?? []).filter((t) => t && t.key).map((t) => ({ ...t, title: t.title || t.key, rows: t.rows ?? [] }));
  if (!from) { return staticTabs; }
  const generated: ResolvedTab[] = [];
  const seen = new Set<string>(staticTabs.map((t) => t.key));
  for (const row of listRows ?? []) {
    const key = String(row?.[from.key_field] ?? '').trim();
    if (!key || seen.has(key)) { continue; }
    seen.add(key);
    const title = String(row?.[from.title_field] ?? '').trim() || key;
    generated.push({ key, title, rows: templateRows(from.rows_template, key, title) });
  }
  const at = from.insert_at === undefined || from.insert_at === null
    ? staticTabs.length
    : Math.max(0, Math.min(from.insert_at, staticTabs.length));
  return [...staticTabs.slice(0, at), ...generated, ...staticTabs.slice(at)];
}

/** The tab `?tab=` names; the first tab when none is named or the name is unknown. */
export function pickTab(tabs: ResolvedTab[], wanted: string | null | undefined): ResolvedTab | null {
  if (!tabs.length) { return null; }
  return tabs.find((t) => t.key === wanted) ?? tabs[0];
}

/**
 * A page scope changed: the open tab's items are re-substituted into `fresh`; copy every CHANGED title / input into the items already on screen
 * (same rows, same positions) instead of replacing the tab. A table whose inputs did not change is left alone - it neither refetches nor flickers -
 * and one whose dataPath changed fetches again through its own ngOnChanges. Returns the number of items that changed.
 */
export function syncInputs(target: { rows?: any[] } | null, fresh: { rows?: any[] } | null): number {
  let changed = 0;
  const rowsA = target?.rows ?? [];
  const rowsB = fresh?.rows ?? [];
  rowsA.forEach((rowA: any, i: number) => {
    const itemsA: any[] = rowA?.dashboardItems ?? [];
    const itemsB: any[] = rowsB[i]?.dashboardItems ?? [];
    itemsA.forEach((a: any, j: number) => {
      const b = itemsB[j];
      if (!a || !b) { return; }
      let touched = false;
      if (a.title !== b.title) { a.title = b.title; touched = true; }
      const ia = a.componentProps?.inputs;
      const ib = b.componentProps?.inputs;
      if (ia && ib) {
        Object.keys(ib).forEach((k) => {
          if (JSON.stringify(ia[k]) !== JSON.stringify(ib[k])) { ia[k] = ib[k]; touched = true; }
        });
      }
      if (touched) { changed++; }
    });
  });
  return changed;
}
