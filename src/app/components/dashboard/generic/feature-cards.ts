/**
 * cb-2 (AI-Notes/plans/COMPONENT_BINDING_PLAN.md §4, §6): the pure half of `feature-cards-table` - one HardwareFeature per row, one card
 * per element. A page seed configures the columns (polari-framework modules/hwnocode/schematic_page.py FEATURE_COLUMNS):
 *   { key, label, kind: 'fields' | 'schematic', source_key, required, fields?: {label: field}, ref_field? }
 * `source_key` is the HardwareFeature column whose state the card shows: chosen (in the row's `chosen` csv: a person picked it and it
 * is held), suggested (filled, not chosen: a solver may change it) or open (empty). The completeness words mirror
 * hwnocode.custom.feature_columns.state on the server; the server's reader is the reference.
 */

export interface FeatureColumn {
  key: string; label: string; kind: 'fields' | 'schematic'; source_key: string; required?: boolean;
  fields?: Record<string, string>; ref_field?: string;
}

export type Source = 'chosen' | 'suggested' | 'open';

export function chosenSet(feature: any): Set<string> {
  return new Set(String(feature?.chosen || '').split(',').map((s) => s.trim()).filter((s) => !!s));
}

export function sourceOf(feature: any, key: string): Source {
  const v = String(feature?.[key] ?? '').trim();
  if (!v) { return 'open'; }
  return chosenSet(feature).has(key) ? 'chosen' : 'suggested';
}

export interface FeatureState { missing: string[]; schematic: string; complete: boolean; words: string; }

/** The bound component's state: 'none' (nothing bound), 'missing' (it names no component that exists), else its solve_state. */
export function schematicStateOf(feature: any, columns: FeatureColumn[], components: any[]): string {
  const col = columns.find((c) => c.kind === 'schematic');
  const name = col ? String(feature?.[col.ref_field || col.source_key] || '').trim() : '';
  if (!name) { return 'none'; }
  const comp = (components || []).find((c) => c?.name === name);
  return comp ? (comp.solve_state || 'unsolved') : 'missing';
}

export function featureState(feature: any, columns: FeatureColumn[], components: any[]): FeatureState {
  const missing = columns.filter((c) => c.required && sourceOf(feature, c.source_key) === 'open').map((c) => c.label);
  const schematic = schematicStateOf(feature, columns, components);
  const complete = !missing.length && schematic === 'solved';
  if (complete) { return { missing, schematic, complete, words: 'complete: every required element is filled and its schematic component is solved' }; }
  const parts: string[] = [];
  if (missing.length) { parts.push('open: ' + missing.join(', ')); }
  if (schematic !== 'solved' && schematic !== 'none') { parts.push(`its schematic component is ${schematic}`); }
  return { missing, schematic, complete, words: 'not complete - ' + parts.join('; ') };
}

/** The CRUDE envelope's rows for one class: [{<Class>: [{data: [...]}]}] (the shape instance-detail-panel reads). */
export function crudeRows(envelope: any, className: string): any[] {
  return envelope?.[0]?.[className]?.[0]?.data ?? [];
}
