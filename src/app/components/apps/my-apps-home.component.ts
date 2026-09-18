import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';

import {
  AppsNavService, MyApp, MyAppsPayload,
} from '@services/apps-nav.service';
import { AuthSessionService } from '@services/auth/auth-session.service';

/**
 * §58 — the TAILORED HOME (`/home`), his ask 2026-09-18:
 *
 *   "If you have my apps selected or a role selected, and apps exist that are
 *    assigned to those roles, we should have a secondary landing page you can
 *    land on that lets you choose from your own apps. It should still be
 *    possible to go to the main Polari Home page via another route, but when
 *    logged in as your user it takes you to your tailored home page."
 *
 * It renders ONE call — `GET /api/apps/mine` (§57) — as cards grouped the way
 * that answer already orders them: the primary role's apps, then every
 * additional role's, then what the person pinned themselves. It adds no read
 * model and no state of its own.
 *
 * Why a page component rather than a mode on the /apps catalogue: the
 * catalogue is a CATALOGUE — every app on the instance, a deployment plan per
 * card, export/build affordances, persona filters. A landing page is the
 * opposite shape (only yours, no plans, no authoring), so a `mine` flag there
 * would have been a second page hidden inside the first. The CARD STYLING is
 * reused literally, though: this component's first stylesheet IS
 * `apps-home.component.scss`, so the two pages cannot drift apart, and the
 * second sheet holds only the group headings. No new reusable component was
 * introduced — everything here is the shell's existing chrome.
 */
@Component({
  standalone: true,
  selector: 'my-apps-home',
  templateUrl: './my-apps-home.component.html',
  styleUrls: ['./apps-home.component.scss', './my-apps-home.component.scss'],
  imports: [CommonModule, RouterModule, MatIconModule, MatTooltipModule],
})
export class MyAppsHomeComponent implements OnInit, OnDestroy {
  mine: MyAppsPayload | null = null;
  loading = true;
  switching = '';
  switchError = '';

  private mineSub?: Subscription;
  private authSub?: Subscription;

  constructor(private appsNav: AppsNavService,
              private authSession: AuthSessionService,
              private router: Router) {}

  ngOnInit(): void {
    // Landing HERE is the deliberate opposite of "Polari home, please" —
    // it lifts the session choice so the next bare landing comes back here.
    this.appsNav.chooseTailoredHome();
    this.mineSub = this.appsNav.mine$.subscribe(m => {
      this.mine = m;
      this.loading = m === null;
    });
    this.appsNav.ensureMineLoaded();
    // A sign-in from this very page must fill it in, not leave the
    // signed-out message standing.
    this.authSub = this.authSession.currentUser$.subscribe(user => {
      if (user && !this.mine?.ok) { this.appsNav.refreshMine(); }
    });
  }

  ngOnDestroy(): void {
    this.mineSub?.unsubscribe();
    this.authSub?.unsubscribe();
  }

  get signedIn(): boolean {
    return this.authSession.isAuthenticated;
  }

  /** ok:false is the 401-shaped anonymous answer, not an error to show. */
  get ready(): boolean {
    return !!this.mine?.ok;
  }

  get apps(): MyApp[] {
    return this.mine?.ok ? this.mine.apps : [];
  }

  get primaryRole(): string {
    return this.mine?.ok ? this.mine.primary_role : '';
  }

  get heldRoles(): string[] {
    return this.mine?.ok ? this.mine.held_roles : [];
  }

  /** The switch only exists for somebody who actually holds more than one
   *  role — the backend refuses a role you do not hold, and a menu of one
   *  is noise. */
  get canSwitchPrimary(): boolean {
    return this.heldRoles.length > 1;
  }

  primaryApps(): MyApp[] {
    return this.apps.filter(a => a.via === 'primary');
  }

  additionalApps(): MyApp[] {
    return this.apps.filter(a => a.via === 'additional');
  }

  addedApps(): MyApp[] {
    return this.apps.filter(a => a.via === 'added');
  }

  get hiddenCount(): number {
    return this.mine?.ok ? this.mine.removed.length : 0;
  }

  async setPrimaryRole(role: string): Promise<void> {
    if (!role || role === this.primaryRole || this.switching) { return; }
    this.switching = role;
    this.switchError = '';
    const result = await this.appsNav.saveMine({ primary_role: role });
    this.switching = '';
    if (!result.ok) {
      this.switchError = result.error
        || 'could not make that your primary role';
    }
  }

  /** "Polari home": the main page, AND a session-long preference for it, so
   *  landing at the bare URL stops bringing them back here until they open
   *  this page again (or start a new browser session). */
  goPolariHome(): void {
    this.appsNav.choosePolariHome();
    this.router.navigateByUrl('/polari');
  }

  open(app: { route: string }): void {
    if (app.route) { this.router.navigateByUrl(app.route); }
  }
}
