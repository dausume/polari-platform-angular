import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { PolariService } from '@services/polari-service';
import {
  AppsNavService, MyApp, MyAppsPayload,
} from '@services/apps-nav.service';

interface AppEntry {
  name: string;
  title: string;
  useCase: string;
  description: string;
  modules: string[];
  pages: string[];
}

interface AppPlacement {
  module: string;
  status: 'already-placed' | 'needs-assignment' | 'missing';
  instances: string[];
  suggestedInstance: string;
  suggestedCommand: string;
}

interface AppPlan {
  ok: boolean;
  error?: string;
  app: string;
  topology: string;
  title: string;
  useCase: string;
  pages: string[];
  placements: AppPlacement[];
  readiness: number;
  note: string;
}

/**
 * Polari-Apps (/apps, tt-12): configurations of modules for a
 * particular capability or use-case — a wax 3D-printing company, a
 * lean judicial app, a DMV policy-analysis build. Deployment is
 * PLAN-FIRST and exportable: the Export button downloads the
 * credential-free polari-app-package JSON that
 * `pol apps deploy <file.json>` applies later; nothing deploys on
 * the spot from this page.
 */
@Component({
  standalone: true,
  selector: 'apps-home',
  templateUrl: './apps-home.component.html',
  styleUrls: ['./apps-home.component.scss'],
  imports: [CommonModule, RouterModule, MatIconModule,
            MatTooltipModule],
})
export class AppsHomeComponent implements OnInit {
  apps: AppEntry[] = [];
  plans = new Map<string, AppPlan>();
  loading = true;
  loadError = '';

  // nav-5: persona chips — filter the cards, and jump straight
  // into the discipline's default study (EE → magnetics).
  personas: string[] = [];
  personaApps: Record<string, string[]> = {};
  activePersona = '';

  // roles -> apps (his ask 2026-09-18): this catalogue IS the "edit my
  // apps" surface — every card says whether the app is already in My apps
  // (and via which role), and carries the one act that adds or hides it.
  // Nothing renders for an anonymous visitor; the catalogue is unchanged
  // for them.
  mine: MyAppsPayload | null = null;
  saveError = '';
  saving = '';

  constructor(private http: HttpClient,
              private polariService: PolariService,
              private appsNav: AppsNavService,
              private route: ActivatedRoute,
              private router: Router) {}

  private url(path: string): string {
    return `${this.polariService.getBackendBaseUrl()}/api/apps${path}`;
  }

  async ngOnInit(): Promise<void> {
    const result = await firstValueFrom(this.http.get<{
      ok: boolean; apps: AppEntry[];
    }>(this.url(''), this.polariService.backendRequestOptions))
      .catch(() => null);
    this.loading = false;
    if (!result?.ok) {
      this.loadError = 'No apps answered — is the backend up? '
        + '(GET /api/apps)';
      return;
    }
    this.apps = result.apps;
    for (const app of this.apps) { this.loadPlan(app.name); }
    this.appsNav.ensureLoaded();
    this.appsNav.payload$.subscribe(p => {
      this.personaApps = p?.personas ?? {};
      this.personas = Object.keys(this.personaApps).sort();
    });
    this.route.queryParamMap.subscribe(q =>
      this.activePersona = q.get('persona') || '');
    this.appsNav.mine$.subscribe(m => { this.mine = m; });
    this.appsNav.ensureMineLoaded();
  }

  // ---- roles -> apps: refine what "My apps" holds ---------------------

  /** True once somebody is signed in and the backend answered — the only
   *  condition under which the add/hide affordances render at all. */
  get canRefine(): boolean {
    return !!this.mine?.ok;
  }

  get hasRoles(): boolean {
    return (this.mine?.held_roles?.length ?? 0) > 0;
  }

  mineEntry(name: string): MyApp | undefined {
    return this.mine?.apps.find(a => a.name === name);
  }

  isHidden(name: string): boolean {
    return !!this.mine?.removed.some(a => a.name === name);
  }

  get hiddenApps(): { name: string; title: string; route: string }[] {
    return this.mine?.ok ? this.mine.removed : [];
  }

  /** What the card's one button says and does: an app a role gave you can
   *  be hidden, an app you hid can be restored, anything else can be
   *  added. Hiding HIDES — it grants and revokes nothing. */
  refineLabel(name: string): string {
    if (this.isHidden(name)) { return '↺ restore'; }
    return this.mineEntry(name) ? '− hide' : '+ add';
  }

  refineHint(name: string): string {
    const entry = this.mineEntry(name);
    if (this.isHidden(name)) {
      return 'you hid this app — put it back in My apps';
    }
    if (entry?.via === 'added') {
      return 'you added this app — remove it from My apps';
    }
    if (entry) {
      return `your ${entry.via} role '${entry.role}' brings this app — `
        + 'hide it (this changes what you see, never what you may do)';
    }
    return 'add this app to My apps in the side menu';
  }

  async refine(name: string): Promise<void> {
    if (this.saving) { return; }
    this.saving = name;
    this.saveError = '';
    const change = this.isHidden(name) ? { restore: [name] }
      : this.mineEntry(name) ? { remove: [name] } : { add: [name] };
    const result = await this.appsNav.saveMine(change);
    this.saving = '';
    if (!result.ok) {
      this.saveError = result.error || 'could not save that choice';
    }
  }

  get visibleApps(): AppEntry[] {
    const names = this.personaApps[this.activePersona];
    return names?.length
      ? this.apps.filter(a => names.includes(a.name)) : this.apps;
  }

  setPersona(persona: string): void {
    this.activePersona =
      this.activePersona === persona ? '' : persona;
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { persona: this.activePersona || null },
      queryParamsHandling: 'merge',
    });
  }

  /** The discipline's default study: the persona's first app's
   *  first enabled routed item — the "EE → magnetics" jump. */
  enterPersona(persona: string): void {
    const first = (this.personaApps[persona] || [])[0];
    const app = first ? this.appsNav.appByName(first) : null;
    if (!app) { return; }
    const item = app.nav.flatMap(g => g.items)
      .find(it => it.availability === 'enabled' && it.route);
    this.router.navigateByUrl(item?.route || `/app/${app.name}`);
  }

  private async loadPlan(name: string): Promise<void> {
    const plan = await firstValueFrom(this.http.get<AppPlan>(
      this.url(`/plan?name=${encodeURIComponent(name)}`),
      this.polariService.backendRequestOptions)).catch(() => null);
    if (plan?.ok) { this.plans.set(name, plan); }
  }

  plan(name: string): AppPlan | undefined {
    return this.plans.get(name);
  }

  percent(level: number | undefined): string {
    return `${Math.round((level ?? 0) * 100)}%`;
  }

  moduleDetailsId(module: string): string {
    return module.split('.')[0];
  }

  /** Download the portable package — the file pol apps deploy
   *  points at. Nothing deploys from here. */
  async exportApp(name: string): Promise<void> {
    const result = await firstValueFrom(this.http.get<{
      ok: boolean; document: unknown;
    }>(this.url(`/export?name=${encodeURIComponent(name)}`),
       this.polariService.backendRequestOptions)).catch(() => null);
    if (!result?.ok) { return; }
    const blob = new Blob(
      [JSON.stringify(result.document, null, 2)],
      { type: 'application/json' });
    const anchor = document.createElement('a');
    anchor.href = URL.createObjectURL(blob);
    anchor.download = `${name}.polari-app.json`;
    anchor.click();
    URL.revokeObjectURL(anchor.href);
  }
}
