/**
 * @cross-cutting
 * @tags @xc:render-shared, @xc:bindings
 * @consumers
 *   - SimSpaceBinding (when channels include a 'time' or 'step' role)
 *   - Future timeline scrubber UI
 *   - Future animation/playback engine
 *   - Graphs (when consolidation lands, log/time axes consume the same units)
 * @impact-on-edit
 *   Conversion factors are physical constants — DO NOT edit numerically
 *   without source citation in the JSDoc. Adding a unit is safe; removing
 *   one is a breaking change for any saved binding that referenced it.
 * @see /OVERLAP_MAP.md
 *
 * Scientific time-unit catalog with conversion factors to seconds.
 *
 * The base unit is the SI second. Every value is `factor_to_seconds` —
 * to convert N units to seconds: `n * factor`. To convert seconds to
 * unit U: `seconds / U.factor`.
 *
 * Coverage:
 *   - Planck time at the small end (smallest physically meaningful)
 *   - yocto/zepto/atto/femto/pico/nano/micro/milli SI prefixes
 *   - second (base)
 *   - minute, hour, day, week, fortnight (calendar)
 *   - month (avg), year (Julian), century, millennium (long-scale)
 *
 * Astronomical/geological units (kyr, Myr, Gyr) live as multiples of
 * year — not separate entries — to keep the catalog focused on what a
 * binding-tab dropdown would reasonably surface.
 */

export type TimeUnitId =
  | 'planck'
  | 'yoctosecond' | 'zeptosecond' | 'attosecond'
  | 'femtosecond' | 'picosecond' | 'nanosecond'
  | 'microsecond' | 'millisecond'
  | 'second'
  | 'minute' | 'hour' | 'day' | 'week' | 'fortnight'
  | 'month' | 'year' | 'decade' | 'century' | 'millennium'
  | 'step';   // dimensionless — simulation tick index

export interface TimeUnitDef {
  id: TimeUnitId;
  label: string;
  symbol: string;
  /**
   * Factor to convert this unit → seconds.
   * For the 'step' pseudo-unit this is `null` because steps are
   * dimensionless; conversion to seconds requires a per-binding
   * `secondsPerStep` mapping.
   */
  factorToSeconds: number | null;
  /**
   * Grouping for UI dropdowns. 'physics' = sub-second SI prefixes;
   * 'human' = calendar units; 'simulation' = step/tick.
   */
  group: 'physics' | 'si' | 'human' | 'astronomical' | 'simulation';
}

/**
 * The catalog. Ordered roughly small → large so dropdowns rendered
 * straight from this list are scientifically intuitive.
 *
 * Planck time: 5.391247×10⁻⁴⁴ s — currently the smallest physically
 * meaningful interval. Source: CODATA 2018.
 */
