import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, throwError } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { PolariService } from '@services/polari-service';

/** One choice of a choicePreset IC interface (e.g. a bob material). */
export interface IcChoice {
  key: string;
  label: string;
  description?: string;
  setParams?: Record<string, number>;
  setFields?: Record<string, Record<string, unknown>>;
  /** Milestone B: the substance's physical identity (melting line,
   *  density behavior) — used as the material space's search
   *  fixedParams. A choice carrying this can be PROVEN by the
   *  first-principles stage. */
  substanceParams?: Record<string, number>;
}

/** Milestone B: which composition + stage proves this picker's choices. */
export interface IcProvingStage {
  msim: string;
  stageKey: string;
}

/** Parsed InitialConditionInterfaceDefinition. */
export interface IcInterfaceConfig {
  id: string;
  name: string;
  description: string;
  targetSimulationRef: string;
  targetClassName: string;
  interfaceKind: string; // 'choicePreset' | 'fieldEditor'
  label: string;
  choices: IcChoice[];
  derivedParams: Record<string, string>;
  provingStage: IcProvingStage | null;
}

/**
 * InitialConditionInterfaceDefinition service — CRUDE-backed reader
 * (same envelope handling as the other definition services). Phase 2
 * uses it for the read-only preview card; Phase 4's interactive
 * msim-ic-panel builds on the same parse.
 */
@Injectable({ providedIn: 'root' })
export class InitialConditionInterfaceService {

  loading$ = new BehaviorSubject<boolean>(false);

  private readonly className = 'InitialConditionInterfaceDefinition';

  constructor(private http: HttpClient, private polariService: PolariService) {}

  private get baseUrl(): string {
    return `${this.polariService.getBackendBaseUrl()}/${this.className}`;
  }

  loadByName(name: string): Observable<IcInterfaceConfig> {
    this.loading$.next(true);
    return this.http.get<any>(this.baseUrl, this.polariService.backendRequestOptions).pipe(
      map((response: any) => {
        const items = this.parseReadAllResponse(response);
        const obj = items.find((item: any) => (item.name || '') === name);
        if (!obj) {
          throw new Error(`InitialConditionInterfaceDefinition "${name}" not found`);
        }
        return this.parseConfig(obj);
      }),
      map((cfg) => { this.loading$.next(false); return cfg; }),
      catchError((err: any) => {
        this.loading$.next(false);
        return throwError(() => err);
      }),
    );
  }

  private parseConfig(obj: any): IcInterfaceConfig {
    let raw: any = {};
    try {
      raw = JSON.parse(obj.config_json || '{}');
    } catch {
      raw = {};
    }
    return {
      id: obj.id ?? '',
      name: obj.name ?? '',
      description: obj.description ?? '',
      targetSimulationRef: obj.target_simulation_ref ?? '',
      targetClassName: obj.target_class_name ?? '',
      interfaceKind: obj.interface_kind ?? 'choicePreset',
      label: raw.label ?? obj.name ?? '',
      choices: Array.isArray(raw.choices) ? raw.choices : [],
      derivedParams: raw.derivedParams && typeof raw.derivedParams === 'object'
        ? raw.derivedParams : {},
      provingStage: (raw.provingStage && raw.provingStage.msim
                     && raw.provingStage.stageKey)
        ? { msim: raw.provingStage.msim, stageKey: raw.provingStage.stageKey }
        : null,
    };
  }

  private parseReadAllResponse(response: any): any[] {
    let unwrapped = response;
    if (Array.isArray(response) && response.length === 1 && response[0] && response[0][this.className]) {
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
      const keys = Object.keys(classData);
      return keys.map(key => ({ id: key, ...classData[key] }));
    }
    if (Array.isArray(response)) return response;
    if (response && response.data && Array.isArray(response.data)) return response.data;
    return [];
  }
}
