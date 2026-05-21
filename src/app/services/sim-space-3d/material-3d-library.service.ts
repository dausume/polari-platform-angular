/**
 * @cross-cutting
 * @tags @xc:render-3d, @xc:bindings
 * @consumers
 *   - ThreeSimSpaceRenderer
 *   - SimSpace3D binding-tab dropdowns (Phase 2.5+)
 * @see /OVERLAP_MAP.md
 */

import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, firstValueFrom } from 'rxjs';

import { RuntimeConfigService } from '@services/runtime-config.service';
import { parseCrudeReadAllResponse } from '@services/sim-space/crude-response-parser';

export interface Material3DDef {
  name: string;
  description?: string;
  material_type: 'basic' | 'lambert' | 'phong' | 'standard' | 'physical';
  color: string;
  emissive: string;
  emissive_intensity: number;
  metalness: number;
  roughness: number;
  opacity: number;
  transparent: boolean;
  double_sided: boolean;
  flat_shading: boolean;
  wireframe: boolean;
}

@Injectable({ providedIn: 'root' })
export class Material3DLibraryService {
  private readonly _materials$ = new BehaviorSubject<Material3DDef[]>([]);
  private byName = new Map<string, Material3DDef>();
  private loaded = false;

  constructor(
    private http: HttpClient,
    private runtimeConfig: RuntimeConfigService
  ) {}

  get materials$(): Observable<Material3DDef[]> {
    return this._materials$.asObservable();
  }

  async load(force = false): Promise<Material3DDef[]> {
    if (this.loaded && !force) return this._materials$.value;
    const url = `${this.runtimeConfig.getBackendBaseUrl()}/Material3DDefinition`;
    try {
      const resp = await firstValueFrom(this.http.get<any>(url));
      const raw = parseCrudeReadAllResponse(resp, 'Material3DDefinition');
      const mats: Material3DDef[] = raw.map(r => ({
        name: r.name ?? '',
        description: r.description ?? '',
        material_type: (r.material_type ?? r.materialType ?? 'standard') as Material3DDef['material_type'],
        color: r.color ?? '#1976d2',
        emissive: r.emissive ?? '#000000',
        emissive_intensity: Number(r.emissive_intensity ?? r.emissiveIntensity ?? 0),
        metalness: Number(r.metalness ?? 0),
        roughness: Number(r.roughness ?? 0.5),
        opacity: Number(r.opacity ?? 1),
        transparent: !!(r.transparent ?? false),
        double_sided: !!(r.double_sided ?? r.doubleSided ?? false),
        flat_shading: !!(r.flat_shading ?? r.flatShading ?? false),
        wireframe: !!(r.wireframe ?? false),
      }));
      this.byName = new Map(mats.map(m => [m.name, m]));
      this._materials$.next(mats);
      this.loaded = true;
      return mats;
    } catch (err) {
      console.warn('[Material3DLibraryService] load failed', err);
      this._materials$.next([]);
      this.loaded = true;
      return [];
    }
  }

  get(name: string): Material3DDef | undefined { return this.byName.get(name); }
}
