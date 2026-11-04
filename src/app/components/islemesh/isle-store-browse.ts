import { TypedApp, OVERVIEW_TYPES, matchesCategory } from './isle-store-types';
export interface BrowseApp extends TypedApp { title?: string; description?: string; provides_engine?: string; purposes?: string[]; }
export const PURPOSES = [
  {id:'networking', title:'Networking', description:'Connect devices and Isles, route traffic and provide network access.'},
  {id:'infrastructure', title:'Infrastructure', description:'Shared services that support installation and operation of other apps.'},
  {id:'software-distribution', title:'Software Distribution', description:'Publish and retrieve packages, container images and release artifacts.'},
  {id:'identity', title:'Identity & Access', description:'Authentication, permissions and certificate trust.'},
  {id:'storage', title:'Storage & Databases', description:'Store shared files and persistent application data.'},
  {id:'platform', title:'Platform Runtime', description:'Polari frontend and backend providers and their runtime services.'},
  {id:'engineering', title:'Engineering & Simulation', description:'Model, simulate, design and work with hardware.'},
  {id:'business', title:'Business', description:'Business operations and organizational tools.'},
  {id:'collaboration', title:'Collaboration', description:'Communication and shared work.'},
  {id:'printing', title:'Printing & Fabrication', description:'Prepare and monitor physical fabrication.'},
  {id:'analysis', title:'Analysis & Policy', description:'Analyze information, policies and outcomes.'},
  {id:'testing', title:'Testing & Demos', description:'Optional sample apps and diagnostic workloads.'},
  {id:'other', title:'Other / Uncategorised', description:'Apps without a published or mapped purpose category.'},
];
const KNOWN: Record<string,string[]> = {
  apt:['infrastructure','software-distribution'], registry:['infrastructure','software-distribution'],
  openwrt:['networking'], 'isle-guestnet':['networking'], 'isle-relay':['networking'],
  keycloak:['infrastructure','identity'], 'prf-keycloak':['infrastructure','identity'],
  mariadb:['infrastructure','storage'], 'prf-mariadb':['infrastructure','storage'], minio:['infrastructure','storage'],
  'polari-instance':['infrastructure','platform'], polari:['platform'],
  odoo:['business'], 'pol-odoo':['business'], 'pol-livekit':['collaboration'],
};
export function purposeIds(app: BrowseApp): string[] {
  const ids = new Set((app.purposes || []).filter(p=>PURPOSES.some(c=>c.id===p)));
  for (const p of KNOWN[app.name] || []) ids.add(p);
  const category=(app.category || '').toLowerCase();
  if (category.startsWith('network') || ['isle-vpn','isle-vpn-app'].includes(app.kind)) ids.add('networking');
  if (['engine','engines'].includes(category) && !KNOWN[app.name]) ids.add('engineering');
  const mapped: Record<string,string> = {demo:'testing',business:'business',collaboration:'collaboration',printing:'printing',policy:'analysis'};
  if (mapped[category]) ids.add(mapped[category]);
  if (category==='hardware' && !KNOWN[app.name]) ids.add('engineering');
  return ids.size ? [...ids] : ['other'];
}
export function browsable<T extends BrowseApp>(entries: T[]): T[] {
  return [...new Map(entries.filter(e=>!e.is_mock && e.management_system !== 'polari' && e.kind !== 'polari-module' && (!['shell-app','polari-app','polari-app-option'].includes(e.kind) || matchesCategory(e,'shell-app')))
    .map(e=>[`${e.kind}/${e.name}/${e.realization || ''}`,e])).values()];
}
export function filterApps<T extends BrowseApp>(entries:T[], query='', deployment='', purpose='', installed=false):T[] {
  const terms=query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return browsable(entries).filter(e=> {
    if (deployment && !matchesCategory(e,deployment)) return false;
    if (purpose && !purposeIds(e).includes(purpose)) return false;
    if (installed && !(e.installed_somewhere || e.instances?.some(i=>i.device && !i.is_mock))) return false;
    const text=[e.name,e.title,e.description,e.kind,e.category,e.provides_engine,
      ...purposeIds(e).map(id=>PURPOSES.find(p=>p.id===id)?.title),
      ...OVERVIEW_TYPES.filter(t=>matchesCategory(e,t.id)).map(t=>t.title)].join(' ').toLocaleLowerCase();
    return terms.every(term=>text.includes(term));
  });
}
