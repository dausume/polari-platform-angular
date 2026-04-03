// editable-date-cell.ts
import { Component, Input } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { BaseEditableCell } from '../base-editable-cell';
import { DateCellComponent } from '../../../../components/templateClassTable/type-cells/date-cell/date-cell';
import {
  CalendarViewDialogComponent,
  CalendarViewDialogData,
  CalendarEventEntry
} from '../../calendar-view-dialog/calendar-view-dialog';

@Component({
  standalone: false,
  selector: 'editable-date-cell',
  templateUrl: 'editable-date-cell.html',
  styleUrls: ['./editable-date-cell.css']
})
export class EditableDateCellComponent extends BaseEditableCell {
  @Input() includeTime: boolean = false;
  @Input() isDuration: boolean = false;
  @Input() dateFormat: string = 'short';
  @Input() minDate: Date | null = null;
  @Input() maxDate: Date | null = null;

  constructor(private dialog: MatDialog) {
    super();
  }

  getDisplayValue(): string {
    if (this.value === null || this.value === undefined || this.value === '') {
      return '-';
    }

    if (this.isDuration) {
      return this.formatDurationDisplay();
    }

    try {
      const date = new Date(this.value);
      if (isNaN(date.getTime())) {
        return String(this.value);
      }

      if (this.includeTime) {
        return date.toLocaleString(undefined, {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
      } else {
        return date.toLocaleDateString(undefined, {
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        });
      }
    } catch (e) {
      return String(this.value);
    }
  }

  /**
   * Format duration display value
   */
  private formatDurationDisplay(): string {
    let parsed = this.control.value || this.value;
    if (typeof parsed === 'string') {
      try { parsed = JSON.parse(parsed); }
      catch { return String(this.value); }
    }
    if (!parsed || typeof parsed !== 'object') return String(this.value);

    const startDate = parsed.start ? new Date(parsed.start) : null;
    const endDate = parsed.end ? new Date(parsed.end) : null;
    const validStart = startDate && !isNaN(startDate.getTime());
    const validEnd = endDate && !isNaN(endDate.getTime());

    if (!validStart && !validEnd) return '-';

    const fmt = (d: Date) => this.includeTime
      ? d.toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
      : d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });

    const startStr = validStart ? fmt(startDate!) : '?';
    const endStr = validEnd ? fmt(endDate!) : '?';
    const spanStr = (validStart && validEnd)
      ? ` (${DateCellComponent.humanizeDuration(startDate!, endDate!, this.includeTime)})`
      : '';

    return `${startStr}  →  ${endStr}${spanStr}`;
  }

  // ─── Single Date Handling ─────────────────────────────────────────────

  /**
   * Get the date value for the datepicker
   */
  get dateValue(): Date | null {
    if (!this.control.value) return null;
    const date = new Date(this.control.value);
    return isNaN(date.getTime()) ? null : date;
  }

  /**
   * Handle date selection
   */
  onDateChange(event: any): void {
    const date = event.value;
    if (date) {
      if (this.includeTime && this.control.value) {
        const oldDate = new Date(this.control.value);
        if (!isNaN(oldDate.getTime())) {
          date.setHours(oldDate.getHours());
          date.setMinutes(oldDate.getMinutes());
          date.setSeconds(oldDate.getSeconds());
        }
      }
      this.control.setValue(date.toISOString());
      this.valueChange.emit(date.toISOString());
    } else {
      this.control.setValue(null);
      this.valueChange.emit(null);
    }
  }

  /**
   * Handle time change (when includeTime is true)
   */
  onTimeChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const [hours, minutes] = input.value.split(':').map(Number);

