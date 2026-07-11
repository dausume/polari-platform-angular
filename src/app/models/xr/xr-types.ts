/**
 * @module models/xr/xr-types
 *
 * XR cascade types (xr-1, WEBXR_PLAN.md) — mirrors the backend xr
 * module: mode/framing values, the four-level resolution result served
 * by GET /api/xr/resolve, and the XrInterfaceVariant row shape.
 * Three-free by design: these types ride the main bundle.
 */

export type XrModeValue = 'unset' | 'none' | 'vr' | 'ar' | 'both';
export type XrFramingValue = 'unset' | 'inside' | 'exhibit';
export type XrResolvedFrom =
  'individual' | 'multiscale' | 'type' | 'global' | 'builtin';

/** One rung's raw values (null = rung absent for this space). */
export interface XrRung {
  mode: XrModeValue;
  framing: XrFramingValue;
}

/** Response of GET /api/xr/resolve?space=<name>[&multiscale=<name>]. */
export interface XrResolution {
  spaceName: string;
  multiscaleName: string;
  mode: Exclude<XrModeValue, 'unset'>;
  modeResolvedFrom: XrResolvedFrom;
  framing: Exclude<XrFramingValue, 'unset'>;
  framingResolvedFrom: XrResolvedFrom;
  category: string;
  categorySource: 'explicit' | 'module' | 'none';
  rungs: {
    individual: XrRung | null;
    multiscale: XrRung | null;
    type: XrRung | null;
    global: XrRung | null;
  };
  typeDefaultName: string;
}

/** Device capability, probed once per session (navigator.xr). */
export interface XrCapability {
  /** immersive-vr sessions supported on this device+browser. */
  vr: boolean;
  /** immersive-ar sessions supported on this device+browser. */
  ar: boolean;
  /** Honest reason when a capability is absent (shown on the
   *  disabled button — never a hidden or dead affordance). */
  reason: string | null;
}

/** XrInterfaceVariant row (CRUDE) — per-mode interface configuration.
 *  Settings decide what's OFFERED; these rows are data and survive
 *  every settings flip. */
export interface XrInterfaceVariantRow {
  id?: string;
  name: string;
  subject_kind: 'sim-space' | 'multiscale';
  subject_name: string;
  mode: 'flat' | 'vr' | 'ar';
  config_json: string;
  notes: string;
}
