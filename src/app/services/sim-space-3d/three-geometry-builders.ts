/**
 * @cross-cutting
 * @tags @xc:render-3d
 * @consumers
 *   - ThreeSimSpaceRenderer (sole runtime consumer)
 * @impact-on-edit
 *   Adding a new built-in primitive: add a case here and a matching
 *   Mesh3DDefinition seed entry. Avoid leaking three-specific knowledge
 *   beyond this file — renderer just calls buildGeometry().
 * @see /OVERLAP_MAP.md
 *
 * Three.js geometry builders for built-in Mesh3DDefinition primitives.
 * Pure factory functions; no renderer state. Each takes the parsed
 * primitive_params and returns a fresh BufferGeometry.
 */

import * as THREE from 'three';

import { Mesh3DDef } from './mesh-3d-library.service';

type PrimitiveBuilder = (params: any) => THREE.BufferGeometry;

const BUILDERS: Record<string, PrimitiveBuilder> = {
  // --- Core primitives ---
  cube:     (p) => new THREE.BoxGeometry(p.width ?? 1, p.height ?? 1, p.depth ?? 1),
  sphere:   (p) => new THREE.SphereGeometry(
    p.radius ?? 0.5, p.widthSegments ?? 32, p.heightSegments ?? 16
  ),
  cylinder: (p) => new THREE.CylinderGeometry(
    p.radiusTop ?? 0.5, p.radiusBottom ?? 0.5,
    p.height ?? 1, p.radialSegments ?? 32
  ),
  cone:     (p) => new THREE.ConeGeometry(
    p.radius ?? 0.5, p.height ?? 1, p.radialSegments ?? 32
  ),
  plane:    (p) => new THREE.PlaneGeometry(p.width ?? 1, p.height ?? 1),
  torus:    (p) => new THREE.TorusGeometry(
    p.radius ?? 0.5, p.tube ?? 0.15,
    p.radialSegments ?? 16, p.tubularSegments ?? 32
  ),

  // --- 3D analogs of 2D shapes ---
  /**
   * Pyramid — square-base 4-sided pyramid. Built from ConeGeometry with
   * 4 radial segments; render with a flat-shaded material to crispen
   * the facets. Apex at +Y; base centered at -Y/2.
   */
  pyramid: (p) => new THREE.ConeGeometry(
    p.radius ?? 0.6, p.height ?? 1, /* radialSegments = */ 4
  ),
  /**
   * Octahedron — the 3D analog of the 2D "diamond" shape. Bipyramid
   * with a square equator.
   */
  octahedron: (p) => new THREE.OctahedronGeometry(p.radius ?? 0.5, p.detail ?? 0),
  /** Tetrahedron — 3D analog of the 2D "triangle". */
  tetrahedron: (p) => new THREE.TetrahedronGeometry(p.radius ?? 0.6, p.detail ?? 0),
  /** Icosahedron — 20-face polyhedron; closest 3D analog of a "star". */
  icosahedron: (p) => new THREE.IcosahedronGeometry(p.radius ?? 0.55, p.detail ?? 0),
  /** Dodecahedron — 12-face Platonic solid; data-science friendly look. */
  dodecahedron: (p) => new THREE.DodecahedronGeometry(p.radius ?? 0.55, p.detail ?? 0),
};

/**
 * Build a Three.js BufferGeometry from a Mesh3DDef. Defaults to a unit
 * cube when the definition is missing or references an unknown builtin.
 */
export function buildGeometry(meshDef: Mesh3DDef | undefined): THREE.BufferGeometry {
  const name = meshDef?.builtin_name || 'cube';
  if (meshDef && !BUILDERS[name]) {
    // Honest gap instead of a silently wrong shape on screen.
    console.warn(
      `[buildGeometry] mesh "${meshDef.name}" names unknown builtin "${name}" — falling back to a unit cube`);
  }
  const params = parseJsonSafe(meshDef?.primitive_params_json);
  const builder = BUILDERS[name] ?? BUILDERS['cube'];
  return builder(params);
}

function parseJsonSafe(s: string | undefined): any {
  if (!s) return {};
  try { return JSON.parse(s); } catch { return {}; }
}
