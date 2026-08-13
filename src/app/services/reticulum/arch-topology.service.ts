import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { PolariService } from '@services/polari-service';

/**
 * ret-1b: the .arch topology view's backend half. One endpoint, one
 * honest shape: isles as blocks (radios + apps inside), measured
 * path edges, demand vs capacity with a verdict.
 *
 * Null return = the reticulum module is not served here (404/410
 * with no refusal body) — the page renders the bring-up hint, the
 * collab-page precedent.
 */

export interface DeviceCapacity {
  declaredAirRateBps: number | null;
  measuredThroughputBps: number | null;
  measuredFidelity: string | null;
  measurementFresh: boolean;
  staleMeasurements: number;
  airtimeBudget: {
    windowSeconds: number; budgetMs: number; consumedMs: number;
  } | null;
  bytesPerMinUsable: number | null;
}

export interface ArchDevice {
  name: string;
  bearer: string;
  direction: string;
  regulatoryDomain: string;
  idlePolicy: string;
  enabled: boolean;
  model: string | null;
  modelInterop: string | null;
  capacity: DeviceCapacity;
}

export interface BindingDemand {
  bytesPerMin: number;
  messagesPerMin: number;
  maxMessageBytes: number;
  encoding: string;
  fidelity: string;
}

export interface ArchApp {
  name: string;
  bytesPerMin?: number;
  domain?: string;
  bindings?: Array<{
    name: string; protocol: string; destination: string;
    enabled: boolean; demand: BindingDemand;
  }>;
}

export interface ArchIsle {
  name: string;
  kind: 'local' | 'peer-isle' | 'device' | 'relay' | 'isle-device';
  devices: ArchDevice[];
  apps: ArchApp[];
  demandBytesPerMin?: number;
  capacityBytesPerMin?: number | null;
  verdict?: { state: string; evidence: string; knob?: string; action?: string };
  reachableNow?: boolean;
  lastHeardMs?: number;
  hopCount?: number;
  trust?: string;
  note?: string;
}

export interface ArchPath {
  from: string;
  to: string;
  bearerPath?: string;
  worstHopBearer?: string;
  hopCount?: number;
  rttMs?: number;
  throughputBps?: number;
  lossRate?: number;
  fidelity?: string;
  fresh: boolean;
  measuredAtMs?: number;
}

export interface ArchTopology {
  ok: boolean;
  nowMs: number;
  isles: ArchIsle[];
  paths: ArchPath[];
  notes: string[];
}

@Injectable({ providedIn: 'root' })
export class ArchTopologyService {
  constructor(
    private http: HttpClient,
    private polariService: PolariService,
  ) {}

  topology(): Promise<ArchTopology | null> {
    const base = this.polariService.getBackendBaseUrl();
    return firstValueFrom(
      this.http.get<ArchTopology>(
        `${base}/api/reticulum/arch-topology`,
        this.polariService.backendRequestOptions,
      ),
    ).catch((err) => (err?.error?.ok === false ? err.error : null));
  }
}
