import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';

import {
  ClaimableRole, ClaimableState, EMPTY_CLAIMABLE, RoleClaimsService,
} from '@services/role-claims.service';
import { AuthSessionService } from '@services/auth/auth-session.service';

/**
 * claim-role-dialog — "Claim a role…" from the signed-in user menu.
 *
 * His ask (2026-09-18): a person who has just registered should be able to
 * give themselves a role from inside Polari, without going to Keycloak and
 * without finding an administrator — but only the roles that are meant to be
 * self-service. The backend decides which those are; this lists them, with a
 * Claim / Release button each, and says plainly that the new group only
 * reaches the token on the next sign-in (it tries a silent renew first).
 *
 * Theme tokens only: it must read in dark mode as well as light.
 */
@Component({
  standalone: true,
  selector: 'claim-role-dialog',
  imports: [
    CommonModule, MatDialogModule, MatButtonModule, MatIconModule,
    MatProgressSpinnerModule, MatTooltipModule,
  ],
  template: `
    <h2 mat-dialog-title class="claim-title">
      <mat-icon>badge</mat-icon>
      <span>Claim a role</span>
    </h2>

    <mat-dialog-content class="claim-content">
      <p class="claim-lede">
        A role in Polari is a group at the sign-in service. These are the roles
        you may give yourself here — administrator roles never appear.
      </p>

      <div class="claim-loading" *ngIf="loading">
        <mat-spinner diameter="22"></mat-spinner>
        <span>Reading the roles you may claim…</span>
      </div>

      <div class="claim-empty" *ngIf="!loading && !state.roles.length">
        <ng-container *ngIf="state.ok; else noBackend">
          No role is self-claimable on this instance
          <span *ngIf="state.posture === 'production'">
            — in production a role has to be opened for self-service first.</span>
          <span *ngIf="state.posture !== 'production'">
            — an administrator creates prototype roles, and every one of them
            becomes claimable here.</span>
        </ng-container>
        <ng-template #noBackend>
          This instance does not offer self-claimable roles.
        </ng-template>
      </div>

      <ul class="claim-list" *ngIf="!loading && state.roles.length">
        <li *ngFor="let r of state.roles" class="claim-row" [class.held]="r.held">
          <div class="claim-row-text">
            <div class="claim-row-name">
              <mat-icon class="claim-row-icon">{{ r.held ? 'check_circle' : 'person_outline' }}</mat-icon>
              <span>{{ r.title || r.role }}</span>
              <span class="claim-badge" *ngIf="r.held">held</span>
              <span class="claim-badge subtle" *ngIf="r.source === 'knob'"
                    matTooltip="Opened for self-service by the operator, not a prototype role">group</span>
            </div>
            <div class="claim-row-desc" *ngIf="r.description">{{ r.description }}</div>
          </div>
          <button mat-stroked-button
                  [disabled]="busy === r.role"
                  (click)="toggle(r)">
            <mat-spinner *ngIf="busy === r.role" diameter="16"></mat-spinner>
            <span *ngIf="busy !== r.role">{{ r.held ? 'Release' : 'Claim' }}</span>
          </button>
        </li>
      </ul>

      <div class="claim-error" *ngIf="error">
        <mat-icon class="claim-error-icon">error_outline</mat-icon>
        <span>{{ error }}</span>
      </div>

      <div class="claim-note" *ngIf="note">
        <mat-icon class="claim-note-icon">info</mat-icon>
        <span>{{ note }}</span>
      </div>

      <div class="claim-signin" *ngIf="needsSignIn">
        <span>Your sign-in could not be refreshed in the background.</span>
        <button mat-flat-button color="primary" (click)="signInAgain()">
          Sign in again
        </button>
      </div>
    </mat-dialog-content>

    <mat-dialog-actions class="claim-actions">
      <a *ngIf="state.account_url" class="claim-account"
         [href]="state.account_url" target="_blank" rel="noopener noreferrer">
        <mat-icon>open_in_new</mat-icon>
        <span>Manage account in Keycloak</span>
      </a>
      <span class="claim-spacer"></span>
      <button mat-button mat-dialog-close>Close</button>
    </mat-dialog-actions>
  `,
  styles: [`
    .claim-title {
      display: flex; align-items: center; gap: 8px;
      color: var(--text-primary);
    }
    .claim-content {
      min-width: 340px; max-width: 460px;
      color: var(--text-primary);
    }
    .claim-lede {
      margin: 0 0 12px; font-size: 13px; line-height: 1.4;
      color: var(--text-secondary);
    }
    .claim-loading {
      display: flex; align-items: center; gap: 10px;
      font-size: 13px; color: var(--text-secondary); padding: 8px 0;
    }
    .claim-empty {
      font-size: 13px; line-height: 1.4;
      color: var(--text-secondary); font-style: italic; padding: 4px 0 8px;
    }
    .claim-list { list-style: none; margin: 0; padding: 0; }
    .claim-row {
      display: flex; align-items: center; gap: 12px;
      padding: 10px 0;
      border-top: 1px solid var(--border-medium);
    }
    .claim-row:first-child { border-top: none; }
    .claim-row-text { flex: 1 1 auto; min-width: 0; }
    .claim-row-name {
      display: flex; align-items: center; gap: 6px;
      font-size: 14px; font-weight: 500; color: var(--text-primary);
    }
    .claim-row-icon {
      font-size: 18px; width: 18px; height: 18px;
      color: var(--text-secondary);
    }
    .claim-row.held .claim-row-icon { color: var(--color-success-text); }
    .claim-row-desc {
      margin-top: 2px; font-size: 12px; line-height: 1.35;
      color: var(--text-secondary);
    }
    .claim-badge {
      font-size: 10px; text-transform: uppercase; letter-spacing: .05em;
      padding: 1px 6px; border-radius: 10px;
      border: 1px solid var(--border-medium); color: var(--text-secondary);
    }
    .claim-badge.subtle { opacity: .7; }
    .claim-error, .claim-note, .claim-signin {
      display: flex; align-items: flex-start; gap: 8px;
      margin-top: 12px; padding: 10px 12px; border-radius: 6px;
      font-size: 12px; line-height: 1.4;
      border: 1px solid var(--border-medium);
      background: var(--surface-secondary);
      color: var(--text-secondary);
    }
    .claim-signin { align-items: center; justify-content: space-between; }
    .claim-error { color: var(--color-error-text); border-color: var(--color-error-text); }
    .claim-error-icon, .claim-note-icon {
      font-size: 18px; width: 18px; height: 18px; flex-shrink: 0;
    }
    .claim-actions { display: flex; align-items: center; }
    .claim-spacer { flex: 1 1 auto; }
    .claim-account {
      display: inline-flex; align-items: center; gap: 6px;
      font-size: 13px; text-decoration: none; padding-left: 8px;
      color: var(--color-info-text);
    }
    .claim-account:hover { text-decoration: underline; }
    .claim-account mat-icon { font-size: 16px; width: 16px; height: 16px; }
  `],
})
export class ClaimRoleDialogComponent implements OnInit {
  state: ClaimableState = EMPTY_CLAIMABLE;
  loading = true;
  busy = '';
  error = '';
  note = '';
  needsSignIn = false;

