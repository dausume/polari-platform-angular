/**
 * fsc-3: the pure half of class-rows-table's ROW INTERACTION options (all optional, configured in the page seed - see
 * module_pages_seed `_table`): a clickable row that sets a page-scope key, and a row that opens a page tab. Unit-tested alone
 * (class-rows-interaction.spec.ts).
 */

/** True when a path still has a query parameter with an empty value (`…&solution=&profile=x`): a scope nothing has picked yet. */
export function hasBlankParam(path: string): boolean {
  const q = (path || '').split('?')[1];
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

/** True when the click came from a link or button INSIDE the row (a ref chip, a more/less toggle): the row itself must not react. */
export function clickIsOnControl(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  return !!el && typeof el.closest === 'function' && !!el.closest('a, button');
}
