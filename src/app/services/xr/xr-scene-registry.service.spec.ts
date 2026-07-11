/**
 * Unit tests for XrSceneRegistryService — register/unregister
 * lifecycle, entry lookup, and entries$ emissions. Pure (no three,
 * no WebXR): the registry is the main-bundle side of the xr-1 seam.
 */
import { TestBed } from '@angular/core/testing';

import { XrSceneRegistryService } from './xr-scene-registry.service';

describe('XrSceneRegistryService', () => {
  function make(): XrSceneRegistryService {
    TestBed.configureTestingModule({});
    return TestBed.inject(XrSceneRegistryService);
  }

  function entry(spaceName: string) {
    return {
      label: spaceName,
      spaceName,
      getHandle: () => ({ scene: {}, camera: {} }),
    };
  }

  it('registers entries with unique ids and lists them', () => {
    const reg = make();
    const a = reg.register(entry('space-a'));
    const b = reg.register(entry('space-b'));
    expect(a).not.toEqual(b);
    expect(reg.list().map(e => e.spaceName)).toEqual(['space-a', 'space-b']);
    expect(reg.get(a)?.label).toBe('space-a');
  });

  it('unregister removes exactly one entry; unknown ids are no-ops', () => {
    const reg = make();
    const a = reg.register(entry('space-a'));
    const b = reg.register(entry('space-b'));
    reg.unregister(a);
    expect(reg.get(a)).toBeNull();
    expect(reg.get(b)).not.toBeNull();
    reg.unregister('nonsense'); // must not throw or disturb others
    expect(reg.list().length).toBe(1);
  });

  it('entries$ emits on every register/unregister', () => {
    const reg = make();
    const sizes: number[] = [];
    const sub = reg.entries$.subscribe(list => sizes.push(list.length));
    const a = reg.register(entry('space-a'));
    reg.register(entry('space-b'));
    reg.unregister(a);
    sub.unsubscribe();
    expect(sizes).toEqual([0, 1, 2, 1]);
  });
});
