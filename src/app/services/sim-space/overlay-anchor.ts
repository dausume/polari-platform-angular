/**
 * @cross-cutting
 * @tags @xc:render-shared
 * @consumers
 *   - SimSpaceSelectorComponent (anchors material-choice overlays)
 * @see /OVERLAP_MAP.md
 *
 * Overlay anchoring for rendered sim-space objects: turns a renderer's
 * HOST-LOCAL projected "shell shape" rect (SimSpaceRenderer.
 * getObjectScreenRect) into the VIEWPORT-space OverlayPosition the
 * shared StateOverlayManager positions overlay components on — the same
 * contract the 2D no-code canvas's SVG rects satisfy, so 3D objects
 * carry the same tiered overlays + popups.
 *
 * Talks only to the renderer INTERFACE (no `three` import — stays
 * outside the sim-space-3d firewall). One instance per viewer host.
 */

import { OverlayPosition } from '@services/no-code-services/state-overlay-manager.service';
import { SimSpaceRenderer } from './sim-space-renderer.interface';

export class OverlayAnchor {
  constructor(
    private renderer: SimSpaceRenderer,
    private hostElement: HTMLElement,
  ) {}

  /** The object's anchor rect in VIEWPORT coordinates, or null when it
   *  has none right now (unknown id / behind the camera). */
  viewportRectFor(objectId: string): OverlayPosition | null {
    const local = this.renderer.getObjectScreenRect?.(objectId);
    if (!local || local.width <= 0 || local.height <= 0) return null;
    const host = this.hostElement.getBoundingClientRect();
    return {
      x: host.left + local.x,
      y: host.top + local.y,
      width: local.width,
      height: local.height,
    };
  }
}
