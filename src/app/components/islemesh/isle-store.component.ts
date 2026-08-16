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
import { ShellBridgeService } from
  '@services/shell-bridge.service';

interface AppInstance {
  app: string;
  device: string;
  domain: string;
  modules?: string[];
}

interface CatalogEntry {
  name: string;
  title: string;
  description: string;
  kind: string;
  source_ref: string;
  provides_engine: string;
  category: string;
  source: string;
  // running instances across the isle (duplicates are deliberate —
  // scaling is a genuine need; this is the tracking half)
  instances?: AppInstance[];
  instance_count?: number;
  // sep-3: derived app OPTIONS (§43 projection — never rows)
  derived?: boolean;
  standard?: boolean;
  converted?: boolean;
  shell?: string;
  placement?: { complete: boolean; missing: string[] };
  // ai-2: derived AI-tool entries (dedicated section) — hosting
  // kind + sovereignty facts ride the tile; the full readiness
  // join is fetched from /api/appstore/ai-tools on select.
  hosting?: string;
  api_family?: string;
  provider_name?: string;
  internet_required?: boolean;
  data_leaves_isle?: boolean;
  linkages?: { kind: string; status: string }[];
  detail?: string;
}

/** ai-1: one linkage claim annotated with the vocabulary. */
interface AiLinkage {
  kind: string;
  status: string;    // proven | feasible (the claim)
  note: string;
  consumer: string;  // the polari seam/knob it wires
  seam: string;      // live | unbuilt (does the polari side exist)
}

/** ai-1: the live readiness join for one AI tool. */
interface AiToolReport {
  name: string;
  linkages: AiLinkage[];
  readiness: {
    ready: boolean; needs: string[];
    sdk_installed: boolean; has_credential: boolean;
  } | null;
  readiness_note: string;
  active: boolean;
  privacy_recommendation?: string;
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

  // native-shell install state (handoff §31)
  installing = false;
  installLog = '';
  installOk: boolean | null = null;

  readonly kindLabel: Record<string, string> = {
    'mesh-app': 'Mesh apps — run as containers on a device',
    'polari-app': 'Polari apps — doors onto running instances',
    'polari-instance': 'Polari instances — runtimes that host modules',
    'polari-module': 'Polari modules',
    // sep-3: every PolariAppDefinition, projected as an OPTION —
    // launcher debs materialize at install time, never a shelf.
    'polari-app-option':
      'Polari app options — any app, installable as its own shell',
    // ai-2 (decision 1): the DEDICATED AI section — never buried
    // under generic apps.
    'ai-tool':
      'AI tools — reasoning, voice, and vision bindings for polari',
  };

  constructor(private http: HttpClient,
              private polariService: PolariService,
              public bridge: ShellBridgeService) {}

  /** True when running inside the native JavaFX/JCEF shell — the
   *  page can then install locally (pkexec) instead of only
   *  showing a copyable command. */
  get nativeInstall(): boolean {
    return this.bridge.available;
  }

  async installNative(entry: CatalogEntry): Promise<void> {
    this.installing = true;
    this.installLog = `Requesting install of ${entry.name}… `
      + `(you'll be asked for your password)`;
    this.installOk = null;
    try {
      const res = await this.bridge.install(entry.name);
      this.installOk = !!res.ok;
      this.installLog = (res.output || res.error
        || (res.ok ? 'installed' : 'failed')).trim();
    } catch (e: any) {
      this.installOk = false;
      this.installLog = e?.message || 'install bridge error';
    } finally {
      this.installing = false;
    }
  }

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

  // installed-on-this-device state (native shell only)
  localInstalled: boolean | null = null;
  localVersion = '';

  // ai-2: the readiness join for the selected AI tool (ai-1 API).
  aiTool: AiToolReport | null = null;

  async select(entry: CatalogEntry): Promise<void> {
    this.selected = entry;
    this.plan = null;
    this.planLoading = true;
    this.installLog = '';
    this.installOk = null;
    this.localInstalled = null;
    this.localVersion = '';
    this.aiTool = null;
    if (entry.kind === 'ai-tool') {
      firstValueFrom(this.http.get(
        `${this.base()}/api/appstore/ai-tools/${entry.name}`,
        this.polariService.backendRequestOptions))
        .then((d: any) => {
          if (this.selected?.name === entry.name && d?.ok) {
            this.aiTool = d.tool;
          }
        }).catch(() => {});
    }
    if (this.nativeInstall && entry.kind === 'polari-app') {
      this.bridge.status(entry.name).then((s) => {
        if (this.selected?.name === entry.name && s?.ok) {
          this.localInstalled = !!s.installed;
          this.localVersion = s.version || '';
        }
      }).catch(() => {});
    }
    const data: any = await firstValueFrom(this.http.get(
      `${this.base()}/api/islemesh/catalog/${entry.name}`,
      this.polariService.backendRequestOptions))
      .catch(() => null);
    this.planLoading = false;
    this.plan = data?.entry?.install_plan ?? null;
  }

  installCommand(entry: CatalogEntry): string {
    // sep-3: options convert+build through the one idempotent
    // command; everything else installs via the isle store verb.
    // ai-2: AI tools have no single host command — built-in needs
    // nothing, remote intermediaries bind via /ai/providers, only
    // local-hosted deploys (the plan states each; '' hides the row).
    if (entry.kind === 'ai-tool') {
      return entry.hosting === 'local-hosted'
        ? `isle store install ${entry.name}` : '';
    }
    return entry.kind === 'polari-app-option'
      ? `pol apps shell ${entry.name}`
      : `isle store install ${entry.name}`;
  }

  /** Devices an entry currently runs on (deduped, for the chip). */
  runsOn(entry: CatalogEntry): string {
    const devs = [...new Set((entry.instances ?? [])
      .map((i) => i.device || '?'))];
    return devs.join(', ');
  }

  /** Installing a mesh-app that already runs somewhere creates a
   *  DUPLICATE instance under the next -N name — say so. */
  nextDuplicateName(entry: CatalogEntry): string {
    const taken = new Set((entry.instances ?? []).map((i) => i.app));
    let n = 2;
    while (taken.has(`${entry.name}-${n}`)) { n += 1; }
    return `${entry.name}-${n}`;
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
