/**
 * segmented-time-input.ts
 *
 * A custom inline time input with two editable segments: HH : MM.
 * Supports toggling between 24-hour and 12-hour (AM/PM) modes.
 */
import {
  Component, Input, Output, EventEmitter, ElementRef,
  ViewChild, OnChanges, SimpleChanges, OnDestroy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { createHoldAccelerator } from '../hold-accelerator';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  selector: 'segmented-time-input',
  templateUrl: 'segmented-time-input.html',
  styleUrls: ['./segmented-time-input.css']
})
export class SegmentedTimeInputComponent implements OnChanges, OnDestroy {
  @Input() value: string | null = null;     // "HH:MM" (24h) or null
  @Input() disabled: boolean = false;
  @Input() use24Hour: boolean = true;
  /** Allow user to toggle between 24h and AM/PM */
  @Input() allowFormatToggle: boolean = true;
  @Output() valueChange = new EventEmitter<string | null>();

  @ViewChild('hoursInput') hoursInput!: ElementRef<HTMLInputElement>;
  @ViewChild('minutesInput') minutesInput!: ElementRef<HTMLInputElement>;

  hours: string = '';
  minutes: string = '';
  ampm: 'AM' | 'PM' = 'AM';
  activeSegment: 'hours' | 'minutes' | null = null;

