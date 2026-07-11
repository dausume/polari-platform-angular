/**
 * @module services/xr/xr-capability.service
 *
 * Probes WebXR device capability ONCE (navigator.xr.isSessionSupported
 * for immersive-vr / immersive-ar) and caches the answer for the whole
 * session. Three-free — rides the main bundle so any component can ask
 * without pulling XR machinery.
 *
 * Honesty matrix (xr-1): configuration says what a space IS, this
 * service says what the DEVICE can do — never conflated. Consumers
 * render disabled buttons with `reason`, never hidden affordances.
 */

import { Injectable } from '@angular/core';

import { XrCapability } from '@models/xr/xr-types';

@Injectable({ providedIn: 'root' })
export class XrCapabilityService {
  private probe?: Promise<XrCapability>;

  /** The cached one-shot probe. Never rejects — absence of WebXR is a
   *  regular (honest) answer, not an error. */
  capability(): Promise<XrCapability> {
    if (!this.probe) this.probe = this.runProbe();
    return this.probe;
  }

  private async runProbe(): Promise<XrCapability> {
    const xr = (navigator as any)?.xr;
    if (!xr?.isSessionSupported) {
      return {
        vr: false, ar: false,
        reason: 'WebXR is not available in this browser',
      };
    }
    const supported = async (mode: string): Promise<boolean> => {
      try {
        return !!(await xr.isSessionSupported(mode));
      } catch {
        // Permission policy / secure-context refusals read as
        // "not supported here" — still an honest no.
        return false;
      }
    };
    const [vr, ar] = await Promise.all([
      supported('immersive-vr'), supported('immersive-ar'),
    ]);
    return {
      vr, ar,
      reason: vr || ar ? null : 'No XR-capable device detected',
    };
  }
}
