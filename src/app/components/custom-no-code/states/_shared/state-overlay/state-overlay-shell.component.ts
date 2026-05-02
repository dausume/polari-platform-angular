// Author: Dustin Etts
// Presentational shell for inline state overlays.
//
// Renders the standard card + header + expand-button scaffolding so per-state
// templates only declare state-specific content via <ng-content>. Optional
// [headerExtras] slot covers overlays that need extras in the header (mode
// tabs, slot-info badges, etc.).
//
// Accent color flows in via the `accent` input as a CSS custom property
// (`--state-accent`). Card border, expand button color, and hover tint all
// derive from it.
//
// The shell does NOT include `appStateOverlayRoot` itself — the consuming
// component decides whether the host element should carry the directive (true
// for single-component overlay roots; false for sub-views, where the base's
// directive already handles bubbled events).
//
// Convention: see ./README.md.

import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  standalone: false,
  selector: 'state-overlay-shell',
  templateUrl: './state-overlay-shell.component.html',
  styleUrls: ['./state-overlay-shell.component.css']
})
export class StateOverlayShellComponent {
  /** Accent color for border / expand button / icon. */
  @Input() accent: string = '#757575';

  /** Material icon name shown in the header. */
  @Input() icon: string = 'widgets';

  /** Header title text. */
  @Input() title: string = '';

  /** Adds the bordered modifier to the header (full-tier divider line). */
  @Input() bordered: boolean = false;

  /** Renders the smaller expand button used in compact-tier sub-views. */
  @Input() compact: boolean = false;

  /** Whether to show the expand button. */
  @Input() hasPopupView: boolean = false;

  /** Optional colored header background (e.g. #673AB7 for conditional-chain). */
  @Input() headerBg: string | null = null;

  /** Optional header foreground color used when headerBg is set. */
  @Input() headerFg: string | null = null;

  /** Inner padding applied to the card root. Override per-tier (e.g. '6px' for compact). */
  @Input() padding: string = '8px';

  @Output() expandClicked = new EventEmitter<void>();

  onExpandClick(event: MouseEvent): void {
    event.stopPropagation();
    this.expandClicked.emit();
  }
}
