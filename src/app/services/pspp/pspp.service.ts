import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { PolariService } from '@services/polari-service';

/**
 * PSPP backend surface (/api/pspp/*) — every payload is generated
 * from editable rows (DigitizedDataset / ReactionRule /
 * ReactionWindow), so scientists change the pictures by editing
 * data, never code. Refusals come back as {ok:false, refusal,
 * suggestion} and are RENDERED, not swallowed.
 */
@Injectable({ providedIn: 'root' })
export class PsppService {
  constructor(private http: HttpClient,
              private polariService: PolariService) {}

  private url(path: string): string {
    return `${this.polariService.getBackendBaseUrl()}/api/pspp${path}`;
  }

  private get<T>(path: string): Promise<T | null> {
    return firstValueFrom(this.http.get<T>(
      this.url(path), this.polariService.backendRequestOptions))
      .catch((err) => (err?.error?.ok === false ? err.error : null));
  }

  catalog(): Promise<any | null> {
    return this.get('/datasets');
  }

  curve(name: string, samples = 80): Promise<any | null> {
    return this.get(
      `/datasets/${encodeURIComponent(name)}/curve?samples=${samples}`);
  }

  network(): Promise<any | null> {
    return this.get('/network');
  }

  states(material: string): Promise<any | null> {
    return this.get(`/states/${encodeURIComponent(material)}`);
  }

  progress(mr: number, temperatureC: number,
           hours: number): Promise<any | null> {
    return this.get(
      `/progress?mr=${mr}&t=${temperatureC}&hours=${hours}`);
  }

  grade(composition: Record<string, number>, basis: string,
        family: string): Promise<any | null> {
    return this.post('/grade', { composition, basis, family });
  }

  /** gsp-1/4: most-likely motif groups — reference (cation+MR) or
   *  state (material[+state]) mode. */
  structureGroups(params: {
    material?: string; state?: string; cation?: string;
    mr?: number; physicalState?: string;
  }): Promise<any | null> {
    const query = Object.entries(params)
      .filter(([, v]) => v !== undefined && v !== null && v !== '')
      .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
      .join('&');
    return this.get(`/structure/groups?${query}`);
  }

  /** gsp-2: one deterministic ensemble sample (atoms/bonds JSON). */
  structureSample(body: any): Promise<any | null> {
    return this.post('/structure/sample', body);
  }

  /** gsp-3: sample -> persisted SimSpace scene for the viewer. */
  structureScene(body: any): Promise<any | null> {
    return this.post('/structure/scene', body);
  }

  /** gsp-4b: groups after scientist-driven network steps. */
  structureSteppedGroups(body: any): Promise<any | null> {
    return this.post('/structure/stepped-groups', body);
  }

  /** gsp-5: Debye halo pattern of the sampled cluster. */
  structureXrd(body: any): Promise<any | null> {
    return this.post('/structure/xrd', body);
  }

  private post(path: string, body: any): Promise<any | null> {
    return firstValueFrom(this.http.post<any>(
      this.url(path), body, this.polariService.backendRequestOptions))
      .catch((err) => (err?.error?.ok === false ? err.error : null));
  }

  // ---- pspp-8 / V3 surfaces ----

  pathways(cation: string, mr: number,
           site?: string): Promise<any | null> {
    const s = site ? `&site=${encodeURIComponent(site)}` : '';
    return this.get(
      `/pathways?cation=${encodeURIComponent(cation)}&mr=${mr}${s}`);
  }

  /** Everything known → graded windows + open pathways + cure +
   *  the gap list (the experiment plan). */
  guide(body: { composition?: Record<string, number>; basis?: string;
                family?: string; cation?: string; mr?: number;
                t?: number; site?: string }): Promise<any | null> {
    return this.post('/guide', body);
  }

  /** Cure-checkpoint promotion: plan by default; {apply:true} is the
   *  explicit write knob. */
  checkpoint(body: { material: string; mr: number; t?: number;
                     state_name?: string; parent_state?: string;
                     apply?: boolean }): Promise<any | null> {
    return this.post('/checkpoint', body);
  }

  benchmarks(): Promise<any | null> {
    return this.get('/benchmarks');
  }

  benchmarkOverlay(name: string): Promise<any | null> {
    return this.get(
      `/benchmarks/${encodeURIComponent(name)}/overlay`);
  }

  waxStates(): Promise<any | null> {
    return this.get('/wax-states');
  }

  // ---- mtt-2 ceramics ----

  /** Ceramic samples on the service-temperature ladder. minTemp +
   *  local/carbonNegative filter to what can line a target furnace. */
  ceramicsSamples(params?: { minTemp?: number; local?: boolean;
                             carbonNegative?: boolean }
                  ): Promise<any | null> {
    if (params?.minTemp === undefined) return this.get('/ceramics/samples');
    const q = [`minTemp=${params.minTemp}`];
    if (params.local) q.push('local=true');
    if (params.carbonNegative) q.push('carbonNegative=true');
    return this.get(`/ceramics/samples?${q.join('&')}`);
  }

  /** The furnace escalation ladder (geopolymer oven -> steelmaking) +
   *  its physical bootstrapping check. */
  ceramicsLadder(): Promise<any | null> {
    return this.get('/ceramics/ladder');
  }

  /** The DATA-BACKED geopolymer -> ceramic thermal-conversion stages
   *  (Table 8.8) + the glass branch. */
  geopolymerTransition(): Promise<any | null> {
    return this.get('/ceramics/geopolymer-transition');
  }

  /** Sample a firing at N checkpoints — the ceramic at different
   *  stages during sintering (rho/grain refuse in place uncalibrated). */
  sinterStages(body: { schedule: any[]; activationEnergy: number;
                       masterCurve?: string; grain?: any;
                       nStages?: number }): Promise<any | null> {
    return this.post('/sinter/stages', body);
  }
}
