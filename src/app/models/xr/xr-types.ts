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

// ---------------------------------------------------------------------
// xr-2: navigation — rig poses, knobs, and the variant config blob
// ---------------------------------------------------------------------

/** A saveable rig viewpoint. Yaw-only rotation by design: navigation
 *  never tilts the horizon (nausea-safe), so a pose is fully described
 *  by position + yaw + scale. */
export interface XrRigPose {
  position: [number, number, number];
  yaw: number;
  scale: number;
}

/** A named, persisted viewpoint (bookmarks live per mode in
 *  XrInterfaceVariant.config_json). */
export interface XrViewpointBookmark {
  name: string;
  pose: XrRigPose;
}

/** Navigation tuning — every one of these is a knob (Q8 defaults). */
export interface XrNavKnobs {
  /** ms a single grip must be held before the shift arms. */
  shiftDebounceMs: number;
  /** meters of hand travel ignored around the shift origin. */
  deadZoneM: number;
  /** shift response curve — linear to start, expo as the other value. */
  responseCurve: 'linear' | 'expo';
  /** drive gain: user-space m/s per meter of offset past the dead zone. */
  speedGain: number;
  /** comfort vignette during shifts/grabs — default ON. */
  vignetteOnShift: boolean;
  /** thumbstick/touchpad snap turn (seated use). */
  snapTurn: boolean;
  snapTurnDegrees: number;
  /** which wrist carries the exit/reset UI ('left' assumes a
   *  right-hand pointer — must be flippable). */
  wristHandedness: 'left' | 'right';
  /** soft zoom clamps, RELATIVE to the entry scale (10^±exponent). */
  scaleRangeExponent: number;
}

export const XR_NAV_DEFAULTS: XrNavKnobs = {
  shiftDebounceMs: 250,
  deadZoneM: 0.05,
  responseCurve: 'linear',
  speedGain: 2.0,
  vignetteOnShift: true,
  snapTurn: true,
  snapTurnDegrees: 30,
  wristHandedness: 'left',
  scaleRangeExponent: 3,
};

/** What the engine hands the (lazy-chunk) session runtime at
 *  enter/switch: the resolved framing plus this space's variant
 *  configuration. Plain data — the runtime stays the only three-side
 *  code. */
export interface XrEnterContext {
  framing: Exclude<XrFramingValue, 'unset'>;
  variantConfig: XrVariantConfig;
  /** Fired when the runtime AUTO-DERIVES the entry scale (no
   *  entry_scale in the variant yet) — the engine persists it so the
   *  derived value becomes an editable knob. */
  onDerivedEntryScale?: (scale: number) => void;
}

/** The parsed shape of XrInterfaceVariant.config_json for a 'vr'
 *  variant (xr-2 keys; xr-3 adds panel placements alongside). */
export interface XrVariantConfig {
  /** Initial rig scale — auto-derived from the space extent × framing
   *  on first entry, then editable (knob over magic). */
  entry_scale?: number;
  nav?: Partial<XrNavKnobs>;
  bookmarks?: XrViewpointBookmark[];
  /** xr-3+ keys ride along untouched. */
  [key: string]: unknown;
}
