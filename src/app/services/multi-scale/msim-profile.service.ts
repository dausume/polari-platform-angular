import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { PolariService } from '@services/polari-service';
import {
  parseCrudeReadAllResponse,
} from '@services/sim-space/crude-response-parser';

import {
  MsimProfile,
  ConformanceFinding,
  ConformanceReport,
} from '@models/multi-scale/msim-types';


/**
 * MultiScaleSimulationProfile (family) reads + the conformance
 * endpoint (GET /api/simulations/multi-scale/{msim}/profile-conformance).
 */
@Injectable({ providedIn: 'root' })
export class MsimProfileService {

  constructor(private http: HttpClient,
              private polariService: PolariService) {}

  async profile(name: string): Promise<MsimProfile | null> {
    const url = `${this.polariService.getBackendBaseUrl()}`
      + '/MultiScaleSimulationProfile';
    const rows = await firstValueFrom(this.http.get<any>(
      url, this.polariService.backendRequestOptions))
      .then(res => parseCrudeReadAllResponse(
        res, 'MultiScaleSimulationProfile'))
      .catch(() => []);
    const row: any = rows.find((r: any) => r.name === name);
    if (!row) return null;
    const parse = (blob: string, fallback: any) => {
      try { return JSON.parse(blob || '') ?? fallback; }
      catch { return fallback; }
    };
    return {
      name: row.name,
      display_name: row.display_name || row.name,
      description: row.description || '',
      scaleLevels: parse(row.scale_levels_json, []),
      stageTemplates: parse(row.stage_templates_json, []),
      fidelityLadder: parse(row.fidelity_ladder_json, []),
      panelRoster: parse(row.panel_roster_json, []),
      couplingShapes: parse(row.coupling_shapes_json, []),
      defaultSearchPolicy: parse(row.default_search_policy_json, {}),
    };
  }

  async conformance(msimName: string): Promise<ConformanceReport | null> {
    const url = `${this.polariService.getBackendBaseUrl()}`
      + `/api/simulations/multi-scale/${encodeURIComponent(msimName)}`
      + '/profile-conformance';
    return firstValueFrom(this.http.get<
      { success: boolean; data: ConformanceReport }>(
      url, this.polariService.backendRequestOptions))
      .then(res => res?.data ?? null)
      .catch(() => null);
  }
}
