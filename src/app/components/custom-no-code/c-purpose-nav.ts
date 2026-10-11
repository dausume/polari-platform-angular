/**
 * ucd-hdr4 (his words 2026-10-11: "maybe it would make more sense for the graph to be the same or equivalent to the
 * solution (and so it is fixed) and then the purpose is able to be chosen via dropdown, and the atom is chosen based on
 * what is in the purpose"). The pure model behind the C command group's two dropdowns — Purpose and Atom. Standalone
 * (no component, no HTTP) so it specs without mounting CustomNoCodeComponent. A Purpose answers "why this is in this
 * firmware"; enforcement is ADVISED, never blocking (his ruling 2026-10-11).
 */
export interface CPurposeRow { name: string; title: string; task_names: string[]; }
export interface CNavNode { instance: string; kind: string; }

/** the kind of a node that is a real, hand-authored C atom — glue-generated kinds (class/parser/frame/tick/rule) are not. */
export const REAL_ATOM_KIND = 'c-atom';

/** '' = "All purposes". The node-instance subset a Purpose pick draws; null = everything. An unknown name draws everything. */
export function purposeSubset(purposes: CPurposeRow[], purpose: string): Set<string> | null {
  if (!purpose) { return null; }
  const p = purposes.find(x => x.name === purpose);
  return p ? new Set(p.task_names) : null;
}

/** The Atom dropdown's options: the real atoms of the chosen Purpose, or all real atoms when "All purposes". */
export function atomOptions(nodes: CNavNode[], purposes: CPurposeRow[], purpose: string): string[] {
  const subset = purposeSubset(purposes, purpose);
  return nodes
    .filter(n => n.kind === REAL_ATOM_KIND && (!subset || subset.has(n.instance)))
    .map(n => n.instance);
}

/** Real atoms that NO Purpose names — the red advice (glue kinds never counted). */
export function atomsWithoutPurpose(nodes: CNavNode[], purposes: CPurposeRow[]): string[] {
  const named = new Set(purposes.flatMap(p => p.task_names));
  return nodes.filter(n => n.kind === REAL_ATOM_KIND && !named.has(n.instance)).map(n => n.instance);
}

/** The Purpose a Composed-by deep link lands on: an explicit ?purpose= that exists, else the first Purpose naming the
 *  node, else '' (All purposes). */
export function presetPurpose(purposes: CPurposeRow[], urlPurpose: string | null, node: string): string {
  if (urlPurpose && purposes.some(p => p.name === urlPurpose)) { return urlPurpose; }
  if (node) {
    const hit = purposes.find(p => p.task_names.includes(node));
    if (hit) { return hit.name; }
  }
  return '';
}

/** Purpose option text; a Purpose whose graph has no Firmware Solution carries the red advice in its text. */
export function purposeOptionLabel(p: CPurposeRow, graphHasFirmware: boolean): string {
  return graphHasFirmware ? p.name : `${p.name} (no firmware solution)`;
}

/** The header's one-line summary. */
export function purposeSummary(shown: number, total: number, purpose: string, unnamed: number): string {
  let s = `${purpose ? 'Purpose ' + purpose : 'All purposes'} · ${shown} of ${total} atoms`;
  if (unnamed > 0) { s += ` · ${unnamed} atom${unnamed === 1 ? '' : 's'} without a Purpose`; }
  return s;
}

export const NO_PURPOSE_TITLE = 'no Purpose names this atom — add it to one';
