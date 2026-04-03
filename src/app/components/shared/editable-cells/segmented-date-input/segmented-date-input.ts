/**
 * segmented-date-input.ts
 *
 * A custom inline date input with three editable segments: MM / DD / YYYY.
 * Each segment is independently focusable with up/down spinners and hold-to-accelerate.
 * Includes a calendar picker toggle for visual date selection.
 */
import {
  Component, Input, Output, EventEmitter, ElementRef,
  ViewChild, OnChanges, SimpleChanges, OnDestroy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { createHoldAccelerator } from '../hold-accelerator';

export interface DateSegments {
  month: number;
  day: number;
  year: number;
}

@Component({
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatIconModule,
    MatDatepickerModule, MatNativeDateModule,
    MatFormFieldModule, MatInputModule
  ],
  selector: 'segmented-date-input',
  templateUrl: 'segmented-date-input.html',
  styleUrls: ['./segmented-date-input.css']
})
export class SegmentedDateInputComponent implements OnChanges, OnDestroy {
  @Input() value: string | null = null;     // ISO date string or null
  @Input() disabled: boolean = false;
  @Input() placeholder: string = 'MM/DD/YYYY';
  @Output() valueChange = new EventEmitter<string | null>();

  @ViewChild('monthInput') monthInput!: ElementRef<HTMLInputElement>;
  @ViewChild('dayInput') dayInput!: ElementRef<HTMLInputElement>;
  @ViewChild('yearInput') yearInput!: ElementRef<HTMLInputElement>;

  month: string = '';
  day: string = '';
  year: string = '';
  activeSegment: 'month' | 'day' | 'year' | null = null;

