import { Input, OnInit, OnDestroy } from '@angular/core';
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDividerModule } from '@angular/material/divider';
import { Router, NavigationEnd } from '@angular/router';
import { ThemeService } from '@services/theme.service';
import { AuthSessionService } from '@services/auth/auth-session.service';
import { AiAssistantService } from '@services/ai-assistant/ai-assistant.service';
import {
  AppNav, AppNavGroup, AppNavItem, AppsNavService, MyAppsPayload,
} from '@services/apps-nav.service';
import { AuthUser } from '../../classes/auth-user';
import { RoleplayMenuComponent } from './roleplay-menu.component';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { RoleClaimsService } from '@services/role-claims.service';
import { ClaimRoleDialogComponent } from './claim-role-dialog.component';
import { Subscription, filter } from 'rxjs';

@Component({
  standalone: true,
  selector: 'header',
  templateUrl: 'header.html',
  styleUrls: ['header.css'],
  imports: [CommonModule, MatToolbarModule, MatIconModule, MatButtonModule, MatMenuModule, MatTooltipModule, MatDividerModule, MatDialogModule, MatSnackBarModule, RoleplayMenuComponent]
})
export class HeaderComponent implements OnInit, OnDestroy {
  @Input()
  currentComponentTitle = "";

  polariImgUrl = "../assets/circle-cropped_dodecahedronStar.png";
  isDark = false;
  currentUser: AuthUser | null = null;

  // nav-3: the base top nav — app switcher + the higher-level views
  // — is ALWAYS present; an app in context ADDS its topMenu groups.
  disciplineApps: AppNav[] = [];
  useCaseApps: AppNav[] = [];
  currentApp: AppNav | null = null;
  topGroups: AppNavGroup[] = [];
  readonly coreViews = [
    { label: 'Topology', route: '/topology', icon: 'hub' },
    { label: 'Module Management', route: '/module-management',
      icon: 'widgets' },
    { label: 'Module Bringup', route: '/modules/bringup',
      icon: 'power' },
    { label: 'Tech Trees', route: '/tech-tree',
      icon: 'account_tree' },
    { label: 'Polari-Apps', route: '/apps', icon: 'apps' },
    { label: 'System Diagnostics', route: '/system-diagnostics',
      icon: 'monitor_heart' },
  ];

  private themeSub?: Subscription;
  private authSub?: Subscription;
  private navSub?: Subscription;
  private routeSub?: Subscription;

  /** The Keycloak account console for this realm — '' when there is none
   *  (the "Manage account" item then stays hidden). */
  accountUrl = '';

  /** roles -> apps (his ask 2026-09-18): "a primary role and additional
   *  roles". The roles a person HOLDS are their token's `groups` claim, so
   *  the menu can only ever offer roles they really have; someone holding
   *  none sees nothing new and still gets the whole catalogue. */
  mine: MyAppsPayload | null = null;
  private mineSub?: Subscription;

  get heldRoles(): string[] {
    return this.mine?.ok ? this.mine.held_roles : [];
  }

  get primaryRole(): string {
    return this.mine?.ok ? this.mine.primary_role : '';
  }

  /** Switch which of the person's own roles leads. The backend refuses a
   *  role they do not hold; the menu never offers one. */
  async setPrimaryRole(role: string): Promise<void> {
    if (!role || role === this.primaryRole) { return; }
    const result = await this.appsNav.saveMine({ primary_role: role });
    if (!result.ok) {
      console.warn('[header] could not set the primary role', result.error);
    }
  }

  constructor(
    private themeService: ThemeService,
    private authSession: AuthSessionService,
    public assistant: AiAssistantService,
    private appsNav: AppsNavService,
    private router: Router,
    private dialog: MatDialog,
    private roleClaims: RoleClaimsService,
    private snackBar: MatSnackBar
  ) {}

  /** "Claim a role…" — self-claimable roles, his ask 2026-09-18. */
  claimRole(): void {
    this.dialog.open(ClaimRoleDialogComponent, { autoFocus: false });
  }

  toggleAssistant(): void {
    this.assistant.toggle();
  }

  /** sep-0: the single-app clamp hides the Apps switcher and Core
   *  menu — presentation only, capability stays with KC. */
  get shellLocked(): boolean {
    return this.appsNav.locked;
  }

