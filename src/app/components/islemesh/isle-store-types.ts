import { CapabilityReport, CAPABILITY_LABELS } from './isle-device-inventory';

export type InstallAction = 'host' | 'launcher' | 'module';
export interface TypedApp { name: string; kind: string; realization?: string; is_mock?: boolean; category?: string; shell?: string; management_system?: string; instances?: {device?: string; is_mock?: boolean}[]; installed_somewhere?: boolean; }
export interface AppType {
  id: string; title: string; icon: string; description: string; action: InstallAction; requirements?: string; managementRoute?: string;
}
export const APP_TYPES: AppType[] = [
  {id:'mesh-app', title:'Mesh Apps', icon:'dns', action:'host', description:'Run container services on an Isle device and use them across the Isle, including websites and simulation workers.'},
  {id:'polari-app', title:'Polari App Launchers', icon:'desktop_windows', action:'launcher', description:'Install a window onto a Polari app. Its frontend and services can be provided by a Polari node elsewhere on the Isle.'},
  {id:'polari-instance', title:'Polari Nodes', icon:'hub', action:'host', description:'Host the Polari runtime that provides frontends and runs app modules. An Isle needs at least one Polari node; every device does not need its own.'},
  {id:'polari-module', title:'Polari Modules', icon:'extension', action:'module', description:'Add functionality to a Polari node, such as electronics tools or shared computation.'},
  {id:'hardware-vm', title:'Hardware Apps — VMs', icon:'computer', action:'host', description:'Run a virtual machine with the required virtualization resources and, where needed, hardware passthrough. Container simulations belong under Mesh Apps.'},
  {id:'hardware-bridge', title:'Hardware Bridge Apps', icon:'usb', action:'host', description:'Connect software to hardware attached to a device. Check the required interfaces, drivers and access to the actual hardware.'},
  {id:'hardware-extension-app', title:'Hardware Extensions', icon:'memory', action:'host', description:'Add functionality to a compatible hardware app. Requirements depend on the hardware app being extended.'},
  {id:'ai-tool', title:'AI Tools', icon:'smart_toy', action:'host', description:'Choose reasoning, voice or vision tools. Some run on an Isle device; others connect to an external service and have nothing to host locally.'},
];
/** Presentation categories follow the management overview; catalog kinds stay unchanged. */
export const OVERVIEW_TYPES: AppType[] = [
  {id:'mesh-app', title:'Mesh Apps', icon:'dns', action:'host', description:'External applications wrapped by the Isle, such as Odoo, LiveKit and Whoami. Polari runtime components are managed within Polari.', requirements:'Docker and a device joined to the Isle with a hosting address.'},
  {id:'hardware-vm', title:'Hardware Apps', icon:'computer', action:'host', description:'QEMU/KVM apps let a computer act as a substitute for hardware. They virtualize hardware and can connect to USB devices for functions that cannot be virtualized.', requirements:'A device with QEMU/KVM support and any physical interfaces required by the app.'},
  {id:'isle-vpn', title:'Isle VPN Apps', icon:'vpn_lock', action:'host', description:'Apps that provide containers and/or virtual machines to establish VPNs through bridges and links between Isles.', requirements:'Docker or QEMU/KVM, according to the app, and the network access needed to connect the Isles.'},
  {id:'polari-instance', title:'Polari Instance', icon:'hub', action:'host', description:'The core runtime configured by Polari Apps. Other devices can use its frontend across the Isle.', requirements:'Docker on a joined device. At least one Polari instance is needed across the Isle.'},
  {id:'shell-app', title:'Shell Apps', icon:'desktop_windows', action:'launcher', description:'Lightweight launchers for apps running on other devices. They provide an app window without hosting the app here.', requirements:'Access to the Isle and its certificate trust. A hosting address is not required.'},
  {id:'polari-software', title:'Polari Apps', icon:'extension', action:'module', description:'Polari Apps configure Polari with the capabilities, pages and tools for a particular purpose. Manage these apps and their underlying modules across Polari nodes in Polari itself.', requirements:'A Polari instance. Polari manages app definitions, module placement and its own node topology.', managementRoute:'/apps'},
  {id:'hardware-extension-app', title:'Hardware Extension Apps', icon:'memory', action:'host', description:'Extensions that add functions to a compatible Hardware App.', requirements:'The parent Hardware App and the interfaces required by the extension.'},
  {id:'hardware-bridge', title:'Hardware Bridge Apps', icon:'usb', action:'host', description:'Connect apps to real hardware attached to a device, including boards and instruments.', requirements:'The required physical connections, drivers and hardware access. A VM is not inherently required.'},
];
export function matchesCategory(entry: TypedApp, category: string): boolean {
  if (entry.management_system === 'polari') return false;
  if (category === 'isle-vpn') return entry.kind === 'isle-vpn' || entry.kind === 'isle-vpn-app' || entry.category === 'isle-vpn';
  if (category === 'shell-app') return (entry.installed_somewhere === true || !!entry.instances?.some(i => !!i.device && !i.is_mock)) && (entry.kind === 'shell-app' || entry.kind === 'polari-app' || entry.kind === 'polari-app-option' || !!entry.shell);
  if (category === 'polari-software') return false; // Polari owns this management destination, not an Isle catalog category.
  return typeId(entry) === category;
}
export function typeId(entry: TypedApp): string {
  if (entry.kind === 'polari-app-option') return 'polari-app';
  if (entry.kind === 'hardware-bridge-app' || (entry.kind === 'hardware-app' && entry.realization === 'bridge')) return 'hardware-bridge';
  if (entry.kind === 'hardware-app' && entry.realization === 'kvm') return 'hardware-vm';
  // An unspecified hardware realization must not be guessed to be a VM or bridge.
  return entry.kind;
}
export interface TypeDevice {
  name: string; ready: number; previouslyReady: number; total: number;
  summary: string; dates: string[];
}
export interface TypeCard extends AppType { count: number; devices: TypeDevice[]; }
export type InstallReports = Partial<Record<InstallAction, CapabilityReport | null>>;
export function appTargets(entry: TypedApp, reports: InstallReports, actionOverride?: InstallAction) {
  const action = actionOverride || ( entry.kind === 'shell-app' ? 'launcher' : APP_TYPES.find(t => t.id === typeId(entry))?.action || 'host');
  return reports[action]?.entries.find(r => r.entry === entry.name && r.kind === entry.kind)?.targets || [];
}
export function buildTypeCards(entries: TypedApp[], devices: string[], reports: InstallReports, overview = false): TypeCard[] {
  const apps = [...new Map(entries.filter(e => !e.is_mock && e.management_system !== 'polari' && !(overview && e.kind === 'polari-module')).map(e => [`${e.kind}/${e.name}/${e.realization || ''}`, e])).values()];
  const types = [...(overview ? OVERVIEW_TYPES : APP_TYPES)];
  for (const id of new Set(apps.map(typeId))) {
    if (!(overview && ['polari-app','shell-app'].includes(id)) && !types.some(t => t.id === id) && !(overview && apps.filter(e => typeId(e) === id).every(e => types.some(t => matchesCategory(e, t.id))))) types.push({id, title:id === 'hardware-app' ? 'Hardware Apps — setup not specified' : id,
      icon:'category', action:'host', description:'Browse this catalog type. Its individual app requirements describe the setup needed on a device.'});
  }
  return types.map(type => {
    const matching = apps.filter(e => overview ? matchesCategory(e, type.id) : typeId(e) === type.id);
    const names = [...new Set([...devices, ...matching.flatMap(e => appTargets(e, reports, overview && type.id === 'shell-app' ? 'launcher' : undefined).map(t => t.device))])].sort();
    return {...type, count:matching.length, devices:names.map(name => {
      const targets = matching.flatMap(e => appTargets(e, reports, overview && type.id === 'shell-app' ? 'launcher' : undefined).filter(t => t.device === name));
      const ready = targets.filter(t => t.status === 'ready').length;
      const previouslyReady = targets.filter(t => t.status !== 'ready' && t.lastReportedStatus === 'ready').length;
      const failures = [...new Set(targets.filter(t => t.lastReportedStatus !== 'ready' && t.lastReportedStatus !== 'unknown')
        .map(t => CAPABILITY_LABELS[t.lastReportedStatus]))];
      const summary = ready ? `Last report: requirements met for ${ready} of ${matching.length} apps`
        : previouslyReady ? `Previously met requirements for ${previouslyReady} of ${matching.length} apps; recheck needed`
        : failures.length ? failures.join('; ') + (targets.length < matching.length || targets.some(t => t.status === 'unknown') ? '; more checks needed' : '')
        : matching.length ? 'Not reported yet — device checks needed' : 'No apps published for this type yet';
      return {name, ready, previouslyReady, total:matching.length, summary,
        dates:[...new Set(targets.flatMap(t => t.observationDates))].sort((a,b) => Date.parse(a)-Date.parse(b))};
    })};
  });
}