export const TIME_UNITS: TimeUnitDef[] = [
  { id: 'planck',       label: 'Planck time',   symbol: 't_P', factorToSeconds: 5.391247e-44, group: 'physics' },
  { id: 'yoctosecond',  label: 'Yoctosecond',   symbol: 'ys',  factorToSeconds: 1e-24,        group: 'si' },
  { id: 'zeptosecond',  label: 'Zeptosecond',   symbol: 'zs',  factorToSeconds: 1e-21,        group: 'si' },
  { id: 'attosecond',   label: 'Attosecond',    symbol: 'as',  factorToSeconds: 1e-18,        group: 'si' },
  { id: 'femtosecond',  label: 'Femtosecond',   symbol: 'fs',  factorToSeconds: 1e-15,        group: 'si' },
  { id: 'picosecond',   label: 'Picosecond',    symbol: 'ps',  factorToSeconds: 1e-12,        group: 'si' },
  { id: 'nanosecond',   label: 'Nanosecond',    symbol: 'ns',  factorToSeconds: 1e-9,         group: 'si' },
  { id: 'microsecond',  label: 'Microsecond',   symbol: 'µs',  factorToSeconds: 1e-6,         group: 'si' },
  { id: 'millisecond',  label: 'Millisecond',   symbol: 'ms',  factorToSeconds: 1e-3,         group: 'si' },
  { id: 'second',       label: 'Second',        symbol: 's',   factorToSeconds: 1,            group: 'si' },
  { id: 'minute',       label: 'Minute',        symbol: 'min', factorToSeconds: 60,           group: 'human' },
  { id: 'hour',         label: 'Hour',          symbol: 'h',   factorToSeconds: 3600,         group: 'human' },
  { id: 'day',          label: 'Day',           symbol: 'd',   factorToSeconds: 86400,        group: 'human' },
  { id: 'week',         label: 'Week',          symbol: 'wk',  factorToSeconds: 604800,       group: 'human' },
  { id: 'fortnight',    label: 'Fortnight',     symbol: 'fn',  factorToSeconds: 1209600,      group: 'human' },
  // Month: 30.4375 d average (Gregorian — 365.25/12).
  { id: 'month',        label: 'Month (avg.)',  symbol: 'mo',  factorToSeconds: 2629800,      group: 'human' },
  // Year: 365.25 d (Julian — standard for astronomy).
  { id: 'year',         label: 'Year (Julian)', symbol: 'yr',  factorToSeconds: 31557600,     group: 'astronomical' },
  { id: 'decade',       label: 'Decade',        symbol: 'dec', factorToSeconds: 315576000,    group: 'astronomical' },
  { id: 'century',      label: 'Century',       symbol: 'c',   factorToSeconds: 3155760000,   group: 'astronomical' },
  { id: 'millennium',   label: 'Millennium',    symbol: 'ka',  factorToSeconds: 31557600000,  group: 'astronomical' },
  // Simulation step — dimensionless by default.
  { id: 'step',         label: 'Simulation step', symbol: 'step', factorToSeconds: null,      group: 'simulation' },
];

const BY_ID = new Map(TIME_UNITS.map(u => [u.id, u]));

export function getTimeUnit(id: TimeUnitId): TimeUnitDef | undefined {
  return BY_ID.get(id);
}

/**
 * Convert a value from one time unit to another. Throws if either unit
 * is 'step' without a `secondsPerStep` override — steps don't have a
 * universal conversion to time.
 */
export function convertTime(
  value: number,
  from: TimeUnitId,
  to: TimeUnitId,
  secondsPerStep?: number
): number {
  if (from === to) return value;
  const fromDef = BY_ID.get(from);
  const toDef = BY_ID.get(to);
  if (!fromDef || !toDef) {
    throw new Error(`Unknown time unit: ${from} or ${to}`);
  }
  // Resolve factor — handle 'step' via secondsPerStep.
  const factor = (def: TimeUnitDef): number => {
    if (def.factorToSeconds !== null) return def.factorToSeconds;
    if (secondsPerStep === undefined) {
      throw new Error(
        `Cannot convert '${def.id}' without a secondsPerStep mapping; ` +
        `simulation steps are dimensionless unless a binding declares one.`
      );
    }
    return secondsPerStep;
  };
  return (value * factor(fromDef)) / factor(toDef);
}

/**
 * How time values are rendered in compact displays.
 *
 *   'flexible'   — auto-pick the SI prefix that brings the value into
 *                  [1, 1000): `0.001 s → 1 ms`, `0.000001 s → 1 µs`,
 *                  `1500 s → 1.5 ks` etc. Falls back to scientific only
 *                  when the value exceeds the yocto…yotta SI range.
 *   'scientific' — keep the displayed unit, fall back to Unicode
 *                  scientific notation (`1.00 × 10⁻³ s`) when |v| < 1e-6
 *                  or |v| >= 1e6 (i.e. more than 6 digits past the
 *                  decimal or 6+ integer digits).
 *
 * 'flexible' is the default. Scrubber + viewer surface the toggle.
 */
export type TimeDisplayMode = 'flexible' | 'scientific';

/** Threshold for falling into scientific notation — values that need
 *  more than 3 digits either side of the decimal point. */
const SCI_LOW = 1e-3;
const SCI_HIGH = 1e3;

/** SI prefixes the 'flexible' mode rotates through. Ordered by
 *  factor-to-seconds so we can pick the prefix whose factor brings the
 *  value into [1, 1000). */
