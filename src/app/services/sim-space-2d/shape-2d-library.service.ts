/**
 * @cross-cutting
 * @tags @xc:render-2d, @xc:bindings, @xc:maps
 * @consumers
 *   - D3SimSpaceRenderer (resolves shapeRef → Shape2DDef)
 *   - SimSpace2D binding-tab dropdowns
 *   - Future: Maps marker library (post-consolidation)
 * @impact-on-edit
 *   Changing the shape of Shape2DDef ripples to the renderer + any UI
 *   that displays library entries. Keep field names aligned with the
 *   backend Shape2DDefinition column names.
 * @see /OVERLAP_MAP.md
 */

import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, firstValueFrom } from 'rxjs';

import { RuntimeConfigService } from '@services/runtime-config.service';
import { parseCrudeReadAllResponse } from '@services/sim-space/crude-response-parser';

/** Frontend model of a row from the backend Shape2DDefinition table. */
export interface Shape2DDef {
  name: string;
  description: string;
  source: 'builtin' | 'svg';
  builtin_name: string;
  svg_string?: string;
  default_width: number;
  default_height: number;
  anchor: 'center' | 'bottom';
  category: string;
}

/**
 * Caches Shape2DDefinition rows in a BehaviorSubject keyed by name.
 * Renderer + binding tab share the same load via `load()`.
 *
 * The backend's auto-CRUDE endpoint serves rows under
 * /api/Shape2DDefinition (camelCase className → URL path).
 */
@Injectable({ providedIn: 'root' })
export class Shape2DLibraryService {
  private readonly _shapes$ = new BehaviorSubject<Shape2DDef[]>([]);
  private byName = new Map<string, Shape2DDef>();
  private loaded = false;

  constructor(
    private http: HttpClient,
    private runtimeConfig: RuntimeConfigService
  ) {}

  get shapes$(): Observable<Shape2DDef[]> {
    return this._shapes$.asObservable();
  }

  async load(force = false): Promise<Shape2DDef[]> {
    if (this.loaded && !force) return this._shapes$.value;
    const url = `${this.runtimeConfig.getBackendBaseUrl()}/Shape2DDefinition`;
    try {
      const resp = await firstValueFrom(this.http.get<any>(url));
      // Auto-CRUDE wraps rows in [{ "Shape2DDefinition": [{ data: [...] }] }] —
      // unwrap via the shared helper. Returns a flat row array.
      const raw = parseCrudeReadAllResponse(resp, 'Shape2DDefinition');
      const shapes: Shape2DDef[] = raw.map(this.normalize);
      this.byName = new Map(shapes.map(s => [s.name, s]));
      this._shapes$.next(shapes);
      this.loaded = true;
      return shapes;
    } catch (err) {
      console.warn('[Shape2DLibraryService] load failed', err);
      this._shapes$.next([]);
      this.loaded = true;
      return [];
    }
  }

  get(name: string): Shape2DDef | undefined {
    return this.byName.get(name);
  }

  private normalize(raw: any): Shape2DDef {
    return {
      name: raw.name ?? '',
      description: raw.description ?? '',
      source: (raw.source ?? 'builtin') as 'builtin' | 'svg',
      builtin_name: raw.builtin_name ?? raw.builtinName ?? '',
      svg_string: raw.svg_string ?? raw.svgString,
      default_width: Number(raw.default_width ?? raw.defaultWidth ?? 16),
      default_height: Number(raw.default_height ?? raw.defaultHeight ?? 16),
      anchor: (raw.anchor ?? 'center') as 'center' | 'bottom',
      category: raw.category ?? 'general',
    };
  }
}
