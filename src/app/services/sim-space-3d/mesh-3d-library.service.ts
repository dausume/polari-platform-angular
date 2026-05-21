/**
 * @cross-cutting
 * @tags @xc:render-3d, @xc:bindings
 * @consumers
 *   - ThreeSimSpaceRenderer (resolves shapeRef → Mesh3DDef)
 *   - SimSpace3D binding-tab dropdowns (Phase 2.5+)
 * @see /OVERLAP_MAP.md
 */

import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, firstValueFrom } from 'rxjs';

import { RuntimeConfigService } from '@services/runtime-config.service';
import { parseCrudeReadAllResponse } from '@services/sim-space/crude-response-parser';

export interface Mesh3DDef {
  name: string;
  description: string;
  source: 'builtin' | 'gltf' | 'three-json';
  builtin_name: string;
  primitive_params_json?: string;
  s3_bucket?: string;
  s3_object_key?: string;
  inline_definition?: string;
  bounding_box_json?: string;
}

@Injectable({ providedIn: 'root' })
export class Mesh3DLibraryService {
  private readonly _meshes$ = new BehaviorSubject<Mesh3DDef[]>([]);
  private byName = new Map<string, Mesh3DDef>();
  private loaded = false;

  constructor(
    private http: HttpClient,
    private runtimeConfig: RuntimeConfigService
  ) {}

  get meshes$(): Observable<Mesh3DDef[]> {
    return this._meshes$.asObservable();
  }

  async load(force = false): Promise<Mesh3DDef[]> {
    if (this.loaded && !force) return this._meshes$.value;
    const url = `${this.runtimeConfig.getBackendBaseUrl()}/Mesh3DDefinition`;
    try {
      const resp = await firstValueFrom(this.http.get<any>(url));
      const raw = parseCrudeReadAllResponse(resp, 'Mesh3DDefinition');
      const meshes: Mesh3DDef[] = raw.map(r => ({
        name: r.name ?? '',
        description: r.description ?? '',
        source: (r.source ?? 'builtin') as 'builtin' | 'gltf' | 'three-json',
        builtin_name: r.builtin_name ?? r.builtinName ?? '',
        primitive_params_json: r.primitive_params_json ?? r.primitiveParamsJson ?? '{}',
        s3_bucket: r.s3_bucket ?? r.s3Bucket ?? '',
        s3_object_key: r.s3_object_key ?? r.s3ObjectKey ?? '',
        inline_definition: r.inline_definition ?? r.inlineDefinition ?? '',
        bounding_box_json: r.bounding_box_json ?? r.boundingBoxJson ?? '',
      }));
      this.byName = new Map(meshes.map(m => [m.name, m]));
      this._meshes$.next(meshes);
      this.loaded = true;
      return meshes;
    } catch (err) {
      console.warn('[Mesh3DLibraryService] load failed', err);
      this._meshes$.next([]);
      this.loaded = true;
      return [];
    }
  }

  get(name: string): Mesh3DDef | undefined { return this.byName.get(name); }
}
