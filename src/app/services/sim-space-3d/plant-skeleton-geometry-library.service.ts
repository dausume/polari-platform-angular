/**
 * @cross-cutting
 * @tags @xc:render-3d, @xc:bindings
 * @consumers
 *   - ThreeSimSpaceRenderer (shapeRef values prefixed "plantskeleton:")
 * @see /AQUAPONICS_POT_SHAPE_PLAN.md (phase 6/7)
 *
 * Geometry for the plant-growth-sim animation-bones skeleton
 * (aquaponics/plant_skeleton.py::generate_skeleton) — same deferred-
 * population trick as MathShapeGeometryLibraryService/
 * WaterSliceGeometryLibraryService: get() returns a shared
 * THREE.BufferGeometry synchronously (empty on first call), populated
 * in place once the async fetch resolves.
 *
 * Unlike the water slice (already a triangulated mesh from the
 * backend), a skeleton is a LIST OF BONES (start/end point + radius,
 * mm, pot-local frame) — this service is what turns that vector graph
 * into an actual renderable mesh: one primitive per bone, merged into
 * a single BufferGeometry via three's own
 * BufferGeometryUtils.mergeGeometries (reused, not hand-rolled vertex
 * merging). Bone points are mm; the pot's own wall/soil/hole/water
 * meshes are all in CM (aquaponics.hydraulics.water_slice_mesh's own
 * convention) — divided by 10 here so a skeleton drops into the same
 * scene with no separate transform on the mesh/material side.
 *
 * Phase 13 (2026-07-15): each bone carries a real `shapePrimitive`
 * (aquaponics/plant_skeleton.py, sourced from OrganModel.
 * shape_primitive) — root/stem/branch AXIS bones are always
 * 'cylinder' (a real physical taper), but terminal organ bones
 * (leaf/flower/fruit) get their species' real shape (lamina/
 * ellipsoid/cone) instead of the same generic tapered-cylinder stand-
 * in every organ used to render as before this phase.
 */

import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

import { RuntimeConfigService } from '@services/runtime-config.service';

interface SkeletonBone {
  id: string;
  parentId: string | null;
  part: string;
  organ: string | null;
  generation: number;
  startPointMm: number[];
  endPointMm: number[];
  startRadiusMm: number;
  endRadiusMm: number;
  shapePrimitive?: string;
}

interface SkeletonResponse {
  ok: boolean;
  bones?: SkeletonBone[];
  boneCount?: number;
  cappedByGenerations?: boolean;
  cappedByBoneCount?: boolean;
  rootPattern?: string;
  note?: string;
  error?: string;
}

/** Last-fetched metadata for a planting's skeleton — surfaced
 *  alongside the mesh (bone count, whether either safety cap was
 *  hit — never silently truncated, per plant_skeleton.py's own
 *  contract). */
export interface PlantSkeletonMeta {
  boneCount: number | null;
  cappedByGenerations: boolean;
  cappedByBoneCount: boolean;
  rootPattern: string | null;
  ok: boolean;
  error?: string;
}

/** Minimum radius (mm) fed to CylinderGeometry — a real bone tip can
 *  taper to ~0, but a zero-radius cylinder degenerates visually
 *  (renders as an invisible sliver from most angles). Purely a
 *  render-floor, never affects the backend's own reported radius. */
const MIN_RENDER_RADIUS_MM = 0.15;
// Was 6 (hexagonal) — root branches taper down through many
// generations to short, thin terminal stubs, and a hexagonal
// cross-section on a steeply-tapered short cylinder visually reads as
// a literal geometric cone rather than an organic root tip (Dustin,
// 2026-07-15: "cones at the bottom of the roots... abnormal and out
// of place"). Bumped to smooth that out; still an axis-bone cylinder
// underneath, this only changes tessellation, not the real taper data.
const RADIAL_SEGMENTS = 10;
// Thin, roughly-planar slab for 'lamina' (leaf-blade) organs.
const LAMINA_THICKNESS_CM = 0.05;

