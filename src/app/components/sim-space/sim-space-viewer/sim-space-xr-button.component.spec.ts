/**
 * Honesty-matrix specs for the Enter-XR button (xr-1): resolved mode
 * (what the space IS) × device capability (what the device CAN do) —
 * disabled with the honest reason, never hidden while offered, never
 * a dead click. Pure logic tests via direct instantiation with stub
 * services (no HTTP, no WebXR).
 */
import { BehaviorSubject, Subject } from 'rxjs';

import {
  SimSpaceXrButtonComponent,
} from './sim-space-xr-button.component';
import { XrResolution } from '@models/xr/xr-types';

function resolutionOf(mode: XrResolution['mode']): XrResolution {
  return {
    spaceName: 'space-a', multiscaleName: '',
    mode, modeResolvedFrom: 'type',
    framing: 'exhibit', framingResolvedFrom: 'builtin',
    category: 'msim-world', categorySource: 'explicit',
    rungs: {
      individual: { mode: 'unset', framing: 'unset' },
      multiscale: null,
      type: { mode, framing: 'unset' },
      global: { mode: 'unset', framing: 'unset' },
    },
    typeDefaultName: 'xr-type-msim-world',
  };
}

describe('SimSpaceXrButtonComponent honesty matrix', () => {
  function make(opts: {
    mode: XrResolution['mode'];
    vr: boolean;
    bound?: string | null;
  }): SimSpaceXrButtonComponent {
    const settings: any = {
      resolve: () => Promise.resolve(resolutionOf(opts.mode)),
      changed$: new Subject<string>(),
    };
    const capabilities: any = {
      capability: () => Promise.resolve({
        vr: opts.vr, ar: false,
        reason: opts.vr ? null : 'No XR-capable device detected',
      }),
    };
    const engine: any = {
      state$: new BehaviorSubject({
        active: !!opts.bound, boundEntryId: opts.bound ?? null,
        entering: false, lastError: null,
      }),
      enter: jasmine.createSpy('enter'),
      exit: jasmine.createSpy('exit'),
    };
    const c = new SimSpaceXrButtonComponent(settings, capabilities, engine);
    c.spaceName = 'space-a';
    c.entryId = 'xr-scene-1';
    return c;
  }

  async function settled(c: SimSpaceXrButtonComponent): Promise<void> {
    c.ngOnInit();
    // resolve + capability are microtask promises — flush them.
    await Promise.resolve();
    await c.refreshResolution();
  }

  it('vr mode + capable device → live Enter VR', async () => {
    const c = make({ mode: 'vr', vr: true });
    await settled(c);
    expect(c.disabledReason).toBeNull();
    expect(c.label).toBe('Enter VR');
  });

  it('vr mode + no device → disabled with the capability reason', async () => {
    const c = make({ mode: 'vr', vr: false });
    await settled(c);
    expect(c.disabledReason).toContain('No XR-capable device');
  });

  it('ar mode → honest xr-4 message even on a capable device', async () => {
    const c = make({ mode: 'ar', vr: true });
    await settled(c);
    expect(c.disabledReason).toContain('AR arrives with xr-4');
  });

  it('none mode → no affordance at all (provenance lives in the sidebar)',
      async () => {
    const c = make({ mode: 'none', vr: true });
    await settled(c);
    // Template guards on mode !== 'none'; the state that drives it:
    expect(c.resolution?.mode).toBe('none');
    expect(c.offersVr).toBe(false);
  });

  it('another scene holds the session → Switch VR here', async () => {
    const c = make({ mode: 'both', vr: true, bound: 'xr-scene-2' });
    await settled(c);
    expect(c.isBoundHere).toBe(false);
    expect(c.label).toBe('Switch VR here');
    expect(c.disabledReason).toBeNull();
  });

  it('this scene holds the session → Exit VR', async () => {
    const c = make({ mode: 'vr', vr: true, bound: 'xr-scene-1' });
    await settled(c);
    expect(c.isBoundHere).toBe(true);
    expect(c.label).toBe('Exit VR');
  });
});
