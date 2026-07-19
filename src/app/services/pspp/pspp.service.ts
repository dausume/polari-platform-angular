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
}
