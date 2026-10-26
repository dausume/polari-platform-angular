import { Injectable } from '@angular/core';
import { BehaviorSubject, firstValueFrom, Observable } from 'rxjs';
import { filter, take } from 'rxjs/operators';
import { RuntimeConfigService } from './runtime-config.service';

export type ConnectionState = 'reachable' | 'http-error' | 'timeout' | 'unreachable' | 'blocked' | 'offline' | 'mixed-content';
export interface EndpointStatus {
  name: string;
  url: string;
  /** A response proves browser transport trust, not application health. */
  trusted: boolean;
  checked: boolean;
  state?: ConnectionState;
  error?: string;
}

/** Fetch does not expose TLS error codes. Never infer a bad certificate from rejection. */
@Injectable({ providedIn: 'root' })
export class CertificateTrustService {
  private statuses = new BehaviorSubject<EndpointStatus[]>([]);
  private prompt = new BehaviorSubject(false);
  private dismissed = false;
  private generation = 0;
  checking = false;
  endpointStatuses$: Observable<EndpointStatus[]> = this.statuses.asObservable();
  showPrompt$: Observable<boolean> = this.prompt.asObservable();

  constructor(private runtimeConfig: RuntimeConfigService) {}

  get showPrompt(): boolean { return this.prompt.value; }
  get endpointStatuses(): EndpointStatus[] { return this.statuses.value; }
  get failedEndpoints(): EndpointStatus[] {
    return this.statuses.value.filter(e => e.checked && e.state !== 'reachable');
  }

  async checkAllEndpoints(): Promise<void> {
    const generation = ++this.generation;
    this.checking = true;
    try {
      // Avoid checking build defaults while runtime configuration is still loading.
      await firstValueFrom(this.runtimeConfig.isConfigLoaded$.pipe(filter(Boolean), take(1)));
      const endpoints: EndpointStatus[] = [{
        name: 'Backend API',
        url: this.runtimeConfig.getBackendBaseUrl().replace(/\/$/, '') + '/polariAPI',
        trusted: false, checked: false
      }];
      const keycloak = this.runtimeConfig.getKeycloakConfig();
      if (keycloak?.authority) {
        endpoints.push({ name: 'Keycloak sign-in',
          url: keycloak.authority.replace(/\/$/, '') + '/.well-known/openid-configuration',
          trusted: false, checked: false });
      }
      const results = await Promise.all(endpoints.map(async endpoint => {
        let result = endpoint;
        // Startup races are common after the router/proxy comes back. Retry before interrupting.
        for (let attempt = 0; attempt < 5; attempt++) {
          if (generation !== this.generation) return result;
          result = await this.checkEndpoint(endpoint);
          if (result.state === 'reachable') break;
          if (attempt < 4) await new Promise(resolve => setTimeout(resolve, Math.min(1500 * 2 ** attempt, 9000)));
        }
        return result;
      }));
      if (generation !== this.generation) return;
      this.statuses.next(results);
      this.prompt.next(!this.dismissed && results.some(e => e.state !== 'reachable'));
    } finally {
      if (generation === this.generation) this.checking = false;
    }
  }

  private async checkEndpoint(endpoint: EndpointStatus): Promise<EndpointStatus> {
    const result = (state: ConnectionState, error?: string, trusted = false): EndpointStatus =>
      ({ ...endpoint, state, error, trusted, checked: true });
    if (!navigator.onLine) return result('offline', 'This device is offline.');
    if (window.location.protocol === 'https:' && new URL(endpoint.url).protocol === 'http:') {
      return result('mixed-content', 'This secure page is configured to contact an insecure HTTP service.');
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    try {
      const response = await fetch(endpoint.url, {
        method: 'GET', mode: 'cors', credentials: 'omit', cache: 'no-store', signal: controller.signal
      });
      // Authentication responses still prove the service and HTTPS connection are available.
      if (response.ok || response.status === 401 || response.status === 403) return result('reachable', undefined, true);
      const transport = new URL(endpoint.url).protocol === 'https:' ? ' Its HTTPS certificate was accepted.' : '';
      return result('http-error', `The service returned HTTP ${response.status}.${transport}`, true);
    } catch {
      if (controller.signal.aborted) return result('timeout', 'The service did not respond within 5 seconds.');
      // A CORS failure can hide a perfectly valid HTTPS response. An opaque response
      // proves transport access, but cannot prove the API is usable by this page.
      try {
        await fetch(endpoint.url, { method: 'HEAD', mode: 'no-cors', credentials: 'omit',
          cache: 'no-store', signal: controller.signal });
        return result('blocked', 'The service responds, but this page cannot read its response. Check browser access and CORS settings.', true);
      } catch {
        return controller.signal.aborted
          ? result('timeout', 'The service did not respond within 5 seconds.')
          : result('unreachable', 'Could not connect. The service, DNS, network, browser policy, or HTTPS certificate may be responsible.');
      }
    } finally { clearTimeout(timer); }
  }

  dismiss(): void { this.dismissed = true; this.prompt.next(false); }
  retry(): Promise<void> { this.dismissed = false; return this.checkAllEndpoints(); }
  reset(): void {
    ++this.generation;
    this.dismissed = false;
    this.checking = false;
    this.statuses.next([]);
    this.prompt.next(false);
  }
}
