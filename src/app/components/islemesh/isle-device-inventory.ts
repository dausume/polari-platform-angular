/** Inventory projection only. Eligibility and health belong to the backend evaluator. */
export interface ReportedApp {
  name: string;
  device: string;
  domain: string;
  url: string | null;
  kind: string;
  realization: string;
  subrole: string;
}
export interface DeviceInventory {
  name: string;
  agent: boolean | null;
  lastReported: string | null;
  routerReported: boolean;
  osHostname: string;
  responsibilities: string[];
  instances: string[];
  hosted: ReportedApp[];
  shared: ReportedApp[];
}
export interface AppKindInventory {
  kind: string;
  label: string;
  catalogCount: number;
  providerCount: number;
}
export interface IsleInventory {
  devices: DeviceInventory[];
  apps: ReportedApp[];
  kinds: AppKindInventory[];
  primaryRoutes: string[];
  polariNodes: string[];
  routerDevices: string[];
  hasMockData: boolean;
}
const KIND_LABELS: Record<string, string> = {
  'mesh-app': 'Mesh Apps (containers)',
  'polari-app': 'Polari Apps',
  'polari-instance': 'Polari Nodes',
  'polari-module': 'Polari Modules',
  'hardware-app': 'Hardware Apps (VM or bridge realization)',
  'hardware-extension-app': 'Hardware Extensions',
};
export function hostedAppType(app: ReportedApp): string {
  if (app.kind === 'hardware-app') {
    if (app.realization === 'kvm') return 'Hardware App — VM';
    if (app.realization === 'bridge') return 'Hardware Bridge App';
    return 'Hardware App — setup not reported';
  }
  const labels: Record<string, string> = {
    'mesh-app': 'Mesh App', 'polari-app': 'Polari App',
    'polari-instance': 'Polari Node', 'polari-module': 'Polari Module',
    'hardware-bridge-app': 'Hardware Bridge App', 'hardware-extension-app': 'Hardware Extension',
    'polari-app-option': 'Polari App option', 'ai-tool': 'AI Tool',
  };
  return labels[app.kind] || app.kind || 'App type not reported';
}
function rows(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter(v => v && typeof v === 'object' && !Array.isArray(v)) : [];
}
function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
function str(value: unknown): string { return typeof value === 'string' ? value.trim() : ''; }
function names(value: unknown): string[] {
  return Array.isArray(value) ? value.map(str).filter(Boolean) : [];
}
/** Only the existing Isle service namespace is eligible for Open links. */
export function isleServiceUrl(value: unknown): string | null {
  const domain = str(value).toLowerCase();
  if (domain.length > 253 || !domain.endsWith('.isle')) return null;
  if (!domain.split('.').every(label => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))) return null;
  return `https://${domain}/`;
}
export function buildIsleInventory(summaryInput: unknown, coherenceInput: unknown, catalogInput: unknown): IsleInventory {
  const summary = record(summaryInput), coherence = record(coherenceInput), catalog = record(catalogInput);
  const devices = new Map<string, DeviceInventory>();
  const apps = new Map<string, ReportedApp>();
  const mocked = new Set([...rows(summary['devices']), ...rows(coherence['devices'])]
    .filter(d => d['is_mock'] === true).map(d => str(d['name'])));
  let hasMockData = [summary, coherence, catalog].some(d => d['mock_network'] === true) || mocked.size > 0;
  const ensure = (name: string): DeviceInventory | null => {
    if (!name || mocked.has(name)) return null;
    if (!devices.has(name)) devices.set(name, {
      name, agent: null, lastReported: null, routerReported: false, osHostname: '', responsibilities: [], instances: [], hosted: [], shared: [],
    });
    return devices.get(name)!;
  };
  const addApp = (name: string, device: string, domain: string, kind = '', realization = '', subrole = ''): void => {
    if (!name || mocked.has(device)) return;
    const key = JSON.stringify([name, device, domain]);
    const prior = apps.get(key);
    const app = { name, device, domain, url: isleServiceUrl(domain), kind: prior?.kind || kind,
      realization: prior?.realization || realization, subrole: prior?.subrole || subrole };
    apps.set(key, app);
    if (device) ensure(device);
  };
  for (const row of rows(summary['devices'])) {
    if (row['is_mock'] === true) continue;
    const d = ensure(str(row['name']));
    if (!d) continue;
    d.agent = typeof row['agent_present'] === 'boolean' ? row['agent_present'] : null;
    const seen = str(row['last_seen']);
    d.lastReported = seen && Number.isFinite(Date.parse(seen)) ? seen : null;
    d.routerReported = row['router_running'] === true;
    d.osHostname = str(row['os_hostname']);
  }
  for (const row of rows(coherence['devices'])) {
    if (row['is_mock'] === true) { hasMockData = true; continue; }
    const d = ensure(str(row['name']));
    if (!d) continue;
    if (d.agent === null && typeof row['agent_present'] === 'boolean') d.agent = row['agent_present'];
    d.instances = [...new Set(names(row['polari_instances']))];
    for (const app of rows(row['apps'])) {
      if (app['is_mock'] === true) { hasMockData = true; continue; }
      addApp(str(app['name']), d.name, str(app['domain']));
    }
  }
  const primaryRoutes = new Set<string>(), polariNodes = new Set<string>();
  for (const node of rows(record(coherence['polari'])['instances'])) {
    if (node['is_mock'] === true) { hasMockData = true; continue; }
    const device = str(node['device']);
    const d = ensure(device), name = str(node['app']);
    if (!d || !name) continue;
    if (!d.instances.includes(name)) d.instances.push(name);
    polariNodes.add(device);
    addApp(name, device, str(node['domain']), 'polari-instance', '',
      str(node['domain']).toLowerCase() === 'polari.isle' ? 'Shared frontend and API' : 'Additional Polari provider');
    if (str(node['domain']).toLowerCase() === 'polari.isle') primaryRoutes.add(device);
  }
  const kindEntries = new Map<string, Set<string>>();
  const kindProviders = new Map<string, Set<string>>();
  for (const entry of rows(catalog['entries'])) {
    if (entry['is_mock'] === true) { hasMockData = true; continue; }
    const kind = str(entry['kind']), name = str(entry['name']);
    if (!kind || !name) continue;
    if (!kindEntries.has(kind)) kindEntries.set(kind, new Set());
    kindEntries.get(kind)!.add(name);
    if (!kindProviders.has(kind)) kindProviders.set(kind, new Set());
    for (const instance of rows(entry['instances'])) {
      if (instance['is_mock'] === true) { hasMockData = true; continue; }
      const device = str(instance['device']);
      if (mocked.has(device)) continue;
      if (device) kindProviders.get(kind)!.add(device);
      addApp(str(instance['app']) || name, device, str(instance['domain']), kind, str(entry['realization']));
    }
  }
  const allApps = [...apps.values()].sort((a,b) => a.name.localeCompare(b.name) || a.device.localeCompare(b.device));
  for (const d of devices.values()) {
    d.hosted = allApps.filter(a => a.device === d.name);
    d.shared = allApps.filter(a => a.device !== d.name && a.url !== null);
    if (d.instances.length) polariNodes.add(d.name);
    d.responsibilities = [
      ...(d.routerReported ? ['Router host'] : []),
      ...(d.instances.length ? ['Polari provider'] : []),
      ...(d.hosted.some(a => a.kind === 'hardware-app' && a.realization === 'kvm') ? ['VM Hardware App host'] : []),
      ...(d.hosted.some(a => a.kind === 'hardware-bridge-app' || (a.kind === 'hardware-app' && a.realization === 'bridge')) ? ['Hardware Bridge App host'] : []),
    ];
  }
  return {
    devices: [...devices.values()].sort((a,b) => a.name.localeCompare(b.name)),
    apps: allApps,
    kinds: [...new Set([...Object.keys(KIND_LABELS), ...kindEntries.keys()])].map(kind => ({
      kind, label: KIND_LABELS[kind] || kind, catalogCount: kindEntries.get(kind)?.size || 0,
      providerCount: kindProviders.get(kind)?.size || 0,
    })),
    primaryRoutes: [...primaryRoutes].sort(), polariNodes: [...polariNodes].sort(),
    routerDevices: [...devices.values()].filter(d => d.routerReported).map(d => d.name).sort(),
    hasMockData,
  };
}

