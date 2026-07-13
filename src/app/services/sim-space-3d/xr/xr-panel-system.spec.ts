/**
 * iwer-driven acceptance specs for xr-3-min (WEBXR_PLAN.md): ring-1
 * grows from the surface seed, toggling spawns an HTMLMesh of the
 * REAL live element, trigger clicks forward to the live DOM, the
 * scrub rail drives the temporal index, quad grips reposition (not
 * navigate), and placements persist + restore.
 */
import { XRDevice, metaQuest2 } from 'iwer';
import * as THREE from 'three';

import { XrSessionRuntime } from './xr-session-runtime';
import type { XrSceneEntry } from '@services/xr/xr-scene-registry.service';
import type { XrEnterContext, XrVariantConfig } from '@models/xr/xr-types';
import type {
  XrScrubState, XrSurfaceProvider,
} from '@models/xr/xr-surface-model';

function webglAvailable(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return !!(canvas.getContext('webgl2') || canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

describe('XrPanelSystem (xr-3-min, iwer)', () => {
  let device: XRDevice;

  beforeAll(() => {
    device = new XRDevice(metaQuest2);
    device.installRuntime({ forceInstall: true });
  });

  function settle(ms = 80): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function sceneEntry(name: string,
      extraHandle: Partial<import('@services/xr/xr-scene-registry.service')
        .XrSceneHandle> = {}) {
    const scene = new THREE.Scene();
    scene.add(new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshBasicMaterial()));
    const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
    camera.position.set(2, 2, 2);
    const entry: XrSceneEntry = {
      id: `test-${name}`,
      label: name,
      spaceName: name,
      getHandle: () => ({ scene, camera, ...extraHandle }),
    };
    return { entry, scene, camera };
  }

  /** An off-screen, laid-out element mimicking the panel host: one
   *  full-size button records forwarded clicks. */
  function buildSurfaceElement() {
    const el = document.createElement('div');
    el.style.cssText = 'position:fixed;left:-9000px;top:0;'
      + 'width:300px;background:#fff;padding:0;margin:0;';
    const button = document.createElement('button');
    button.textContent = 'STEP ONCE';
    button.style.cssText =
      'display:block;width:300px;height:120px;margin:0;';
    el.appendChild(button);
    document.body.appendChild(el);
    const clicks: string[] = [];
    button.addEventListener('click', () => clicks.push('click'));
    return { el, button, clicks };
  }

  interface Harness {
    surfaces: XrSurfaceProvider;
    scrubbedTo: number[];
    scrubState: XrScrubState | null;
    persisted: Partial<XrVariantConfig>[];
    el: HTMLElement;
    clicks: string[];
    dispose: () => void;
  }

  function buildHarness(): Harness {
    const { el, clicks } = buildSurfaceElement();
    const harness: Harness = {
      scrubbedTo: [],
      scrubState: {
        min: 0, max: 10, current: 0, kind: 'time',
        formatted: '0 s / 10 s', sampleCount: 5,
      },
      persisted: [],
      el, clicks,
      dispose: () => el.remove(),
      surfaces: {
        panels: [
          { id: 'run', label: 'Simulation run', getElement: () => el },
          { id: 'conditions', label: 'Initial conditions',
            getElement: () => el },
          { id: 'equations', label: 'Live evaluations',
            getElement: () => el },
          { id: 'legend', label: 'Scene contents', getElement: () => el },
          { id: 'solutions', label: 'No-code solutions',
            getElement: () => el },
        ],
        getScrubState: () => harness.scrubState,
        setScrubCurrent: value => {
          harness.scrubbedTo.push(value);
          if (harness.scrubState) harness.scrubState.current = value;
        },
      },
    };
    return harness;
  }

  function contextOf(harness: Harness,
      variantConfig: XrVariantConfig = {}): XrEnterContext {
    return {
      framing: 'exhibit',
      variantConfig,
      surfaces: harness.surfaces,
      persistPatch: patch => harness.persisted.push(patch),
    };
  }

  async function withSession(
    context: XrEnterContext,
    body: (runtime: XrSessionRuntime, scene: THREE.Scene)
      => Promise<void>,
  ): Promise<void> {
    const { entry, scene } = sceneEntry('panel-space');
    const runtime = new XrSessionRuntime({ onEnded: () => {} });
    await runtime.enter(entry, context);
    try {
      await body(runtime, scene);
    } finally {
      await runtime.exit();
      await settle();
    }
  }

  /** Aim an iwer controller (reference-space pose) at a world point:
   *  rig rotation is identity at entry, so local directions map
   *  straight to world directions. */
  function aimControllerAt(scene: THREE.Scene, hand: 'left' | 'right',
      worldTarget: THREE.Vector3): void {
    const rig = scene.getObjectByName('polari-xr-rig')!;
    const controller = device.controllers[hand]!;
    const local = new THREE.Vector3(hand === 'left' ? -0.2 : 0.2,
      1.5, 0);
    controller.position.set(local.x, local.y, local.z);
    const targetLocal = rig.worldToLocal(worldTarget.clone());
    const matrix = new THREE.Matrix4()
      .lookAt(local, targetLocal, new THREE.Vector3(0, 1, 0));
    const q = new THREE.Quaternion().setFromRotationMatrix(matrix);
    controller.quaternion.set(q.x, q.y, q.z, q.w);
  }

  function quadWorldCenter(scene: THREE.Scene, contentRef: string):
      THREE.Vector3 {
    const root = scene.getObjectByName(`xr-panel-${contentRef}`)!;
    const quad = root.children.find(c =>
      c.name !== 'xr-panel-frame' && c.name !== 'xr-panel-close')!;
    return quad.getWorldPosition(new THREE.Vector3());
  }

  it('grows wrist ring 1 from the surface seed (RUN / CONDITIONS / '
      + 'SCRUB / EQUATIONS / LEGEND / NO-CODE), and only when '
      + 'surfaces exist', async () => {
    if (!webglAvailable()) { pending('WebGL unavailable'); return; }
    const harness = buildHarness();
    await withSession(contextOf(harness), async (_runtime, scene) => {
      await settle(150); // controllers connect, wrist attaches
      for (const id of
          ['run', 'conditions', 'scrub', 'equations', 'legend',
           'solutions']) {
        expect(scene.getObjectByName(`xr-wrist-item-${id}`))
          .withContext(`ring-1 item ${id}`).toBeTruthy();
      }
    });
    harness.dispose();
    // No surfaces → ring 0 only.
    const { entry, scene } = sceneEntry('bare-space');
    const runtime = new XrSessionRuntime({ onEnded: () => {} });
    await runtime.enter(entry,
      { framing: 'exhibit', variantConfig: {} });
    await settle(150);
    expect(scene.getObjectByName('xr-wrist-item-run')).toBeFalsy();
    await runtime.exit();
    await settle();
  });

  it('toggling RUN spawns an HTMLMesh quad of the LIVE element and '
      + 'toggling again removes every trace', async () => {
    if (!webglAvailable()) { pending('WebGL unavailable'); return; }
    const harness = buildHarness();
    await withSession(contextOf(harness), async (runtime, scene) => {
      const childrenBefore = scene.children.length;
      runtime.togglePanel('panel:run');
      expect(runtime.isPanelOpen('panel:run')).toBeTrue();
      const root = scene.getObjectByName('xr-panel-panel:run')!;
      expect(root).toBeTruthy();
      const quad = root.children.find(
        c => (c as THREE.Mesh).isMesh
          && ((c as THREE.Mesh).material as THREE.MeshBasicMaterial)
            ?.map && (((c as THREE.Mesh).material as
            THREE.MeshBasicMaterial).map as any).dom) as THREE.Mesh;
      expect(quad).withContext('HTMLMesh quad').toBeTruthy();
      expect((quad.material as any).map.dom)
        .withContext('rasterizes the REAL live element')
        .toBe(harness.el);
      // Raster cost recorded (res-3 idiom).
      expect(harness.persisted.some(p => p.panel_raster_ms
        && typeof p.panel_raster_ms['run'] === 'number')).toBeTrue();

      runtime.togglePanel('panel:run');
      expect(runtime.isPanelOpen('panel:run')).toBeFalse();
      expect(scene.getObjectByName('xr-panel-panel:run')).toBeFalsy();
      expect(scene.children.length).toBe(childrenBefore);
    });
    harness.dispose();
  });

  it('toggling EQUATIONS, LEGEND, or SOLUTIONS spawns an HTMLMesh '
      + 'quad of the LIVE element the same way RUN does', async () => {
    if (!webglAvailable()) { pending('WebGL unavailable'); return; }
    const harness = buildHarness();
    await withSession(contextOf(harness), async (runtime, scene) => {
      for (const contentRef of
          ['panel:equations', 'panel:legend', 'panel:solutions']) {
        runtime.togglePanel(contentRef);
        expect(runtime.isPanelOpen(contentRef))
          .withContext(contentRef).toBeTrue();
        const root = scene.getObjectByName(`xr-panel-${contentRef}`)!;
        const quad = root.children.find(
          c => (c as THREE.Mesh).isMesh
            && ((c as THREE.Mesh).material as THREE.MeshBasicMaterial)
              ?.map && (((c as THREE.Mesh).material as
              THREE.MeshBasicMaterial).map as any).dom) as THREE.Mesh;
        expect(quad).withContext(`${contentRef} HTMLMesh quad`)
          .toBeTruthy();
        expect((quad.material as any).map.dom)
          .withContext(`${contentRef} rasterizes the live element`)
          .toBe(harness.el);
        runtime.togglePanel(contentRef);
        expect(runtime.isPanelOpen(contentRef)).toBeFalse();
      }
    });
    harness.dispose();
  });

  it('a trigger press+release on the quad forwards a CLICK to the '
      + 'live DOM (behavior parity)', async () => {
    if (!webglAvailable()) { pending('WebGL unavailable'); return; }
    const harness = buildHarness();
    await withSession(contextOf(harness), async (runtime, scene) => {
      await settle(150);
      runtime.togglePanel('panel:run');
      await settle(100);
      aimControllerAt(scene, 'right',
        quadWorldCenter(scene, 'panel:run'));
      await settle(120); // frames propagate the pose + hover
      const controller = device.controllers['right']!;
      controller.updateButtonValue('trigger', 1);
      await settle(60);
      controller.updateButtonValue('trigger', 0);
      await settle(60);
      expect(harness.clicks.length)
        .withContext('forwarded click reached the live button')
        .toBeGreaterThan(0);
    });
    harness.dispose();
  });

  it('the scrub rail maps a trigger on its track to the temporal '
      + 'range and drives the viewer seam', async () => {
    if (!webglAvailable()) { pending('WebGL unavailable'); return; }
    const harness = buildHarness();
    await withSession(contextOf(harness), async (runtime, scene) => {
      await settle(150);
      runtime.togglePanel('scrub-rail');
      expect(runtime.isPanelOpen('scrub-rail')).toBeTrue();
      await settle(100);
      // Aim at the rail CENTER → track fraction 0.5 → value 5.
      aimControllerAt(scene, 'right',
        quadWorldCenter(scene, 'scrub-rail'));
      await settle(120);
      const controller = device.controllers['right']!;
      controller.updateButtonValue('trigger', 1);
      await settle(60);
      controller.updateButtonValue('trigger', 0);
      await settle(30);
      expect(harness.scrubbedTo.length).toBeGreaterThan(0);
      expect(harness.scrubbedTo[0]).toBeCloseTo(5, 1);
    });
    harness.dispose();
  });

  it('a grip on a hovered quad REPOSITIONS it (world navigation '
      + 'never starts) and persists the placement', async () => {
    if (!webglAvailable()) { pending('WebGL unavailable'); return; }
    const harness = buildHarness();
    await withSession(contextOf(harness), async (runtime, scene) => {
      await settle(150);
      runtime.togglePanel('panel:run');
      await settle(100);
      const rig = scene.getObjectByName('polari-xr-rig')!;
      const rigPositionBefore = rig.position.clone();
      const quadBefore = quadWorldCenter(scene, 'panel:run');
      aimControllerAt(scene, 'right', quadBefore);
      await settle(120);
      const controller = device.controllers['right']!;
      controller.updateButtonValue('squeeze', 1);
      await settle(100);
      // Move the hand: the quad must ride, the rig must not.
      controller.position.set(0.2, 1.9, -0.3);
      await settle(150);
      controller.updateButtonValue('squeeze', 0);
      await settle(250); // grip release debounce (150ms) + drop
      const quadAfter = quadWorldCenter(scene, 'panel:run');
      expect(quadAfter.distanceTo(quadBefore))
        .withContext('quad followed the grip')
        .toBeGreaterThan(1e-3);
      expect(rig.position.distanceTo(rigPositionBefore))
        .withContext('world navigation stayed idle')
        .toBeLessThan(1e-6);
      expect(harness.persisted.some(p => p.panel_placements
        && p.panel_placements['panel:run'])).toBeTrue();
    });
    harness.dispose();
  });

  it('a persisted placement is restored on spawn (survives '
      + 'exit/re-enter)', async () => {
    if (!webglAvailable()) { pending('WebGL unavailable'); return; }
    const harness = buildHarness();
    const saved = {
      position: [1.5, 2.5, -3] as [number, number, number],
      yaw: 0.4, scale: 2.5,
    };
    await withSession(
      contextOf(harness, { panel_placements: { 'panel:run': saved } }),
      async (runtime, scene) => {
        runtime.togglePanel('panel:run');
        const root = scene.getObjectByName('xr-panel-panel:run')!;
        expect(root.position.toArray())
          .toEqual([1.5, 2.5, -3]);
        expect(root.rotation.y).toBeCloseTo(0.4, 10);
        expect(root.scale.x).toBeCloseTo(2.5, 10);
      });
    harness.dispose();
  });

  it('a 2D scene handle (mainSurfaceElement) auto-spawns a NON-'
      + 'CLOSABLE main quad at bind — no ring-1 toggle needed, no '
      + 'close button (primary content, not an auxiliary panel)',
      async () => {
    if (!webglAvailable()) { pending('WebGL unavailable'); return; }
    const { el, clicks } = buildSurfaceElement();
    const { entry, scene } = sceneEntry('2d-space', {
      mainSurfaceElement: el, forcedFraming: 'exhibit', fixedRadius: 0.5,
    });
    const runtime = new XrSessionRuntime({ onEnded: () => {} });
    // No context.surfaces at all — a bare 2D space with nothing else
    // registered must still get its main quad.
    await runtime.enter(entry, { framing: 'inside', variantConfig: {} });
    try {
      await settle(150);
      const root = scene.getObjectByName('xr-panel-panel:main');
      expect(root).withContext('main quad auto-spawned').toBeTruthy();
      expect(root!.children.some(c => c.name === 'xr-panel-close'))
        .withContext('no close mesh on the main quad').toBeFalse();
      // Still interactive — same forwarding path as every other quad.
      aimControllerAt(scene, 'right', quadWorldCenter(scene, 'panel:main'));
      await settle(120);
      const controller = device.controllers['right']!;
      controller.updateButtonValue('trigger', 1);
      await settle(60);
      controller.updateButtonValue('trigger', 0);
      await settle(60);
      expect(clicks.length)
        .withContext('main quad forwards clicks like any panel')
        .toBeGreaterThan(0);
    } finally {
      await runtime.exit();
      await settle();
    }
    el.remove();
  });
});