@Injectable({ providedIn: 'root' })
export class PlantSkeletonGeometryLibraryService {
  private cache = new Map<string, THREE.BufferGeometry>();
  private meta = new Map<string, PlantSkeletonMeta>();
  private requestSeq = new Map<string, number>();

  constructor(
    private http: HttpClient,
    private runtimeConfig: RuntimeConfigService
  ) {}

  /** Synchronous — returns a shared BufferGeometry for a planting's
   *  skeleton. First call returns an empty geometry and kicks off the
   *  fetch; subsequent calls with the same planting name return the
   *  SAME instance. */
  get(plantingName: string): THREE.BufferGeometry {
    const cached = this.cache.get(plantingName);
    if (cached) return cached;
    const geometry = new THREE.BufferGeometry();
    this.cache.set(plantingName, geometry);
    this.fetchAndPopulate(plantingName, geometry);
    return geometry;
  }

  /** Last-fetched bone-count/cap metadata for a planting, or null
   *  before the first fetch resolves. */
  lastResult(plantingName: string): PlantSkeletonMeta | null {
    return this.meta.get(plantingName) ?? null;
  }

  /** Drops the cached geometry so the next get() re-fetches — call
   *  after advance_growth() changes a planting's normalized_growth
   *  (the skeleton's SHAPE equations depend on current growth, so a
   *  stale cached mesh would show pre-growth-tick sizing). */
  invalidate(plantingName: string): void {
    this.cache.delete(plantingName);
    this.meta.delete(plantingName);
  }

  private async fetchAndPopulate(
    plantingName: string, geometry: THREE.BufferGeometry
  ): Promise<void> {
    const mySeq = (this.requestSeq.get(plantingName) ?? 0) + 1;
    this.requestSeq.set(plantingName, mySeq);
    try {
      const url = `${this.runtimeConfig.getBackendBaseUrl()}`
        + `/api/aquaponics/plantings/${encodeURIComponent(plantingName)}`
        + '/skeleton';
      const resp = await firstValueFrom(this.http.get<SkeletonResponse>(url));
      if (this.requestSeq.get(plantingName) !== mySeq) return;
      if (!resp?.ok || !resp.bones?.length) {
        this.meta.set(plantingName, {
          boneCount: null, cappedByGenerations: false,
          cappedByBoneCount: false, rootPattern: null, ok: false,
          error: resp?.error || 'no skeleton bones',
        });
        console.warn(
          `[PlantSkeletonGeometryLibraryService] skeleton for `
          + `"${plantingName}" returned no bones — leaving geometry empty.`);
        return;
      }
      const merged = buildSkeletonGeometry(resp.bones);
      if (merged) {
        geometry.copy(merged);
        merged.dispose();
      }
      this.meta.set(plantingName, {
        boneCount: resp.boneCount ?? resp.bones.length,
        cappedByGenerations: !!resp.cappedByGenerations,
        cappedByBoneCount: !!resp.cappedByBoneCount,
        rootPattern: resp.rootPattern ?? null,
        ok: true,
      });
    } catch (err) {
      if (this.requestSeq.get(plantingName) !== mySeq) return;
      this.meta.set(plantingName, {
        boneCount: null, cappedByGenerations: false,
        cappedByBoneCount: false, rootPattern: null, ok: false,
        error: err instanceof Error ? err.message : String(err),
      });
      console.warn(
        `[PlantSkeletonGeometryLibraryService] skeleton fetch failed for `
        + `"${plantingName}"`, err);
    }
  }
}

/** One real-shaped primitive per bone (mm -> cm, pot-local frame),
 *  merged into a single BufferGeometry. A bone's own start/end radius
 *  IS the taper/size (plant_skeleton.py already computed it from the
 *  growth engine's shape equations) — this only turns that data into
 *  geometry, it never invents or smooths a radius itself. Branches on
 *  bone.shapePrimitive (OrganModel.shape_primitive, threaded through
 *  since phase 13) so leaf/flower/fruit organs get a shape that
 *  actually resembles the real organ instead of every bone rendering
 *  as a generic tapered cylinder. */
