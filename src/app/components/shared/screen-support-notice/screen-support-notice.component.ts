import {
  AfterViewInit, Component, ElementRef, Input, OnDestroy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';

/** The `supportedScreen` knob's shape (per display component config). */
export interface SupportedScreen {
  minWidth?: number;
  maxWidth?: number;
  /** Optional author's note shown in the disclaimer. */
  note?: string;
}

/**
 * The per-component screen-support DISCLAIMER — the minimum-viable
 * responsive capability: a component declares the width range it was
 * built for (`supportedScreen` in its Display config), and when the
 * live host falls outside it, this banner says so instead of failing
 * silently into an unusable layout. Fully-adaptive components simply
 * never declare the knob (or declare a generous range).
 *
 * Measures its own host width via ResizeObserver — a squeezed desktop
 * panel gets the same honesty as a phone.
 */
@Component({
  standalone: true,
  selector: 'screen-support-notice',
  imports: [CommonModule, MatIconModule],
  template: `
    <div class="notice" *ngIf="outOfRange">
      <mat-icon>aspect_ratio</mat-icon>
      <span>
        This panel was built for
        {{ support?.minWidth ? 'screens at least ' + support?.minWidth + 'px wide' : '' }}
        {{ support?.minWidth && support?.maxWidth ? ' and ' : '' }}
        {{ support?.maxWidth ? 'screens at most ' + support?.maxWidth + 'px wide' : '' }}
        — some parts may be cramped or cut off here
        ({{ currentWidth }}px).
        {{ support?.note || '' }}
      </span>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .notice {
      display: flex; align-items: flex-start; gap: 8px;
      font-size: 12px; line-height: 1.4; color: #7a5b00;
      background: #fff8e1; border: 1px solid #ffe082;
      border-radius: 8px; padding: 6px 10px; margin: 4px 0;
    }
    .notice mat-icon {
      font-size: 16px; width: 16px; height: 16px; flex-shrink: 0;
      margin-top: 1px;
    }
  `],
})
export class ScreenSupportNoticeComponent implements AfterViewInit, OnDestroy {
  @Input() support: SupportedScreen | null = null;

  outOfRange = false;
  currentWidth = 0;

  private observer: ResizeObserver | null = null;

  constructor(private host: ElementRef<HTMLElement>) {}

  ngAfterViewInit(): void {
    this.evaluate();
    if (typeof ResizeObserver !== 'undefined') {
      this.observer = new ResizeObserver(() => this.evaluate());
      const parent = this.host.nativeElement.parentElement;
      if (parent) this.observer.observe(parent);
    }
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
  }

  private evaluate(): void {
    const parent = this.host.nativeElement.parentElement;
    if (!parent || !this.support) {
      this.outOfRange = false;
      return;
    }
    this.currentWidth = Math.round(parent.clientWidth);
    if (this.currentWidth <= 0) return;  // not laid out yet
    const below = this.support.minWidth !== undefined
      && this.currentWidth < this.support.minWidth;
    const above = this.support.maxWidth !== undefined
      && this.currentWidth > this.support.maxWidth;
    this.outOfRange = below || above;
  }
}
