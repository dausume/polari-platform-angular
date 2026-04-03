/**
 * ScheduleDefinition.ts
 *
 * Defines the data model for the `schedule` field type.
 * A schedule describes a recurrence rule that generates temporal events.
 *
 * Events can be produced as any of the four temporal types:
 *   - 'date'              — all-day, single instant (e.g., "every Monday")
 *   - 'datetime'          — precise instant (e.g., "every Tuesday at 3 PM")
 *   - 'date_duration'     — all-day span (e.g., "every Mon–Fri")
 *   - 'datetime_duration' — precise span (e.g., "every weekday 9 AM – 5 PM")
 *
 * Storage: JSON-serialized TEXT column in SQLite.
 *
 * Example values:
 *
 *   Weekly Tuesday meeting at 3 PM:
 *   {
 *     eventType: 'datetime',
 *     frequency: 'weekly',
 *     interval: 1,
 *     byDay: ['TU'],
 *     startTime: '15:00',
 *     rangeStart: '2026-01-01',
 *     rangeEnd: '2026-12-31'
 *   }
 *
 *   First Tuesday of every month:
 *   {
 *     eventType: 'date',
 *     frequency: 'monthly',
 *     interval: 1,
 *     byDay: ['TU'],
 *     bySetPos: [1],
 *     rangeStart: '2026-01-01'
 *   }
 *
 *   Growth window — 12 weeks starting from a specific date:
 *   {
 *     eventType: 'date_duration',
 *     frequency: 'once',
 *     rangeStart: '2026-04-15',
 *     durationDays: 84
 *   }
 *
 *   Weekday work blocks, 9 AM – 5 PM:
 *   {
 *     eventType: 'datetime_duration',
 *     frequency: 'weekly',
 *     interval: 1,
 *     byDay: ['MO', 'TU', 'WE', 'TH', 'FR'],
 *     startTime: '09:00',
 *     endTime: '17:00',
 *     rangeStart: '2026-01-01',
 *     rangeEnd: '2026-06-30'
 *   }
 */

// ─── Types ──────────────────────────────────────────────────────────────────

/** The kind of temporal event this schedule produces. */
export type ScheduleEventType = 'date' | 'datetime' | 'date_duration' | 'datetime_duration';

/** Recurrence frequency. 'once' means a single occurrence (no repeat). */
export type ScheduleFrequency = 'once' | 'daily' | 'weekly' | 'monthly' | 'yearly';

/** ISO day-of-week abbreviations (RFC 5545 / iCalendar). */
export type DayOfWeek = 'MO' | 'TU' | 'WE' | 'TH' | 'FR' | 'SA' | 'SU';

// ─── Schedule Definition ────────────────────────────────────────────────────

export interface ScheduleDefinition {
  /** What kind of events this schedule generates. */
  eventType: ScheduleEventType;

  /** How often the event recurs. */
  frequency: ScheduleFrequency;

  /**
   * Repeat every N periods (e.g., interval=2 + frequency='weekly' = every 2 weeks).
   * Defaults to 1 if omitted.
   */
  interval?: number;

  // ─── Day / Position selectors ───────────────────────────────────────

  /**
   * Days of the week the event occurs on.
   * Used with 'weekly' and 'monthly' frequencies.
   * e.g., ['MO', 'WE', 'FR'] for Mon/Wed/Fri.
   */
  byDay?: DayOfWeek[];

  /**
   * Day(s) of the month (1–31) the event occurs on.
   * Used with 'monthly' frequency.
   * e.g., [1, 15] for 1st and 15th.
   */
  byMonthDay?: number[];

  /**
   * Month(s) of the year (1–12) the event occurs in.
   * Used with 'yearly' frequency.
   * e.g., [3, 9] for March and September.
   */
  byMonth?: number[];

  /**
   * Positional selector within the period, used with byDay.
   * e.g., byDay=['TU'], bySetPos=[1] → "1st Tuesday".
   * e.g., byDay=['FR'], bySetPos=[-1] → "last Friday".
   * Follows RFC 5545 BYSETPOS semantics.
   */
  bySetPos?: number[];

  // ─── Time of day (for datetime / datetime_duration) ─────────────────

  /**
   * Start time of day as "HH:MM" (24-hour).
   * Required when eventType is 'datetime' or 'datetime_duration'.
   */
  startTime?: string;

  /**
   * End time of day as "HH:MM" (24-hour).
   * Used when eventType is 'datetime_duration'.
   */
  endTime?: string;

  // ─── Duration (for date_duration / datetime_duration) ───────────────

  /**
   * Duration of each event in days (can be fractional for sub-day spans).
   * Used when eventType is 'date_duration' or 'datetime_duration'
   * and endTime is not set (or for multi-day durations).
   */
  durationDays?: number;

  // ─── Recurrence range ───────────────────────────────────────────────

  /**
   * Earliest date for generated events (ISO date string: YYYY-MM-DD).
   * Also serves as the anchor/start for 'once' frequency.
   */
  rangeStart?: string;

  /**
   * Latest date for generated events (ISO date string: YYYY-MM-DD).
   * If omitted, the schedule repeats indefinitely.
   */
  rangeEnd?: string;

  /**
   * Maximum number of event occurrences to generate.
   * If both rangeEnd and count are set, whichever limit is hit first applies.
   */
  count?: number;

