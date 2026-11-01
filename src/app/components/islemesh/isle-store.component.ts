/**
 * /isle-store — the general isle app store as a browsable page
 * (handoff §25.1). Reads the polari catalog
 * (/api/islemesh/catalog); each entry shows its kind, what it
 * provides, and its INSTALL PLAN (the host commands `isle store
 * install` runs — the store proposes, the host executes).
 *
 * App types are the landing page. Each type has a filtered view and
 * action-specific, dated device evaluations; native install stays local.
 */
import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterModule, Router, ActivatedRoute } from '@angular/router';
import { firstValueFrom, timeout, Subscription } from 'rxjs';
import { buildIsleInventory, readCapabilityReport, CAPABILITY_LABELS } from './isle-device-inventory';
import { buildTypeCards, appTargets, matchesCategory, TypeCard, InstallReports, baselineCapability, capabilityProfile } from './isle-store-types';

import { PolariService } from '@services/polari-service';
import { AiAssistantService } from
  '@services/ai-assistant/ai-assistant.service';
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
  realization?: string;
  is_mock?: boolean;
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
  // ai-6: hosting profiles (guidance) — presence drives host-check
  requirements?: { name: string; note: string }[];
}

/** ai-6: the hosting gauge (GET .../host-check). */
interface HostCheck {
  ok: boolean;
  nothing_to_host?: boolean;
  resources_unavailable?: string;
  note?: string;
  realistic?: boolean;
  tight?: boolean;
  best?: { machine: string; profile: string } | null;
  machines?: {
    name: string; source: string; observedAt: string;
    profiles: { profile: string; verdict: string;
                detail: string[] }[];
  }[];
  unknown_machines?: string[];
  cloud_recommended?: boolean;
  cloud?: { name: string; title: string; sovereignty: string;
            how: string; note: string }[];
}

interface InstallPlan {
  ok: boolean;
  steps: string[];
  note: string;
}

