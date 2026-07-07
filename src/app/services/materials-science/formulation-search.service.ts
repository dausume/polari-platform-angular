import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { PolariService } from '@services/polari-service';
import {
  parseCrudeReadAllResponse,
} from '@services/sim-space/crude-response-parser';

/** A FormulationSearchDefinition row (backend field names). */
export interface FormulationSearchDef {
  id?: string;
  name: string;
  display_name: string;
  description: string;
  target_profile_id: string;
  targets_json: string;
  base_material_name: string;
  base_properties_json: string;
  additive_pool_json: string;
  sourcing_policy: string;
  mode: string;
  knobs_json: string;
  process: string;
  thermal_knobs_json: string;
  fidelity_stages_json: string;
  results_keep_top_n: number;
  enabled: boolean;
}

/** One persisted candidate (GET .../runs payload shape). */
export interface FormulationCandidate {
  name: string;
  rank: number;
  components: { materialId: string; weightPercent: number }[];
  predicted: Record<string, number>;
  score: number;
  meetsTargets: boolean;
  violations: any[];
  unpredicted: string[];
  thermalVerdict: Record<string, any>;
  fidelity: {
    screening?: { status: string };
    femVerify?: { status: string; components?: any[]; reason?: string };
    dftEvidence?: { status: string };
  };
  isWinner: boolean;
  promotedScaleDef: string;
}

/** One persisted run (GET .../runs payload shape). */
export interface FormulationRun {
  name: string;
  mode: string;
  status: string;
  outcome: string;
  evaluated: number;
  sweepCapped: boolean;
  winnersCount: number;
  sourcingPolicy: string;
  startedAt: string;
  finishedAt: string;
  error: string;
  fidelitySummary: Record<string, any>;
  gapAnalysis: any[];
  trajectory: any[];
  excludedBySourcing: string[];
  predictableProperties: string[];
  assumptions: string[];
  candidates: FormulationCandidate[];
}

/**
 * The FormulationSearchDefinition object surface: CRUDE read/update of
 * the definition rows plus the run / list-runs / promote endpoints
 * (materialsScience.formulation_search_api).
 */
@Injectable({ providedIn: 'root' })
export class FormulationSearchService {

  constructor(private http: HttpClient,
              private polariService: PolariService) {}

  private get base(): string {
    return this.polariService.getBackendBaseUrl();
  }

  async definitions(): Promise<FormulationSearchDef[]> {
    const url = `${this.base}/FormulationSearchDefinition`;
    const res = await firstValueFrom(this.http.get<any>(
      url, this.polariService.backendRequestOptions));
    return parseCrudeReadAllResponse(
      res, 'FormulationSearchDefinition') as FormulationSearchDef[];
  }

  /** Standard CRUDE update (polariId + updateData FormData — the same
   *  convention the msim authoring service uses). */
  async saveDefinition(def: FormulationSearchDef): Promise<boolean> {
    const url = `${this.base}/FormulationSearchDefinition`;
    const { id, ...vars } = def as unknown as Record<string, unknown>;
    const formData = new FormData();
    formData.append('polariId', String(id ?? ''));
    formData.append('updateData', JSON.stringify(vars));
    return firstValueFrom(this.http.put<any>(url, formData))
      .then(() => true).catch(() => false);
  }

  async run(searchName: string, opts?: {
    continueAfterWinner?: boolean;
    knobOverrides?: Record<string, unknown>;
  }): Promise<any> {
    const url = `${this.base}/api/msci/formulation-searches/`
      + `${encodeURIComponent(searchName)}/run`;
    const body: Record<string, unknown> = {};
    if (opts?.continueAfterWinner) body['continueAfterWinner'] = true;
    if (opts?.knobOverrides) body['knobOverrides'] = opts.knobOverrides;
    return firstValueFrom(this.http.post<any>(
      url, body, this.polariService.backendRequestOptions));
  }

  async runs(searchName: string): Promise<FormulationRun[]> {
    const url = `${this.base}/api/msci/formulation-searches/`
      + `${encodeURIComponent(searchName)}/runs`;
    const res = await firstValueFrom(this.http.get<
      { success: boolean; data: FormulationRun[] }>(
      url, this.polariService.backendRequestOptions));
    return res?.data ?? [];
  }

  /** The EXPLICIT winner → MaterialScaleDefinition L1 promotion knob. */
  async promote(runName: string, candidateName: string): Promise<any> {
    const url = `${this.base}/api/msci/formulation-runs/`
      + `${encodeURIComponent(runName)}/promote/`
      + `${encodeURIComponent(candidateName)}`;
    return firstValueFrom(this.http.post<any>(
      url, {}, this.polariService.backendRequestOptions));
  }
}
