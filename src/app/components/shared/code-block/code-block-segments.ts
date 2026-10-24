/** aut-1: pure helpers that colour a C line's identifiers by kind. Only identifiers the `/code` door returned
 *  are matched (whole-word), so there is no word list in the frontend. */
export interface CodeIdentifier { name: string; kind: string; why?: string; value?: string; }
export interface CodeSegment { text: string; kind?: string; why?: string; }
export interface LegendChip { kind: string; label: string; count: number; }

export const KIND_ORDER = ['pin-macro', 'register', 'knob', 'global', 'library'];
export const KIND_LABEL: Record<string, string> = {
  'pin-macro': 'pin macro', register: 'register', knob: 'build knob', global: 'global', library: 'library call',
};

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Split `text` into plain and identifier segments. Whole-word only; the longest name wins at a position. */
export function segmentLine(text: string, identifiers: CodeIdentifier[] | null | undefined): CodeSegment[] {
  const ids = (identifiers || []).filter((i) => i && i.name);
  if (!ids.length || !text) { return [{ text }]; }
  const byName = new Map<string, CodeIdentifier>();
  ids.forEach((i) => { if (!byName.has(i.name)) { byName.set(i.name, i); } });
  const names = [...byName.keys()].sort((a, b) => b.length - a.length).map(escapeRe);
  const re = new RegExp(`(?<![A-Za-z0-9_])(?:${names.join('|')})(?![A-Za-z0-9_])`, 'g');
  const out: CodeSegment[] = [];
  let last = 0;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    if (m.index > last) { out.push({ text: text.slice(last, m.index) }); }
    const id = byName.get(m[0])!;
    out.push({ text: m[0], kind: id.kind, why: id.why });
    last = m.index + m[0].length;
  }
  if (last < text.length) { out.push({ text: text.slice(last) }); }
  return out.length ? out : [{ text }];
}

/** One chip per kind present, in the fixed order; unknown kinds follow, alphabetically. */
export function legendChips(identifiers: CodeIdentifier[] | null | undefined): LegendChip[] {
  const counts = new Map<string, number>();
  (identifiers || []).forEach((i) => { if (i?.kind) { counts.set(i.kind, (counts.get(i.kind) || 0) + 1); } });
  const known = KIND_ORDER.filter((k) => counts.has(k));
  const extra = [...counts.keys()].filter((k) => !KIND_ORDER.includes(k)).sort();
  return [...known, ...extra].map((k) => ({ kind: k, label: KIND_LABEL[k] || k, count: counts.get(k)! }));
}
