/**
 * fsc-3: the pure half of class-rows-table's EDIT and ROW-ACTION options (configured in the page seed - see module_pages_seed `_table`).
 * Unit-tested alone (class-rows-action.spec.ts).
 *
 *   editAction / rowAction: { method?, path, body_template?, then_scope?: {key, from}, label?, show_when_field? }
 *
 * Templating: in the path and in the body (keys AND values) `{field}` is that field of the row. A body value that is exactly `"{value}"`
 * becomes the edited number itself (not text). A body value that is exactly one `"{field}"` keeps that field's own TYPE (a boolean stays a
 * boolean: `{"led_on": "{led_on}"}` sends false, not "false" - the demo's light button needs it). In the path a filled field is URL-encoded;
 * a placeholder inside longer text is inserted as text.
 */

export interface RowActionConfig {
  method?: string;
  path: string;
  body_template?: any;
  /** After the call, set page scope `key` to the response field `from`. */
  then_scope?: { key: string; from: string };
  /** rowAction only: the button text. */
  label?: string;
  /** rowAction only: the row field that must be truthy for the button to show. */
  show_when_field?: string;
}

function rowText(row: any, field: string): string {
  const v = row?.[field];
  return v === null || v === undefined ? '' : String(v);
}

/** Every `{field}` in a string, replaced by the row's field (optionally URL-encoded). */
function fillString(text: string, row: any, encode: boolean): string {
  return text.replace(/\{([A-Za-z0-9_]+)\}/g, (_m, f) => (encode ? encodeURIComponent(rowText(row, f)) : rowText(row, f)));
}

/** A body template filled from the row; `"{value}"` (exactly) becomes `value`. Objects, arrays, keys and values are all templated. */
export function fillBody(node: any, row: any, value?: number): any {
  if (typeof node === 'string') {
    if (node === '{value}') { return value; }
    const whole = /^\{([A-Za-z0-9_]+)\}$/.exec(node);
    if (whole) { const v = row?.[whole[1]]; return v === undefined ? '' : v; }
    return fillString(node, row, false);
  }
  if (Array.isArray(node)) { return node.map((n) => fillBody(n, row, value)); }
  if (node && typeof node === 'object') {
    const out: Record<string, any> = {};
    Object.keys(node).forEach((k) => { out[fillString(k, row, false)] = fillBody(node[k], row, value); });
    return out;
  }
  return node;
}

/** The action's path with the row's fields URL-encoded into it. */
export function fillPath(path: string, row: any): string {
  return fillString(path || '', row, true);
}

/** A number typed into an edit box, or null when it is not a usable number >= 0 (empty, text, negative, NaN, infinite). */
export function parseWeight(text: string): number | null {
  const t = (text ?? '').trim();
  if (!t) { return null; }
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** True when a row may be edited: no enabling field configured, or that field is truthy on the row. */
export function rowEditable(row: any, enabledField: string): boolean {
  if (!enabledField) { return true; }
  const v = row?.[enabledField];
  return v === true || v === 'true' || (typeof v === 'number' && v !== 0) || (typeof v === 'string' && v !== '' && v !== 'false');
}

/** True when a row's action button shows (no `show_when_field`, or that field is truthy). */
export function actionShown(row: any, action: RowActionConfig | null | undefined): boolean {
  return !!action && rowEditable(row, action.show_when_field || '');
}

/** The words for a refused or failed call: the door's own `error` text, else a plain fallback. */
export function failureWords(err: any): string {
  const body = err?.error;
  if (body && typeof body === 'object' && typeof body.error === 'string' && body.error) { return body.error; }
  if (typeof body === 'string' && body) { return body.slice(0, 200); }
  return 'The change could not be saved.';
}

/** The words when a call answered 200 but says it failed (`ok: false`, `success: false`, or a solution run whose summary status is
 *  errored/failed), else ''. */
export function actionRefusal(res: any): string {
  if (!res || typeof res !== 'object') { return ''; }
  const status = res.displaySummary?.status;
  if (res.ok === false || res.success === false || status === 'errored' || status === 'failed') {
    const steps: any[] = res.trace?.steps || [];
    const bad = steps.find((x: any) => x?.status === 'errored');
    return (bad?.executionError || res.error || res.refused || 'The action did not complete.') as string;
  }
  return '';
}
