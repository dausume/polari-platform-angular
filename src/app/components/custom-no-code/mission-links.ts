/**
 * mis-0 - the links on a Hardware Mission drawing. Each Purpose the Mission needs is ONE state (MissionPurposeState); the
 * state carries a link (`links[0].route`, `/display/hardware-solutions?solution=purpose-<name>`) into that Purpose's own
 * drawing. The canvas shows one link per Purpose under the toolbar; following it selects that Purpose's drawing.
 */
export interface MissionPurposeLink {
  /** the card's own title, e.g. "Required: Polari can control the light" */
  label: string;
  /** the Purpose's solution name, e.g. purpose-ensure-polari-can-control-light */
  solution: string;
}

export function missionPurposeLinks(states: any[] | null | undefined): MissionPurposeLink[] {
  const out: MissionPurposeLink[] = [];
  for (const s of states || []) {
    if ((s?.stateClass || s?.boundObjectClass) !== 'MissionPurposeState') continue;
    const f = s.boundObjectFieldValues || {};
    const route = String(f.links?.[0]?.route || f.detail_ref?.route || '');
    const hit = /[?&]solution=([^&]+)/.exec(route);
    if (!hit) continue;
    out.push({ label: String(f.displayName || f.purpose_name || s.stateName), solution: decodeURIComponent(hit[1]) });
  }
  return out;
}
