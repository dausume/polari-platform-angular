// date-cell.component.ts
import { Component, Input } from '@angular/core';

@Component({
  standalone: true,
  selector: 'date-cell',
  templateUrl: `date-cell.html`,
  styleUrls: ['./date-cell.css']
})
export class DateCellComponent {
  @Input() value: any = '';
  @Input() columnName: string = '';
  @Input() type: string = 'date';
  @Input() editable: boolean = false;

  get isDuration(): boolean {
    const t = this.type?.toLowerCase();
    return t === 'date_duration' || t === 'dateduration'
        || t === 'datetime_duration' || t === 'datetimeduration';
  }

  get includesTime(): boolean {
    const t = this.type?.toLowerCase();
    return t === 'datetime' || t === 'datetime_duration' || t === 'datetimeduration';
  }

  get typeIcon(): string {
    if (this.isDuration) return this.includesTime ? '⏳' : '⏱';
    return this.includesTime ? '🕐' : '📅';
  }

  /**
   * Get display value for date/datetime/duration
   */
  getDisplayValue(): string {
    if (this.value === null || this.value === undefined) {
      return '-';
    }

    if (this.isDuration) {
      return this.formatDuration();
    }

    try {
      const date = new Date(this.value);
      if (isNaN(date.getTime())) {
        return String(this.value);
      }
      return this.includesTime
        ? date.toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
        : date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    } catch (error) {
      return String(this.value);
    }
  }

  /**
   * Get time component for datetime
   */
  getTimeValue(): string {
    if (!this.includesTime || this.isDuration) {
      return '';
    }
    try {
      const date = new Date(this.value);
      if (isNaN(date.getTime())) return '';
      return date.toLocaleTimeString();
    } catch (error) {
      return '';
    }
  }

  /**
   * Format a duration value for display.
   * Stored as JSON: { start: ISO string, end: ISO string }
   */
  private formatDuration(): string {
    let parsed = this.value;
    if (typeof parsed === 'string') {
      try { parsed = JSON.parse(parsed); }
      catch { return String(this.value); }
    }

    if (!parsed || typeof parsed !== 'object') {
      return String(this.value);
    }

    const startDate = parsed.start ? new Date(parsed.start) : null;
    const endDate = parsed.end ? new Date(parsed.end) : null;

    const validStart = startDate && !isNaN(startDate.getTime());
    const validEnd = endDate && !isNaN(endDate.getTime());

    if (!validStart && !validEnd) return '-';

    const fmt = (d: Date) => this.includesTime
      ? d.toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
      : d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });

    const startStr = validStart ? fmt(startDate!) : '?';
    const endStr = validEnd ? fmt(endDate!) : '?';
    const spanStr = (validStart && validEnd) ? ` (${DateCellComponent.humanizeDuration(startDate!, endDate!, this.includesTime)})` : '';

    return `${startStr}  →  ${endStr}${spanStr}`;
  }

  /**
   * Human-readable duration between two dates.
   */
  static humanizeDuration(start: Date, end: Date, includeTime: boolean): string {
    const diffMs = Math.abs(end.getTime() - start.getTime());
    const seconds = Math.floor(diffMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 365) {
      const years = Math.floor(days / 365);
      const remDays = days % 365;
      return remDays > 0 ? `${years}y ${remDays}d` : `${years}y`;
    }
    if (days > 0 && includeTime) {
      const remHours = hours % 24;
      return remHours > 0 ? `${days}d ${remHours}h` : `${days}d`;
    }
    if (days > 0) return `${days}d`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m`;
    return `${seconds}s`;
  }
}
