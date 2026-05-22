/**
 * @cross-cutting
 * @tags @xc:render-shared
 * @consumers
 *   - SimSpaceListPage, SimSpaceDetailPage
 *   - SimSpaceViewer (snapshot fetch)
 *   - Per-class binding-tab live preview (snapshot fetch)
 * @impact-on-edit
 *   Response shape changes here propagate from the backend SimSpaceAPI.
 *   Keep aligned with the SimSpaceSnapshot type in sim-space-types.ts.
 * @see /OVERLAP_MAP.md
 */

import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { RuntimeConfigService } from '@services/runtime-config.service';
import {
  SimSpaceDimensionality,
  SimSpaceEvaluationSnapshot,
  SimSpaceSnapshot,
} from '@models/sim-space/sim-space-types';

export interface SimSpaceSummary {
  name: string;
  description: string;
  dimensionality: SimSpaceDimensionality;
  coordinateSystem: 'math' | 'screen';
}

@Injectable({ providedIn: 'root' })
export class SimSpaceService {
  constructor(
    private http: HttpClient,
    private runtimeConfig: RuntimeConfigService
  ) {}

  async list(filter?: { dimensionality?: SimSpaceDimensionality }): Promise<SimSpaceSummary[]> {
    const params = new URLSearchParams();
    if (filter?.dimensionality) params.set('dimensionality', filter.dimensionality);
    const qs = params.toString() ? `?${params.toString()}` : '';
    const url = `${this.runtimeConfig.getBackendBaseUrl()}/api/simspace${qs}`;
    const resp = await firstValueFrom(
      this.http.get<{ success: boolean; data: SimSpaceSummary[] }>(url)
    );
    return resp.data || [];
  }

  async snapshot(name: string): Promise<SimSpaceSnapshot> {
    const url = `${this.runtimeConfig.getBackendBaseUrl()}/api/simspace/${encodeURIComponent(name)}/snapshot`;
    const resp = await firstValueFrom(
      this.http.get<{ success: boolean; data: SimSpaceSnapshot }>(url)
    );
    return resp.data;
  }

  /**
   * On-demand single-step evaluation of every SimSpaceEvaluationEquation
   * in the scene. Fired by the viewer (debounced) when the user pauses
   * on a particular scrubber position. Returns the same envelope shape
   * as the snapshot's `evaluations` field, with one `perStep` entry per
   * overlay carrying the requested step's values.
   *
   * Cheap on the server — leverages the LaTeX parse cache so repeated
   * stops only pay sub-millisecond SymPy substitution + evalf.
   */
  async evaluationsAt(name: string, opts: { step?: number; time?: number }): Promise<{
    evaluations: SimSpaceEvaluationSnapshot[];
    warnings: string[];
  }> {
    const params = new URLSearchParams();
    if (opts.step !== undefined) params.set('step', String(opts.step));
    else if (opts.time !== undefined) params.set('time', String(opts.time));
    const qs = params.toString() ? `?${params.toString()}` : '';
    const url = `${this.runtimeConfig.getBackendBaseUrl()}`
      + `/api/simspace/${encodeURIComponent(name)}/evaluations/at${qs}`;
    const resp = await firstValueFrom(
      this.http.get<{
        success: boolean;
        data: { evaluations: SimSpaceEvaluationSnapshot[]; warnings: string[] };
      }>(url)
    );
    return resp.data ?? { evaluations: [], warnings: [] };
  }
}
