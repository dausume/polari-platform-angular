/**
 * @cross-cutting
 * @tags @xc:render-3d, @xc:bindings
 * @consumers
 *   - ThreeSimSpaceRenderer (shapeRef values prefixed "mathshape:")
 * @see /AQUAPONICS_POT_SHAPE_PLAN.md (phase 1)
 *
 * Geometry cache for math-defined shapes (mathshapes module) — the
 * math-shape analog of what three-texture-builders is for textures.
 * `GET /api/shapes/{name}/surface` is a per-shape network call, so this
 * follows the SAME deferred-population trick THREE.TextureLoader uses:
 * get() returns a shared BufferGeometry SYNCHRONOUSLY (empty on first
 * call), then mutates that same instance's attributes in place once the
 * fetch resolves. The renderer's continuous render loop repaints on the
 * very next frame — no explicit "scene is dirty" signal needed.
 */

import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import * as THREE from 'three';

import { RuntimeConfigService } from '@services/runtime-config.service';

interface ShapeSurfaceResponse {
  ok: boolean;
  points?: number[][];
  triangles?: number[][];
}

@Injectable({ providedIn: 'root' })
export class MathShapeGeometryLibraryService {
  private cache = new Map<string, THREE.BufferGeometry>();
  private inFlight = new Set<string>();

  constructor(
    private http: HttpClient,
    private runtimeConfig: RuntimeConfigService
  ) {}

  /** Synchronous — returns a shared BufferGeometry for a math-shape by
   *  name (resolution `n`). First call returns an empty geometry and
   *  kicks off the surface fetch; subsequent calls with the same
   *  (shapeName, n) return the SAME instance, populated once the fetch
   *  lands. */
  get(shapeName: string, n = 32): THREE.BufferGeometry {
    const key = `${shapeName}:${n}`;
    const cached = this.cache.get(key);
    if (cached) return cached;
    const geometry = new THREE.BufferGeometry();
    this.cache.set(key, geometry);
    this.fetchAndPopulate(shapeName, n, geometry, key);
    return geometry;
  }

  /** Drops cached geometry for a shape name (all resolutions) so the
   *  next get() re-fetches fresh surface data — call after editing a
   *  pot's holes/dimensions and re-deriving its math shape (from-pot). */
  invalidate(shapeName: string): void {
    const prefix = `${shapeName}:`;
    for (const key of Array.from(this.cache.keys())) {
      if (key.startsWith(prefix)) this.cache.delete(key);
    }
  }

  private async fetchAndPopulate(
    shapeName: string, n: number, geometry: THREE.BufferGeometry, key: string
  ): Promise<void> {
    if (this.inFlight.has(key)) return;
    this.inFlight.add(key);
    try {
      const url = `${this.runtimeConfig.getBackendBaseUrl()}`
        + `/api/shapes/${encodeURIComponent(shapeName)}/surface?n=${n}`;
      const resp = await firstValueFrom(
        this.http.get<ShapeSurfaceResponse>(url));
      if (!resp?.ok || !resp.points?.length) {
        console.warn(
          `[MathShapeGeometryLibraryService] surface for "${shapeName}" `
          + 'returned no points — leaving geometry empty.');
        return;
      }
      const positions = new Float32Array(resp.points.length * 3);
      resp.points.forEach((p, i) => {
        positions[i * 3] = p[0] ?? 0;
        positions[i * 3 + 1] = p[1] ?? 0;
        positions[i * 3 + 2] = p[2] ?? 0;
      });
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      if (resp.triangles?.length) {
        geometry.setIndex(resp.triangles.flat());
      } else {
        console.warn(
          `[MathShapeGeometryLibraryService] "${shapeName}" surface has no `
          + 'triangles (CSG point-cloud path) — rendering as a point set.');
      }
      geometry.computeVertexNormals();
      geometry.computeBoundingSphere();
    } catch (err) {
      console.warn(
        `[MathShapeGeometryLibraryService] surface fetch failed for `
        + `"${shapeName}"`, err);
    } finally {
      this.inFlight.delete(key);
    }
  }
}
