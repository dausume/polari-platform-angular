import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { AuthSessionService } from '@services/auth/auth-session.service';

@Component({
  standalone: true,
  selector: 'auth-callback',
  imports: [CommonModule, MatProgressSpinnerModule],
  template: `
    <div class="auth-callback-shell">
      <mat-spinner diameter="48"></mat-spinner>
      <p>Signing you in…</p>
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
    }
  `]
})
export class AuthCallbackComponent implements OnInit {
  constructor(
    private authSession: AuthSessionService,
    private router: Router
  ) {}

  async ngOnInit(): Promise<void> {
    const returnTo = await this.authSession.handleOAuthCallback();
    // Replace history so the callback URL (with code/state params) isn't
    // a back-button target — users would re-trigger the exchange and fail.
    this.router.navigateByUrl(returnTo || '/', { replaceUrl: true });
  }
}
