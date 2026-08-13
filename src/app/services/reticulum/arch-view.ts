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
