import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { PolariService } from '@services/polari-service';
import { NamedMultiScaleSimConfig } from '@models/multi-scale/NamedMultiScaleSimConfig';

/** The simulation-intents taxonomy (GET /api/simulations/intents). */
export interface IntentInfo {
  label: string;
  question: string;
  requires: string[];
  produces: string;
  plugPoints: string;
}
export interface IntentsCatalog {
  intents: Record<string, IntentInfo>;
  productBearing: string[];
  continuous: string[];
}

/** One composition-coherence finding (plain language). */
export interface CompositionFinding {
  level: 'error' | 'warning';
  message: string;
}

/** A member simulation as the authoring surfaces need it. */
export interface SimDefLite {
  id: string;
  name: string;
  intent: string;
  timeStepSeconds: number;
  participatingClasses: string[];
}

/** Parsed SimulationCouplingDefinition for the weaving editor. */
export interface CouplingConfig {
  id: string;
  name: string;
  description: string;
  sourceSimulationRef: string;
  sourceClassName: string;
  targetSimulationRef: string;
  targetClassName: string;
  samplerEquationRef: string;
  /** The raw config_json object (sampler operands / inject / defaults). */
  config: Record<string, any>;
  enabled: boolean;
}

/**
 * Authoring backend access for the Multi-Scale page's Configure mode and
 * wizard: generic CRUDE list/create/update (the FormData conventions the
 * other definition services use), the intents taxonomy, composition
 * validation, and the parsed models the editors write back.
 */
@Injectable({ providedIn: 'root' })
export class MsimAuthoringService {

  private intentsCache: IntentsCatalog | null = null;

  constructor(private http: HttpClient, private polariService: PolariService) {}

  private base(): string {
    return this.polariService.getBackendBaseUrl();
  }

  // ------------------------------------------------------------------
  // Generic CRUDE access (same envelope + FormData shapes as the
  // *DefinitionService pattern).
  // ------------------------------------------------------------------

  async crudeList(className: string): Promise<any[]> {
    const resp = await firstValueFrom(this.http.get<any>(
      `${this.base()}/${className}`, this.polariService.backendRequestOptions));
    return parseCrudeReadAll(resp, className);
  }

  async crudeUpdate(className: string, id: string,
                    updateData: Record<string, any>): Promise<void> {
    const formData = new FormData();
    formData.append('polariId', id);
    formData.append('updateData', JSON.stringify(updateData));
    await firstValueFrom(this.http.put(`${this.base()}/${className}`, formData));
  }

  async crudeCreate(className: string,
                    fields: Record<string, any>): Promise<any> {
    const formData = new FormData();
    formData.append('initParamSets', JSON.stringify([fields]));
    const resp = await firstValueFrom(
      this.http.post<any>(`${this.base()}/${className}`, formData));
    const items = parseCrudeReadAll(resp, className);
    return items[0] ?? resp;
  }

  // ------------------------------------------------------------------
  // Intents + composition validation
  // ------------------------------------------------------------------

  async intents(): Promise<IntentsCatalog> {
    if (this.intentsCache) return this.intentsCache;
    const resp = await firstValueFrom(this.http.get<any>(
      `${this.base()}/api/simulations/intents`));
    this.intentsCache = resp?.data ?? { intents: {}, productBearing: [], continuous: [] };
    return this.intentsCache!;
  }

  async validateComposition(msimName: string):
      Promise<{ coherent: boolean; findings: CompositionFinding[] }> {
    const url = `${this.base()}/api/simulations/multi-scale/`
      + `${encodeURIComponent(msimName)}/validate-composition`;
    const resp = await firstValueFrom(this.http.post<any>(url, {}));
    return resp?.data ?? { coherent: true, findings: [] };
  }

  // ------------------------------------------------------------------
  // Simulation definitions (spaces): list + intent write
  // ------------------------------------------------------------------

  async listSimDefs(): Promise<SimDefLite[]> {
    const items = await this.crudeList('SimulationDefinition');
    return items.map((it: any) => ({
      id: it.id ?? '',
      name: it.name ?? '',
      intent: it.intent || 'observe',
      timeStepSeconds: Number(it.time_step_seconds ?? 0) || 0,
      participatingClasses: parseJsonArray(it.participating_sim_state_classes_json),
    })).filter(s => s.name);
  }

