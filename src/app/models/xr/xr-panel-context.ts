/**
 * @module models/xr/xr-panel-context
 *
 * XR_PANEL_CONTEXT (xr-3-min): the DI signal a component reads to know
 * it is mounted inside the off-screen `.xr-panel-context` host and
 * will be rasterized onto an XR page-panel (HTMLMesh). Two reaction
 * levels (WEBXR_PLAN.md): the scoped stylesheet lifts flat-view
 * constraints for free; components inject this token for DELIBERATE
 * structural changes the rasterizer needs —
 *  - controls that open cdk overlays (mat-select) render an inline
 *    alternative: overlays attach to document.body, OUTSIDE the
 *    rasterized element, so they can never appear on the quad;
 *  - numeric text inputs grow ±steppers: no keyboard in-session
 *    (Q-C resolved: steppers-first IC editing day one).
 *
 * Defaults to false so every flat mount is untouched.
 */

import { InjectionToken } from '@angular/core';

export const XR_PANEL_CONTEXT = new InjectionToken<boolean>(
  'XR_PANEL_CONTEXT', { providedIn: 'root', factory: () => false });
