/**
 * @cross-cutting
 * @tags @xc:render-shared
 * @consumers
 *   - SimSpaceViewer (asks for a renderer for the current definition)
 *   - Per-class binding-tab live preview
 * @impact-on-edit
 *   Adding a new dimensionality (none planned beyond 2d/3d) requires a
 *   new branch here AND an `import * from 'sim-space-Xd/...'`. Keep this
 *   factory as the only place that knows about all renderer impls.
 *
 *   3D renderer is lazy-loaded via dynamic import — keeps `three`
 *   (~600KB) out of the main bundle for users who never open a 3D scene.
 * @see /OVERLAP_MAP.md
 */

import { Injectable } from '@angular/core';

import { SimSpaceRenderer } from './sim-space-renderer.interface';
import {
  SimSpaceDefinitionPayload,
  SimSpaceDimensionality,
} from '@models/sim-space/sim-space-types';
import { D3SimSpaceRenderer } from '@services/sim-space-2d/d3-renderer.service';
import { Shape2DLibraryService } from '@services/sim-space-2d/shape-2d-library.service';
import { Style2DLibraryService } from '@services/sim-space-2d/style-2d-library.service';
import { Mesh3DLibraryService } from '@services/sim-space-3d/mesh-3d-library.service';
import { Material3DLibraryService } from '@services/sim-space-3d/material-3d-library.service';
import { Texture3DLibraryService } from '@services/sim-space-3d/texture-3d-library.service';
import { MathShapeGeometryLibraryService } from '@services/sim-space-3d/math-shape-geometry-library.service';
import { WaterSliceGeometryLibraryService } from '@services/sim-space-3d/water-slice-geometry-library.service';
import { PlantSkeletonGeometryLibraryService } from '@services/sim-space-3d/plant-skeleton-geometry-library.service';

@Injectable({ providedIn: 'root' })
export class SimSpaceRendererFactory {
  constructor(
    private shapes2D: Shape2DLibraryService,
    private styles2D: Style2DLibraryService,
    private meshes3D: Mesh3DLibraryService,
    private materials3D: Material3DLibraryService,
    private textures3D: Texture3DLibraryService,
    private mathShapeGeometry3D: MathShapeGeometryLibraryService,
    private waterSliceGeometry3D: WaterSliceGeometryLibraryService,
    private plantSkeletonGeometry3D: PlantSkeletonGeometryLibraryService
  ) {}

  /**
   * Returns a fresh renderer for the given dimensionality. Caller owns
   * lifecycle (must call attach() then destroy() on teardown).
   *
   * 3D is async because the `three` module is loaded on demand. 2D is
   * synchronous since d3 is already in the main bundle (no-code uses it).
   */
  async create(dimensionality: SimSpaceDimensionality): Promise<SimSpaceRenderer> {
    if (dimensionality === '2d') {
      return new D3SimSpaceRenderer(this.shapes2D, this.styles2D);
    }
    if (dimensionality === '3d') {
      // Dynamic import so `three` only enters the bundle when actually
      // needed. The import path is captured by Angular's bundler as a
      // lazy chunk.
      const { ThreeSimSpaceRenderer } = await import(
        '@services/sim-space-3d/three-renderer.service'
      );
      return new ThreeSimSpaceRenderer(this.meshes3D, this.materials3D,
                                       this.textures3D, this.mathShapeGeometry3D,
                                       this.waterSliceGeometry3D,
                                       this.plantSkeletonGeometry3D);
    }
    throw new Error(`[SimSpaceRendererFactory] dimensionality "${dimensionality}" not supported.`);
  }

  async createForDefinition(def: SimSpaceDefinitionPayload): Promise<SimSpaceRenderer> {
    return this.create(def.dimensionality);
  }
}
