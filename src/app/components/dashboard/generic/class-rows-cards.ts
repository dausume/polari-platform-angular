/**
 * wb-1: the pure half of the generic display kinds `cards`, `picker-button` and `steps` (WORKBENCH_WALKTHROUGH_PLAN D-wb-1).
 * Each is a REGISTERED COMPONENT, so a page seed emits a display item  {type:'component', componentProps:{componentName, inputs:{...}}}.
 * The page substitutes `{scope:key}` in every string of `inputs`, NESTED objects and arrays included (display-page `substituteObject`).
 *
 * `cards`  (componentName 'cards') - inputs = CardsConfig:
 *   { "dataPath": "/api/board/bench-options/boards?bench={scope:bench}&rev=r{scope:rev}",   // door answering {ok, rows} (or a bare array)
 *     "title_field": "title", "subtitle_field": "chip",
 *     "badge_fields": ["family", "testing"],                                                // each value a chip
 *     "fields": {"On hand": "on_hand", "Rail power": "rail_power"},                         // label -> row field, shown as label/value rows
 *     "group_by": "kind",                                                                   // optional: a heading per distinct value
 *     "facets": [{"label": "Architecture", "query_param": "arch",
 *                 "options": [{"label": "RISC-V", "value": "riscv"}, {"label": "Not RISC-V", "value": "other"}]}],
 *     "action": {"label": "Add", "method": "POST", "path": "/api/board/benches/{scope:bench}/boards",
 *                "body_template": {"board": "{board}"}, "then_scope": {"key": "x", "from": "y"}},   // RowActionConfig, one per card
 *     "empty_text": "Nothing matches." }
 *   Selecting a facet option re-queries the door with `?query_param=value`; selecting it again clears it (click-toggle rule).
 *   A value of -1 or 'unverified' shows as the word "unverified" (dimmed), never as a number. `facets`/`action` are optional.
 *
 * `picker-button` (componentName 'picker-button') - inputs: { "label": "Breadboards", "title": "Pick breadboards", "popup": <CardsConfig> }
 *   A button that opens a MatDialog holding that `cards` config plus a Close button. The card action runs inside the modal, bumps page
 *   scope `rev` (so the tables behind reload) and the modal stays open so several cards can be added in a row.
 *
 * `steps` (componentName 'steps') - inputs: { "steps": [{"label": "Name the bench",
 *       "done_when": {"scope_key": "{scope:bench}", "op": "set"},                           // set: value non-empty
 *       "target": "breadboards"},                                                           // optional tab key to open on click
 *     {"label": "Breadboards", "done_when": {"scope_key": "{scope:bench_breadboards}", "op": "gte", "value": 1}, "target": "breadboards"}] }
 *   `scope_key` is written as the placeholder `{scope:<key>}` so the page hands the component the CURRENT scope value (steps has no
 *   network of its own). op 'gte': Number(value) >= `value`. The first step not done is current; the rest are todo; steps are not locked.
 */
import { RowActionConfig } from './class-rows-action';

export interface CardFacetOption { label: string; value: string; }
export interface CardFacet { label: string; query_param: string; options: CardFacetOption[]; }

export interface CardsConfig {
  dataPath: string;
  title_field?: string;
  subtitle_field?: string;
  badge_fields?: string[];
  fields?: Record<string, string>;
  group_by?: string;
  facets?: CardFacet[];
  action?: RowActionConfig;
  empty_text?: string;
}

export interface StepConfig {
  label: string;
  done_when: { scope_key: string; op: 'set' | 'gte'; value?: number };
  target?: string;
}

export type StepState = 'done' | 'current' | 'todo';

/** True for the honest-gap values: -1 (number or text), 'unverified', or nothing at all. */
export function isUnverified(v: unknown): boolean {
  if (v === null || v === undefined || v === '') { return true; }
  if (typeof v === 'number') { return v === -1; }
  const t = String(v).trim().toLowerCase();
  return t === '-1' || t === 'unverified';
}

/** What a card shows for a value: lists joined, booleans as yes/no, unverified as the word, else the text. */
export function cardText(v: unknown): string {
  if (isUnverified(v)) { return 'unverified'; }
  if (Array.isArray(v)) { return v.map((x) => cardText(x)).join(', '); }
  if (typeof v === 'boolean') { return v ? 'yes' : 'no'; }
  if (typeof v === 'object') { return JSON.stringify(v); }
  return String(v);
}

/** The door URL with the selected facet params appended (`?a=b` or `&a=b`), values URL-encoded. */
export function withFacetParams(path: string, selected: Record<string, string>): string {
  const parts = Object.keys(selected).filter((k) => selected[k] !== '')
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(selected[k])}`);
  if (!parts.length) { return path; }
  return path + (path.includes('?') ? '&' : '?') + parts.join('&');
}

/** The selection after a click: the value, or cleared when it was already selected (click-toggle rule). */
export function toggleFacet(selected: Record<string, string>, param: string, value: string): Record<string, string> {
  const next = { ...selected };
  if (next[param] === value) { delete next[param]; } else { next[param] = value; }
  return next;
}

/** Rows in groups by a field's value, first-seen order; no `group_by` = one group with no heading. A blank value groups as 'other'. */
export function groupRows(rows: any[], groupBy?: string): { heading: string; rows: any[] }[] {
  if (!groupBy) { return [{ heading: '', rows }]; }
  const order: string[] = [];
  const map: Record<string, any[]> = {};
  rows.forEach((r) => {
    const raw = r?.[groupBy];
    const h = raw === null || raw === undefined || raw === '' ? 'other' : String(raw);
    if (!map[h]) { map[h] = []; order.push(h); }
    map[h].push(r);
  });
  return order.map((h) => ({ heading: h, rows: map[h] }));
}

/** Each step's state from the (page-substituted) scope values: done by its op, the first not-done step current, the rest todo. */
export function stepStates(steps: StepConfig[]): StepState[] {
  let currentSeen = false;
  return (steps || []).map((s) => {
    const raw = s?.done_when?.scope_key ?? '';
    const done = s?.done_when?.op === 'gte'
      ? raw !== '' && Number.isFinite(Number(raw)) && Number(raw) >= Number(s.done_when.value ?? 0)
      : String(raw).trim() !== '';
    if (done) { return 'done'; }
    if (!currentSeen) { currentSeen = true; return 'current'; }
    return 'todo';
  });
}
