/**
 * @cross-cutting
 * @tags @xc:render-shared, @xc:overlay
 * @consumers
 *   - SimSpaceViewer (mounted at the bottom of the canvas when the
 *     snapshot has at least one temporally-bound class)
 * @impact-on-edit
 *   Scrubber emits `currentTime` changes via Output. The viewer holds
 *   the authoritative state + filters objects to render. Adding new
 *   playback features (loop, reverse, mark-to-mark) → extend here.
 * @see /OVERLAP_MAP.md
 *
 * Timeline scrubber for temporally-bound SimSpaces. Slider over
 * [minTime, maxTime], play / pause / speed control, formatted
 * current-time display via the time-units catalog.
 */

import { Component, EventEmitter, Input, OnChanges, OnDestroy, Output, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatSliderModule } from '@angular/material/slider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';

import {
  formatTimeValue,
  TimeUnitId,
} from '@models/sim-space/time-units';

export type ScrubberKind = 'time' | 'step';

@Component({
  standalone: true,
  selector: 'sim-space-scrubber',
  imports: [
    CommonModule, FormsModule, MatIconModule, MatButtonModule,
    MatSliderModule, MatTooltipModule, MatSelectModule, MatFormFieldModule,
  ],
  template: `
    <div class="scrubber-panel" *ngIf="hasRange"
         [class.collapsed]="collapsed"
         [attr.data-collapsed]="collapsed">
      <!-- Compact form: only play/pause + time + expand chevron. -->
      <div class="scrubber-row" *ngIf="collapsed">
        <button mat-icon-button (click)="togglePlay()"
                [matTooltip]="playing ? 'Pause' : 'Play'">
          <mat-icon>{{ playing ? 'pause' : 'play_arrow' }}</mat-icon>
        </button>
        <span class="time-display mono compact" [matTooltip]="rangeTooltip">
          {{ formatTime(currentTime) }} / {{ formatTime(maxTime) }}
        </span>
        <button mat-icon-button (click)="setCollapsed(false)"
                matTooltip="Expand scrubber" class="collapse-btn">
          <mat-icon>expand_less</mat-icon>
        </button>
      </div>
      <!-- Full form. -->
      <div class="scrubber-row" *ngIf="!collapsed">
        <button mat-icon-button (click)="reset()" matTooltip="Jump to start">
          <mat-icon>skip_previous</mat-icon>
        </button>
        <button mat-icon-button (click)="togglePlay()"
                [matTooltip]="playing ? 'Pause' : 'Play'">
          <mat-icon>{{ playing ? 'pause' : 'play_arrow' }}</mat-icon>
        </button>
        <button mat-icon-button (click)="jumpEnd()" matTooltip="Jump to end">
          <mat-icon>skip_next</mat-icon>
        </button>

        <mat-slider class="slider"
                    [min]="minTime"
                    [max]="maxTime"
                    [step]="sliderStep"
                    discrete
                    [displayWith]="displayFn">
          <input matSliderThumb [(ngModel)]="currentTime" (ngModelChange)="onSliderChange($event)">
        </mat-slider>

        <span class="time-display mono" [matTooltip]="rangeTooltip">
          {{ formatTime(currentTime) }} / {{ formatTime(maxTime) }}
        </span>

        <mat-form-field appearance="outline" class="speed-field" subscriptSizing="dynamic">
          <mat-select [(value)]="playbackSpeed" matTooltip="Playback speed">
            <mat-option *ngFor="let s of speeds" [value]="s">{{ s }}x</mat-option>
          </mat-select>
        </mat-form-field>

        <button mat-icon-button (click)="setCollapsed(true)"
                matTooltip="Minimize scrubber" class="collapse-btn">
          <mat-icon>expand_more</mat-icon>
        </button>
      </div>
    </div>
  `,
  styles: [`
    .scrubber-panel {
      position: absolute;
      left: 12px;
      right: 12px;
      bottom: 12px;
      background: rgba(255, 255, 255, 0.96);
      border: 1px solid #d0d0d0;
      border-radius: 6px;
      padding: 6px 12px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
      z-index: 2;
    }
    .scrubber-panel.collapsed {
      left: auto;          /* shrink to content on the right */
      max-width: 320px;
    }
    .time-display.compact { min-width: 0; }
    .collapse-btn { margin-left: auto; }
    .scrubber-row {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .slider {
      flex: 1;
      min-width: 100px;
    }
    .time-display {
      font-size: 0.82rem;
      color: var(--mat-sys-on-surface, #1a1a1a);
      white-space: nowrap;
      min-width: 140px;
      text-align: right;
    }
    .speed-field {
      width: 80px;
    }
    .speed-field ::ng-deep .mat-mdc-form-field-subscript-wrapper { display: none; }
    .speed-field ::ng-deep .mat-mdc-form-field-infix { min-height: 32px; padding: 4px 0; }
    .mono { font-family: monospace; }
  `]
})
export class SimSpaceScrubberComponent implements OnChanges, OnDestroy {
  /** Min/max of the temporal range derived from snapshot objects. */
  @Input() minTime = 0;
  @Input() maxTime = 1;
  /** 'time' (continuous) or 'step' (discrete integer). */
  @Input() kind: ScrubberKind = 'time';
  /** Time unit used for display formatting (only meaningful for kind='time'). */
  @Input() unit: TimeUnitId = 'second';
  /** Two-way bound — the viewer holds authoritative state. */
  @Input() currentTime = 0;
  @Output() currentTimeChange = new EventEmitter<number>();

