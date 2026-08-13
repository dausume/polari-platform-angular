/**
 * ret-1b: pure view rules for the .arch topology page — the
 * meeting-xr idiom: everything a spec can pin without a DOM.
 *
 * The honesty rules live HERE so the template cannot fudge them:
 * a null capacity renders as unknown (never 0, never a guess), a
 * device that cannot transmit never earns a TX badge, and stale
 * measurements say how stale they are.
 */

export type VerdictState = 'fits' | 'oversubscribed' | 'idle' | 'unknown';

/** Tone class for the demand-vs-capacity verdict: 'oversubscribed'
 *  is the loud one; 'unknown' must read as a question, not a calm. */
export function verdictTone(state: string | undefined): string {
  switch (state) {
    case 'fits': return 'tone-ok';
    case 'oversubscribed': return 'tone-error';
    case 'idle': return 'tone-quiet';
    default: return 'tone-unknown';
  }
}

/** Demand as a % of capacity for the bar. Null when capacity is
 *  unknown — the bar is NOT drawn then (a bar with an invented
 *  denominator is a lie), and >100% clamps with the overflow said
 *  in text instead. */
export function demandPercent(
  demand: number | null | undefined,
  capacity: number | null | undefined,
): number | null {
  if (capacity == null || capacity <= 0) { return null; }
  return Math.min(100, Math.round(((demand ?? 0) / capacity) * 100));
}

/** Human bytes-per-minute. Null/undefined is a dash — absence of a
 *  fact is not zero. */
export function formatBytesPerMin(n: number | null | undefined): string {
  if (n == null) { return '—'; }
  if (n >= 1_000_000) { return `${(n / 1_000_000).toFixed(1)} MB/min`; }
  if (n >= 1_000) { return `${(n / 1_000).toFixed(1)} kB/min`; }
  return `${n} B/min`;
}

export function formatBps(n: number | null | undefined): string {
  if (n == null) { return '—'; }
  if (n >= 1_000_000) { return `${(n / 1_000_000).toFixed(1)} Mbps`; }
  if (n >= 1_000) { return `${(n / 1_000).toFixed(1)} kbps`; }
  return `${n} bps`;
}

/** What kind of radio a chip label shows. HAM is a regulatory fact,
 *  not a bearer, so 'amateur' domain wins the label — a 915 ISM LoRa
 *  stick and an amateur-band link are different things to an
 *  operator even when the silicon matches. */
export function deviceKindLabel(
  bearer: string | undefined,
  regulatoryDomain: string | undefined,
): string {
  if (regulatoryDomain === 'amateur') { return 'HAM'; }
  switch (bearer) {
    case 'rnode-lora': return 'LoRa';
    case 'lorawan': return 'LoRaWAN';
    case 'wifi': return 'WiFi';
    case 'wifi-halow': return 'HaLow';
    case 'serial-kiss': return 'KISS';
    case 'tcp': return 'TCP';
    case 'udp': return 'UDP';
    case 'ethernet': return 'Ethernet';
    default: return bearer || 'unknown';
  }
}

/** A device that cannot transmit never shows a TX affordance —
 *  honest UI, not a missing feature (§5i). */
export function directionBadge(direction: string | undefined): string {
  switch (direction) {
    case 'rx': return 'RX only';
    case 'tx': return 'TX only';
    case 'both': return 'RX + TX';
    default: return 'direction unknown';
  }
}

export function offersTransmit(direction: string | undefined): boolean {
  return direction === 'tx' || direction === 'both';
}

/** '(fresh)' or '(measured 12 min ago)' — a stale number must say
 *  its age wherever it appears. */
export function freshnessLabel(
  fresh: boolean | undefined,
  measuredAtMs: number | null | undefined,
  nowMs: number,
): string {
  if (fresh) { return 'fresh'; }
  if (!measuredAtMs) { return 'never measured'; }
  const minutes = Math.round((nowMs - measuredAtMs) / 60_000);
  return `measured ${minutes} min ago — stale`;
}

/* ---- ret-1d peers panel rules -------------------------------------- */

/** Short form of an identity/destination hash for chips; the full
 *  hash rides the title attr. Empty is a dash, never ''. */
export function truncateHash(hash: string | undefined | null): string {
  if (!hash) { return '—'; }
  return hash.length <= 10 ? hash : `${hash.slice(0, 10)}…`;
}

/** 'just now' / '3 min ago' / '2 h ago' — sighting ages. Zero or
 *  missing timestamps say 'never', not 'now'. */
export function agoLabel(
  ms: number | undefined | null,
  nowMs: number,
): string {
  if (!ms) { return 'never'; }
  const deltaMin = Math.round((nowMs - ms) / 60_000);
  if (deltaMin < 1) { return 'just now'; }
  if (deltaMin < 60) { return `${deltaMin} min ago`; }
  return `${Math.round(deltaMin / 6) / 10} h ago`;
}

/** Peer field access across the two spellings (persisted rows are
 *  snake_case, live sidecar entries camelCase) — the template never
 *  guesses which it got. */
export function peerField(
  entry: Record<string, unknown>,
  snake: string,
  camel: string,
): unknown {
  return entry[snake] ?? entry[camel];
}

/** heard_via is a comma-joined interface list; live entries may
 *  carry a single 'interface'. */
export function heardViaList(
  entry: { heard_via?: string; interface?: string },
): string[] {
  const joined = entry.heard_via ?? entry.interface ?? '';
  return joined ? joined.split(',').filter((s) => !!s) : [];
}

/* ---- ret-1e planner panel rules ------------------------------------ */

/** The planner's relay verdict maps onto the same tones as the isle
 *  verdict: fits calm, oversubscribed loud, absent unknown. */
export function plannerVerdictTone(
  fits: boolean | undefined,
): string {
  if (fits === true) { return 'tone-ok'; }
  if (fits === false) { return 'tone-error'; }
  return 'tone-unknown';
}

/** Range fidelity badge text: 'declared' came from a vendor,
 *  'derived-flat' from link-budget math on the flat-terrain
 *  assumption — the difference is exactly what the disclaimer is
 *  about, so the badge spells it out. */
export function rangeFidelityLabel(
  fidelity: string | undefined,
): string {
  switch (fidelity) {
    case 'declared': return 'vendor-declared';
    case 'derived-flat': return 'derived (flat-terrain assumption)';
    case 'measured': return 'measured';
    case 'unknown': return 'unknown — not guessed';
    default: return fidelity || 'unstated';
  }
}

/** Human meters: 850 m / 12.4 km. */
export function formatMeters(m: number | null | undefined): string {
  if (m == null) { return '—'; }
  if (m >= 1000) { return `${(m / 1000).toFixed(1)} km`; }
  return `${Math.round(m)} m`;
}

/** The form takes km² (human), the backend takes m². */
export function km2ToM2(km2: number | null | undefined): number {
  if (!km2 || km2 < 0) { return 0; }
  return km2 * 1_000_000;
}
