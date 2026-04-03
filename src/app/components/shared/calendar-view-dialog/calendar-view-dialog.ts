// calendar-view-dialog.ts
// Popup calendar view for date-time and date-time-duration fields.
// Uses FullCalendar (MIT) for month/week/day/list views.

import { Component, Inject, OnInit, OnDestroy } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { CalendarOptions, EventInput, EventClickArg } from '@fullcalendar/core';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import listPlugin from '@fullcalendar/list';
import interactionPlugin from '@fullcalendar/interaction';

// ─── Dialog Data ────────────────────────────────────────────────────────────

export interface CalendarViewDialogData {
  /** Title shown in the dialog header */
  title?: string;
  /** The field name being viewed */
  fieldName?: string;
  /**
   * Events to display. Each entry represents a date-time or duration.
   * For single date-times: only `start` is set.
   * For durations: both `start` and `end` are set.
   */
  events: CalendarEventEntry[];
  /** Initial calendar view: 'month' | 'week' | 'day' | 'list' */
  initialView?: 'month' | 'week' | 'day' | 'list';
  /** Initial date to center the calendar on (ISO string or Date) */
  initialDate?: string | Date;
  /** Whether events have time components (false = all-day display) */
  includeTime?: boolean;
}

export interface CalendarEventEntry {
  /** Unique identifier for this event */
  id?: string;
  /** Display title on the calendar */
  title: string;
  /** Start date/datetime (ISO 8601) */
  start: string;
  /** End date/datetime (ISO 8601). Omit for single date-time instants. */
  end?: string;
  /** Optional color override */
  color?: string;
  /** Arbitrary metadata attached to this event */
  meta?: any;
}

export interface CalendarViewDialogResult {
  action: 'close' | 'select';
  /** The event the user clicked on, if any */
  selectedEvent?: CalendarEventEntry;
}

// ─── Component ──────────────────────────────────────────────────────────────

@Component({
  standalone: false,
  selector: 'calendar-view-dialog',
  templateUrl: 'calendar-view-dialog.html',
  styleUrls: ['./calendar-view-dialog.css']
})
export class CalendarViewDialogComponent implements OnInit, OnDestroy {

  calendarOptions: CalendarOptions = {};
  selectedEvent: CalendarEventEntry | null = null;
  eventCount = 0;
  durationCount = 0;
  instantCount = 0;

  private viewMap: Record<string, string> = {
    'month': 'dayGridMonth',
    'week':  'timeGridWeek',
    'day':   'timeGridDay',
    'list':  'listMonth'
  };

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: CalendarViewDialogData,
    private dialogRef: MatDialogRef<CalendarViewDialogComponent>
  ) {}

  ngOnInit(): void {
    const events = this.buildEvents(this.data.events || []);
    this.eventCount = events.length;
    this.durationCount = (this.data.events || []).filter(e => e.end).length;
    this.instantCount = this.eventCount - this.durationCount;

    const includeTime = this.data.includeTime !== false;
    const initialView = this.viewMap[this.data.initialView || 'month'] || 'dayGridMonth';

    this.calendarOptions = {
      plugins: [dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin],
      initialView,
      initialDate: this.data.initialDate || this.guessInitialDate(events),
      headerToolbar: {
        left: 'prev,next today',
        center: 'title',
        right: 'dayGridMonth,timeGridWeek,timeGridDay,listMonth'
      },
      buttonText: {
        today: 'Today',
        month: 'Month',
        week: 'Week',
        day: 'Day',
        list: 'List'
      },
      events,
      editable: false,
      selectable: false,
      eventClick: this.onEventClick.bind(this),
      height: 'auto',
      // All-day display for date-only (no time) events
      ...(includeTime ? {} : { eventDisplay: 'block' }),
      // Style tweaks
      dayMaxEvents: 4,
      eventTimeFormat: {
        hour: '2-digit',
        minute: '2-digit',
        meridiem: 'short'
      }
    };
  }

  ngOnDestroy(): void {
    // Cleanup if needed
  }

  get dialogTitle(): string {
    return this.data.title || this.data.fieldName || 'Calendar View';
  }

  // ─── Event Building ─────────────────────────────────────────────────

  private buildEvents(entries: CalendarEventEntry[]): EventInput[] {
    return entries.map((entry, i) => {
      const isDuration = !!entry.end;
      const hasTime = this.data.includeTime !== false;

      const ev: EventInput = {
        id: entry.id || String(i),
        title: entry.title,
        start: entry.start,
        allDay: !hasTime,
        extendedProps: { _entry: entry }
      };

      if (isDuration) {
        ev.end = entry.end;
        ev.color = entry.color || '#ad1457'; // Duration color
      } else {
        ev.color = entry.color || '#5c6bc0'; // Instant color
      }

      return ev;
    });
  }

  private guessInitialDate(events: EventInput[]): string | undefined {
    if (events.length === 0) return undefined;
    // Use the earliest event start
    const starts = events
      .map(e => e.start)
      .filter(Boolean)
      .map(s => new Date(s as string).getTime())
      .filter(t => !isNaN(t));
    if (starts.length === 0) return undefined;
    return new Date(Math.min(...starts)).toISOString();
  }

  // ─── Interaction ──────────────────────────────────────────────────────

  onEventClick(info: EventClickArg): void {
    const entry = info.event.extendedProps['_entry'] as CalendarEventEntry;
    this.selectedEvent = entry || null;
  }

  clearSelection(): void {
    this.selectedEvent = null;
  }

  selectAndClose(): void {
    if (this.selectedEvent) {
      this.dialogRef.close({
        action: 'select',
        selectedEvent: this.selectedEvent
      } as CalendarViewDialogResult);
    }
  }

  onClose(): void {
    this.dialogRef.close({ action: 'close' } as CalendarViewDialogResult);
  }

  // ─── Detail Formatting ────────────────────────────────────────────────

  formatEventDate(iso: string): string {
    if (!iso) return '-';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return this.data.includeTime !== false
      ? d.toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
      : d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  }

  get selectedDurationLabel(): string {
    if (!this.selectedEvent?.start || !this.selectedEvent?.end) return '';
    const s = new Date(this.selectedEvent.start);
    const e = new Date(this.selectedEvent.end);
    if (isNaN(s.getTime()) || isNaN(e.getTime())) return '';
    return this.humanizeDuration(s, e);
  }

  private humanizeDuration(start: Date, end: Date): string {
    const diffMs = Math.abs(end.getTime() - start.getTime());
    const seconds = Math.floor(diffMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 365) {
      const years = Math.floor(days / 365);
      const rem = days % 365;
      return rem > 0 ? `${years}y ${rem}d` : `${years}y`;
    }
    if (days > 0) {
      const rem = hours % 24;
      return rem > 0 ? `${days}d ${rem}h` : `${days}d`;
    }
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m`;
    return `${seconds}s`;
  }
}
