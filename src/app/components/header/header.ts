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
  AppNav, AppNavGroup, AppNavItem, AppsNavService,
} from '@services/apps-nav.service';
import { AuthUser } from '../../classes/auth-user';
import { Subscription, filter } from 'rxjs';

@Component({
  standalone: true,
  selector: 'header',
  templateUrl: 'header.html',
  styleUrls: ['header.css'],
  imports: [CommonModule, MatToolbarModule, MatIconModule, MatButtonModule, MatMenuModule, MatTooltipModule, MatDividerModule]
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

  constructor(
    private themeService: ThemeService,
    private authSession: AuthSessionService,
    public assistant: AiAssistantService,
    private appsNav: AppsNavService,
    private router: Router
  ) {}

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
    });
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

  ngOnDestroy(): void {
    this.themeSub?.unsubscribe();
    this.authSub?.unsubscribe();
    this.navSub?.unsubscribe();
    this.routeSub?.unsubscribe();
  }

  toggleTheme(): void {
    this.themeService.toggleTheme();
  }

  login(): void {
    this.authSession.login();
  }

  register(): void {
    this.authSession.register();
  }

  logout(): void {
    this.authSession.logout();
  }

  get displayName(): string {
    return this.currentUser?.name || this.currentUser?.username || 'Account';
  }
}