  playing = false;
  playbackSpeed = 1;
  readonly speeds = [0.25, 0.5, 1, 2, 4];

  /** Compact-vs-full toggle. The compact form keeps play/pause + time
   *  readout so the user can still control playback without expanding. */
  collapsed = false;
  /** Emits true when collapsed, false when expanded — so the viewer can
   *  shift other absolutely-positioned panels (legend) clear of the
   *  scrubber's current footprint. */
  @Output() collapsedChange = new EventEmitter<boolean>();

  private rafId: number | null = null;
  private lastTick: number | null = null;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['minTime'] || changes['maxTime']) {
      // Clamp currentTime into the new range.
      this.currentTime = Math.min(Math.max(this.currentTime, this.minTime), this.maxTime);
      this.currentTimeChange.emit(this.currentTime);
    }
  }

  ngOnDestroy(): void {
    this.stop();
  }

  setCollapsed(value: boolean): void {
    if (this.collapsed === value) return;
    this.collapsed = value;
    this.collapsedChange.emit(value);
  }

  get hasRange(): boolean {
    return this.maxTime > this.minTime;
  }

  /** Slider step granularity — discrete for step kind, fine for time. */
  get sliderStep(): number {
    if (this.kind === 'step') return 1;
    const span = this.maxTime - this.minTime;
    if (span <= 0) return 0.01;
    // ~1000 ticks across the range — fine enough for smooth scrubbing.
    return Math.max(span / 1000, 0.0001);
  }

  get rangeTooltip(): string {
    return `Range: ${this.formatTime(this.minTime)} – ${this.formatTime(this.maxTime)}`;
  }

  displayFn = (value: number): string => this.formatTime(value);

  formatTime(value: number): string {
    if (this.kind === 'step') return `${Math.round(value)} step${Math.round(value) === 1 ? '' : 's'}`;
    return formatTimeValue(value, this.unit);
  }

  onSliderChange(value: number): void {
    this.currentTime = value;
    this.currentTimeChange.emit(value);
  }

  togglePlay(): void {
    if (this.playing) this.stop();
    else this.play();
  }

  reset(): void {
    this.stop();
    this.currentTime = this.minTime;
    this.currentTimeChange.emit(this.currentTime);
  }

  jumpEnd(): void {
    this.stop();
    this.currentTime = this.maxTime;
    this.currentTimeChange.emit(this.currentTime);
  }

  private play(): void {
    if (this.playing) return;
    this.playing = true;
    this.lastTick = performance.now();
    const tick = (now: number) => {
      if (!this.playing) return;
      const dtSec = ((now - (this.lastTick ?? now)) / 1000) * this.playbackSpeed;
      this.lastTick = now;
      const span = this.maxTime - this.minTime;
      // For step-kind, advance at 10 steps/sec (multiplied by speed).
      const advance = this.kind === 'step' ? 10 * this.playbackSpeed * dtSec : dtSec;
      let next = this.currentTime + advance;
      if (next >= this.maxTime) {
        next = this.maxTime;
        this.currentTime = next;
        this.currentTimeChange.emit(next);
        this.stop();
        return;
      }
      this.currentTime = next;
      this.currentTimeChange.emit(next);
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  private stop(): void {
    this.playing = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.lastTick = null;
  }
}
