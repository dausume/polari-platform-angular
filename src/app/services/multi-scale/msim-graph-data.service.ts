import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { RuntimeConfigService } from '@services/runtime-config.service';
import { PolariService } from '@services/polari-service';
import { NamedGraphConfig } from '@models/graphs/NamedGraphConfig';

/** One page of a per-run timeseries from GET /runs/{run}/series. */
export interface SeriesPage {
  run: string;
  class: string;
  steps: number[];
  times: Array<number | null>;
  fields: Record<string, Array<number | null>>;
  lastStep: number | null;
}

/**
 * Data feed for the multi-scale page's graph panels: GraphDefinition
 * lookup BY NAME plus the per-run /series endpoint (with incremental
 * `sinceStep` paging for live growth). Kept apart from
 * GraphDefinitionService because (a) panels reference graphs by name
 * (the sim domain's identity convention) and (b) seeded graph
 * definitions may store the config FLAT ({renderStyle, ...}) rather
 * than wrapped ({graphConfig: {...}}) — `loadGraphByName` normalizes
 * both shapes into a NamedGraphConfig.
 */
@Injectable({ providedIn: 'root' })
export class MsimGraphDataService {

  private readonly graphClassName = 'GraphDefinition';

  constructor(
    private http: HttpClient,
    private runtimeConfig: RuntimeConfigService,
    private polariService: PolariService,
  ) {}

  async fetchSeries(
    runName: string,
    className: string,
    fields: string[],
    sinceStep?: number,
  ): Promise<SeriesPage> {
    const params = new URLSearchParams();
    params.set('class', className);
    if (fields.length) params.set('fields', fields.join(','));
    if (sinceStep !== undefined && sinceStep !== null) {
      params.set('sinceStep', String(sinceStep));
    }
    const url = `${this.runtimeConfig.getBackendBaseUrl()}`
      + `/api/simulations/runs/${encodeURIComponent(runName)}/series?${params}`;
    const resp = await firstValueFrom(
      this.http.get<{ success: boolean; data: SeriesPage }>(url),
    );
    return resp.data;
  }

  /** Convert a series page into graph-renderer instance rows —
   *  one object per step: { step, time, <field>: value, ... }. */
  seriesToRows(page: SeriesPage): any[] {
    return page.steps.map((step, i) => {
      const row: Record<string, any> = { step, time: page.times[i] };
      for (const [field, values] of Object.entries(page.fields)) {
        row[field] = values[i];
      }
      return row;
    });
  }

  async loadGraphByName(name: string): Promise<NamedGraphConfig> {
    const url = `${this.polariService.getBackendBaseUrl()}/${this.graphClassName}`;
    const response = await firstValueFrom(
      this.http.get<any>(url, this.polariService.backendRequestOptions),
    );
    const items = this.parseReadAllResponse(response);
    const obj = items.find((item: any) => (item.name || '') === name);
    if (!obj) throw new Error(`GraphDefinition "${name}" not found`);
    const config = NamedGraphConfig.fromBackend(obj);
    // Normalize FLAT seeded definitions ({renderStyle, xDimension, ...}
    // without the {graphConfig: ...} wrapper) — fromBackend leaves the
    // defaults (empty xDimension) in that case.
    if (!config.graphConfig.xDimension && obj.definition) {
      try {
        const flat = typeof obj.definition === 'string'
          ? JSON.parse(obj.definition) : obj.definition;
        if (flat && typeof flat === 'object' && flat.renderStyle && flat.xDimension) {
          config.graphConfig = {
            ...config.graphConfig,
            renderStyle: flat.renderStyle,
            xDimension: flat.xDimension,
            yDimensions: Array.isArray(flat.yDimensions) ? flat.yDimensions : [],
            seriesColors: Array.isArray(flat.seriesColors) ? flat.seriesColors : [],
          };
        }
      } catch { /* keep defaults; renderer shows its empty state */ }
    }
    return config;
  }

  /** Same CRUDE envelope unwrap the other definition services use. */
  private parseReadAllResponse(response: any): any[] {
    let unwrapped = response;
    if (Array.isArray(response) && response.length === 1
        && response[0] && response[0][this.graphClassName]) {
      unwrapped = response[0];
    }
    if (unwrapped && unwrapped[this.graphClassName]) {
      const classData = unwrapped[this.graphClassName];
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
      const keys = Object.keys(classData);
      return keys.map(key => ({ id: key, ...classData[key] }));
    }
    if (Array.isArray(response)) return response;
    if (response && response.data && Array.isArray(response.data)) return response.data;
    return [];
  }
}
