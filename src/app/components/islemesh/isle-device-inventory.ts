/** Inventory projection only. Eligibility and health belong to the backend evaluator. */
export interface ReportedApp {
  name: string;
  device: string;
  domain: string;
  url: string | null;
}
export interface DeviceInventory {
  name: string;
  agent: boolean | null;
  lastReported: string | null;
  routerReported: boolean;
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
      name, agent: null, lastReported: null, routerReported: false, instances: [], hosted: [], shared: [],
    });
    return devices.get(name)!;
  };
  const addApp = (name: string, device: string, domain: string): void => {
    if (!name || mocked.has(device)) return;
    const app = { name, device, domain, url: isleServiceUrl(domain) };
    apps.set(JSON.stringify([name, device, domain]), app);
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
      addApp(str(instance['app']) || name, device, str(instance['domain']));
    }
  }
  const allApps = [...apps.values()].sort((a,b) => a.name.localeCompare(b.name) || a.device.localeCompare(b.device));
  for (const d of devices.values()) {
    d.hosted = allApps.filter(a => a.device === d.name);
    d.shared = allApps.filter(a => a.device !== d.name && a.url !== null);
    if (d.instances.length) polariNodes.add(d.name);
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
