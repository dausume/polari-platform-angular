/**
 * @cross-cutting
 * @tags @xc:render-shared, @xc:bindings
 * @consumers
 *   - SimSpaceBindingTabComponent (per-class config UI)
 *   - SimSpaceAPI on the backend (consumed via the snapshot endpoint)
 * @impact-on-edit
 *   Persisted shape must stay aligned with the backend
 *   SimSpaceBindingDefinition columns AND the SimSpaceBinding type in
 *   sim-space-types.ts. Change all three together.
 * @see /OVERLAP_MAP.md
 */

import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { RuntimeConfigService } from '@services/runtime-config.service';
import {
  SimSpaceBinding,
  SimSpaceDimensionality,
} from '@models/sim-space/sim-space-types';
import { parseCrudeReadAllResponse } from './crude-response-parser';

interface BindingRow {
  name: string;
  class_name: string;
  dimensionality: SimSpaceDimensionality;
  enabled: boolean;
  binding_json: string;
}

@Injectable({ providedIn: 'root' })
export class SimSpaceBindingService {
  constructor(
    private http: HttpClient,
    private runtimeConfig: RuntimeConfigService
  ) {}

  private rowKey(className: string, dim: SimSpaceDimensionality): string {
    return `${className}-${dim}`;
  }

  private url(): string {
    // Auto-CRUDE endpoint for the class.
    return `${this.runtimeConfig.getBackendBaseUrl()}/SimSpaceBindingDefinition`;
  }

  async getBinding(
    className: string,
    dimensionality: SimSpaceDimensionality
  ): Promise<{ enabled: boolean; binding: SimSpaceBinding | null }> {
    const all = await this.listAll();
    const key = this.rowKey(className, dimensionality);
    const row = all.find(r => r.name === key);
    if (!row) return { enabled: false, binding: null };
    let parsed: SimSpaceBinding | null = null;
    try {
      parsed = row.binding_json ? JSON.parse(row.binding_json) : null;
    } catch {
      parsed = null;
    }
    return { enabled: !!row.enabled, binding: parsed };
  }

  /** Upserts the binding row (create if missing, else update). */
  async saveBinding(
    className: string,
    dimensionality: SimSpaceDimensionality,
    enabled: boolean,
    binding: SimSpaceBinding
  ): Promise<void> {
    const key = this.rowKey(className, dimensionality);
    const all = await this.listAll();
    const existing = all.find(r => r.name === key);
    const payload = {
      name: key,
      class_name: className,
      dimensionality,
      enabled,
      binding_json: JSON.stringify(binding),
    };
    if (existing) {
      // CRUDE PUT — pass the row id.
      const id = (existing as any).id ?? key;
      await firstValueFrom(
        this.http.put(`${this.url()}/${encodeURIComponent(id)}`, payload)
      );
    } else {
      await firstValueFrom(this.http.post(this.url(), payload));
    }
  }

  private async listAll(): Promise<BindingRow[]> {
    try {
      const resp = await firstValueFrom(this.http.get<any>(this.url()));
      const raw = parseCrudeReadAllResponse(resp, 'SimSpaceBindingDefinition');
      return raw.map(r => ({
        name: r.name ?? '',
        class_name: r.class_name ?? r.className ?? '',
        dimensionality: (r.dimensionality ?? '2d') as SimSpaceDimensionality,
        enabled: !!r.enabled,
        binding_json: r.binding_json ?? r.bindingJson ?? '{}',
      }));
    } catch {
      return [];
    }
  }
}