function buildSkeletonGeometry(
  bones: SkeletonBone[]
): THREE.BufferGeometry | null {
  const pieces: THREE.BufferGeometry[] = [];
  for (const bone of bones) {
    const piece = buildBoneGeometry(bone);
    if (piece) pieces.push(piece);
  }
  if (!pieces.length) return null;
  const merged = mergeGeometries(pieces, false);
  pieces.forEach(p => p.dispose());
  if (!merged) return null;
  merged.computeVertexNormals();
  merged.computeBoundingSphere();
  return merged;
}

/** Builds + orients ONE bone's geometry, dispatching on shapePrimitive.
 *  Every primitive is authored along +Y centered at its own origin
 *  (three.js's own convention for Cylinder/Cone/Box/Sphere), so all
 *  branches share the same "rotate +Y onto the bone direction, then
 *  translate to the midpoint" placement step at the end. */
function buildBoneGeometry(bone: SkeletonBone): THREE.BufferGeometry | null {
  const start = new THREE.Vector3(
    (bone.startPointMm[0] ?? 0) / 10,
    (bone.startPointMm[1] ?? 0) / 10,
    (bone.startPointMm[2] ?? 0) / 10
  );
  const end = new THREE.Vector3(
    (bone.endPointMm[0] ?? 0) / 10,
    (bone.endPointMm[1] ?? 0) / 10,
    (bone.endPointMm[2] ?? 0) / 10
  );
  const axis = new THREE.Vector3().subVectors(end, start);
  const length = axis.length();
  if (length < 1e-6) return null;
  const radiusTop = Math.max(
    bone.endRadiusMm / 10, MIN_RENDER_RADIUS_MM / 10);
  const radiusBottom = Math.max(
    bone.startRadiusMm / 10, MIN_RENDER_RADIUS_MM / 10);
  // Widest of the two ends — a leaf/fruit's own currentWidthMm was
  // passed in by _attach_organs as the organ's startRadiusMm, so this
  // recovers that real width instead of guessing one.
  const widthCm = Math.max(radiusTop, radiusBottom) * 2;

  let geom: THREE.BufferGeometry;
  switch (bone.shapePrimitive) {
    case 'lamina':
      // A flat blade: real leaf width across, real bone length long,
      // a thin constant thickness — NOT a cylinder of revolution.
      geom = new THREE.BoxGeometry(widthCm, length, LAMINA_THICKNESS_CM);
      break;
    case 'ellipsoid': {
      // A unit sphere stretched into an ellipsoid: real width across,
      // real length long, a modest thickness so it doesn't render as
      // a flat disc.
      const sphere = new THREE.SphereGeometry(0.5, 12, 8);
      sphere.scale(widthCm, length, widthCm * 0.5);
      geom = sphere;
      break;
    }
    case 'cone':
      // ConeGeometry's apex sits at +Y, base at -Y — base at the
      // bone's start (attachment point), apex at its end/tip.
      geom = new THREE.ConeGeometry(radiusBottom, length, RADIAL_SEGMENTS);
      break;
    case 'cylinder':
    default:
      geom = new THREE.CylinderGeometry(
        radiusTop, radiusBottom, length, RADIAL_SEGMENTS, 1);
      break;
  }

  const up = new THREE.Vector3(0, 1, 0);
  const direction = axis.clone().normalize();
  const quaternion = new THREE.Quaternion().setFromUnitVectors(
    up, direction);
  geom.applyQuaternion(quaternion);
  const midpoint = new THREE.Vector3()
    .addVectors(start, end).multiplyScalar(0.5);
  geom.translate(midpoint.x, midpoint.y, midpoint.z);
  return geom;
}
