import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { RuntimeConfigService } from './runtime-config.service';

export interface EndpointStatus {
  name: string;
  url: string;
  trusted: boolean;
  checked: boolean;
  error?: string;
}

/**
 * CertificateTrustService
 *
 * Detects when self-signed certificates are not trusted by the browser
 * and provides information to help users resolve the issue.
 *
 * In development with self-signed certs, browsers will reject HTTPS connections
 * to endpoints they don't trust. This service probes key endpoints and detects
 * these failures so we can show a helpful UI to the user.
 */
@Injectable({ providedIn: 'root' })
export class CertificateTrustService {

  // RxJS BehaviorSubjects for reactive state
  private _endpointStatuses = new BehaviorSubject<EndpointStatus[]>([]);
  private _checkComplete = new BehaviorSubject<boolean>(false);
  private _hasUntrustedCerts = new BehaviorSubject<boolean>(false);
  private _dismissed = new BehaviorSubject<boolean>(false);
  private _showPrompt = new BehaviorSubject<boolean>(false);

  // Public observables
  endpointStatuses$: Observable<EndpointStatus[]> = this._endpointStatuses.asObservable();
  checkComplete$: Observable<boolean> = this._checkComplete.asObservable();
  hasUntrustedCerts$: Observable<boolean> = this._hasUntrustedCerts.asObservable();
  showPrompt$: Observable<boolean> = this._showPrompt.asObservable();

  // Synchronous getters for template binding
  get showPrompt(): boolean {
    return this._showPrompt.value;
  }

  get endpointStatuses(): EndpointStatus[] {
    return this._endpointStatuses.value;
  }

  get untrustedEndpoints(): EndpointStatus[] {
    return this._endpointStatuses.value.filter(e => !e.trusted);
  }

  constructor(private runtimeConfig: RuntimeConfigService) {
    console.log('[CertificateTrustService] Initialized');
  }

  /**
   * Update showPrompt based on current state
   */
  private updateShowPrompt(): void {
    const shouldShow = this._checkComplete.value &&
                       this._hasUntrustedCerts.value &&
                       !this._dismissed.value;
    console.log('[CertificateTrustService] updateShowPrompt:', shouldShow);
    this._showPrompt.next(shouldShow);
  }

  /**
   * Check all endpoints for certificate trust issues
   * Call this on app startup
   */
  async checkAllEndpoints(): Promise<void> {
    console.log('[CertificateTrustService] checkAllEndpoints called');

    // Get the current backend URL from RuntimeConfigService
    const backendUrl = this.runtimeConfig.getBackendBaseUrl();
    const isUsingHttps = this.runtimeConfig.useHttps$.value;
    const protocol = this.runtimeConfig.backendProtocol$.value;

    console.log('[CertificateTrustService] Backend URL:', backendUrl);
    console.log('[CertificateTrustService] Using HTTPS:', isUsingHttps);
    console.log('[CertificateTrustService] Protocol:', protocol);

    // Skip check if not using HTTPS
    if (!isUsingHttps || protocol !== 'https') {
      console.log('[CertificateTrustService] Skipping - not using HTTPS');
      this._checkComplete.next(true);
      this.updateShowPrompt();
      return;
    }

    // Build the endpoints to check based on current backend configuration
    const endpoints: EndpointStatus[] = [
      {
        name: 'Backend API',
        url: backendUrl + '/cert-trust',
        trusted: false,
        checked: false
      }
    ];

    console.log('[CertificateTrustService] Checking endpoints:', endpoints.map(e => e.url));

    const results = await Promise.all(
      endpoints.map(endpoint => this.checkEndpoint(endpoint))
    );

    console.log('[CertificateTrustService] Check results:', results);

    this._endpointStatuses.next(results);
    this._checkComplete.next(true);
    this._hasUntrustedCerts.next(results.some(e => !e.trusted));
    this.updateShowPrompt();

    if (this._hasUntrustedCerts.value) {
      console.warn('[CertificateTrustService] Certificate trust issues detected:');
      results.filter(e => !e.trusted).forEach(e => {
        console.warn(`  - ${e.name}: ${e.url} (${e.error})`);
      });
    } else {
      console.log('[CertificateTrustService] All certificates are trusted.');
    }
  }

  /**
   * Check a single endpoint for certificate trust
   */
  private async checkEndpoint(endpoint: EndpointStatus): Promise<EndpointStatus> {
    console.log('[CertificateTrustService] Checking endpoint:', endpoint.url);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      // Try to fetch the endpoint
      await fetch(endpoint.url, {
        method: 'HEAD',
        mode: 'no-cors',
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      console.log('[CertificateTrustService] Endpoint trusted:', endpoint.url);
      return {
        ...endpoint,
        trusted: true,
        checked: true
      };
    } catch (error: any) {
      console.log('[CertificateTrustService] Endpoint check failed:', endpoint.url, error.message);
      return {
        ...endpoint,
        trusted: false,
        checked: true,
        error: error.message || 'Connection failed - likely untrusted certificate'
      };
    }
  }

  /**
   * Dismiss the certificate trust prompt
   */
  dismiss(): void {
    console.log('[CertificateTrustService] Dismissed');
    this._dismissed.next(true);
    this.updateShowPrompt();
  }

  /**
   * Reset dismissed state
   */
  reset(): void {
    this._dismissed.next(false);
    this._checkComplete.next(false);
    this._hasUntrustedCerts.next(false);
    this.updateShowPrompt();
  }

  /**
   * Get instructions for trusting certificates
   */
  getTrustInstructions(): string[] {
    return [
      'Click each link below to open the service in a new tab',
      'Your browser will show a security warning about the certificate',
      'Click "Advanced" (or similar) and choose to proceed/accept the risk',
      'Once accepted, close the tab and return here',
      'After trusting all certificates, refresh this page'
    ];
  }
}
