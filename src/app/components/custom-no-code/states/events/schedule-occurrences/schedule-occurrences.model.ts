// Author: Dustin Etts
// polari-platform-angular/src/app/components/custom-no-code/states/events/schedule-occurrences/schedule-occurrences.model.ts

import { ValueSourceConfig } from '../../_shared/value-source-config';

/**
 * ScheduleOccurrences (cal-2) — Expand a `schedule` value (recurrence JSON)
 * into its occurrences inside [from, to] — a list the ForEach loop walks.
 * Python backend only (rides python-dateutil rrule).
 */
export class ScheduleOccurrences {
  type = 'ScheduleOccurrences';
  displayName: string;
  /** Recurrence JSON (dict) or a value source resolving to one. */
  schedule: { [key: string]: any } | ValueSourceConfig | null;
  from: string;
  to: string;
  resultVariable: string;
  description: string;

  constructor(
    displayName: string = 'Schedule Occurrences',
    schedule: { [key: string]: any } | ValueSourceConfig | null = null,
    from: string = '',
    to: string = '',
    resultVariable: string = 'occurrences',
    description: string = 'Expand a schedule into occurrences inside [from, to]'
  ) {
    this.displayName = displayName;
    this.schedule = schedule;
    this.from = from;
    this.to = to;
    this.resultVariable = resultVariable;
    this.description = description;
  }
}
