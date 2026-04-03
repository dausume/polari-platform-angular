// editable-time-cell.ts
import { Component, Input } from '@angular/core';
import { BaseEditableCell } from '../base-editable-cell';

@Component({
  standalone: false,
  selector: 'editable-time-cell',
  templateUrl: 'editable-time-cell.html',
  styleUrls: ['./editable-time-cell.css']
})
export class EditableTimeCellComponent extends BaseEditableCell {
  @Input() isDuration: boolean = false;
  @Input() use24Hour: boolean = true;

  getDisplayValue(): string {
    if (this.value === null || this.value === undefined || this.value === '') return '-';

    if (this.isDuration) {
      return this.formatDurationDisplay();
    }

    if (typeof this.value === 'string' && this.value.includes(':')) {
      return this.formatTime(this.value);
    }
    return String(this.value);
  }

  private formatTime(hhmm: string): string {
    const [h, m] = hhmm.split(':').map(Number);
    if (isNaN(h) || isNaN(m)) return hhmm;
    if (this.use24Hour) return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
  }

  private formatDurationDisplay(): string {
    let parsed = this.control.value || this.value;
    if (typeof parsed === 'string') {
      try { parsed = JSON.parse(parsed); } catch { return String(this.value); }
    }
    if (!parsed || typeof parsed !== 'object') return String(this.value);

    const startStr = parsed.start ? this.formatTime(parsed.start) : '?';
    const endStr = parsed.end ? this.formatTime(parsed.end) : '?';
    return `${startStr}  →  ${endStr}`;
  }

  // ─── Single time ──────────────────────────────────────────────────────

  onTimeChange(timeStr: string | null): void {
    this.control.setValue(timeStr);
    this.valueChange.emit(timeStr);
  }

  // ─── Duration ─────────────────────────────────────────────────────────

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

  get durationStartValue(): string | null {
    return this.parseDuration().start;
  }

  get durationEndValue(): string | null {
    return this.parseDuration().end;
  }

  onDurationStartChange(timeStr: string | null): void {
    const dur = this.parseDuration();
    dur.start = timeStr;
    this.emitDuration(dur);
  }

  onDurationEndChange(timeStr: string | null): void {
    const dur = this.parseDuration();
    dur.end = timeStr;
    this.emitDuration(dur);
  }

  clearTime(): void {
    if (this.isDuration) {
      this.emitDuration({ start: null, end: null });
    } else {
      this.control.setValue(null);
      this.valueChange.emit(null);
    }
  }
}
