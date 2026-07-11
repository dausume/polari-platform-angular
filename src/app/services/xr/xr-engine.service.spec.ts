/**
 * iwer-driven specs for the xr-1 engine: session grant, enter/exit,
 * scene-switch on ONE session, byte-identical scene restore, and the
 * capability probe. iwer (Immersive Web Emulator Runtime) injects a
 * synthetic navigator.xr so these run headless — the selftest idiom
 * for XR (WEBXR_PLAN.md §3).
 *
 * The spec imports three directly (spec-only; never enters app
 * bundles) to build real Scenes for the registry entries.
 */
import { TestBed } from '@angular/core/testing';
import { XRDevice, metaQuest2 } from 'iwer';
import * as THREE from 'three';

import { XrEngineService } from './xr-engine.service';
import { XrSceneRegistryService } from './xr-scene-registry.service';
import { XrCapabilityService } from './xr-capability.service';
import { XrSettingsService } from './xr-settings.service';
import { XrVariantService } from './xr-variant.service';

/** WebGL is required for the session tests (three's XR binding needs
 *  a real context). Headless Chrome ships SwiftShader so this should
 *  hold; if an environment truly lacks WebGL we skip loudly rather
 *  than fail on an infrastructure gap. */
function webglAvailable(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return !!(canvas.getContext('webgl2') || canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

describe('XrEngineService (iwer)', () => {
  let device: XRDevice;

  beforeAll(() => {
    device = new XRDevice(metaQuest2);
    // forceInstall: headless Chrome exposes a NATIVE navigator.xr
    // (which reports no devices) — the emulator must displace it.
    device.installRuntime({ forceInstall: true });
  });

  function services() {
    // The engine resolves framing + variant config on enter (xr-2);
    // stub both at their honest-degradation defaults — no backend in
    // karma, entry proceeds on 'exhibit' + {}.
    TestBed.configureTestingModule({
      providers: [
        {
          provide: XrSettingsService,
          useValue: {
            resolve: () => Promise.reject(new Error('no backend')),
          },
        },
        {
          provide: XrVariantService,
          useValue: {
            getConfig: () => Promise.resolve({}),
            mergeConfig: () => Promise.resolve({}),
          },
        },
      ],
    });
    return {
      engine: TestBed.inject(XrEngineService),
      registry: TestBed.inject(XrSceneRegistryService),
      capability: TestBed.inject(XrCapabilityService),
    };
  }

  function sceneEntry(registry: XrSceneRegistryService, name: string) {
    const scene = new THREE.Scene();
    scene.add(new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshBasicMaterial()));
    const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
    camera.position.set(2, 2, 2);
    const id = registry.register({
      label: name,
      spaceName: name,
      getHandle: () => ({ scene, camera }),
    });
    return { id, scene, camera };
  }

  /** Stable structural snapshot for the byte-identical-exit assert. */
  function snapshotOf(scene: THREE.Scene): string[] {
    return scene.children.map(c => `${c.uuid}:${c.name}`);
  }

  it('capability probe reports immersive-vr under the emulated runtime',
      async () => {
    const { capability } = services();
    const cap = await capability.capability();
    expect(cap.vr).toBe(true);
    expect(cap.reason).toBeNull();
  });

  it('enter → switch → exit runs ONE session and restores both scenes '
      + 'byte-identically', async () => {
    if (!webglAvailable()) {
      pending('WebGL unavailable in this environment — session test skipped');
      return;
    }
    const { engine, registry } = services();
    const a = sceneEntry(registry, 'space-a');
    const b = sceneEntry(registry, 'space-b');
    const beforeA = snapshotOf(a.scene);
    const beforeB = snapshotOf(b.scene);
    const flatCameraPos = a.camera.position.clone();

    await engine.enter(a.id);
    expect(engine.state.active)
      .withContext(engine.state.lastError ?? 'no error')
      .toBe(true);
    expect(engine.state.boundEntryId).toBe(a.id);
    // The session's rig is the ONLY scene mutation while immersed.
    expect(a.scene.getObjectByName('polari-xr-rig')).toBeTruthy();
    // The flat camera is a pose seed only — never mutated.
    expect(a.camera.position.equals(flatCameraPos)).toBe(true);

    // Entering another interface SWAPS the bound scene — same session.
    await engine.enter(b.id);
    expect(engine.state.active).toBe(true);
    expect(engine.state.boundEntryId).toBe(b.id);
    expect(a.scene.getObjectByName('polari-xr-rig')).toBeFalsy();
    expect(b.scene.getObjectByName('polari-xr-rig')).toBeTruthy();

    await engine.exit();
    // Session end propagates through the 'end' event — settle it.
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(engine.state.active).toBe(false);
    expect(engine.state.boundEntryId).toBeNull();
    expect(snapshotOf(a.scene)).toEqual(beforeA);
    expect(snapshotOf(b.scene)).toEqual(beforeB);
  });

  it('a viewer unregistering while bound exits the session first',
      async () => {
    if (!webglAvailable()) {
      pending('WebGL unavailable in this environment — session test skipped');
      return;
    }
    const { engine, registry } = services();
    const a = sceneEntry(registry, 'space-a');
    await engine.enter(a.id);
    expect(engine.state.active).toBe(true);
    await engine.onEntryUnregistering(a.id);
    await new Promise(resolve => setTimeout(resolve, 50));
    registry.unregister(a.id);
    expect(engine.state.active).toBe(false);
    expect(a.scene.getObjectByName('polari-xr-rig')).toBeFalsy();
  });

  it('entering an unknown entry surfaces an honest error, never throws',
      async () => {
    const { engine } = services();
    await engine.enter('xr-scene-does-not-exist');
    expect(engine.state.active).toBe(false);
    expect(engine.state.lastError).toContain('Unknown XR scene entry');
  });
});