export interface CapabilityTarget {
  device: string;
  status: string;
  reasons: string[];
  lastReportedStatus: string;
  observationDates: string[];
}
export interface CapabilityEntry {
  entry: string;
  kind: string;
  status: string;
  lastReportedStatus: string;
  targets: CapabilityTarget[];
}
export interface CapabilityReport {
  evaluatedAt: string;
  entries: CapabilityEntry[];
}
export const CAPABILITY_LABELS: Record<string, string> = {
  ready: 'Requirements met at last evaluation',
  'needs-setup': 'Setup required',
  unsupported: 'Unsupported by reported targets',
  'resource-limited': 'Insufficient resources',
  'policy-restricted': 'Restricted by device policy',
  unknown: 'Not fully reported; checks still needed',
  blocked: 'No eligible target; see device requirements',
};
function observationDates(checks: unknown): string[] {
  const dates = rows(checks).flatMap(check => {
    const observed = str(check['observed_at']);
    return [...(observed && Number.isFinite(Date.parse(observed)) ? [observed] : []),
      ...rows(check['candidates']).flatMap(candidate => observationDates(candidate['checks']))];
  });
  return [...new Set(dates)].sort((a, b) => Date.parse(a) - Date.parse(b));
}
/** Reject unsupported/malformed contracts instead of rendering an optimistic state. */
export function readCapabilityReport(input: unknown, action: 'host' | 'use' | 'launcher' | 'module'): CapabilityReport | null {
  const data = record(input);
  if (data['ok'] !== true || data['schema_version'] !== 1 || data['action'] !== action
      || !Array.isArray(data['entries'])) return null;
  const evaluatedAt = str(data['evaluated_at']);
  if (!evaluatedAt || !Number.isFinite(Date.parse(evaluatedAt))) return null;
  const entries: CapabilityEntry[] = [];
  for (const raw of data['entries']) {
    const entry = record(raw);
    const status = str(entry['status']);
    if (!str(entry['entry']) || !Object.hasOwn(CAPABILITY_LABELS, status) || !Array.isArray(entry['targets'])) return null;
    const targets: CapabilityTarget[] = [];
    for (const rawTarget of entry['targets']) {
      const target = record(rawTarget), state = str(target['status']);
      if (!str(target['device']) || !Object.hasOwn(CAPABILITY_LABELS, state) || !Array.isArray(target['checks'])) return null;
      targets.push({ observationDates: observationDates(target['checks']), device: str(target['device']), status: state,
        lastReportedStatus: Object.hasOwn(CAPABILITY_LABELS, str(target['last_reported_status'])) ? str(target['last_reported_status']) : state,
        reasons: rows(target['checks']).filter(c => c['status'] !== 'ready')
          .map(c => `${str(c['dep'])}: ${str(c['reason'])}${str(c['observed_at']) ? ' (reported ' + str(c['observed_at']) + ')' : ''}`),
      });
    }
    // A ready aggregate must identify an eligible target. Unknown providers cannot
    // be turned into ready by a malformed summary alone.
    if (status === 'ready' && !targets.some(t => t.status === 'ready')) return null;
    entries.push({ entry: str(entry['entry']), kind: str(entry['kind']), status, targets,
      lastReportedStatus: Object.hasOwn(CAPABILITY_LABELS, str(entry['last_reported_status'])) ? str(entry['last_reported_status']) : status });
  }
  return { evaluatedAt, entries };
}
