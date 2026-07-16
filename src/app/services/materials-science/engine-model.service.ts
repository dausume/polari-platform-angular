import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { PolariService } from '@services/polari-service';
import {
  parseCrudeReadAllResponse,
} from '@services/sim-space/crude-response-parser';

import {
  EngineTemplate,
  EngineModelClass,
  EngineModelRow,
  EngineRootCapability,
} from '@models/materials-science/engine-model-types';

/**
 * The engine-model layer's HTTP surface: the template catalog (with
 * live capability), FEM/DFT model rows via CRUDE, and the
 * validate/execute endpoints.
 */
@Injectable({ providedIn: 'root' })
export class EngineModelService {

  constructor(private http: HttpClient,
              private polariService: PolariService) {}

  private get base(): string {
    return this.polariService.getBackendBaseUrl();
  }

  async templates(): Promise<EngineTemplate[]> {
    const res = await firstValueFrom(this.http.get<
      { success: boolean; data: EngineTemplate[] }>(
      `${this.base}/api/msci/engine-templates`,
      this.polariService.backendRequestOptions));
    return res?.data ?? [];
  }

  async models(className: EngineModelClass): Promise<EngineModelRow[]> {
    const res = await firstValueFrom(this.http.get<any>(
      `${this.base}/${className}`,
      this.polariService.backendRequestOptions));
    return parseCrudeReadAllResponse(res, className) as EngineModelRow[];
  }

  /** The honest per-root capability map (fem/dft/md/meso) — the
   *  named-gap rows (forceFieldMD, dpd) ride inside each root. */
  async capability(): Promise<Record<string, EngineRootCapability>> {
    return firstValueFrom(this.http.get<Record<string, EngineRootCapability>>(
      `${this.base}/api/msci/engines/capability`,
      this.polariService.backendRequestOptions))
      .catch(() => ({}));
  }

  /** Standard CRUDE update (polariId + updateData FormData). */
  async saveModel(className: string, row: EngineModelRow
                  ): Promise<boolean> {
    const { id, ...vars } = row as unknown as Record<string, unknown>;
    const formData = new FormData();
    formData.append('polariId', String(id ?? ''));
    formData.append('updateData', JSON.stringify(vars));
    return firstValueFrom(this.http.put<any>(
      `${this.base}/${className}`, formData))
      .then(() => true).catch(() => false);
  }

  async validate(name: string): Promise<any> {
    return firstValueFrom(this.http.post<any>(
      `${this.base}/api/msci/models/${encodeURIComponent(name)}/validate`,
      {}, this.polariService.backendRequestOptions))
      .catch(err => err?.error ?? { ok: false, error: String(err) });
  }

  async execute(name: string): Promise<any> {
    return firstValueFrom(this.http.post<any>(
      `${this.base}/api/msci/models/${encodeURIComponent(name)}/execute`,
      {}, this.polariService.backendRequestOptions))
      .catch(err => err?.error ?? { ok: false, error: String(err) });
  }
}
