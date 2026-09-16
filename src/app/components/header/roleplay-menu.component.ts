import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { Subscription } from 'rxjs';

import {
  RoleplayRole, RoleplayService, RoleplayState,
} from '@services/roleplay.service';

/**
 * roleplay-menu — the role menu in the header, beside the login controls.
 *
 * Renders ONLY when the backend says `can_roleplay` (a dev-posture instance
 * and a person holding the role-play permission). Acting as a prototype role
 * puts `X-Polari-Roleplay` on every backend request and records the apps and
 * pages used, so the role's permission profile can be derived from what the
 * job actually needed — then narrowed, enforced, and verified.
 */
@Component({
  standalone: true,
  selector: 'app-roleplay-menu',
  imports: [
    CommonModule, FormsModule, MatButtonModule, MatMenuModule, MatIconModule,
    MatTooltipModule, MatFormFieldModule, MatInputModule,
  ],
  template: `
    <ng-container *ngIf="state?.can_roleplay">
      <button mat-flat-button [matMenuTriggerFor]="roleMenu"
              class="header-roleplay-button"
              [class.acting]="!!role"
              [color]="role ? 'accent' : ''"
              matTooltip="Dev mode: everything you do as this role is recorded to build its permission profile"
              [attr.aria-label]="role ? ('Acting as ' + role) : 'Role-play'">
        <mat-icon>theater_comedy</mat-icon>
        <span class="header-roleplay-label">{{ role ? ('Acting as: ' + role) : 'Role-play' }}</span>
        <mat-icon class="header-roleplay-caret">arrow_drop_down</mat-icon>
      </button>

      <mat-menu #roleMenu="matMenu" class="roleplay-menu-panel">
        <div class="roleplay-menu-head" (click)="$event.stopPropagation()">
          Act as a prototype role — what you use is recorded to build its
          permission profile.
        </div>

        <button mat-menu-item *ngFor="let r of state.roles" (click)="act(r)">
          <mat-icon>{{ r.name === role ? 'check' : 'person_outline' }}</mat-icon>
          <span>{{ r.title || r.name }}</span>
        </button>

        <div class="roleplay-menu-empty"
             *ngIf="!state.roles || !state.roles.length"
             (click)="$event.stopPropagation()">
          No prototype roles yet — make one below.
        </div>

        <button mat-menu-item *ngIf="role" (click)="stop()">
          <mat-icon>stop_circle</mat-icon>
          <span>Stop role-play</span>
        </button>

        <div class="roleplay-menu-divider"></div>

        <div class="roleplay-new" (click)="$event.stopPropagation()"
             (keydown)="$event.stopPropagation()">
          <div class="roleplay-new-title">New prototype role</div>
          <mat-form-field appearance="outline" class="roleplay-field">
            <mat-label>name</mat-label>
            <input matInput [(ngModel)]="newName" name="roleplayName"
                   placeholder="journalist" autocomplete="off">
          </mat-form-field>
          <mat-form-field appearance="outline" class="roleplay-field">
            <mat-label>title</mat-label>
            <input matInput [(ngModel)]="newTitle" name="roleplayTitle"
                   placeholder="Journalist" autocomplete="off">
          </mat-form-field>
          <button mat-stroked-button class="roleplay-create"
                  [disabled]="!newName || creating" (click)="create()">
            {{ creating ? 'Creating…' : 'Create' }}
          </button>
          <div class="roleplay-error" *ngIf="error">{{ error }}</div>
        </div>

        <div class="roleplay-menu-divider"></div>

        <button mat-menu-item (click)="review()">
          <mat-icon>fact_check</mat-icon>
          <span>Review this role</span>
        </button>
      </mat-menu>
    </ng-container>
  `,
  styles: [`
    /* The toolbar is dark in both themes, so the trigger is tuned against
       --nav-background like the other header controls. */
    .header-roleplay-button {
      margin-left: 8px;
      height: 36px;
      line-height: 36px;
      font-weight: 500;
      letter-spacing: 0.3px;
      display: inline-flex;
      align-items: center;
      background-color: rgba(255, 255, 255, 0.12) !important;
      color: var(--nav-text) !important;
    }
    .header-roleplay-button:hover {
      background-color: rgba(255, 255, 255, 0.22) !important;
    }
    .header-roleplay-button.acting {
      background-color: var(--brand-orange) !important;
      color: #1a1a1a !important;
    }
    .header-roleplay-button.acting mat-icon { color: #1a1a1a !important; }
    .header-roleplay-button mat-icon { color: var(--nav-text); }
    .header-roleplay-label {
      margin: 0 4px 0 6px;
      max-width: 170px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .header-roleplay-caret { margin-left: -2px; }

    @media (max-width: 900px) {
      .header-roleplay-label { display: none; }
      .header-roleplay-button { min-width: 0; padding: 0 8px; }
    }
  `],
  /* The menu panel renders in an overlay OUTSIDE this component's view, so
     its styles cannot be encapsulated here — they live in styles.css under
     .roleplay-menu-panel. */
})
export class RoleplayMenuComponent implements OnInit, OnDestroy {
  state: RoleplayState = { can_roleplay: false, roles: [] };
  role = '';
  newName = '';
  newTitle = '';
  creating = false;
  error = '';

  private subs: Subscription[] = [];

  constructor(public roleplay: RoleplayService, private router: Router) {}

  ngOnInit(): void {
    this.subs.push(this.roleplay.state$.subscribe(s => { this.state = s; }));
    this.subs.push(this.roleplay.role$.subscribe(r => { this.role = r; }));
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
  }

  act(r: RoleplayRole): void {
    if (!r || !r.name) { return; }
    if (r.name === this.role) { void this.roleplay.stop(); return; }
    void this.roleplay.start(r.name);
  }

  stop(): void {
    void this.roleplay.stop();
  }

  async create(): Promise<void> {
    const name = (this.newName || '').trim();
    if (!name || this.creating) { return; }
    this.creating = true;
    this.error = '';
    const made = await this.roleplay.createPrototype(
      name, (this.newTitle || '').trim() || name, '');
    this.creating = false;
    if (made) {
      this.newName = '';
      this.newTitle = '';
    } else {
      this.error = 'Could not create that role — you may not hold the role-play permission.';
    }
  }

  review(): void {
    void this.router.navigate(['/display/security-events']);
  }
}