/** Baseline hosting capability, distinct from an individual app's placement checks. */
export function capabilityProfile(id: string): string[] | null {
  switch (id) {
    case 'mesh-app': case 'polari-instance': return ['runtime.docker.usable','runtime.compose.usable','agent.running'];
    case 'hardware-vm': return ['runtime.qemu.installed','runtime.libvirt.usable','runtime.kvm.usable'];
    case 'shell-app': return ['runtime.shell.installed','access.polari-frontend.https'];
    default: return null;
  }
}
export function baselineCapability(id: string, report: any): {label: string; date: string; ready: boolean} {
  const required = capabilityProfile(id);
  if (!required) return {label:'App-specific capabilities', date:'', ready:false};
  const facts = report?.capability_evidence?.facts || {};
  const evidence = required.map(k => facts[k]);
  const observed = evidence.every(f => f?.status === 'observed');
  const ready = observed && evidence.every(f => f.value === true);
  return {label:ready ? 'Installable' : observed ? 'Capabilities needed' : 'Not yet checked',
    date:evidence.map(f => f?.observed_at || '').filter(Boolean).sort()[0] || '', ready};
}

/** Dependency packages prepare a baseline; they do not deploy apps or join an Isle. */
export const PREPARATION_PROFILES: Record<string, {packages: string; deb: string}> = {
  'mesh-app': {packages:'Docker Engine and Docker Compose', deb:'isle-capability-mesh'},
  'polari-instance': {packages:'Docker Engine and Docker Compose; Polari images and modules are installed separately', deb:'isle-capability-polari'},
  'hardware-vm': {packages:'QEMU, libvirt and KVM access; firmware virtualization and guest images are checked separately', deb:'isle-capability-kvm'},
  'shell-app': {packages:'Polari shared shell runtime; Isle connectivity and certificate trust are checked separately', deb:'isle-capability-shell'},
};
export function preparationProfile(id: string) {
  const profile = PREPARATION_PROFILES[id];
  return profile ? {...profile, command:'sudo isle capabilities enable '+id,
    planCommand:'isle capabilities plan '+id,
    packageCommand:'sudo apt install ./'+profile.deb+'_0.1.0_amd64.deb',
    download:'https://apt.isle/'+profile.deb+'_0.1.0_amd64.deb'} : null;
}