const SI_PREFIX_UNITS: TimeUnitId[] = [
  'yoctosecond', 'zeptosecond', 'attosecond', 'femtosecond',
  'picosecond', 'nanosecond', 'microsecond', 'millisecond',
  'second',
];

/**
 * Format a value in a given unit for compact display. See
 * `TimeDisplayMode` for the two policies; default is 'flexible'.
 */
export function formatTimeValue(
  value: number,
  unitId: TimeUnitId,
  mode: TimeDisplayMode = 'flexible',
): string {
  const def = BY_ID.get(unitId);
  const baseSym = def?.symbol ?? unitId;
  if (!isFinite(value)) return `? ${baseSym}`;
  if (value === 0) return `0 ${baseSym}`;

  if (mode === 'flexible' && def?.factorToSeconds != null) {
    const picked = pickReadableSiPrefix(value * def.factorToSeconds);
    if (picked) {
      const converted = (value * def.factorToSeconds) / picked.factorToSeconds!;
      return formatInUnit(converted, picked.symbol);
    }
    // Value sits outside the yocto…second SI prefix range — let
    // scientific notation handle it on the base unit.
  }
  return formatInUnit(value, baseSym);
}

/**
 * Pick the SI-prefixed unit whose magnitude lands the value in
 * [1, 1000). Returns null when no SI prefix covers the value (extreme
 * magnitudes outside yocto…second).
 */
function pickReadableSiPrefix(seconds: number): TimeUnitDef | null {
  const abs = Math.abs(seconds);
  // Walk from smallest prefix to largest. Last unit whose factor is
  // <= |seconds| wins — that's the one that produces a coefficient >= 1.
  let best: TimeUnitDef | null = null;
  for (const id of SI_PREFIX_UNITS) {
    const u = BY_ID.get(id);
    if (!u || u.factorToSeconds == null) continue;
    if (u.factorToSeconds <= abs) best = u;
    else break;
  }
  // Below yocto — scientific notation territory; let caller fall through.
  if (best === null) return null;
  // Above second — let scientific handle it (calendar units aren't SI
  // prefixes and aren't what the user asked us to default to).
  return best;
}

function formatInUnit(value: number, sym: string): string {
  const abs = Math.abs(value);
  if (abs === 0) return `0 ${sym}`;
  if (abs >= SCI_HIGH || abs < SCI_LOW) {
    return `${prettyScientific(value)} ${sym}`;
  }
  return `${parseFloat(value.toPrecision(4))} ${sym}`;
}

/**
 * Render a number in scientific notation using Unicode superscripts so
 * it reads as physics rather than JS — `1.00 × 10⁻³` instead of `1.00e-3`.
 */
function prettyScientific(value: number): string {
  const [mantissa, expRaw] = value.toExponential(2).split('e');
  const exp = parseInt(expRaw, 10);
  if (exp === 0) return mantissa;
  return `${mantissa} × 10${superscript(exp)}`;
}

const SUPERSCRIPT_DIGITS: Record<string, string> = {
  '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
  '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
  '-': '⁻', '+': '⁺',
};

function superscript(n: number): string {
  return String(n).split('').map(c => SUPERSCRIPT_DIGITS[c] ?? c).join('');
}

/**
 * Pick a "human-friendly" unit for a given second value — e.g. 0.0015
 * seconds is more readable as "1.5 ms". Used by the future scrubber's
 * default display.
 */
export function pickReadableUnit(seconds: number): TimeUnitId {
  const abs = Math.abs(seconds);
  if (abs >= 31557600) return 'year';
  if (abs >= 86400)    return 'day';
  if (abs >= 3600)     return 'hour';
  if (abs >= 60)       return 'minute';
  if (abs >= 1)        return 'second';
  if (abs >= 1e-3)     return 'millisecond';
  if (abs >= 1e-6)     return 'microsecond';
  if (abs >= 1e-9)     return 'nanosecond';
  if (abs >= 1e-12)    return 'picosecond';
  if (abs >= 1e-15)    return 'femtosecond';
  if (abs >= 1e-18)    return 'attosecond';
  if (abs >= 1e-21)    return 'zeptosecond';
  if (abs >= 1e-24)    return 'yoctosecond';
  return 'planck';
}
