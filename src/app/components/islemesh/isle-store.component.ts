/**
 * /isle-store — the general isle app store as a browsable page
 * (handoff §25.1). Reads the polari catalog
 * (/api/islemesh/catalog); each entry shows its kind, what it
 * provides, and its INSTALL PLAN (the host commands `isle store
 * install` runs — the store proposes, the host executes).
 *
 * The two proven variants render side by side: mesh-apps (deploy a
 * container as an .isle app) and polari-apps (a shared-shell
 * launcher). Engine-providing apps are badged.
 */
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { firstValueFrom } from 'rxjs';

import { PolariService } from '@services/polari-service';

interface CatalogEntry {
  name: string;
  title: string;
  description: string;
  kind: string;
  source_ref: string;
  provides_engine: string;
  category: string;
  source: string;
}

interface InstallPlan {
  ok: boolean;
  steps: string[];
  note: string;
}

@Component({
  selector: 'app-isle-store',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule],
  templateUrl: './isle-store.component.html',
  styleUrls: ['./isle-store.component.scss'],
})
export class IsleStoreComponent implements OnInit {
  entries: CatalogEntry[] = [];
  loading = true;
  loadError = '';
  selected: CatalogEntry | null = null;
  plan: InstallPlan | null = null;
  planLoading = false;

  readonly kindLabel: Record<string, string> = {
    'mesh-app': 'Mesh app',
    'polari-app': 'Polari app',
    'polari-module': 'Module',
  };

  constructor(private http: HttpClient,
              private polariService: PolariService) {}

  ngOnInit(): void {
    this.refresh();
  }

  private base(): string {
    return this.polariService.getBackendBaseUrl();
  }

  async refresh(): Promise<void> {
    this.loading = true;
    this.loadError = '';
    const data: any = await firstValueFrom(this.http.get(
      `${this.base()}/api/islemesh/catalog`,
      this.polariService.backendRequestOptions))
      .catch((err) => (err?.error ?? null));
    this.loading = false;
    if (!data?.ok) {
      this.loadError = 'GET /api/islemesh/catalog did not answer — '
        + 'is the islemesh module deployed?';
      return;
    }
    this.entries = data.entries;
  }

  async select(entry: CatalogEntry): Promise<void> {
    this.selected = entry;
    this.plan = null;
    this.planLoading = true;
    const data: any = await firstValueFrom(this.http.get(
      `${this.base()}/api/islemesh/catalog/${entry.name}`,
      this.polariService.backendRequestOptions))
      .catch(() => null);
    this.planLoading = false;
    this.plan = data?.entry?.install_plan ?? null;
  }

  installCommand(entry: CatalogEntry): string {
    return `isle store install ${entry.name}`;
  }

  copy(text: string): void {
    navigator.clipboard?.writeText(text);
  }

  kindsPresent(): string[] {
    return [...new Set(this.entries.map((e) => e.kind))];
  }

  entriesOfKind(kind: string): CatalogEntry[] {
    return this.entries.filter((e) => e.kind === kind);
  }
}
