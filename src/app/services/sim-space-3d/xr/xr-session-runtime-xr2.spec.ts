/**
 * iwer-driven integration specs for the xr-2 session runtime: input
 * rig presence, framing-aware scale-relative entry (+ derived-scale
 * report-up), the mirror-ghost layer contract on the flat camera, and
 * the byte-identical exit including the camera's layer mask.
 */
import { XRDevice, metaQuest2 } from 'iwer';
import * as THREE from 'three';

import { XrSessionRuntime } from './xr-session-runtime';
import { XR_MIRROR_GHOST_LAYER } from './xr-mirror-ghost';
import type { XrSceneEntry } from '@services/xr/xr-scene-registry.service';
import type { XrEnterContext } from '@models/xr/xr-types';

function webglAvailable(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return !!(canvas.getContext('webgl2') || canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

describe('XrSessionRuntime (xr-2, iwer)', () => {
  let device: XRDevice;

  beforeAll(() => {
    device = new XRDevice(metaQuest2);
    device.installRuntime({ forceInstall: true });
  });

  function sceneEntry(name: string) {
    const scene = new THREE.Scene();
    // A unit box at the origin — bounding sphere radius √3/2 ≈ 0.866.
    scene.add(new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshBasicMaterial()));
    const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
    camera.position.set(2, 2, 2);
    const entry: XrSceneEntry = {
      id: `test-${name}`,
      label: name,
      spaceName: name,
      getHandle: () => ({ scene, camera }),
    };
    return { entry, scene, camera };
  }

  function contextOf(partial?: Partial<XrEnterContext>): XrEnterContext {
    return { framing: 'exhibit', variantConfig: {}, ...partial };
  }

  function settle(ms = 80): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async function withSession(
    context: XrEnterContext,
    body: (runtime: XrSessionRuntime, scene: THREE.Scene,
           camera: THREE.Camera) => Promise<void>,
  ): Promise<void> {
    const { entry, scene, camera } = sceneEntry('space-a');
    let ended = false;
    const runtime = new XrSessionRuntime({
      onEnded: () => { ended = true; },
    });
    await runtime.enter(entry, context);
    try {
      await body(runtime, scene, camera);
    } finally {
      await runtime.exit();
      await settle();
      expect(ended).toBe(true);
    }
  }

  it('derives the exhibit entry scale from the space extent and '
      + 'reports it up for persistence', async () => {
    if (!webglAvailable()) { pending('WebGL unavailable'); return; }
    let derived: number | null = null;
    await withSession(
      contextOf({ onDerivedEntryScale: s => (derived = s) }),
      async (_runtime, scene) => {
        const rig = scene.getObjectByName('polari-xr-rig')!;
        // radius ≈ 0.866, exhibit apparent 0.45 → scale ≈ 1.92.
        expect(rig.scale.x).toBeCloseTo(Math.sqrt(3) / 2 / 0.45, 2);
        expect(derived).toBeCloseTo(rig.scale.x, 10);
      });
  });

  it('a variant entry_scale WINS over derivation (knob over magic)',
      async () => {
    if (!webglAvailable()) { pending('WebGL unavailable'); return; }
    let derived: number | null = null;
    await withSession(
      contextOf({
        variantConfig: { entry_scale: 7.5 },
        onDerivedEntryScale: s => (derived = s),
      }),
      async (_runtime, scene) => {
        const rig = scene.getObjectByName('polari-xr-rig')!;
        expect(rig.scale.x).toBeCloseTo(7.5, 10);
        expect(derived).toBeNull(); // nothing derived — knob honored
      });
  });

  it('mounts the input rig (rays + grips + hands) and the mirror '
      + 'ghost inside the session rig', async () => {
    if (!webglAvailable()) { pending('WebGL unavailable'); return; }
    await withSession(contextOf(), async (_runtime, scene) => {
      await settle(); // let controllers connect
      const rig = scene.getObjectByName('polari-xr-rig')!;
      const rays = rig.children.filter(
        c => c.getObjectByName('xr-target-ray'));
      expect(rays.length).toBe(2);
      const ghost = rig.getObjectByName('xr-headset-ghost')!;
      expect(ghost).toBeTruthy();
      // Ghost lives ONLY on the mirror layer — the wearer's XR camera
      // (layers 1/2 + default) must not see it.
      ghost.traverse(o => {
        expect(o.layers.mask)
          .toBe(1 << XR_MIRROR_GHOST_LAYER);
      });
    });
  });

  it('enables the ghost layer on the FLAT camera while bound and '
      + 'restores the exact mask on exit', async () => {
    if (!webglAvailable()) { pending('WebGL unavailable'); return; }
    const { entry, scene, camera } = sceneEntry('space-mask');
    const maskBefore = camera.layers.mask;
    const childrenBefore =
      scene.children.map(c => `${c.uuid}:${c.name}`);
    let ended = false;
    const runtime = new XrSessionRuntime({
      onEnded: () => { ended = true; },
    });
    await runtime.enter(entry, contextOf());
    expect(camera.layers.mask & (1 << XR_MIRROR_GHOST_LAYER))
      .toBeTruthy();
    await runtime.exit();
    await settle();
    expect(ended).toBe(true);
    expect(camera.layers.mask).toBe(maskBefore);
    expect(scene.children.map(c => `${c.uuid}:${c.name}`))
      .toEqual(childrenBefore);
  });

  it('an iwer grip squeeze + hand push drives the rig (the one-grip '
      + 'shift end-to-end)', async () => {
    if (!webglAvailable()) { pending('WebGL unavailable'); return; }
    await withSession(
      // Short debounce keeps the spec fast; it is a knob.
      contextOf({ variantConfig: { nav: { shiftDebounceMs: 40 } } }),
      async (_runtime, scene) => {
        await settle(); // controllers connect
        const rig = scene.getObjectByName('polari-xr-rig')!;
        const positionBefore = rig.position.clone();

        const controller = device.controllers['right']!;
        controller.position.set(0.2, 1.4, -0.4);
        controller.updateButtonValue('squeeze', 1);
        await settle(120); // debounce passes, shift arms
        controller.position.set(0.2, 1.4, -0.8); // push forward
        await settle(250); // frames drive the rig
        controller.updateButtonValue('squeeze', 0);

        expect(rig.position.distanceTo(positionBefore))
          .toBeGreaterThan(1e-4);
      });
  });
});
