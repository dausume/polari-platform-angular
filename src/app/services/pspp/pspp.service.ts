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
    return firstValueFrom(this.http.post<any>(
      this.url('/grade'), { composition, basis, family },
      this.polariService.backendRequestOptions))
      .catch((err) => (err?.error?.ok === false ? err.error : null));
  }
}
