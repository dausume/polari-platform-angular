// Per-selector overlay orchestration: creates one tiered overlay per
// selectable item on its projected 3D shell rect via the SHARED
// StateOverlayManager (the same machinery + convention the 2D no-code
// canvas uses), keeps them tracking camera/view changes, and relays
// their popupRequested output. Extracted from the selector component so
// the component stays a thin host.

import { ComponentRef, ViewContainerRef } from '@angular/core';
import { Subject } from 'rxjs';

import {
  StateOverlayManager,
} from '@services/no-code-services/state-overlay-manager.service';
import { OverlayAnchor } from '@services/sim-space/overlay-anchor';
import {
  getSelectionOverlay,
} from '@components/sim-space/selection-overlays/selection-overlay-registry';

/** One selectable object's overlay wiring. */
export interface OrchestratedItem {
  key: string;
  objectId: string;
  overlayRef: string;
  /** Extra inputs forwarded to the overlay component. */
  inputs: Record<string, unknown>;
}

export class SelectorOverlayOrchestrator {

  /** An overlay's expand button was clicked (item key). */
  readonly popupRequested$ = new Subject<string>();

  private items: OrchestratedItem[] = [];
  private anchor: OverlayAnchor | null = null;
  /** Overlay names are namespaced per selector instance so several
   *  selectors (and the 2D canvas) share the manager without colliding. */
  private readonly namespace = `matsel-${Math.random().toString(36).slice(2, 8)}`;

  constructor(private overlayManager: StateOverlayManager) {}

  attach(anchor: OverlayAnchor, vcr: ViewContainerRef,
         items: OrchestratedItem[]): void {
    this.anchor = anchor;
    this.items = items;
    // Last-set wins by design: overlays are detached to document.body,
    // so any live VCR serves; each surface sets it on (re)attach.
    this.overlayManager.setViewContainerRef(vcr);
    for (const item of items) {
      this.createOverlay(item);
    }
    this.reposition();
  }

  /** Recompute every overlay's rect (camera/view change, resize,
   *  snapshot refresh). Unprojectable anchors hide their overlay. */
  reposition(): void {
    if (!this.anchor) return;
    for (const item of this.items) {
      this.overlayManager.updateOverlayPositionAt(
        this.overlayName(item), this.anchor.viewportRectFor(item.objectId));
    }
  }

  /** Push updated inputs (proof badges, selection state) into an
   *  item's live overlay component. */
  updateInputs(key: string, inputs: Record<string, unknown>): void {
    const item = this.items.find(i => i.key === key);
    if (!item) return;
    const componentRef = this.overlayManager.getOverlayComponent(
      this.overlayName(item));
    if (!componentRef) return;
    Object.entries(inputs).forEach(([k, v]) => componentRef.setInput(k, v));
    componentRef.changeDetectorRef.detectChanges();
  }

  destroy(): void {
    for (const item of this.items) {
      this.overlayManager.destroyOverlayForState(this.overlayName(item));
    }
    this.items = [];
    this.anchor = null;
  }

  private createOverlay(item: OrchestratedItem): void {
    const componentType = getSelectionOverlay(item.overlayRef);
    if (!componentType || !this.anchor) return;
    const rect = this.anchor.viewportRectFor(item.objectId)
      // The scene may not have projected yet — create at a placeholder
      // rect; the next reposition() corrects (or hides) it.
      ?? { x: -10000, y: -10000, width: 120, height: 60 };
    const componentRef: ComponentRef<any> | null =
      this.overlayManager.createOverlayAt(
        this.overlayName(item), rect, componentType,
        { stateName: item.key, ...item.inputs } as any);
    if (!componentRef) return;
    // Same popup wiring the 2D canvas uses: the overlay asks, the host
    // opens the MatDialog (relayed via popupRequested$).
    const instance = componentRef.instance as
      { popupRequested?: { subscribe: (fn: () => void) => unknown } };
    instance.popupRequested?.subscribe(() =>
      this.popupRequested$.next(item.key));
    // The host stays pointer-events:none (the manager's default) so the
    // 3D canvas underneath receives clicks; a transparent host set to
    // 'auto' hit-tests across its whole rect and swallows them. The
    // chips' interactive children (e.g. the expand button) opt back in
    // with their own pointer-events:auto, which works under a 'none'
    // parent.
  }

  private overlayName(item: OrchestratedItem): string {
    return `${this.namespace}:${item.key}`;
  }
}
