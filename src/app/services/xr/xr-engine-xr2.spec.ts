/**
 * iwer-driven engine specs for xr-2: the engine resolves framing +
 * variant config on enter, persists the auto-derived entry scale
 * (knob over magic), and round-trips viewpoint bookmarks through the
 * variant store. The variant service is an in-memory stub — the HTTP
 * protocol itself is pinned in xr-variant.service.spec.ts.
 */
import { TestBed } from '@angular/core/testing';
import { XRDevice, metaQuest2 } from 'iwer';
import * as THREE from 'three';

import { XrEngineService } from './xr-engine.service';
import { XrSceneRegistryService } from './xr-scene-registry.service';
import { XrSettingsService } from './xr-settings.service';
import { XrVariantService } from './xr-variant.service';
import { XrVariantConfig } from '@models/xr/xr-types';

function webglAvailable(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return !!(canvas.getContext('webgl2') || canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

/** In-memory XrInterfaceVariant store with the real merge semantics. */
class VariantStub {
  store = new Map<string, XrVariantConfig>();

  key(kind: string, subject: string, mode: string): string {
    return `${kind}:${subject}:${mode}`;
  }
  async getConfig(kind: string, subject: string, mode: string):
      Promise<XrVariantConfig> {
    return { ...(this.store.get(this.key(kind, subject, mode)) ?? {}) };
  }
  async mergeConfig(kind: string, subject: string, mode: string,
      patch: Partial<XrVariantConfig>): Promise<XrVariantConfig> {
    const merged = {
      ...(this.store.get(this.key(kind, subject, mode)) ?? {}),
      ...patch,
    };
    this.store.set(this.key(kind, subject, mode), merged);
    return { ...merged };
  }
}

describe('XrEngineService (xr-2, iwer)', () => {
  let device: XRDevice;
  let variants: VariantStub;

  beforeAll(() => {
    device = new XRDevice(metaQuest2);
    device.installRuntime({ forceInstall: true });
  });

  function services(framing: 'inside' | 'exhibit' = 'exhibit') {
    variants = new VariantStub();
    TestBed.configureTestingModule({
      providers: [
        {
          provide: XrSettingsService,
          useValue: {
            resolve: () => Promise.resolve({ framing, mode: 'vr' }),
          },
        },
        { provide: XrVariantService, useValue: variants },
      ],
    });
    return {
      engine: TestBed.inject(XrEngineService),
      registry: TestBed.inject(XrSceneRegistryService),
    };
  }

  function sceneEntry(registry: XrSceneRegistryService, name: string) {
    const scene = new THREE.Scene();
    scene.add(new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshBasicMaterial()));
    const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
    const id = registry.register({
      label: name, spaceName: name,
      getHandle: () => ({ scene, camera }),
    });
    return { id, scene };
  }

  function settle(ms = 60): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  it('persists the derived entry scale into the variant on first '
      + 'entry', async () => {
    if (!webglAvailable()) { pending('WebGL unavailable'); return; }
    const { engine, registry } = services('exhibit');
    const a = sceneEntry(registry, 'pendulum');
    await engine.enter(a.id);
    expect(engine.state.active)
      .withContext(engine.state.lastError ?? 'no error').toBe(true);
    await settle();
    const stored =
      await variants.getConfig('sim-space', 'pendulum', 'vr');
    expect(stored.entry_scale)
      .toBeCloseTo(Math.sqrt(3) / 2 / 0.45, 2);
    await engine.exit();
    await settle();
  });

  it('bookmarks: save persists the pose per mode; goto jumps the '
      + 'live rig; delete is deliberate', async () => {
    if (!webglAvailable()) { pending('WebGL unavailable'); return; }
    const { engine, registry } = services();
    const a = sceneEntry(registry, 'pendulum');
    await engine.enter(a.id);
    expect(engine.state.active).toBe(true);

    expect(await engine.saveBookmark('overview')).toBe(true);
    const stored =
      await variants.getConfig('sim-space', 'pendulum', 'vr');
    expect(stored.bookmarks!.length).toBe(1);
    expect(stored.bookmarks![0].name).toBe('overview');
    const savedPose = stored.bookmarks![0].pose;

    // Move the rig, then jump back to the bookmark.
    const rig = a.scene.getObjectByName('polari-xr-rig')!;
    rig.position.x += 5;
    expect(engine.gotoBookmark('overview')).toBe(true);
    expect(rig.position.x).toBeCloseTo(savedPose.position[0], 10);

    await engine.deleteBookmark('overview');
    expect((await variants.getConfig(
      'sim-space', 'pendulum', 'vr')).bookmarks!.length).toBe(0);
    expect(engine.gotoBookmark('overview')).toBe(false);

    await engine.exit();
    await settle();
  });

  it('resetView + backView act on the live session', async () => {
    if (!webglAvailable()) { pending('WebGL unavailable'); return; }
    const { engine, registry } = services();
    const a = sceneEntry(registry, 'pendulum');
    await engine.enter(a.id);
    const rig = a.scene.getObjectByName('polari-xr-rig')!;
    const home = rig.position.clone();

    rig.position.x += 3; // drift (as if navigated)
    engine.resetView();
    expect(rig.position.distanceTo(home)).toBeLessThan(1e-9);
    expect(engine.backView()).toBe(true); // back to the drifted pose
    expect(rig.position.x).toBeCloseTo(home.x + 3, 9);

    await engine.exit();
    await settle();
  });
});
