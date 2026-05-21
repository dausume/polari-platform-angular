/**
 * @cross-cutting
 * @tags @xc:render-3d
 * @consumers
 *   - ThreeSimSpaceRenderer
 * @see /OVERLAP_MAP.md
 *
 * Three.js material builders. Phase 2 supports the standard set of
 * MeshXxxMaterial variants — Standard (PBR) is the default. Textures
 * land in a later phase via Texture3DDefinition + UV mapping.
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
};

/**
 * Build a Three.js material from a Material3DDef. Always returns a
 * fresh material — callers own its lifetime (must dispose on teardown).
 */
export function buildMaterial(materialDef: Material3DDef | undefined): THREE.Material {
  const def = materialDef ?? FALLBACK_MATERIAL_DEF;
  const side = def.double_sided ? THREE.DoubleSide : THREE.FrontSide;
  const common = {
    color: new THREE.Color(def.color),
    opacity: def.opacity,
    transparent: def.transparent || def.opacity < 1,
    side,
    wireframe: def.wireframe,
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
