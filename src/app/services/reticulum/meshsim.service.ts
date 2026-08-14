import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { PolariService } from '@services/polari-service';
import {
  NormalizedPlacement,
  NormalizedPopulation,
  normalizePlacement,
  normalizePopulation,
} from '@services/reticulum/planner-geo';

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
  /** ret-1f: normalized by planner-geo — raw backend shapes vary */
  placement?: NormalizedPlacement | null;
  population?: NormalizedPopulation | null;
}

/** ret-1f request sections (plan §5q). Optional — a plain §5p plan
 *  still works without them. */
export interface PlacementRequest {
  mode: 'cheapest-coverage' | 'fixed-locations' | 'resilience';
  polygon: unknown;               // geojson, backend-authoritative
  reachMode: 'max-spread' | 'linear';
  /** range scenarios: which figure the solver plans against */
  rangeScenario?: 'pessimistic' | 'typical' | 'optimistic';
  /** the operator's own assertion — wins over the scenario */
  rangeOverrideM?: number;
  nodes?: Array<{ name: string; x_m: number; y_m: number }>;
  deviceOptions?: Array<{ model: string; capacityBps?: number;
                          unitsMax?: number; antenna?: string }>;
}

/** counts-first: a cohort is N people with a profile or a custom
 *  kit — the counts ARE the configuration, percentages are derived
 *  analytics on the response. */
export interface CohortRequest {
  profile?: string;
  kit?: Record<string, number>;
  label?: string;
  count: number;
}

export interface PopulationRequest {
  cohorts?: CohortRequest[];
  /** legacy percentage form — still accepted by the backend
   *  (flagged legacyPctForm), no longer produced by this UI */
  mix?: Record<string,
               number | { kit: Record<string, number>; pct: number }>;
  n?: number;
}

export interface PlannerRequest {
  bearerSet: string;
  propagationMode: string;
  meshSizeNodes: number;
  targetPerPeerBps: number;
  areaM2: number;
  placement?: PlacementRequest;
  population?: PopulationRequest;
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
  if (!result) { return result; }
  const withSections: PlannerResult = {
    ...result,
    placement: normalizePlacement(
      (result as unknown as Record<string, unknown>)['placement']),
    population: normalizePopulation(
      (result as unknown as Record<string, unknown>)['population']),
  };
  if (!withSections.perBearer) { return withSections; }
  const flat: Record<string, PlannerBearer> = {};
  for (const [bearer, entryRaw] of
      Object.entries(withSections.perBearer)) {
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
  return { ...withSections, perBearer: flat };
}