  private emitting = false;
  private accelerators: { stop: () => void }[] = [];

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['value'] && !this.emitting) {
      this.parseFromString(this.value);
    }
  }

  ngOnDestroy(): void {
    this.stopAllAccelerators();
  }

  // ─── Parsing / Emitting ──────────────────────────────────────────────

  private parseFromString(val: string | null): void {
    if (!val) {
      this.hours = ''; this.minutes = '';
      return;
    }
    const parts = val.split(':');
    let h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    if (isNaN(h) || isNaN(m)) {
      this.hours = ''; this.minutes = '';
      return;
    }

    if (!this.use24Hour) {
      this.ampm = h >= 12 ? 'PM' : 'AM';
      h = h % 12 || 12;
    }
    this.hours = String(h).padStart(2, '0');
    this.minutes = String(m).padStart(2, '0');
  }

  private emitValue(): void {
    let h = parseInt(this.hours, 10);
    const m = parseInt(this.minutes, 10);
    if (isNaN(h) || isNaN(m)) {
      this.emitting = true;
      this.valueChange.emit(null);
      this.emitting = false;
      return;
    }

    if (!this.use24Hour) {
      if (this.ampm === 'PM' && h < 12) h += 12;
      if (this.ampm === 'AM' && h === 12) h = 0;
    }

    this.emitting = true;
    this.valueChange.emit(
      `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
    );
    this.emitting = false;
  }

  get isEmpty(): boolean {
    return !this.hours && !this.minutes;
  }

  // ─── Format Toggle ───────────────────────────────────────────────────

  toggleTimeFormat(): void {
    // Convert current displayed hours to 24h, toggle, then re-display
    let h24 = parseInt(this.hours, 10);
    if (isNaN(h24)) { this.use24Hour = !this.use24Hour; return; }

    if (!this.use24Hour) {
      // Currently 12h → convert to 24h value before switching
      if (this.ampm === 'PM' && h24 < 12) h24 += 12;
      if (this.ampm === 'AM' && h24 === 12) h24 = 0;
    }

    this.use24Hour = !this.use24Hour;

    if (!this.use24Hour) {
      this.ampm = h24 >= 12 ? 'PM' : 'AM';
      h24 = h24 % 12 || 12;
    }
    this.hours = String(h24).padStart(2, '0');
  }

  // ─── Segment Focus ───────────────────────────────────────────────────

  onSegmentFocus(segment: 'hours' | 'minutes', input: HTMLInputElement): void {
    this.activeSegment = segment;
    setTimeout(() => input.select(), 0);
  }

  onSegmentBlur(segment: 'hours' | 'minutes'): void {
    if (this.activeSegment === segment) {
      this.activeSegment = null;
    }
    this.padSegment(segment);
    this.clampSegment(segment);
    this.emitValue();
  }

  // ─── Keyboard ────────────────────────────────────────────────────────

  onKeydown(event: KeyboardEvent, segment: 'hours' | 'minutes'): void {
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.incrementSegment(segment, 1);
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.incrementSegment(segment, -1);
    } else if (event.key === 'ArrowRight' || (event.key === 'Tab' && !event.shiftKey)) {
      if (segment === 'hours' && event.key === 'ArrowRight') {
        event.preventDefault();
        this.minutesInput?.nativeElement?.focus();
      }
    } else if (event.key === 'ArrowLeft' || (event.key === 'Tab' && event.shiftKey)) {
      if (segment === 'minutes' && event.key === 'ArrowLeft') {
        event.preventDefault();
        this.hoursInput?.nativeElement?.focus();
      }
    } else if (event.key === 'a' || event.key === 'A') {
      if (!this.use24Hour) { event.preventDefault(); this.ampm = 'AM'; this.emitValue(); }
      else event.preventDefault();
    } else if (event.key === 'p' || event.key === 'P') {
      if (!this.use24Hour) { event.preventDefault(); this.ampm = 'PM'; this.emitValue(); }
      else event.preventDefault();
    } else if (event.key.length === 1 && !/\d/.test(event.key)) {
      event.preventDefault();
    }
  }

  onInput(segment: 'hours' | 'minutes'): void {
    let val = this[segment].replace(/\D/g, '');
    if (val.length > 2) val = val.slice(0, 2);
    this[segment] = val;

    if (val.length >= 2) {
      this.clampSegment(segment);
      this.padSegment(segment);
      if (segment === 'hours') {
        this.minutesInput?.nativeElement?.focus();
      } else {
        this.emitValue();
      }
    }
  }

  // ─── Increment / Spinners ───────────────────────────────────────────

  incrementSegment(segment: 'hours' | 'minutes', step: number): void {
    let val = parseInt(this[segment], 10) || 0;
    val += step;

    if (segment === 'hours') {
      const max = this.use24Hour ? 23 : 12;
      const min = this.use24Hour ? 0 : 1;
      val = ((val - min + (max - min + 1)) % (max - min + 1)) + min;
    } else {
      val = ((val + 60) % 60);
    }

    this[segment] = String(val).padStart(2, '0');
    this.emitValue();
  }

  startSpinner(segment: 'hours' | 'minutes', direction: 1 | -1): void {
    if (this.disabled) return;
    const ref = segment === 'hours' ? this.hoursInput : this.minutesInput;
    ref?.nativeElement?.focus();
    const fastStep = segment === 'minutes' ? 5 : 1;
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

  toggleAmPm(): void {
    this.ampm = this.ampm === 'AM' ? 'PM' : 'AM';
    this.emitValue();
  }

  // ─── Helpers ─────────────────────────────────────────────────────────

  private padSegment(segment: 'hours' | 'minutes'): void {
    const val = this[segment];
    if (val) this[segment] = val.padStart(2, '0');
  }

  private clampSegment(segment: 'hours' | 'minutes'): void {
    let val = parseInt(this[segment], 10);
    if (isNaN(val)) return;
    if (segment === 'hours') {
      const max = this.use24Hour ? 23 : 12;
      const min = this.use24Hour ? 0 : 1;
      val = Math.min(max, Math.max(min, val));
    } else {
      val = Math.min(59, Math.max(0, val));
    }
    this[segment] = String(val).padStart(2, '0');
  }

  private stopAllAccelerators(): void {
    this.accelerators.forEach(a => a.stop());
    this.accelerators = [];
  }

  clear(): void {
    this.hours = ''; this.minutes = '';
    this.ampm = 'AM';
    this.emitting = true;
    this.valueChange.emit(null);
    this.emitting = false;
  }
}
