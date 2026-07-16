import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { PolariService } from '@services/polari-service';
import {
  parseCrudeReadAllResponse,
} from '@services/sim-space/crude-response-parser';
import {
  FormulationSearchDef,
  FormulationRun,
} from '@models/materials-science/formulation-search-types';

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