@Component({
  selector: 'app-isle-store',
  standalone: true,
  imports: [CommonModule, FormsModule, MatButtonModule,
            MatIconModule, RouterModule],
  templateUrl: './isle-store.component.html',
  styleUrls: ['./isle-store.component.scss'],
})
export class IsleStoreComponent implements OnInit, OnDestroy {
  currentDevice = '';
  localReport: any = null;
  reportedDevices: any[] = [];
  preparingCapabilities = false;
  capabilitySetupMessage = '';
  currentCapability(id: string) { return baselineCapability(id, this.localReport); }
  deviceCapability(id: string, name: string) {
    const device = this.reportedDevices.find(d => d.name === name);
    return baselineCapability(id, device);
  }
  supportsCapabilitySetup(id: string) { return capabilityProfile(id) !== null; }
  get routerHardwareInstalled(): boolean {
    const f = this.localReport?.capability_evidence?.facts?.['hardware.openwrt.running'];
    return f?.status === 'observed' && f.value === true;
  }
  get installedRouters(): {device: string; date: string}[] {
    const devices = this.reportedDevices.filter(d => d.name !== this.currentDevice);
    if (this.currentDevice && this.localReport) devices.push({...this.localReport, name:this.currentDevice});
    return devices.flatMap(d => {
      const f = d.capability_evidence?.facts?.['hardware.openwrt.running'];
      return f?.status === 'observed' && f.value === true ? [{device:d.name, date:f.observed_at}] : [];
    });
  }
  async refreshLocalDevice(): Promise<void> {
    this.currentDevice = ''; this.localReport = null;
    if (!this.bridge.available) return;
    try {
      const context = await this.bridge.deviceContext();
      if (context.ok && /^[a-z0-9][a-z0-9-]{0,62}$/.test(context.report?.device || '')) {
        this.currentDevice = context.report.device; this.localReport = context.report;
      }
    } catch { /* Older shells cannot identify their host; never guess from the server. */ }
  }
  async installCapabilities(id: string): Promise<void> {
    if (!this.currentDevice || !this.bridge.available || !this.supportsCapabilitySetup(id) || this.preparingCapabilities) return;
    this.preparingCapabilities = true;
    this.capabilitySetupMessage = `Preparing capabilities on ${this.currentDevice}…`;
    try {
      const result = await this.bridge.enableCapabilities(id);
      this.capabilitySetupMessage = result.output || result.error || (result.ok ? 'Capabilities prepared.' : 'Setup did not finish.');
      await this.refreshLocalDevice(); await this.refresh();
    } catch (e: any) { this.capabilitySetupMessage = e?.message || 'Capability setup failed.'; }
    finally { this.preparingCapabilities = false; }
  }
  selectedType: string | null = null;
  typeCards: TypeCard[] = [];
  expandedDevices: string | null = null;
  toggleDevices(id: string): void { this.expandedDevices = this.expandedDevices === id ? null : id; }
  reports: InstallReports = {};
  capabilityNotice = "";
  readonly capabilityLabels = CAPABILITY_LABELS;
  private navigation?: Subscription;
  get activeType() { return this.typeCards.find(t => t.id === this.selectedType); }
  get visibleEntries() { return this.entries.filter(e => !e.is_mock && matchesCategory(e, this.selectedType || '')); }
  targetsFor(entry: CatalogEntry) { return appTargets(entry, this.reports, this.selectedType === 'shell-app' ? 'launcher' : undefined); }
  openType(id: string | null): void {
    if (id === "polari-software") { void this.router.navigate(["/apps"]); return; }
    if (this.installing || this.uninstalling || this.bindBusy) return;
    void this.router.navigate([], {relativeTo:this.route, queryParams:{appType:id}, queryParamsHandling:"merge"});
  }
  ngOnDestroy(): void { this.navigation?.unsubscribe(); }

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
              private ai: AiAssistantService,
              public bridge: ShellBridgeService,
              private router: Router, private route: ActivatedRoute) {}

  /** True when running inside the native JavaFX/JCEF shell — the
   *  page can then install locally (pkexec) instead of only
   *  showing a copyable command. */
  get nativeInstall(): boolean {
    return this.bridge.available;
  }

  // unin-4: the Uninstall buttons are THIN — one pkexec invocation
  // of `isle store uninstall <name> [--purge]`; the engine verb owns
  // every teardown step and the data policy. Two buttons (Q2):
  // plain uninstall PRESERVES data; the erase variant backs volumes
  // up to /var/backups/ first, then deletes them.
  uninstalling = false;

  async uninstallNative(entry: CatalogEntry,
                        purge: boolean): Promise<void> {
    this.uninstalling = true;
    this.installLog = `Requesting uninstall of ${entry.name}… `
      + `(you'll be asked for your password)`;
    this.installOk = null;
    try {
      const res = await this.bridge.uninstall(entry.name, purge);
      this.installOk = !!res.ok;
      this.installLog = (res.output || res.error
        || (res.ok ? 'uninstalled' : 'failed')).trim();
      if (res.ok) {
        this.localInstalled = false;
        this.localVersion = '';
        this.localDeployed = false;
      }
    } catch (e: any) {
      this.installOk = false;
      this.installLog = e?.message || 'uninstall bridge error';
    } finally {
      this.uninstalling = false;
    }
  }

  /** The terminal equivalent shown beside each Uninstall button —
   *  the UI runs exactly this via polkit, nothing more. */
  uninstallCommand(entry: CatalogEntry, purge: boolean): string {
    return `isle store uninstall ${entry.name}`
      + (purge ? ' --purge' : '');
  }

  // unin-4: "remove isle-mesh from this device" — the shell opens a
  // terminal running `pkexec isle uninstall --everything`; the
  // verb's own confirmations (yes/no, and the typed core-cascade
  // phrase) happen THERE, so a stray click cannot delete anything.
  removeIsleMsg = '';

  async removeIsle(): Promise<void> {
    this.removeIsleMsg = '';
    try {
      const res = await this.bridge.removeIsle();
      this.removeIsleMsg = res.ok
        ? `A terminal (${res.terminal}) opened — the uninstall asks `
          + 'its questions there. Nothing is removed until you '
          + 'confirm in that window.'
        : (res.error || 'could not open a terminal');
    } catch (e: any) {
      this.removeIsleMsg = e?.message || 'bridge error';
    }
  }

  async installNative(entry: CatalogEntry): Promise<void> {
    if (!this.currentDevice || !this.bridge.available || !this.plan?.ok || this.planLoading || this.installing || this.selected?.name !== entry.name) return;
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
    this.navigation = this.route.queryParamMap.subscribe(params => {
      this.selectedType = params.get("appType");
      if (this.selectedType === "polari-software") { void this.router.navigate(["/apps"]); return; }
      this.selected = null; this.plan = null; this.bindSecret = "";
    });
    void this.refreshLocalDevice();
    this.refresh();
  }

  private base(): string {
    return this.polariService.getBackendBaseUrl();
  }

  async refresh(): Promise<void> {
    void this.refreshLocalDevice();
    this.loading = true;
    this.loadError = '';
    const paths = ['/catalog', '', '/gaps?action=host', '/gaps?action=launcher', '/gaps?action=module', '/devices'];
    const results = await Promise.allSettled(paths.map(path => firstValueFrom(this.http.get<any>(
      `${this.base()}/api/islemesh${path}`, this.polariService.backendRequestOptions).pipe(timeout(10000)))));
    const values = results.map(r => r.status === 'fulfilled' && r.value?.ok ? r.value : null);
    this.loading = false;
    this.reportedDevices = (values[5]?.devices || []).filter((d: any) => !d.is_mock);
    if (!Array.isArray(values[0]?.entries)) {
      this.loadError = 'The app catalog could not be refreshed. Check your Isle connection and try again.';
      return;
    }
    this.entries = values[0].entries.filter((e: any) => e && typeof e.name === 'string' && typeof e.kind === 'string' && !e.is_mock);
    const actions = ['host', 'launcher', 'module'] as const;
    const missing: string[] = [];
    actions.forEach((action, i) => {
      const report = readCapabilityReport(values[i+2], action);
      if (report) this.reports[action] = report;
      else missing.push(action);
    });
    this.capabilityNotice = missing.length ? 'Some device checks could not be refreshed. Previous dated reports are retained where available; missing reports do not mean a device is incapable.' : '';
    const inventory = buildIsleInventory(values[1], null, values[0]);
    this.typeCards = buildTypeCards(this.entries, inventory.devices.map(d => d.name), this.reports, true);
    if (this.selected) this.selected = this.visibleEntries.find(e => e.name === this.selected?.name) || null;
  }

  // installed-on-this-device state (native shell only). unin-4:
  // localDeployed = the mesh-app's compose project runs HERE (a
  // mesh-app installs as containers, not a launcher deb).
  localInstalled: boolean | null = null;
  localVersion = '';
  localDeployed = false;

  // ai-2: the readiness join for the selected AI tool (ai-1 API).
  aiTool: AiToolReport | null = null;

  // ai-5: the in-store binding flow — "install" for a remote
  // intermediary IS select -> set_auth -> validate. The secret is
  // typed by the HUMAN into the password field and goes straight
  // to the backend (never an AI channel, never echoed, never git).
  bindSecret = '';
  bindBusy = false;
  bindLog: { step: string; ok: boolean; detail: string }[] = [];

  // ai-6: the hosting gauge for local-hosted tools + the
  // connect-remote-hosted flow (your rented server's base_url).
  hostCheck: HostCheck | null = null;
  bindBaseUrl = '';

  /** The binding flow applies to every tool that IS a reasoning
   *  provider. Remote intermediaries + built-in bind directly;
   *  local-hosted tools bind here too when the server runs
   *  REMOTELY (ai-6: your rented machine's base_url) — an
   *  on-isle deploy still binds itself automatically (ai-3). */
  bindable(entry: CatalogEntry): boolean {
    return entry.kind === 'ai-tool' && !!entry.provider_name;
  }

  /** ai-6: local-hosted binds need the server's address. */
  bindNeedsBaseUrl(entry: CatalogEntry): boolean {
    return entry.hosting === 'local-hosted';
  }

  async bindTool(entry: CatalogEntry): Promise<void> {
    if (this.bindBusy || !entry.provider_name) { return; }
    const baseUrl = this.bindBaseUrl.trim();
    if (this.bindNeedsBaseUrl(entry) && !baseUrl) { return; }
    this.bindBusy = true;
    this.bindLog = [];
    const provider = entry.provider_name;
    const log = (step: string, ok: boolean, detail: string) =>
      this.bindLog.push({ step, ok, detail });
    try {
      await firstValueFrom(this.ai.providerAction({
        action: 'select', provider,
        ...(baseUrl ? { settings: { base_url: baseUrl } } : {}),
      }));
      log('select', true, baseUrl
        ? `${provider} is now active at ${baseUrl}`
        : `${provider} is now the active provider`);
    } catch (e: any) {
      log('select', false, e?.error?.error ?? 'failed');
      this.bindBusy = false;
      return;
    }
    if (this.bindSecret.trim()) {
      try {
        await firstValueFrom(this.ai.providerAction(
          { action: 'set_auth', provider,
            secret: this.bindSecret.trim() }));
        log('set_auth', true,
            'credential stored on the backend (never echoed)');
      } catch (e: any) {
        log('set_auth', false, e?.error?.error ?? 'failed');
      }
      this.bindSecret = '';
    }
    try {
      const v: any = await firstValueFrom(this.ai.providerAction(
        { action: 'validate', provider }));
      log('validate', !!v?.ok,
          v?.detail ?? (v?.ok ? 'responded' : 'no reply'));
    } catch (e: any) {
      log('validate', false, e?.error?.error ?? 'failed');
    }
    this.bindBusy = false;
    // re-join readiness so ready/active flip in place
    this.refreshAiTool(entry);
  }

  private refreshAiTool(entry: CatalogEntry): void {
    firstValueFrom(this.http.get(
      `${this.base()}/api/appstore/ai-tools/${entry.name}`,
      this.polariService.backendRequestOptions))
      .then((d: any) => {
        if (this.selected?.name === entry.name && d?.ok) {
          this.aiTool = d.tool;
        }
      }).catch(() => {});
  }

  async select(entry: CatalogEntry): Promise<void> {
    this.selected = entry;
    this.plan = null;
    this.planLoading = true;
    this.installLog = '';
    this.installOk = null;
    this.localInstalled = null;
    this.localVersion = '';
    this.localDeployed = false;
    this.aiTool = null;
    this.bindSecret = '';
    this.bindBaseUrl = '';
    this.bindLog = [];
    this.hostCheck = null;
    if (entry.kind === 'ai-tool') {
      firstValueFrom(this.http.get(
        `${this.base()}/api/appstore/ai-tools/${entry.name}`,
        this.polariService.backendRequestOptions))
        .then((d: any) => {
          if (this.selected?.name === entry.name && d?.ok) {
            this.aiTool = d.tool;
          }
        }).catch(() => {});
      // ai-6: gauge hosting realism for tools that run a server
      if (entry.hosting === 'local-hosted') {
        firstValueFrom(this.http.get(
          `${this.base()}/api/appstore/ai-tools/${entry.name}`
          + '/host-check',
          this.polariService.backendRequestOptions))
          .then((d: any) => {
            if (this.selected?.name === entry.name && d?.ok) {
              this.hostCheck = d;
            }
          }).catch(() => {});
      }
    }
    // unin-4: mesh-apps get the same this-device probe — `deployed`
    // (compose project present) is their "installed here"
    if (this.nativeInstall && (entry.kind === 'polari-app'
        || entry.kind === 'mesh-app')) {
      this.bridge.status(entry.name).then((s) => {
        if (this.selected?.name === entry.name && s?.ok) {
          this.localInstalled = !!s.installed;
          this.localVersion = s.version || '';
          this.localDeployed = !!s.deployed;
        }
      }).catch(() => {});
    }
    const data: any = await firstValueFrom(this.http.get(
      `${this.base()}/api/islemesh/catalog/${entry.name}`,
      this.polariService.backendRequestOptions))
      .catch(() => null);
    if (this.selected?.name !== entry.name) return;
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

}
