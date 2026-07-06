/**
 * @cross-cutting
 * @tags @xc:render-3d, @xc:bindings
 * @consumers
 *   - ThreeSimSpaceRenderer (resolves a material's map_texture_ref)
 * @see /OVERLAP_MAP.md
 *
 * Texture3DDefinition cache — the structural mirror of
 * Material3DLibraryService. Rows describe 3D-applicable TEXTURES
 * (procedural-first; `source:'image'` + S3 fields are the file-store
 * knob wired in a follow-up); three-texture-builders turns a def into a
 * THREE.Texture.
 */

import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, firstValueFrom } from 'rxjs';

import { RuntimeConfigService } from '@services/runtime-config.service';
import { parseCrudeReadAllResponse } from '@services/sim-space/crude-response-parser';

export interface Texture3DDef {
  name: string;
  description?: string;
  source: 'procedural' | 'image';
  procedural_kind: 'checker' | 'stripes' | 'gradient' | 'noise';
  /** Opaque generator params (colors, cells, scale, seed …). */
  procedural_params_json: string;
  s3_bucket: string;
  s3_object_key: string;
  wrap_s: 'repeat' | 'clamp' | 'mirror';
  wrap_t: 'repeat' | 'clamp' | 'mirror';
  repeat_u: number;
  repeat_v: number;
  offset_u: number;
  offset_v: number;
  rotation: number;
}

@Injectable({ providedIn: 'root' })
export class Texture3DLibraryService {
  private readonly _textures$ = new BehaviorSubject<Texture3DDef[]>([]);
  private byName = new Map<string, Texture3DDef>();
  private loaded = false;

  constructor(
    private http: HttpClient,
    private runtimeConfig: RuntimeConfigService
  ) {}

  get textures$(): Observable<Texture3DDef[]> {
    return this._textures$.asObservable();
  }

  async load(force = false): Promise<Texture3DDef[]> {
    if (this.loaded && !force) return this._textures$.value;
    const url = `${this.runtimeConfig.getBackendBaseUrl()}/Texture3DDefinition`;
    try {
      const resp = await firstValueFrom(this.http.get<any>(url));
      const raw = parseCrudeReadAllResponse(resp, 'Texture3DDefinition');
      const textures: Texture3DDef[] = raw.map(r => ({
        name: r.name ?? '',
        description: r.description ?? '',
        source: (r.source ?? 'procedural') as Texture3DDef['source'],
        procedural_kind:
          (r.procedural_kind ?? 'noise') as Texture3DDef['procedural_kind'],
        procedural_params_json: r.procedural_params_json ?? '{}',
        s3_bucket: r.s3_bucket ?? '',
        s3_object_key: r.s3_object_key ?? '',
        wrap_s: (r.wrap_s ?? 'repeat') as Texture3DDef['wrap_s'],
        wrap_t: (r.wrap_t ?? 'repeat') as Texture3DDef['wrap_t'],
        repeat_u: Number(r.repeat_u ?? 1),
        repeat_v: Number(r.repeat_v ?? 1),
        offset_u: Number(r.offset_u ?? 0),
        offset_v: Number(r.offset_v ?? 0),
        rotation: Number(r.rotation ?? 0),
      }));
      this.byName = new Map(textures.map(t => [t.name, t]));
      this._textures$.next(textures);
      this.loaded = true;
      return textures;
    } catch (err) {
      console.warn('[Texture3DLibraryService] load failed', err);
      this._textures$.next([]);
      this.loaded = true;
      return [];
    }
  }

  get(name: string): Texture3DDef | undefined { return this.byName.get(name); }
}
