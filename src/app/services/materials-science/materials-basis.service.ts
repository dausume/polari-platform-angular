import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { PolariService } from '@services/polari-service';
import {
  parseCrudeReadAllResponse,
} from '@services/sim-space/crude-response-parser';

/** One MaterialScaleDefinition row (backend CRUDE shape, camel-safe). */
export interface ScaleDefinitionRow {
  name: string;
  material_name: string;
  scale_level: number;
  scale_category: string;
  definition_class: string;
  definition_ref: string;
  status: string;               // defined | partial | planned
  derived_from_name: string;
  derivation_method: string;
  parameters_json: string;
  notes: string;
}

/** One ThermalProcessingProfile row. */
export interface ThermalProfileRow {
  name: string;
  material_name: string;
  melt_low_c: number;
  melt_high_c: number;
  smoke_low_c: number;
  smoke_high_c: number;
  provenance: string;
}

/** Honest engine capability report (FEM + DFT ladders). */
export interface EngineCapability {
  fem: Record<string, unknown>;
  dft: Record<string, unknown>;
}

/** One MaterialsScienceMaterial identity row (msci-22 fields). */
export interface MaterialIdentityRow {
  name: string;
  display_name: string;
  description: string;
  material_kind: string;
  category: string;
  tags_json: string;
}

/** One scale-row summary as the presence endpoints return it. */
export interface PresenceRowSummary {
  name: string;
  status: string;               // defined | partial | planned
  derivationMethod: string;
  derivedFrom: string;
  definitionClass: string;
  definitionRef: string;
  hasResult: boolean;
  provenance: string;
  notes: string;
}

/** One level of the presence matrix (taxonomy + rollup counts). */
export interface PresenceLevel {
  level: number;
  name: string;
  lengthRange: string;
  methods: string;
  earnedBy: string;
  engines: string[];
  defined: number;
  partial: number;
  missing: number;
}

/** The materials x levels accountability matrix. */
export interface PresenceMatrix {
  levels: PresenceLevel[];
  materials: {
    name: string;
    displayName: string;
    category: string;
    tags: string[];
    presence: Record<string, {
      status: 'defined' | 'partial' | 'missing';
      rows: PresenceRowSummary[];
    }>;
  }[];
}

/** One material's entry on a level page. */
export interface LevelEntry {
  material: string;
  displayName: string;
  category: string;
  rows: PresenceRowSummary[];
  suggestion?: {
    level: number; category: string;
    evidence: string; knob: string; action: string;
  };
}

/** One level's accountability page data. */
export interface LevelAccountability {
  ok: boolean;
  level: number;
  detail: Omit<PresenceLevel, 'level' | 'defined' | 'partial' | 'missing'>;
  defined: LevelEntry[];
  partial: LevelEntry[];
  missing: LevelEntry[];
  error?: string;
}

/**
 * Read access for the materials-basis browser: MaterialScaleDefinition
 * / MaterialsScienceMaterial / ThermalProcessingProfile rows via
 * standard CRUDE, plus the honest engine-capability endpoint and the
 * scale-presence accountability endpoints (msci-24).
 */
@Injectable({ providedIn: 'root' })
export class MaterialsBasisService {

  constructor(private http: HttpClient,
              private polariService: PolariService) {}

  private crude<T>(className: string): Promise<T[]> {
    const url = `${this.polariService.getBackendBaseUrl()}/${className}`;
    return firstValueFrom(this.http.get<any>(
      url, this.polariService.backendRequestOptions))
      .then(res => parseCrudeReadAllResponse(res, className) as T[])
      .catch(() => []);
  }

  scaleDefinitions(): Promise<ScaleDefinitionRow[]> {
    return this.crude<ScaleDefinitionRow>('MaterialScaleDefinition');
  }

  materialIdentities(): Promise<MaterialIdentityRow[]> {
    return this.crude<MaterialIdentityRow>('MaterialsScienceMaterial');
  }

  thermalProfiles(): Promise<ThermalProfileRow[]> {
    return this.crude<ThermalProfileRow>('ThermalProcessingProfile');
  }

  engineCapability(): Promise<EngineCapability | null> {
    const url = `${this.polariService.getBackendBaseUrl()}`
      + '/api/msci/engines/capability';
    return firstValueFrom(this.http.get<EngineCapability>(
      url, this.polariService.backendRequestOptions))
      .catch(() => null);
  }

  presenceMatrix(): Promise<PresenceMatrix | null> {
    const url = `${this.polariService.getBackendBaseUrl()}`
      + '/api/msci/scale-presence';
    return firstValueFrom(this.http.get<PresenceMatrix>(
      url, this.polariService.backendRequestOptions))
      .catch(() => null);
  }

  levelAccountability(level: number): Promise<LevelAccountability | null> {
    const url = `${this.polariService.getBackendBaseUrl()}`
      + `/api/msci/scale-presence/level/${level}`;
    return firstValueFrom(this.http.get<LevelAccountability>(
      url, this.polariService.backendRequestOptions))
      .catch(() => null);
  }
}
