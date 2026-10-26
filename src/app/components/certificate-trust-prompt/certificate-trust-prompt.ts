import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { CertificateTrustService, EndpointStatus } from '../../services/certificate-trust.service';

/**
 * CertificateTrustPromptComponent
 *
 * Reports persistent service failures without assuming a certificate problem.
 */
@Component({
  standalone: true,
  selector: 'app-certificate-trust-prompt',
  templateUrl: './certificate-trust-prompt.html',
  styleUrls: ['./certificate-trust-prompt.css'],
  imports: [CommonModule, MatCardModule, MatIconModule, MatButtonModule]
})
export class CertificateTrustPromptComponent implements OnInit, OnDestroy {

  showPrompt: boolean = false;
  failedEndpoints: EndpointStatus[] = [];
  get checking(): boolean { return this.certService.checking; }

  private subscriptions: Subscription[] = [];

  constructor(private certService: CertificateTrustService) {

  }

  ngOnInit(): void {
    // console.log('[CertificateTrustPrompt] Initializing...');

    // Subscribe to showPrompt changes
    this.subscriptions.push(
      this.certService.showPrompt$.subscribe(show => {
        // console.log('[CertificateTrustPrompt] showPrompt changed:', show);
        this.showPrompt = show;
      })
    );

    // Subscribe to endpoint status changes
    this.subscriptions.push(
      this.certService.endpointStatuses$.subscribe(endpoints => {
        // console.log('[CertificateTrustPrompt] endpoints changed:', endpoints);
        this.failedEndpoints = endpoints.filter(e => e.checked && e.state !== 'reachable');
      })
    );

    // Check endpoints on component initialization
    // console.log('[CertificateTrustPrompt] Calling checkAllEndpoints...');
    this.certService.checkAllEndpoints();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  /**
   * Open a diagnostic endpoint without bypassing browser certificate checks
   */
  openEndpoint(url: string): void {
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  /**
   * Dismiss the prompt - user will handle it themselves
   */
  dismiss(): void {
    this.certService.dismiss();
  }

  /**
   * Retry service checks without reloading the app
   */
  refresh(): void {
    void this.certService.retry();
  }
}