  constructor(
    private claims: RoleClaimsService,
    private authSession: AuthSessionService,
    private dialogRef: MatDialogRef<ClaimRoleDialogComponent>,
  ) {}

  async ngOnInit(): Promise<void> {
    await this.reload();
  }

  private async reload(): Promise<void> {
    this.loading = true;
    this.state = await this.claims.claimable();
    this.loading = false;
    if (this.state.ok && this.state.keycloak && this.state.keycloak.ready === false) {
      this.error = this.state.keycloak.why || '';
    }
  }

  async toggle(r: ClaimableRole): Promise<void> {
    if (this.busy) { return; }
    this.busy = r.role;
    this.error = '';
    const res = r.held
      ? await this.claims.release(r.role)
      : await this.claims.claim(r.role);
    this.busy = '';
    if (!res.ok) {
      this.error = res.refusal || 'the change was refused';
      return;
    }
    // The group only exists in a NEWLY issued token: try a silent renew,
    // and say so plainly when it cannot be done here.
    const renewed = await this.authSession.renewSession();
    this.needsSignIn = !renewed;
    this.note = renewed
      ? `Your session was refreshed — you now act ${r.held ? 'without' : 'as'} ${r.role}.`
      : (res.note || 'Sign in again for the change to appear in your session.');
    await this.reload();
  }

  signInAgain(): void {
    this.dialogRef.close();
    void this.authSession.login();
  }
}