  // ─── Exception dates ────────────────────────────────────────────────

  /**
   * Specific dates to exclude from the schedule (ISO date strings).
   * e.g., holidays or skip-days.
   */
  excludeDates?: string[];

  // ─── Display ────────────────────────────────────────────────────────

  /** Human-readable label for generated events (used in calendar view). */
  eventLabel?: string;

  /** Color override for calendar display. */
  eventColor?: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

export const DAY_OF_WEEK_LABELS: Record<DayOfWeek, string> = {
  'MO': 'Monday',
  'TU': 'Tuesday',
  'WE': 'Wednesday',
  'TH': 'Thursday',
  'FR': 'Friday',
  'SA': 'Saturday',
  'SU': 'Sunday'
};

export const DAY_OF_WEEK_SHORT: Record<DayOfWeek, string> = {
  'MO': 'Mon',
  'TU': 'Tue',
  'WE': 'Wed',
  'TH': 'Thu',
  'FR': 'Fri',
  'SA': 'Sat',
  'SU': 'Sun'
};

export const FREQUENCY_LABELS: Record<ScheduleFrequency, string> = {
  'once': 'Once',
  'daily': 'Daily',
  'weekly': 'Weekly',
  'monthly': 'Monthly',
  'yearly': 'Yearly'
};

export const EVENT_TYPE_LABELS: Record<ScheduleEventType, string> = {
  'date': 'Date (all day)',
  'datetime': 'Date & Time',
  'date_duration': 'Date Range (all day)',
  'datetime_duration': 'Date & Time Range'
};

export const ORDINAL_LABELS: Record<number, string> = {
  1: '1st', 2: '2nd', 3: '3rd', 4: '4th', 5: '5th',
  [-1]: 'Last', [-2]: '2nd to last'
};

/**
 * Build a human-readable summary of a schedule definition.
 */
export function summarizeSchedule(sched: ScheduleDefinition | null | undefined): string {
  if (!sched) return '-';

  const parts: string[] = [];

  // Frequency
  if (sched.frequency === 'once') {
    parts.push('Once');
    if (sched.rangeStart) parts.push(`on ${sched.rangeStart}`);
  } else {
    const interval = sched.interval && sched.interval > 1 ? `every ${sched.interval} ` : 'every ';
    const freqLabel = { daily: 'day', weekly: 'week', monthly: 'month', yearly: 'year' }[sched.frequency] || sched.frequency;
    const freqSuffix = (sched.interval && sched.interval > 1) ? `${freqLabel}s` : freqLabel;
    parts.push(`${interval}${freqSuffix}`);
  }

  // Days
  if (sched.byDay?.length) {
    const dayNames = sched.byDay.map(d => DAY_OF_WEEK_SHORT[d] || d);
    if (sched.bySetPos?.length) {
      const posLabels = sched.bySetPos.map(p => ORDINAL_LABELS[p] || `#${p}`);
      parts.push(`on the ${posLabels.join(', ')} ${dayNames.join(', ')}`);
    } else {
      parts.push(`on ${dayNames.join(', ')}`);
    }
  }

  if (sched.byMonthDay?.length) {
    parts.push(`on day ${sched.byMonthDay.join(', ')}`);
  }

  if (sched.byMonth?.length) {
    const monthNames = sched.byMonth.map(m => {
      const d = new Date(2000, m - 1, 1);
      return d.toLocaleString(undefined, { month: 'short' });
    });
    parts.push(`in ${monthNames.join(', ')}`);
  }

  // Time
  if (sched.startTime) {
    if (sched.endTime) {
      parts.push(`${sched.startTime} – ${sched.endTime}`);
    } else {
      parts.push(`at ${sched.startTime}`);
    }
  }

  // Duration
  if (sched.durationDays) {
    if (sched.durationDays >= 7 && sched.durationDays % 7 === 0) {
      const weeks = sched.durationDays / 7;
      parts.push(`for ${weeks} week${weeks > 1 ? 's' : ''}`);
    } else {
      parts.push(`for ${sched.durationDays} day${sched.durationDays > 1 ? 's' : ''}`);
    }
  }

  // Range
  if (sched.rangeStart && sched.frequency !== 'once') {
    parts.push(`from ${sched.rangeStart}`);
  }
  if (sched.rangeEnd) {
    parts.push(`until ${sched.rangeEnd}`);
  }
  if (sched.count) {
    parts.push(`(${sched.count} occurrences)`);
  }

  return parts.join(' ') || EVENT_TYPE_LABELS[sched.eventType] || 'Schedule';
}

/**
 * Parse a raw value (JSON string or object) into a ScheduleDefinition.
 */
export function parseSchedule(value: any): ScheduleDefinition | null {
  if (!value) return null;
  if (typeof value === 'string') {
    try { value = JSON.parse(value); } catch { return null; }
  }
  if (typeof value === 'object' && value.eventType && value.frequency) {
    return value as ScheduleDefinition;
  }
  return null;
}

/**
 * Create a default/empty schedule definition.
 */
export function createDefaultSchedule(): ScheduleDefinition {
  return {
    eventType: 'datetime',
    frequency: 'weekly',
    interval: 1,
    byDay: [],
    startTime: '09:00'
  };
}
