import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { PolariService } from '@services/polari-service';
import {
  parseCrudeReadAllResponse,
} from '@services/sim-space/crude-response-parser';

/** One catalog row from GET /api/msci/engine-templates. */
export interface EngineTemplate {
  name: string;
  displayName: string;
  description: string;
  engineKind: 'fem' | 'dft' | string;
  engineKey: string;
  parameterSchema: {
    section: string; key: string; type: string; unit?: string;
    required?: boolean; default?: unknown; min?: number; max?: number;
    description?: string;
  }[];
  sectionMap: Record<string, string>;
  outputs: { key: string; type: string; unit?: string;
             description?: string }[];
  costClass: string;
  capabilityRequirements: string[];
  capability: { ok: boolean; missing: any[]; suggestions: any[] };
  notes: string;
  enabled: boolean;
}

/** A FEM/DFT model definition row (backend field names). */
export interface EngineModelRow {
  id?: string;
  name: string;
  display_name: string;
  description: string;
  physics_ref?: string;       // FEMModelDefinition
  calculation_ref?: string;   // DFTModelDefinition
  domain_json?: string;
  materials_json?: string;
  boundary_conditions_json?: string;
  source_terms_json?: string;
  mesh_json?: string;
  solver_json?: string;
  structure_json?: string;
  method_json?: string;
  accuracy_json?: string;
  last_result_json: string;
  last_executed_at: string;
  notes: string;
  enabled: boolean;
}

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

  async models(className: 'FEMModelDefinition' | 'DFTModelDefinition'
               ): Promise<EngineModelRow[]> {
    const res = await firstValueFrom(this.http.get<any>(
      `${this.base}/${className}`,
      this.polariService.backendRequestOptions));
    return parseCrudeReadAllResponse(res, className) as EngineModelRow[];
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
