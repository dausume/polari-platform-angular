// Author: Dustin Etts
// Standard interaction handlers for state-overlay root containers.
//
// Apply to the root element of every base overlay AND every sub-view to:
//   - stop click / mousedown / pointerdown propagation (so D3 doesn't start a state drag)
//   - intercept contextmenu, prevent the browser menu, and emit `contextRequested`
//     with screen coordinates so the canvas can open its full-view popup.
//
// Replaces the duplicated `onOverlayClick` / `onMouseDown` / `onContextMenu`
// triple previously declared inline on every base overlay, plus the
// `stopPropagation(event)` helper duplicated across sub-views.
//
// Usage:
//   <div [appStateOverlayRoot]="stateName"
//        (contextRequested)="fullViewRequested.emit($event)">
//     ...
//   </div>
//
// On sub-views (no contextRequested handler needed), just bind the directive:
//   <div [appStateOverlayRoot]="stateName"> ... </div>

import { Directive, EventEmitter, HostListener, Input, Output } from '@angular/core';

export interface StateOverlayContextEvent {
  x: number;
  y: number;
  stateName: string;
}

@Directive({
  standalone: false,
  selector: '[appStateOverlayRoot]'
})
export class StateOverlayInteractionsDirective {
  /** State name forwarded with the contextRequested payload. */
  @Input('appStateOverlayRoot') stateName: string = '';

  @Output() contextRequested = new EventEmitter<StateOverlayContextEvent>();

  @HostListener('click', ['$event'])
  onClick(event: MouseEvent): void {
    event.stopPropagation();
  }

  @HostListener('mousedown', ['$event'])
  onMouseDown(event: MouseEvent): void {
    event.stopPropagation();
  }

  @HostListener('pointerdown', ['$event'])
  onPointerDown(event: MouseEvent): void {
    event.stopPropagation();
  }

  @HostListener('contextmenu', ['$event'])
  onContextMenu(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.contextRequested.emit({
      x: event.clientX,
      y: event.clientY,
      stateName: this.stateName
    });
  }
}
