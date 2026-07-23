import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { PolariService } from '@services/polari-service';

export interface CrystalFacts {
  formula: string;
  nAtoms: number;
  spaceGroup: number;
  cellpar: number[];
  cellVolumeA3: number;
  densityGcm3: number;
  nearestNeighborA: number | null;
  coordinationOfAtom0: number;
  bondCount: number;
  bondCutoffScale: number;
  bondRule: string;
}

export interface CrystalSummary {
  name: string;
  displayName: string;
  materialName: string;
  spaceGroup: number;
  description: string;
  facts?: CrystalFacts;
  buildError?: string;
}

export interface CrystalDetail {
  ok: boolean;
  error?: string;
  name: string;
  displayName: string;
  description: string;
  materialName: string;
  spaceGroup: number;
  spaceGroupSetting: number;
  bondCutoffScale: number;
  provenance: string;
  notes: string;
  sceneName: string;
  facts: CrystalFacts;
  cell: number[][];
  atoms: { index: number; element: string;
           frac: number[]; cart: number[] }[];
  bonds: { i: number; j: number; distanceA: number }[];
}

export interface PhononResult {
  ok: boolean;
  error?: string;
  suggestion?: any;
  nAtoms?: number;
  branches?: number;
  pathLabels?: string[];
  pathLabelIndices?: number[];
  kDistances?: number[];
  frequenciesThz?: number[][];
  dos?: { binsThz: number[]; counts: number[] };
  gammaAcousticMaxThz?: number;
  acousticSumHolds?: boolean;
  stable?: boolean;
  minFrequencyThz?: number;
  residualPressureGpa?: number;
  fittedSigmaA?: number;
  fittedSigmaNote?: string;
  validity?: string;
}

export interface ElasticResult {
  ok: boolean;
  error?: string;
  suggestion?: any;
  c11Gpa?: number;
  c12Gpa?: number;
  c44Gpa?: number;
  bulkModulusGpa?: number;
  bulkModulusEosGpa?: number;
  bulkRoutesAgree?: boolean;
  residualPressureGpa?: number;
  fittedSigmaA?: number;
  validity?: string;
}

/**
 * Crystal structures (ssp): list/detail over
 * /api/msci/structures, the explicit scene-regenerate knob, and the
 * ssp-4 lattice-dynamics computations (phonons / elastic constants).
 */
@Injectable({ providedIn: 'root' })
export class CrystalStructureService {

  constructor(private http: HttpClient,
              private polariService: PolariService) {}

  private get base(): string {
    return this.polariService.getBackendBaseUrl();
  }

  async list(): Promise<CrystalSummary[]> {
    const url = `${this.base}/api/msci/structures`;
    const res = await firstValueFrom(this.http.get<
      { ok: boolean; structures: CrystalSummary[] }>(
      url, this.polariService.backendRequestOptions))
      .catch(() => null);
    return res?.structures ?? [];
  }

  detail(name: string): Promise<CrystalDetail | null> {
    const url = `${this.base}/api/msci/structures/`
      + `${encodeURIComponent(name)}`;
    return firstValueFrom(this.http.get<CrystalDetail>(
      url, this.polariService.backendRequestOptions))
      .catch((err) => err?.error?.ok === false ? err.error : null);
  }

  refreshScene(name: string, body: {
    supercell?: number[]; atomScale?: number; bondRadius?: number;
    ghostReplicas?: boolean; cellEdges?: boolean;
  } = {}): Promise<any> {
    const url = `${this.base}/api/msci/structures/`
      + `${encodeURIComponent(name)}/scene`;
    return firstValueFrom(this.http.post<any>(
      url, body, this.polariService.backendRequestOptions))
      .catch((err) => err?.error ?? { ok: false,
        error: 'scene endpoint unreachable' });
  }

  analyze(name: string, body: any = {}): Promise<any> {
    const url = `${this.base}/api/msci/structures/`
      + `${encodeURIComponent(name)}/analyze`;
    return firstValueFrom(this.http.post<any>(
      url, body, this.polariService.backendRequestOptions))
      .catch((err) => err?.error ?? { ok: false,
        error: 'analyze endpoint unreachable' });
  }

  xrd(name: string, body: any = {}): Promise<any> {
    const url = `${this.base}/api/msci/structures/`
      + `${encodeURIComponent(name)}/xrd`;
    return firstValueFrom(this.http.post<any>(
      url, body, this.polariService.backendRequestOptions))
      .catch((err) => err?.error ?? { ok: false,
        error: 'xrd endpoint unreachable' });
  }

  phonons(name: string, body: any): Promise<PhononResult> {
    const url = `${this.base}/api/msci/structures/`
      + `${encodeURIComponent(name)}/phonons`;
    return firstValueFrom(this.http.post<PhononResult>(
      url, body, this.polariService.backendRequestOptions))
      .catch((err) => err?.error ?? { ok: false,
        error: 'phonon endpoint unreachable' });
  }

  elastic(name: string, body: any): Promise<ElasticResult> {
    const url = `${this.base}/api/msci/structures/`
      + `${encodeURIComponent(name)}/elastic`;
    return firstValueFrom(this.http.post<ElasticResult>(
      url, body, this.polariService.backendRequestOptions))
      .catch((err) => err?.error ?? { ok: false,
        error: 'elastic endpoint unreachable' });
  }
}
