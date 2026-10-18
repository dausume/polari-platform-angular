/**
 * fsc-3: the pure half of class-rows-table's ROW INTERACTION options (all optional, configured in the page seed - see
 * module_pages_seed `_table`): a clickable row that sets a page-scope key, and a row that opens a page tab. Unit-tested alone
 * (class-rows-interaction.spec.ts).
 */

/**
 * True when a path still has an empty piece where a page-scope value should be: a query parameter with an empty value (`…&solution=&profile=x`)
 * or an empty path segment (`/api/profiles//terms`) - a scope nothing has picked yet.
 */
export function hasBlankParam(path: string): boolean {
  const [route, q] = (path || '').split('?');
  if (/^[a-z]+:\/\//i.test(route) ? /\/\//.test(route.replace(/^[a-z]+:\/\//i, '')) : /\/\//.test(route)) { return true; }
  if (!q) { return false; }
  return q.split('&').some((kv) => kv.length > 0 && /^[^=]+=$/.test(kv));
}

/** The text of a row field as a plain string ('' when missing). */
export function fieldText(row: any, field: string): string {
  const v = row?.[field];
  return v === null || v === undefined ? '' : String(v);
}

/**
 * What a click on a row does to the scope: the row's value, or '' (clear) when that row is already the selected one - the project's
 * click-toggle rule (anything selectable by click deselects on a second click; Escape clears).
 */
export function nextSelection(row: any, selectField: string, selectedValue: string): string {
  const value = fieldText(row, selectField);
  if (!value) { return ''; }
  return value === (selectedValue || '') ? '' : value;
}

/** True when the click came from a link or button INSIDE the row (a ref chip, a more/less toggle, an edit box): the row itself must not react. */
export function clickIsOnControl(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  return !!el && typeof el.closest === 'function' && !!el.closest('a, button, input, select, textarea');
}

/** A number shown with `decimals` decimals (default 1) - the `fixed` column format. Not a number: shown as it came. The data keeps its precise value. */
export function fixedText(raw: string, decimals?: string | number): string {
  const n = Number(raw);
  if (raw === '' || raw === null || raw === undefined || !isFinite(n)) { return raw; }
  const k = decimals === undefined || decimals === null || decimals === '' ? 1 : Math.floor(Number(decimals));
  const d = isFinite(k) ? Math.max(0, Math.min(8, k)) : 1;
  return n.toFixed(d);
}