    if (this.dateValue) {
      const newDate = new Date(this.dateValue);
      newDate.setHours(hours || 0);
      newDate.setMinutes(minutes || 0);
      this.control.setValue(newDate.toISOString());
      this.valueChange.emit(newDate.toISOString());
    }
  }

  /**
   * Get time string for time input
   */
  get timeString(): string {
    if (!this.dateValue) return '';
    const hours = this.dateValue.getHours().toString().padStart(2, '0');
    const minutes = this.dateValue.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  /**
   * Clear the date
   */
  clearDate(): void {
    this.control.setValue(null);
    this.valueChange.emit(null);
  }

  // ─── Segmented Input Handlers ─────────────────────────────────────────

  /**
   * Handle segmented date change — receives ISO string from segmented-date-input.
   * Preserves time component if includeTime is true.
   */
  onSegmentedDateChange(iso: string | null): void {
    if (!iso) {
      this.control.setValue(null);
      this.valueChange.emit(null);
      return;
    }
    if (this.includeTime && this.dateValue) {
      // Preserve existing time
      const newDate = new Date(iso);
      newDate.setUTCHours(this.dateValue.getUTCHours());
      newDate.setUTCMinutes(this.dateValue.getUTCMinutes());
      this.control.setValue(newDate.toISOString());
      this.valueChange.emit(newDate.toISOString());
    } else {
      this.control.setValue(iso);
      this.valueChange.emit(iso);
    }
  }

  /**
   * Handle segmented time change — receives "HH:MM" string.
   */
  onSegmentedTimeChange(hhmm: string | null): void {
    if (!this.dateValue || !hhmm) return;
    const [hours, minutes] = hhmm.split(':').map(Number);
    const newDate = new Date(this.dateValue);
    newDate.setHours(hours || 0);
    newDate.setMinutes(minutes || 0);
    this.control.setValue(newDate.toISOString());
    this.valueChange.emit(newDate.toISOString());
  }

  // ─── Duration Handling ────────────────────────────────────────────────

  /**
   * Parse the current control value as a duration object
   */
  private parseDuration(): { start: string | null; end: string | null } {
    let parsed = this.control.value;
    if (typeof parsed === 'string') {
      try { parsed = JSON.parse(parsed); } catch { parsed = null; }
    }
    if (parsed && typeof parsed === 'object') {
      return { start: parsed.start || null, end: parsed.end || null };
    }
    return { start: null, end: null };
  }

  private emitDuration(dur: { start: string | null; end: string | null }): void {
    const val = JSON.stringify(dur);
    this.control.setValue(val);
    this.valueChange.emit(val);
  }

  get durationStartValue(): Date | null {
    const dur = this.parseDuration();
    if (!dur.start) return null;
    const d = new Date(dur.start);
    return isNaN(d.getTime()) ? null : d;
  }

  get durationEndValue(): Date | null {
    const dur = this.parseDuration();
    if (!dur.end) return null;
    const d = new Date(dur.end);
    return isNaN(d.getTime()) ? null : d;
  }

  get durationStartTimeString(): string {
    const d = this.durationStartValue;
    if (!d) return '';
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  }

  get durationEndTimeString(): string {
    const d = this.durationEndValue;
    if (!d) return '';
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  }

  get durationSpanLabel(): string {
    const s = this.durationStartValue;
    const e = this.durationEndValue;
    if (!s || !e) return '';
    return DateCellComponent.humanizeDuration(s, e, this.includeTime);
  }

  onDurationStartChange(event: any): void {
    const date = event.value as Date;
    const dur = this.parseDuration();
    if (date) {
      if (this.includeTime && dur.start) {
        const old = new Date(dur.start);
        if (!isNaN(old.getTime())) {
          date.setHours(old.getHours());
          date.setMinutes(old.getMinutes());
        }
      }
      dur.start = date.toISOString();
    } else {
      dur.start = null;
    }
    this.emitDuration(dur);
  }

  onDurationEndChange(event: any): void {
    const date = event.value as Date;
    const dur = this.parseDuration();
    if (date) {
      if (this.includeTime && dur.end) {
        const old = new Date(dur.end);
        if (!isNaN(old.getTime())) {
          date.setHours(old.getHours());
          date.setMinutes(old.getMinutes());
        }
      }
      dur.end = date.toISOString();
    } else {
      dur.end = null;
    }
    this.emitDuration(dur);
  }

  onDurationStartTimeChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const [hours, minutes] = input.value.split(':').map(Number);
    const dur = this.parseDuration();
    const d = this.durationStartValue;
    if (d) {
      const newDate = new Date(d);
      newDate.setHours(hours || 0);
      newDate.setMinutes(minutes || 0);
      dur.start = newDate.toISOString();
      this.emitDuration(dur);
    }
  }

  onDurationEndTimeChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const [hours, minutes] = input.value.split(':').map(Number);
    const dur = this.parseDuration();
    const d = this.durationEndValue;
    if (d) {
      const newDate = new Date(d);
      newDate.setHours(hours || 0);
      newDate.setMinutes(minutes || 0);
      dur.end = newDate.toISOString();
      this.emitDuration(dur);
    }
  }

  clearDuration(): void {
    this.emitDuration({ start: null, end: null });
  }

  // ─── Duration Segmented Handlers ──────────────────────────────────────

  get durationStartISO(): string | null {
    return this.parseDuration().start;
  }

  get durationEndISO(): string | null {
    return this.parseDuration().end;
  }

  onDurationStartDateChange(iso: string | null): void {
    const dur = this.parseDuration();
    if (!iso) { dur.start = null; this.emitDuration(dur); return; }
    if (this.includeTime && dur.start) {
      const old = new Date(dur.start);
      const newD = new Date(iso);
      if (!isNaN(old.getTime())) {
        newD.setUTCHours(old.getUTCHours());
        newD.setUTCMinutes(old.getUTCMinutes());
      }
      dur.start = newD.toISOString();
    } else {
      dur.start = iso;
    }
    this.emitDuration(dur);
  }

  onDurationEndDateChange(iso: string | null): void {
    const dur = this.parseDuration();
    if (!iso) { dur.end = null; this.emitDuration(dur); return; }
    if (this.includeTime && dur.end) {
      const old = new Date(dur.end);
      const newD = new Date(iso);
      if (!isNaN(old.getTime())) {
        newD.setUTCHours(old.getUTCHours());
        newD.setUTCMinutes(old.getUTCMinutes());
      }
      dur.end = newD.toISOString();
    } else {
      dur.end = iso;
    }
    this.emitDuration(dur);
  }

  onDurationStartSegmentedTimeChange(hhmm: string | null): void {
    if (!hhmm) return;
    const dur = this.parseDuration();
    const d = this.durationStartValue;
    if (d) {
      const [hours, minutes] = hhmm.split(':').map(Number);
      const newDate = new Date(d);
      newDate.setHours(hours || 0);
      newDate.setMinutes(minutes || 0);
      dur.start = newDate.toISOString();
      this.emitDuration(dur);
    }
  }

  onDurationEndSegmentedTimeChange(hhmm: string | null): void {
    if (!hhmm) return;
    const dur = this.parseDuration();
    const d = this.durationEndValue;
    if (d) {
      const [hours, minutes] = hhmm.split(':').map(Number);
      const newDate = new Date(d);
      newDate.setHours(hours || 0);
      newDate.setMinutes(minutes || 0);
      dur.end = newDate.toISOString();
      this.emitDuration(dur);
    }
  }

  // ─── Calendar View Popup ──────────────────────────────────────────────

  openCalendarView(): void {
    const events: CalendarEventEntry[] = [];

    if (this.isDuration) {
      const dur = this.parseDuration();
      if (dur.start || dur.end) {
        events.push({
          title: this.displayName || this.fieldName || 'Duration',
          start: dur.start || dur.end!,
          end: dur.end || undefined
        });
      }
    } else if (this.value) {
      const d = new Date(this.value);
      if (!isNaN(d.getTime())) {
        events.push({
          title: this.displayName || this.fieldName || 'Date',
          start: d.toISOString()
        });
      }
    }

    if (events.length === 0) return;

    const dialogData: CalendarViewDialogData = {
      title: this.displayName || this.fieldName || 'Calendar',
      fieldName: this.fieldName,
      events,
      includeTime: this.includeTime,
      initialView: this.isDuration ? 'month' : 'day',
      initialDate: events[0].start
    };

    this.dialog.open(CalendarViewDialogComponent, {
      data: dialogData,
      width: '850px',
      maxHeight: '90vh'
    });
  }
}
