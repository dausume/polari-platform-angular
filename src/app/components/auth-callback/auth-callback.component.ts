import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

import { AuthSessionService } from '@services/auth/auth-session.service';

/**
 * /callback route — handles the redirect from Keycloak after auth.
 *
 * On success, navigates back to the user's pre-login path (replaceUrl
 * so the back button doesn't re-trigger the code exchange).
 *
 * On failure, stops here and shows the error rather than silently
 * dropping to `/` — silent failure is exactly what made the bug we're
 * currently debugging invisible. The user can navigate to /permissions
 * to see fuller diagnostics, or retry login.
 */
@Component({
  standalone: true,
  selector: 'auth-callback',
  imports: [CommonModule, MatProgressSpinnerModule, MatButtonModule, MatIconModule],
  template: `
    <div class="auth-callback-shell">
      <ng-container *ngIf="!errorMessage; else errBlock">
        <mat-spinner diameter="48"></mat-spinner>
        <p>Signing you in…</p>
      </ng-container>
      <ng-template #errBlock>
        <mat-icon class="err-icon">error</mat-icon>
        <h2>Sign-in failed</h2>
        <p class="err-detail">{{ errorMessage }}</p>
        <p class="muted small">Check the browser console for the full error chain.</p>
        <div class="actions">
          <button mat-stroked-button (click)="goHome()">
            <mat-icon>home</mat-icon> Home
          </button>
          <button mat-stroked-button (click)="goDiagnostics()">
            <mat-icon>bug_report</mat-icon> Open Diagnostics
          </button>
          <button mat-flat-button color="primary" (click)="retry()">
            <mat-icon>login</mat-icon> Try Again
          </button>
        </div>
      </ng-template>
    </div>
  `,
  styles: [`
    .auth-callback-shell {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100vh;
      gap: 16px;
      padding: 16px;
      text-align: center;
    }
    .err-icon {
      font-size: 64px;
      width: 64px;
      height: 64px;
      color: #c62828;
    }
    h2 { margin: 0; }
    .err-detail {
      font-family: monospace;
      font-size: 0.9rem;
      max-width: 600px;
      word-break: break-word;
      color: #c62828;
    }
    .muted { color: #888; }
    .small { font-size: 0.85rem; }
    .actions { display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; }
  `]
})
export class AuthCallbackComponent implements OnInit {
  errorMessage: string | null = null;

  constructor(
    private authSession: AuthSessionService,
    private router: Router
  ) {}

  async ngOnInit(): Promise<void> {
    console.log('[AuthCallback] ngOnInit — current url:', window.location.href);
    const returnTo = await this.authSession.handleOAuthCallback();
    console.log('[AuthCallback] handleOAuthCallback returned:', returnTo, 'isAuthenticated:', this.authSession.isAuthenticated);

    // Success path: session is populated. Navigate back to the original page.
    if (this.authSession.isAuthenticated) {
      this.router.navigateByUrl(returnTo || '/', { replaceUrl: true });
      return;
    }

    // Failure path: stay here and surface whatever the chain logged.
    const persisted = sessionStorage.getItem('__polari_auth_callback_error');
    if (persisted) {
      try {
        const parsed = JSON.parse(persisted);
        this.errorMessage = parsed.errorDescription || parsed.message || parsed.error || 'Unknown error';
      } catch {
        this.errorMessage = persisted;
      }
    } else {
      this.errorMessage = 'No usable session returned from Keycloak (see console for details).';
    }
  }

  goHome(): void {
    this.router.navigateByUrl('/', { replaceUrl: true });
  }

  goDiagnostics(): void {
    this.router.navigateByUrl('/permissions', { replaceUrl: true });
  }

  retry(): void {
    this.authSession.login();
  }
}
