import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, firstValueFrom } from 'rxjs';
import { PolariService } from '@services/polari-service';

/**
 * nav-2/nav-3: the app-navigation read model (/api/apps/nav).
 *
 * Apps carry their menus as DATA (nav groups -> items with kind +
 * tri-state availability). The shell renders every app's SIDE map
 * in full; groups flagged topMenu are ADDITIONALLY promoted to the
 * top bar. Absent modules stay visible with a bring-online
 * affordance — the map survives the missing territory.
 */

export interface AppNavItem {
  label: string;
  kind: 'page' | 'simspace' | 'view' | 'tech-node';
  availability: 'enabled' | 'absent' | 'unknown';
  route?: string;
  ref?: string;
  requiresModule?: string;
  bringup?: { route: string; requires?: string[] };
}

export interface AppNavGroup {
  group: string;
  topMenu: boolean;
  items: AppNavItem[];
}

export interface AppNav {
  name: string;
  title: string;
  useCase: string;
  discipline: string;
  personas: string[];
  pages: string[];
  modules: string[];
  moduleStates: Record<string, 'enabled' | 'absent' | 'unknown'>;
  navSynthesized: boolean;
  nav: AppNavGroup[];
}

export interface AppsNavPayload {
  ok: boolean;
  gatingReadable: boolean;
  apps: AppNav[];
  personas: Record<string, string[]>;
  refusal?: string;
}

@Injectable({ providedIn: 'root' })
export class AppsNavService {
  readonly payload$ = new BehaviorSubject<AppsNavPayload | null>(null);
  private loading = false;

  constructor(private http: HttpClient,
              private polariService: PolariService) {}

  /** Fetch once (idempotent); refusal-shaped result on failure so a
   *  gated-off backend renders as a message, never a blank shell. */
  ensureLoaded(): void {
    if (this.loading || this.payload$.value?.ok) { return; }
    this.loading = true;
    firstValueFrom(this.http.get<AppsNavPayload>(
      `${this.polariService.getBackendBaseUrl()}/api/apps/nav`,
      this.polariService.backendRequestOptions))
      .then(p => this.payload$.next(p))
      .catch(err => this.payload$.next(err?.error ?? {
        ok: false, gatingReadable: false, apps: [], personas: {},
        refusal: `apps nav unreachable (${err?.status ?? '?'}) — ` +
          `is 'polariapps' in POLARI_MODULES?`,
      }))
      .finally(() => { this.loading = false; });
  }

  refresh(): void {
    this.payload$.next(null);
    this.loading = false;
    this.ensureLoaded();
  }

  appByName(name: string): AppNav | null {
    return this.payload$.value?.apps
      .find(a => a.name === name) ?? null;
  }

  /** The app context for a router URL: /app/:name wins; otherwise
   *  the app owning the LONGEST matching nav-item route (so
   *  /magnetics/motor lands in app-magnetics, /scoring/survival in
   *  scorecards rather than policy only when its match is longer).
   *  Null = no app context (core shell). */
  appForUrl(url: string): AppNav | null {
    const apps = this.payload$.value?.apps ?? [];
    const path = (url.split('?')[0] || '/');
    const direct = /^\/app\/([^/]+)/.exec(path);
    if (direct) { return this.appByName(direct[1]); }
    let best: AppNav | null = null;
    let bestLen = 0;
    for (const app of apps) {
      for (const grp of app.nav) {
        for (const item of grp.items) {
          const r = item.route;
          if (!r) { continue; }
          if ((path === r || path.startsWith(r + '/'))
              && r.length > bestLen) {
            best = app; bestLen = r.length;
          }
        }
      }
    }
    return best;
  }
}
