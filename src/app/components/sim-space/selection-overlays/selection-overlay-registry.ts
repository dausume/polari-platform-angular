// Selection-overlay registry: overlayRef (config string) → overlay
// component. Mirrors DISPLAY_COMPONENT_REGISTRY's registration pattern —
// which overlay renders on which 3D object is CONFIGURATION (the
// selector item's `overlayRef`), the component itself is registered
// code, same split the Display system uses.

import { Type } from '@angular/core';

import { StateOverlayBase } from '@components/custom-no-code/states/_shared/state-overlay/state-overlay-base';

const SELECTION_OVERLAY_REGISTRY = new Map<string, Type<StateOverlayBase>>();

export function registerSelectionOverlay(
  name: string, component: Type<StateOverlayBase>): void {
  SELECTION_OVERLAY_REGISTRY.set(name, component);
}

export function getSelectionOverlay(
  name: string): Type<StateOverlayBase> | undefined {
  return SELECTION_OVERLAY_REGISTRY.get(name);
}

export function listSelectionOverlays(): string[] {
  return [...SELECTION_OVERLAY_REGISTRY.keys()];
}
