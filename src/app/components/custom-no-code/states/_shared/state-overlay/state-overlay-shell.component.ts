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

  // ==================== Coding Comment ====================
  // Universal "author's note" footer rendered on every state overlay
  // that opts in. Overlays bind:
  //
  //   <state-overlay-shell ...
  //     [codingComment]="boundObjectFieldValues['codingComment'] || ''"
  //     (commentChanged)="onCodingCommentChange($event)">
  //
  // and patch the value into their fieldValuesChanged emit. The section
  // is collapsed by default so it doesn't crowd compact-tier displays;
  // a small "Comment" pill in the header signals when one is present.

  /** Persisted Coding Comment text. Empty string = no comment yet. */
  @Input() codingComment: string = '';

  /** Whether this state should expose the comment section. Default
   *  true so opt-out is per-overlay; opt-out only matters for tiers
   *  where a footer would overflow the visible card (e.g. compact). */
  @Input() showCodingComment: boolean = true;

  @Output() expandClicked = new EventEmitter<void>();
  @Output() commentChanged = new EventEmitter<string>();

  /** Local UI state — section open/closed. Independent of whether a
   *  comment exists; users may want to hide a long comment temporarily. */
  commentSectionOpen: boolean = false;

  toggleCommentSection(event: MouseEvent): void {
    event.stopPropagation();
    this.commentSectionOpen = !this.commentSectionOpen;
  }

  onCommentTextChange(value: string): void {
    this.codingComment = value;
    this.commentChanged.emit(value);
  }

  onExpandClick(event: MouseEvent): void {
    event.stopPropagation();
    this.expandClicked.emit();
  }
}
