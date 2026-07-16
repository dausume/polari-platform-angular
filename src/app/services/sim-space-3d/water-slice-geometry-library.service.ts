/**
 * @cross-cutting
 * @tags @xc:render-3d, @xc:bindings
 * @consumers
 *   - ThreeSimSpaceRenderer (shapeRef values prefixed "waterslice:")
 * @see /AQUAPONICS_POT_SHAPE_PLAN.md (phase 3)
 *
 * Geometry cache for the aquaponics pot's live water-flow slice
 * (aquaponics-pot-shape phase 3) — same deferred-population trick as
 * MathShapeGeometryLibraryService, but keyed by POT NAME only (not
 * name+resolution) and re-fetchable at a NEW water_level_mm via
 * setWaterLevel() without dropping the cached THREE.BufferGeometry
 * instance — that's what lets a fill-animation driver update the
 * SAME mesh every tick instead of allocating a new one per frame.
 *
 * Unlike `mathshape:` shapes (a stored MathShapeDefinition row, static
 * until re-derived), the water slice has no backing row at all — every
 * request is a live Darcy solve (aquaponics/hydraulics.py::
 * water_slice_mesh), already 3-D-positioned in the SAME (cm,
 * z-vertical-through-the-pot's-own-center) frame the pot's own wall/
 * soil/hole meshes render in, so the points returned need no extra
 * transform here — just load straight into the BufferGeometry.
 */

import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import * as THREE from 'three';

import { RuntimeConfigService } from '@services/runtime-config.service';

interface WaterSliceResponse {
  ok: boolean;
  points?: number[][];
  triangles?: number[][];
  headValuesM?: number[];
  waterLevelMm?: number;
  outflowRateMlS?: number;
  note?: string;
  error?: string;
}

/** Last-fetched metadata for a pot's water slice — for a UI readout
 *  alongside the animated mesh (outflow rate, the current water
 *  level driving it, the backend's own approximation caveat). */
export interface WaterSliceMeta {
  waterLevelMm: number | null;
  outflowRateMlS: number | null;
  note: string | null;
  ok: boolean;
  error?: string;
}

@Injectable({ providedIn: 'root' })
export class WaterSliceGeometryLibraryService {
  private cache = new Map<string, THREE.BufferGeometry>();
  private meta = new Map<string, WaterSliceMeta>();
  /** Monotonic per-pot request counter — an in-flight fetch that
   *  resolves AFTER a newer one has already landed is discarded
   *  (same idiom as sim-space-viewer's evalRequestSeq), so a fast
   *  animation loop never lets a stale tick clobber a fresher one. */
  private requestSeq = new Map<string, number>();

  constructor(
    private http: HttpClient,
    private runtimeConfig: RuntimeConfigService
  ) {}

  /** Synchronous — returns a shared BufferGeometry for a pot's water
   *  slice at its default (maintained) water level. First call
   *  returns an empty geometry and kicks off the fetch; subsequent
   *  calls with the same pot name return the SAME instance. */
  get(potName: string, refine = 4): THREE.BufferGeometry {
    const cached = this.cache.get(potName);
    if (cached) return cached;
    const geometry = new THREE.BufferGeometry();
    this.cache.set(potName, geometry);
    this.fetchAndPopulate(potName, undefined, refine, geometry);
    return geometry;
  }

  /** The animation tick driver: re-solve at a SPECIFIC water_level_mm
   *  and update the pot's existing shared geometry in place — this is
   *  what lets a caller ramp water_level_mm 0 -> maintained level over
   *  time and see the SAME mesh update each tick (repeated
   *  independent steady-state solves; see water_slice_mesh's own
   *  documented approximation — not a true transient formulation). */
  async setWaterLevel(
    potName: string, waterLevelMm: number, refine = 4
  ): Promise<void> {
    const geometry = this.cache.get(potName) ?? this.get(potName, refine);
    await this.fetchAndPopulate(potName, waterLevelMm, refine, geometry);
  }

  /** Last-fetched outflow/head metadata for a pot, or null before the
   *  first fetch resolves. */
  lastResult(potName: string): WaterSliceMeta | null {
    return this.meta.get(potName) ?? null;
  }

  /** Drops the cached geometry + metadata for a pot so the next
   *  get() starts fresh (e.g. after the pot's own geometry changed
   *  via phase 2's editor — width/holes moved, so the old slice
   *  positioning is stale). */
  invalidate(potName: string): void {
    this.cache.delete(potName);
    this.meta.delete(potName);
  }

  private async fetchAndPopulate(
    potName: string, waterLevelMm: number | undefined, refine: number,
    geometry: THREE.BufferGeometry
  ): Promise<void> {
    const mySeq = (this.requestSeq.get(potName) ?? 0) + 1;
    this.requestSeq.set(potName, mySeq);
    try {
      const params = new URLSearchParams({ refine: String(refine) });
      if (waterLevelMm !== undefined) {
        params.set('waterLevelMm', String(waterLevelMm));
      }
      const url = `${this.runtimeConfig.getBackendBaseUrl()}`
        + `/api/aquaponics/pots/${encodeURIComponent(potName)}`
        + `/water-slice?${params.toString()}`;
      const resp = await firstValueFrom(
        this.http.get<WaterSliceResponse>(url));
      // A newer request already landed while this one was in flight —
      // never let a stale tick overwrite a fresher one.
      if (this.requestSeq.get(potName) !== mySeq) return;
      if (!resp?.ok || !resp.points?.length) {
        this.meta.set(potName, {
          waterLevelMm: null, outflowRateMlS: null, note: null,
          ok: false, error: resp?.error || 'no water-slice points',
        });
        console.warn(
          `[WaterSliceGeometryLibraryService] water-slice for "${potName}" `
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
          `[WaterSliceGeometryLibraryService] "${potName}" water-slice has `
          + 'no triangles — rendering as a point set.');
      }
      geometry.computeVertexNormals();
      geometry.computeBoundingSphere();
      this.meta.set(potName, {
        waterLevelMm: resp.waterLevelMm ?? null,
        outflowRateMlS: resp.outflowRateMlS ?? null,
        note: resp.note ?? null,
        ok: true,
      });
    } catch (err) {
      if (this.requestSeq.get(potName) !== mySeq) return;
      this.meta.set(potName, {
        waterLevelMm: null, outflowRateMlS: null, note: null,
        ok: false, error: err instanceof Error ? err.message : String(err),
      });
      console.warn(
        `[WaterSliceGeometryLibraryService] water-slice fetch failed for `
        + `"${potName}"`, err);
    }
  }
}
