import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { PolariService } from '@services/polari-service';

import { MemberSimInfo } from '@models/multi-scale/msim-types';

/**
 * Per-member simulation descriptions for the Multi-Scale Simulation
 * Page. SimulationDefinition rows already carry rich `description` and
 * `intent` text; this service surfaces them so member chips can explain
 * WHAT each sub-simulation is doing (they used to render name-only).
 *
 * One CRUDE list fetch, cached for the session — member sets are small
 * and definitions change rarely; `invalidate()` covers the rare case
 * (e.g. after Configure-mode saves).
 */
@Injectable({ providedIn: 'root' })
export class MsimMemberInfoService {

  private readonly className = 'SimulationDefinition';
  private listPromise: Promise<Map<string, MemberSimInfo>> | null = null;

  constructor(private http: HttpClient, private polariService: PolariService) {}

  async load(name: string): Promise<MemberSimInfo | null> {
    const byName = await this.loadAll();
    return byName.get(name) ?? null;
  }

  invalidate(): void {
    this.listPromise = null;
  }

  private loadAll(): Promise<Map<string, MemberSimInfo>> {
    if (!this.listPromise) {
      this.listPromise = this.fetchAll().catch(err => {
        // A failed fetch must not poison the cache forever.
        this.listPromise = null;
        throw err;
      });
    }
    return this.listPromise;
  }

  private async fetchAll(): Promise<Map<string, MemberSimInfo>> {
    const url = `${this.polariService.getBackendBaseUrl()}/${this.className}`;
    const response = await firstValueFrom(
      this.http.get<any>(url, this.polariService.backendRequestOptions));
    const byName = new Map<string, MemberSimInfo>();
    for (const item of this.parseReadAllResponse(response)) {
      if (!item?.name) continue;
      byName.set(item.name, {
        name: item.name,
        description: item.description ?? '',
        intent: item.intent ?? '',
      });
    }
    return byName;
  }

  /** Same CRUDE read-all unwrap the other definition services use. */
  private parseReadAllResponse(response: any): any[] {
    let unwrapped = response;
    if (Array.isArray(response) && response.length === 1
        && response[0] && response[0][this.className]) {
      unwrapped = response[0];
    }
    if (unwrapped && unwrapped[this.className]) {
      const classData = unwrapped[this.className];
      if (Array.isArray(classData)) {
        const instances: any[] = [];
        classData.forEach((dataSet: any) => {
          if (dataSet.data && Array.isArray(dataSet.data)) {
            instances.push(...dataSet.data);
          } else if (dataSet.id !== undefined) {
            instances.push(dataSet);
          }
        });
        return instances;
      }
    }
    return Array.isArray(unwrapped) ? unwrapped : [];
  }
}
