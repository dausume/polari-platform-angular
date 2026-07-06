/**
 * @cross-cutting
 * @tags @xc:render-shared
 * @consumers
 *   - SimSpaceViewerComponent (applies the active profile)
 * @see /OVERLAP_MAP.md
 *
 * SCREEN PROFILES — the "how does this scene change for the screen it's
 * viewed on" knob. The authored scene config is the DESKTOP baseline;
 * profiles live in the definition blob and take over automatically when
 * the HOST is narrow (host width, not window — a squeezed desktop panel
 * deserves the same adaptation as a phone):
 *
 *   definition: {
 *     "screenProfiles": [
 *       {"name": "phone", "maxWidth": 560,
 *        "camera": {"fitMargin": 1.05, "fov": 55},
 *        "objectOverrides": {
 *          "choice-lead": {"position": [0, -0.45, 0]}   // re-arrange
 *        }}
 *     ],
 *     ...
 *   }
 *
 * `camera` merges OVER the scene's camera_json (auto-fit still runs on
 * the merged result); `objectOverrides` patch compiled objects by id.
 * The narrowest matching profile wins; no match = pure desktop config.
 */

import {
  SimSpaceCameraConfig, SimSpaceDefinitionPayload, SimSpaceObject,
} from '@models/sim-space/sim-space-types';

export interface ScreenProfile {
  name: string;
  /** Active while host width <= maxWidth (px). Omitted = never auto. */
  maxWidth?: number;
  camera?: Partial<SimSpaceCameraConfig>;
  objectOverrides?: Record<string, {
    position?: number[];
    scale?: number | number[];
  }>;
}

export function parseScreenProfiles(
  definitionBlob: string | undefined): ScreenProfile[] {
  if (!definitionBlob) return [];
  try {
    const blob = JSON.parse(definitionBlob);
    const profiles = blob?.screenProfiles;
    return Array.isArray(profiles)
      ? profiles.filter(p => p && typeof p === 'object' && p.name)
      : [];
  } catch {
    return [];
  }
}

/** The narrowest profile whose maxWidth admits `hostWidth` (most
 *  specific wins), or null for the authored desktop baseline. */
export function resolveScreenProfile(
  profiles: ScreenProfile[], hostWidth: number): ScreenProfile | null {
  const matching = profiles
    .filter(p => typeof p.maxWidth === 'number' && hostWidth <= p.maxWidth!)
    .sort((a, b) => (a.maxWidth! - b.maxWidth!));
  return matching[0] ?? null;
}

/** A payload copy with the profile's camera override merged in (the
 *  renderer re-runs auto-fit on the merged config). */
export function applyProfileToDefinition(
  def: SimSpaceDefinitionPayload,
  profile: ScreenProfile | null,
): SimSpaceDefinitionPayload {
  if (!profile?.camera) return def;
  return { ...def, camera: { ...(def.camera ?? {}), ...profile.camera } };
}

/** Objects with the profile's per-id position/scale patches applied. */
export function applyProfileToObjects(
  objects: SimSpaceObject[],
  profile: ScreenProfile | null,
): SimSpaceObject[] {
  const overrides = profile?.objectOverrides;
  if (!overrides) return objects;
  return objects.map(obj => {
    const patch = overrides[obj.id];
    if (!patch) return obj;
    return {
      ...obj,
      ...(patch.position
        ? { position: patch.position as SimSpaceObject['position'] } : {}),
      ...(patch.scale !== undefined ? { scale: patch.scale as any } : {}),
    };
  });
}
