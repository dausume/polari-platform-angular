// time-cell.ts — Read-only time / time-duration display cell
import { Component, Input } from '@angular/core';

@Component({
  standalone: true,
  selector: 'time-cell',
  templateUrl: 'time-cell.html',
  styleUrls: ['./time-cell.css']
})
export class TimeCellComponent {
  @Input() value: any = '';
  @Input() columnName: string = '';
  @Input() type: string = 'time';

  get isDuration(): boolean {
    const t = this.type?.toLowerCase();
    return t === 'time_duration' || t === 'timeduration';
  }

  get typeIcon(): string {
    return this.isDuration ? '🕑' : '🕐';
  }

  getDisplayValue(): string {
    if (this.value === null || this.value === undefined || this.value === '') return '-';

    if (this.isDuration) {
      return this.formatTimeDuration();
    }

    // Single time value: "HH:MM" string
    if (typeof this.value === 'string' && this.value.includes(':')) {
      return this.formatTime(this.value);
    }
    return String(this.value);
  }

  private formatTime(hhmm: string): string {
    const [h, m] = hhmm.split(':').map(Number);
    if (isNaN(h) || isNaN(m)) return hhmm;
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
  }

  private formatTimeDuration(): string {
    let parsed = this.value;
    if (typeof parsed === 'string') {
      try { parsed = JSON.parse(parsed); } catch { return String(this.value); }
    }
    if (!parsed || typeof parsed !== 'object') return String(this.value);

    const startStr = parsed.start ? this.formatTime(parsed.start) : '?';
    const endStr = parsed.end ? this.formatTime(parsed.end) : '?';
    let span = '';

    if (parsed.start && parsed.end) {
      const [sh, sm] = parsed.start.split(':').map(Number);
      const [eh, em] = parsed.end.split(':').map(Number);
      if (!isNaN(sh) && !isNaN(sm) && !isNaN(eh) && !isNaN(em)) {
        let diffMin = (eh * 60 + em) - (sh * 60 + sm);
        if (diffMin < 0) diffMin += 24 * 60; // wrap past midnight
        const hrs = Math.floor(diffMin / 60);
        const mins = diffMin % 60;
        span = hrs > 0
          ? (mins > 0 ? ` (${hrs}h ${mins}m)` : ` (${hrs}h)`)
          : ` (${mins}m)`;
      }
    }

    return `${startStr}  →  ${endStr}${span}`;
  }
}
