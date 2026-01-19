import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { CertificateTrustService, EndpointStatus } from '../../services/certificate-trust.service';

/**
 * CertificateTrustPromptComponent
 *
 * Displays a user-friendly prompt when self-signed certificates are not trusted.
 * Provides links to each endpoint so users can accept the certificates,
 * and instructions on how to proceed.
 */
@Component({
  selector: 'app-certificate-trust-prompt',
  templateUrl: './certificate-trust-prompt.html',
  styleUrls: ['./certificate-trust-prompt.css']
})
export class CertificateTrustPromptComponent implements OnInit, OnDestroy {

  showPrompt: boolean = false;
  untrustedEndpoints: EndpointStatus[] = [];
  instructions: string[];

  private subscriptions: Subscription[] = [];

  constructor(private certService: CertificateTrustService) {
    this.instructions = this.certService.getTrustInstructions();
  }

  ngOnInit(): void {
    console.log('[CertificateTrustPrompt] Initializing...');

    // Subscribe to showPrompt changes
    this.subscriptions.push(
      this.certService.showPrompt$.subscribe(show => {
        console.log('[CertificateTrustPrompt] showPrompt changed:', show);
        this.showPrompt = show;
      })
    );

    // Subscribe to endpoint status changes
    this.subscriptions.push(
      this.certService.endpointStatuses$.subscribe(endpoints => {
        console.log('[CertificateTrustPrompt] endpoints changed:', endpoints);
        this.untrustedEndpoints = endpoints.filter(e => !e.trusted);
      })
    );

    // Check endpoints on component initialization
    console.log('[CertificateTrustPrompt] Calling checkAllEndpoints...');
    this.certService.checkAllEndpoints();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  /**
   * Open an endpoint URL in a new tab so user can accept the certificate
   */
  openEndpoint(url: string): void {
    window.open(url, '_blank');
  }

  /**
   * Dismiss the prompt - user will handle it themselves
   */
  dismiss(): void {
    this.certService.dismiss();
  }

  /**
   * Refresh the page after user has trusted certificates
   */
  refresh(): void {
    window.location.reload();
  }
}