  /** Prevents feedback loop: don't re-parse while we are the source of the change. */
  private emitting = false;
  private accelerators: { stop: () => void }[] = [];

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['value'] && !this.emitting) {
      this.parseFromISO(this.value);
    }
  }

  ngOnDestroy(): void {
    this.stopAllAccelerators();
  }

  // ─── Calendar picker ─────────────────────────────────────────────────

  /** Value for the hidden MatDatepicker (synced with segments). */
  get calendarDate(): Date | null {
    const m = parseInt(this.month, 10);
    const d = parseInt(this.day, 10);
    const y = parseInt(this.year, 10);
    if (isNaN(m) || isNaN(d) || isNaN(y) || m < 1 || d < 1 || y < 1) return null;
    return new Date(y, m - 1, d);
  }

  onCalendarDateChange(event: any): void {
    const date: Date | null = event.value;
    if (!date || isNaN(date.getTime())) return;
    this.month = String(date.getMonth() + 1).padStart(2, '0');
    this.day = String(date.getDate()).padStart(2, '0');
    this.year = String(date.getFullYear()).padStart(4, '0');
    this.emitValue();
  }

  // ─── Parsing / Emitting ──────────────────────────────────────────────

  private parseFromISO(iso: string | null): void {
    if (!iso) {
      this.month = ''; this.day = ''; this.year = '';
      return;
    }
    // Parse as UTC to avoid timezone day-shift
    const d = new Date(iso);
    if (isNaN(d.getTime())) {
      this.month = ''; this.day = ''; this.year = '';
      return;
    }
    this.month = String(d.getUTCMonth() + 1).padStart(2, '0');
    this.day = String(d.getUTCDate()).padStart(2, '0');
    this.year = String(d.getUTCFullYear()).padStart(4, '0');
  }

  private emitValue(): void {
    const m = parseInt(this.month, 10);
    const d = parseInt(this.day, 10);
    const y = parseInt(this.year, 10);

    if (isNaN(m) || isNaN(d) || isNaN(y) || m < 1 || d < 1 || y < 1) {
      this.emitting = true;
      this.valueChange.emit(null);
      this.emitting = false;
      return;
    }

    // Clamp day to actual max for this month/year to prevent Date rollover
    const maxDay = new Date(y, m, 0).getDate(); // day 0 of next month = last day of this month
    const clampedDay = Math.min(d, maxDay);

    const date = new Date(Date.UTC(y, m - 1, clampedDay));
    if (isNaN(date.getTime())) {
      this.emitting = true;
      this.valueChange.emit(null);
      this.emitting = false;
      return;
    }
    this.emitting = true;
    this.valueChange.emit(date.toISOString());
    this.emitting = false;
  }

  get isEmpty(): boolean {
    return !this.month && !this.day && !this.year;
  }

  // ─── Segment Focus ───────────────────────────────────────────────────

  onSegmentFocus(segment: 'month' | 'day' | 'year', input: HTMLInputElement): void {
    this.activeSegment = segment;
    setTimeout(() => input.select(), 0);
  }

  onSegmentBlur(segment: 'month' | 'day' | 'year'): void {
    if (this.activeSegment === segment) {
      this.activeSegment = null;
    }
    this.padSegment(segment);
    this.clampSegment(segment);
    this.emitValue();
  }

  // ─── Keyboard ────────────────────────────────────────────────────────

  onKeydown(event: KeyboardEvent, segment: 'month' | 'day' | 'year'): void {
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.incrementSegment(segment, 1);
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.incrementSegment(segment, -1);
    } else if (event.key === 'ArrowRight' || (event.key === 'Tab' && !event.shiftKey)) {
      const next = this.nextSegment(segment);
      if (next && event.key === 'ArrowRight') {
        event.preventDefault();
        this.focusSegment(next);
      }
    } else if (event.key === 'ArrowLeft' || (event.key === 'Tab' && event.shiftKey)) {
      const prev = this.prevSegment(segment);
      if (prev && event.key === 'ArrowLeft') {
        event.preventDefault();
        this.focusSegment(prev);
      }
    } else if (event.key === 'Backspace' || event.key === 'Delete') {
      // Let default behavior handle deletion
    } else if (event.key.length === 1 && !/\d/.test(event.key)) {
      event.preventDefault();
    }
  }

  onInput(segment: 'month' | 'day' | 'year'): void {
    const maxLen = segment === 'year' ? 4 : 2;
    let val = this[segment].replace(/\D/g, '');
    if (val.length > maxLen) val = val.slice(0, maxLen);
    this[segment] = val;

    // Auto-advance when segment is full
    if (val.length >= maxLen) {
      this.clampSegment(segment);
      this.padSegment(segment);
      const next = this.nextSegment(segment);
      if (next) {
        this.focusSegment(next);
      } else {
        this.emitValue();
      }
    }
  }

  // ─── Increment / Spinners ───────────────────────────────────────────

  incrementSegment(segment: 'month' | 'day' | 'year', step: number): void {
    let val = parseInt(this[segment], 10) || 0;
    val += step;

    if (segment === 'month') {
      val = ((val - 1 + 12) % 12) + 1; // wrap 1-12
    } else if (segment === 'day') {
      val = ((val - 1 + 31) % 31) + 1;  // wrap 1-31
    } else {
      val = Math.max(1, val);
    }

    this[segment] = segment === 'year'
      ? String(val).padStart(4, '0')
      : String(val).padStart(2, '0');
    this.emitValue();
  }

  startSpinner(segment: 'month' | 'day' | 'year', direction: 1 | -1): void {
    if (this.disabled) return;
    this.focusSegment(segment);
    const fastStep = segment === 'year' ? 10 : segment === 'day' ? 5 : 1;
    const acc = createHoldAccelerator(
      (step) => this.incrementSegment(segment, direction * step),
      { baseStep: 1, fastStep }
    );
    this.accelerators.push(acc);
    acc.start();
  }

  stopSpinner(): void {
    this.stopAllAccelerators();
  }

  private stopAllAccelerators(): void {
    this.accelerators.forEach(a => a.stop());
    this.accelerators = [];
  }

  // ─── Helpers ─────────────────────────────────────────────────────────

  private padSegment(segment: 'month' | 'day' | 'year'): void {
    const val = this[segment];
    if (!val) return;
    const maxLen = segment === 'year' ? 4 : 2;
    this[segment] = val.padStart(maxLen, '0');
  }

  private clampSegment(segment: 'month' | 'day' | 'year'): void {
    let val = parseInt(this[segment], 10);
    if (isNaN(val)) return;
    if (segment === 'month') val = Math.min(12, Math.max(1, val));
    else if (segment === 'day') val = Math.min(31, Math.max(1, val));
    else val = Math.max(1, val);
    this[segment] = segment === 'year'
      ? String(val).padStart(4, '0')
      : String(val).padStart(2, '0');
  }

  private focusSegment(segment: 'month' | 'day' | 'year'): void {
    const ref = segment === 'month' ? this.monthInput
      : segment === 'day' ? this.dayInput
      : this.yearInput;
    ref?.nativeElement?.focus();
  }

  private nextSegment(s: 'month' | 'day' | 'year'): 'month' | 'day' | 'year' | null {
    return s === 'month' ? 'day' : s === 'day' ? 'year' : null;
  }

  private prevSegment(s: 'month' | 'day' | 'year'): 'month' | 'day' | 'year' | null {
    return s === 'year' ? 'day' : s === 'day' ? 'month' : null;
  }

  clear(): void {
    this.month = ''; this.day = ''; this.year = '';
    this.emitting = true;
    this.valueChange.emit(null);
    this.emitting = false;
  }
}
