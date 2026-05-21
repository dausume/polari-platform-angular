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
 * Format a value in a given unit for compact display. Uses scientific
 * notation for very small / very large magnitudes; otherwise 4 sig figs.
 */
export function formatTimeValue(value: number, unitId: TimeUnitId): string {
  const def = BY_ID.get(unitId);
  const sym = def?.symbol ?? unitId;
  if (!isFinite(value)) return `? ${sym}`;
  const abs = Math.abs(value);
  if (abs === 0) return `0 ${sym}`;
  if (abs >= 10000 || abs < 0.01) return `${value.toExponential(2)} ${sym}`;
  return `${parseFloat(value.toPrecision(4))} ${sym}`;
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
