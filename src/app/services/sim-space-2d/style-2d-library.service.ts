/**
 * @cross-cutting
 * @tags @xc:render-2d, @xc:bindings, @xc:maps
 * @consumers
 *   - D3SimSpaceRenderer (resolves styleRef → resolved style)
 *   - SimSpace2D binding-tab dropdowns
 *   - Future: Maps marker library
 * @impact-on-edit
 *   Changing field names breaks the renderer's style consumption.
 *   Keep aligned with backend Style2DDefinition columns.
 * @see /OVERLAP_MAP.md
 */

import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, firstValueFrom } from 'rxjs';

import { RuntimeConfigService } from '@services/runtime-config.service';
import { parseCrudeReadAllResponse } from '@services/sim-space/crude-response-parser';

/**
 * Flattened style — already resolves label_json into discrete fields the
 * renderer can read without further parsing. Keep all rendering-relevant
 * fields on this struct.
 */
export interface Style2DDef {
  name: string;
  description: string;
  width: number;
  height: number;
  fill_color: string;
  stroke_color: string;
  stroke_width: number;
  opacity: number;
  anchor: 'center' | 'bottom';
  // Flattened label config (from label_json on the backend row).
  label_text: string;
  label_color: string;
  label_font_size: number;
}

@Injectable({ providedIn: 'root' })
export class Style2DLibraryService {
  private readonly _styles$ = new BehaviorSubject<Style2DDef[]>([]);
  private byName = new Map<string, Style2DDef>();
  private loaded = false;

  constructor(
    private http: HttpClient,
    private runtimeConfig: RuntimeConfigService
  ) {}

  get styles$(): Observable<Style2DDef[]> {
    return this._styles$.asObservable();
  }

  async load(force = false): Promise<Style2DDef[]> {
    if (this.loaded && !force) return this._styles$.value;
    const url = `${this.runtimeConfig.getBackendBaseUrl()}/Style2DDefinition`;
    try {
      const resp = await firstValueFrom(this.http.get<any>(url));
      const raw = parseCrudeReadAllResponse(resp, 'Style2DDefinition');
      const styles: Style2DDef[] = raw.map(this.normalize);
      this.byName = new Map(styles.map(s => [s.name, s]));
      this._styles$.next(styles);
      this.loaded = true;
      return styles;
    } catch (err) {
      console.warn('[Style2DLibraryService] load failed', err);
      this._styles$.next([]);
      this.loaded = true;
      return [];
    }
  }

  get(name: string): Style2DDef | undefined {
    return this.byName.get(name);
  }

  private normalize(raw: any): Style2DDef {
    // Try to parse label_json — fall back to empty label.
    let labelText = '';
    let labelColor = '#1a1a1a';
    let labelFontSize = 11;
    try {
      const lj = raw.label_json ?? raw.labelJson;
      if (lj) {
        const parsed = typeof lj === 'string' ? JSON.parse(lj) : lj;
        labelText = parsed?.text ?? '';
        labelColor = parsed?.color ?? labelColor;
        labelFontSize = Number(parsed?.fontSize ?? labelFontSize);
      }
    } catch {
      // Malformed label_json — just skip rather than fail the whole row.
    }
    return {
      name: raw.name ?? '',
      description: raw.description ?? '',
      width: Number(raw.width ?? 24),
      height: Number(raw.height ?? 24),
      fill_color: raw.fill_color ?? raw.fillColor ?? '#1976d2',
      stroke_color: raw.stroke_color ?? raw.strokeColor ?? '#0d47a1',
      stroke_width: Number(raw.stroke_width ?? raw.strokeWidth ?? 1.5),
      opacity: Number(raw.opacity ?? 1),
      anchor: (raw.anchor ?? 'center') as 'center' | 'bottom',
      label_text: labelText,
      label_color: labelColor,
      label_font_size: labelFontSize,
    };
  }
}
