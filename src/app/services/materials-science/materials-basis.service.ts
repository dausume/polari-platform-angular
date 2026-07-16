import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { PolariService } from '@services/polari-service';
import {
  parseCrudeReadAllResponse,
} from '@services/sim-space/crude-response-parser';

import {
  ScaleDefinitionRow,
  ThermalProfileRow,
  EngineCapabilityLadders,
  MaterialIdentityRow,
  PresenceRowSummary,
  PresenceLevel,
  PresenceMatrix,
  LevelEntry,
  LevelAccountability,
  MaterialProperty,
  BlendEffect,
  DetailLevelRow,
  DetailLevel,
  MaterialDetail,
} from '@models/materials-science/materials-basis-types';

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

  engineCapability(): Promise<EngineCapabilityLadders | null> {
    const url = `${this.polariService.getBackendBaseUrl()}`
      + '/api/msci/engines/capability';
    return firstValueFrom(this.http.get<EngineCapabilityLadders>(
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

  materialDetail(name: string): Promise<MaterialDetail | null> {
    const url = `${this.polariService.getBackendBaseUrl()}`
      + `/api/msci/materials/${encodeURIComponent(name)}/detail`;
    return firstValueFrom(this.http.get<MaterialDetail>(
      url, this.polariService.backendRequestOptions))
      .catch((err) => err?.error?.ok === false ? err.error : null);
  }
}
