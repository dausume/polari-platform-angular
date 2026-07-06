/**
 * @cross-cutting
 * @tags @xc:render-3d
 * @consumers
 *   - ThreeSimSpaceRenderer
 * @see /OVERLAP_MAP.md
 *
 * Three.js material builders: the standard set of MeshXxxMaterial
 * variants — Standard (PBR) is the default — plus an optional albedo
 * TEXTURE (Texture3DDefinition via three-texture-builders; the caller
 * resolves the def's map_texture_ref and passes the built texture in,
 * keeping this module a pure sync function).
 */

import * as THREE from 'three';

import { Material3DDef } from './material-3d-library.service';

/** Fallback used when a material ref can't be resolved — magenta for visibility. */
export const FALLBACK_MATERIAL_DEF: Material3DDef = {
  name: 'fallback',
  description: '',
  material_type: 'standard',
  color: '#ff00ff',
  emissive: '#000000',
  emissive_intensity: 0,
  metalness: 0,
  roughness: 0.5,
  opacity: 1,
  transparent: false,
  double_sided: false,
  flat_shading: false,
  wireframe: false,
  map_texture_ref: '',
};

/**
 * Build a Three.js material from a Material3DDef. Always returns a
 * fresh material — callers own its lifetime (must dispose on teardown).
 * `texture` is the def's resolved albedo map, when it has one (textures
 * themselves are cached/shared by three-texture-builders).
 */
export function buildMaterial(materialDef: Material3DDef | undefined,
                              texture?: THREE.Texture | null): THREE.Material {
  const def = materialDef ?? FALLBACK_MATERIAL_DEF;
  const side = def.double_sided ? THREE.DoubleSide : THREE.FrontSide;
  const common = {
    color: new THREE.Color(def.color),
    opacity: def.opacity,
    transparent: def.transparent || def.opacity < 1,
    side,
    wireframe: def.wireframe,
    ...(texture ? { map: texture } : {}),
  };
  switch (def.material_type) {
    case 'basic':   return new THREE.MeshBasicMaterial(common);
    case 'lambert': return new THREE.MeshLambertMaterial(common);
    case 'phong':   return new THREE.MeshPhongMaterial(common);
    case 'standard':
    case 'physical':
    default:
      return new THREE.MeshStandardMaterial({
        ...common,
        metalness: def.metalness,
        roughness: def.roughness,
        emissive: new THREE.Color(def.emissive),
        emissiveIntensity: def.emissive_intensity,
        flatShading: def.flat_shading,
      });
  }
}