  ngOnInit(): void {
    this.themeSub = this.themeService.currentTheme.subscribe(theme => {
      this.isDark = theme === 'dark';
    });
    this.authSub = this.authSession.currentUser$.subscribe(user => {
      this.currentUser = user;
      // The account console URL comes from the backend (it knows the
      // issuer); read it once a person is actually signed in.
      if (user && !this.accountUrl) {
        void this.roleClaims.claimable()
          .then(s => { this.accountUrl = s.account_url || ''; })
          .catch(() => { this.accountUrl = ''; });
      }
    });
    this.mineSub = this.appsNav.mine$.subscribe(m => { this.mine = m; });
    this.appsNav.ensureLoaded();
    this.navSub = this.appsNav.payload$.subscribe(p => {
      this.disciplineApps =
        (p?.apps ?? []).filter(a => a.discipline);
      this.useCaseApps =
        (p?.apps ?? []).filter(a => !a.discipline);
      this.bindAppContext(this.router.url);
    });
    this.routeSub = this.router.events
      .pipe(filter((e): e is NavigationEnd =>
        e instanceof NavigationEnd))
      .subscribe(e => this.bindAppContext(e.urlAfterRedirects));
  }

  private bindAppContext(url: string): void {
    this.currentApp = this.appsNav.appForUrl(url);
    this.topGroups =
      (this.currentApp?.nav ?? []).filter(g => g.topMenu);
  }

  openNavItem(it: AppNavItem): void {
    if (it.availability === 'absent') {
      this.router.navigateByUrl(
        it.bringup?.route || '/modules/bringup');
    } else if (it.kind === 'tech-node' && it.ref) {
      this.router.navigate(['/tech-tree'],
                           { queryParams: { node: it.ref } });
    } else if (it.route) {
      this.router.navigateByUrl(it.route);
    }
  }

  go(route: string): void {
    this.router.navigateByUrl(route);
  }

  /** §58: where the logo goes. `/home` (the tailored page) for somebody who
   *  has one and has not asked for the main page this session; `/` — the
   *  main Polari home — for everybody else. The landing guard asks the same
   *  service the same question, so the two can never disagree. */
  get homeRoute(): string {
    return this.appsNav.homeRoute();
  }

  get homeTooltip(): string {
    return this.homeRoute === '/home'
      ? 'your apps (Polari home is on that page)' : 'Polari home';
  }

  goHome(): void {
    this.router.navigateByUrl(this.homeRoute);
  }

  ngOnDestroy(): void {
    this.themeSub?.unsubscribe();
    this.authSub?.unsubscribe();
    this.navSub?.unsubscribe();
    this.routeSub?.unsubscribe();
    this.mineSub?.unsubscribe();
  }

  toggleTheme(): void {
    this.themeService.toggleTheme();
  }

  login(): void {
    void this.authSession.login().then((ok) => { if (!ok) { this.signInUnreachable('sign in'); } });
  }

  register(): void {
    void this.authSession.register().then((ok) => { if (!ok) { this.signInUnreachable('register'); } });
  }

  /** bp-2b: the sign-in round trip could not start — say so, name the realm host, offer to open it (the usual cause
   *  on a phone or a fresh machine: the dev certificate of the auth host is not trusted yet, so the browser refuses
   *  the realm's discovery document before any redirect happens). */
  private signInUnreachable(what: string): void {
    const authority = this.authSession.authority;
    let host = authority;
    try { host = authority ? new URL(authority).host : ''; } catch { /* keep the raw string */ }
    const msg = host
      ? `Could not ${what}: the sign-in server at ${host} did not answer. On this device its certificate may not be trusted yet — open it once, accept it, then try again.`
      : `Could not ${what}: the sign-in server is not configured for this page.`;
    const ref = this.snackBar.open(msg, authority ? 'Open it' : 'OK', { duration: 12000 });
    if (authority) { ref.onAction().subscribe(() => window.open(authority, '_blank', 'noopener')); }
  }

  logout(): void {
    this.authSession.logout();
  }

  get displayName(): string {
    return this.currentUser?.name || this.currentUser?.username || 'Account';
  }
}
