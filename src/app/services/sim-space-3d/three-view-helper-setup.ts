/**
 * @cross-cutting
 * @tags @xc:render-3d
 * @consumers
 *   - ThreeSimSpaceRenderer
 * @see /OVERLAP_MAP.md
 *
 * Creates + tears down the corner ViewHelper gizmo. Pulled out of the
 * renderer because the DOM-container + pointer-event setup is enough
 * code to deserve its own file.
 */

import * as THREE from 'three';
import { ViewHelper } from 'three/examples/jsm/helpers/ViewHelper.js';

import { CADControls } from './controls/cad-controls';

export interface ViewHelperRig {
  helper: ViewHelper;
  container: HTMLDivElement;
  dispose(): void;
}

/**
 * Mount a ViewHelper into the upper-right corner of `host`. Click-pickup
 * is wired to ViewHelper.handleClick — the renderer's main canvas keeps
 * its own click handlers separate.
 */
export function mountViewHelper(
  host: HTMLElement,
  camera: THREE.Camera,
  controls: CADControls
): ViewHelperRig {
  const container = document.createElement('div');
  container.style.cssText = [
    'position: absolute',
    'top: 8px',
    'right: 8px',
    'width: 128px',
    'height: 128px',
    'pointer-events: auto',
    'z-index: 2',
  ].join(';');
  host.appendChild(container);

  const helper = new ViewHelper(camera, container);
  // ViewHelper's face-click handler rotates the orbit target via this ref.
  (helper as any).controls = controls.orbit;

  const onPointer = (e: PointerEvent) => helper.handleClick(e as any);
  container.addEventListener('pointerup', onPointer);

  return {
    helper,
    container,
    dispose() {
      container.removeEventListener('pointerup', onPointer);
      helper.dispose();
      if (container.parentNode) {
        container.parentNode.removeChild(container);
      }
    },
  };
}
