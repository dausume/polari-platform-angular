// Author: Dustin Etts
// Abstract base class for every per-state inline overlay component.
//
// Owns the standard inputs (positioning + identity), standard outputs
// (popup / full-view / state-page request), sizeTier resolution, and
// hasPopupView declaration. Concrete subclasses extend this class and
// only declare state-specific extras (e.g. boundObjectFieldValues,
// availableInputs, solutionName, fieldValuesChanged).
//
// Subclasses that need their own ngOnInit / ngOnChanges MUST call
// super.ngOnInit() / super.ngOnChanges(changes) so the size-tier
// resolution stays current.
//
// The `@Directive()` decorator (without a selector) is required so
// Angular processes the @Input/@Output decorator metadata on this
// abstract class — without it the inputs would not be registered
// when subclasses are instantiated.
//
// Convention: see ./README.md.

import { Directive, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges } from '@angular/core';
import { SizeTier, resolveSizeTier } from './size-tier';

@Directive()
export abstract class StateOverlayBase implements OnInit, OnChanges {
  // ==================== Standard inputs ====================
  @Input() x: number = 0;
  @Input() y: number = 0;
  @Input() width: number = 100;
  @Input() height: number = 100;
  @Input() stateName: string = '';

  // ==================== Standard outputs ====================
  /** Emitted when the user clicks the expand button on the inline overlay. */
  @Output() popupRequested = new EventEmitter<void>();
  /** Emitted by the appStateOverlayRoot directive on right-click. */
  @Output() fullViewRequested = new EventEmitter<{ x: number; y: number; stateName: string }>();
  /** Emitted when the user clicks the "open state page" button. */
  @Output() statePageRequested = new EventEmitter<{ stateName: string }>();

  // ==================== Standard state ====================
  /** Computed from `width` via the shared size-tier breakpoints. */
  sizeTier: SizeTier = 'full';

  /** Whether this state has a popup/ component wired into the canvas. Subclasses override to true. */
  hasPopupView: boolean = false;

  // ==================== Lifecycle ====================
  ngOnInit(): void {
    this.sizeTier = resolveSizeTier(this.width);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['width']) {
      this.sizeTier = resolveSizeTier(this.width);
    }
  }

  /** Called by StateOverlayManager when the host rect resizes (zoom/pan). */
  forceUpdateSizeMode(): void {
    this.sizeTier = resolveSizeTier(this.width);
  }
}
