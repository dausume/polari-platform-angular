import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterModule } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { PolariService } from '@services/polari-service';

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

  constructor(private http: HttpClient,
              private polariService: PolariService) {}

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
