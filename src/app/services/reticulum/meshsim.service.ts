import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { PolariService } from '@services/polari-service';

/**
 * ret-1e: the mesh planner. POST a scenario, get spacing + relay
 * allowance per bearer with EVERY assumption listed and the terrain
 * disclaimer on every result.
 *
 * A 400 body is a real answer here (the elevation modes refuse WITH
 * the disclaimer — that refusal is what the user asked to see), so
 * refusal bodies pass through; only a bodyless 404 (module absent /
 * older backend) becomes null.
 */

export interface PlannerSpacing {
  spacingM: number;
  cellAreaM2: number;
  nodesForArea: number;
  assumptions: string[];
}

export interface PlannerRelay {
  ok?: boolean;
  fits?: boolean;
  avgHops?: number;
  relayAllowanceBpsPerNode?: number;
  relayAirtimeShare?: number;
  usableBps?: number;
  maxAchievablePerPeerBps?: number;
  verdict?: string;
  assumptions?: string[];
  evidence?: string;
}

export interface PlannerBearer {
  rangeM?: number | null;
  rangeFidelity?: string;
  rangeEvidence?: string;
  spacing?: PlannerSpacing;
  relay?: PlannerRelay;
  reason?: string;
  capacityBps?: number;
}

export interface PlannerResult {
  ok: boolean;
  mode?: string;
  disclaimer?: string;
  perBearer?: Record<string, PlannerBearer>;
  interference?: {
    suspicions: Array<{
      bearingFromDeg: number; bearingToDeg: number;
      bestReachM: number; evidence: string;
    }>;
    note?: string;
  };
  assumptions?: string[];
  error?: string;
  suggestion?: { evidence?: string; knob?: string; action?: string };
}

export interface PlannerRequest {
  bearerSet: string;
  propagationMode: string;
  meshSizeNodes: number;
  targetPerPeerBps: number;
  areaM2: number;
}

@Injectable({ providedIn: 'root' })
export class MeshSimService {
  constructor(
    private http: HttpClient,
    private polariService: PolariService,
  ) {}

  plan(request: PlannerRequest): Promise<PlannerResult | null> {
    const base = this.polariService.getBackendBaseUrl();
    return firstValueFrom(
      this.http.post<PlannerResult>(
        `${base}/api/reticulum/meshsim`,
        request,
        this.polariService.backendRequestOptions,
      ),
    ).then((result) => normalizePlan(result))
      .catch((err) =>
        (err?.error && typeof err.error === 'object'
          && 'ok' in err.error ? normalizePlan(err.error) : null));
  }
}

/** The backend nests range facts ({range: {rangeM, fidelity,
 *  evidence}}); flatten them so the template reads one shape and an
 *  older/newer backend cannot silently blank the panel. */
export function normalizePlan(
  result: PlannerResult | null,
): PlannerResult | null {
  if (!result?.perBearer) { return result; }
  const flat: Record<string, PlannerBearer> = {};
  for (const [bearer, entryRaw] of Object.entries(result.perBearer)) {
    const entry = entryRaw as PlannerBearer
      & { range?: { rangeM?: number; fidelity?: string;
                    evidence?: string } };
    flat[bearer] = {
      ...entry,
      rangeM: entry.rangeM ?? entry.range?.rangeM ?? null,
      rangeFidelity: entry.rangeFidelity ?? entry.range?.fidelity,
      rangeEvidence: entry.rangeEvidence ?? entry.range?.evidence,
    };
  }
  return { ...result, perBearer: flat };
}