  async saveSimIntent(simDef: SimDefLite, intent: string): Promise<void> {
    await this.crudeUpdate('SimulationDefinition', simDef.id, { intent });
  }

  // ------------------------------------------------------------------
  // MultiScaleSimulationDefinition: save + create
  // ------------------------------------------------------------------

  async saveMsim(config: NamedMultiScaleSimConfig): Promise<void> {
    await this.crudeUpdate('MultiScaleSimulationDefinition', config.id,
      config.toUpdateData());
  }

  async createMsim(fields: {
    name: string; description: string; members: string[];
    couplings: string[]; primary: string; stages: any[]; panels: any[];
  }): Promise<any> {
    return this.crudeCreate('MultiScaleSimulationDefinition', {
      name: fields.name,
      description: fields.description,
      member_simulation_refs_json: JSON.stringify(fields.members),
      coupling_refs_json: JSON.stringify(fields.couplings),
      primary_simulation_ref: fields.primary,
      stages_json: JSON.stringify(fields.stages),
      panels_json: JSON.stringify(fields.panels),
      display_ref: '',
      compare_run_policy_json: '{}',
      enabled: true,
    });
  }

  // ------------------------------------------------------------------
  // SimulationCouplingDefinition (the weaving)
  // ------------------------------------------------------------------

  async listCouplings(): Promise<CouplingConfig[]> {
    const items = await this.crudeList('SimulationCouplingDefinition');
    return items.map((it: any) => ({
      id: it.id ?? '',
      name: it.name ?? '',
      description: it.description ?? '',
      sourceSimulationRef: it.source_simulation_ref ?? '',
      sourceClassName: it.source_class_name ?? '',
      targetSimulationRef: it.target_simulation_ref ?? '',
      targetClassName: it.target_class_name ?? '',
      samplerEquationRef: it.sampler_equation_ref ?? '',
      config: parseJsonObject(it.config_json),
      enabled: it.enabled !== false,
    })).filter(c => c.name);
  }

  async saveCoupling(c: CouplingConfig): Promise<void> {
    const fields = couplingToFields(c);
    if (c.id) {
      await this.crudeUpdate('SimulationCouplingDefinition', c.id, fields);
    } else {
      await this.crudeCreate('SimulationCouplingDefinition', fields);
    }
  }

  // ------------------------------------------------------------------
  // InitialConditionInterfaceDefinition (overall ICs)
  // ------------------------------------------------------------------

  async listIcInterfaces(): Promise<any[]> {
    return this.crudeList('InitialConditionInterfaceDefinition');
  }

  async saveIcInterface(id: string, fields: Record<string, any>): Promise<void> {
    if (id) {
      await this.crudeUpdate('InitialConditionInterfaceDefinition', id, fields);
    } else {
      await this.crudeCreate('InitialConditionInterfaceDefinition', fields);
    }
  }

  // ------------------------------------------------------------------
  // Reference lists for pickers
  // ------------------------------------------------------------------

  async listNames(className: string): Promise<string[]> {
    const items = await this.crudeList(className);
    return items.map((it: any) => it.name).filter((n: any) => !!n);
  }
}

function couplingToFields(c: CouplingConfig): Record<string, any> {
  return {
    name: c.name,
    description: c.description,
    source_simulation_ref: c.sourceSimulationRef,
    source_class_name: c.sourceClassName,
    target_simulation_ref: c.targetSimulationRef,
    target_class_name: c.targetClassName,
    sampler_equation_ref: c.samplerEquationRef,
    config_json: JSON.stringify(c.config ?? {}),
    enabled: c.enabled,
  };
}

function parseJsonArray(raw: any): string[] {
  if (Array.isArray(raw)) return raw.filter(x => typeof x === 'string');
  if (typeof raw !== 'string' || !raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(x => typeof x === 'string') : [];
  } catch { return []; }
}

function parseJsonObject(raw: any): Record<string, any> {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) return raw;
  if (typeof raw !== 'string' || !raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch { return {}; }
}

/** The CRUDE read-all envelope parse every definition service uses. */
export function parseCrudeReadAll(response: any, className: string): any[] {
  let unwrapped = response;
  if (Array.isArray(response) && response.length === 1 && response[0] && response[0][className]) {
    unwrapped = response[0];
  }
  if (unwrapped && unwrapped[className]) {
    const classData = unwrapped[className];
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
