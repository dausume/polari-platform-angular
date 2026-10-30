// Pure projection regression: no browser, server or network needed.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const assert = require('node:assert/strict'), ts = require('typescript');
const text = fs.readFileSync(path.resolve(__dirname, '../src/app/components/islemesh/isle-device-inventory.ts'), 'utf8');
const exportsObject = {};
vm.runInNewContext(ts.transpileModule(text, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }}).outputText, { exports: exportsObject });
const { buildIsleInventory: build, isleServiceUrl: url } = exportsObject;
let count = 0;
function test(name, fn) { fn(); count++; console.log(`PASS ${name}`); }
const node = (device) => ({app:'polari', device, domain:'polari.isle'});
const instance = {app:'worker', device:'host', domain:'worker.isle'};
test('node-less client sees shared app', () => {
 const v=build({devices:[{name:'client'}]}, {devices:[{name:'host',apps:[{name:'polari',domain:'polari.isle'}]}]}, null);
 const d=v.devices.find(d=>d.name==='client'); assert.equal(d.instances.length,0); assert.equal(d.shared[0].url,'https://polari.isle/');
});
test('primary node separate from infrastructure core', () => {
 const v=build({devices:[{name:'core',router_running:true}]},{polari:{instances:[node('remote')]}},null);
 assert.equal(v.routerDevices.join(),'core'); assert.equal(v.primaryRoutes.join(),'remote');
});
test('conflicting primary reports remain visible', () => {
 assert.equal(build(null,{polari:{instances:[node('a'),node('b')]}},null).primaryRoutes.length,2);
});
test('summary-only device retains unknown agent', () => {
 const v=build({devices:[{name:'client'}]},null,null); assert.equal(v.devices[0].agent,null);
});
test('duplicate instances and catalog entries counted once', () => {
 const entry={name:'worker',kind:'mesh-app',instances:[instance,instance]};
 const v=build(null,{devices:[{name:'host',apps:[{name:'worker',domain:'worker.isle'}]}]}, {entries:[entry,entry]});
 assert.equal(v.apps.length,1); const k=v.kinds.find(k=>k.kind==='mesh-app'); assert.equal(k.catalogCount,1);assert.equal(k.providerCount,1);
});
test('unknown host not invented', () => {
 const v=build(null,null,{entries:[{name:'worker',kind:'mesh-app',instances:[{app:'worker',domain:'worker.isle'}]}]});
 assert.equal(v.devices.length,0);assert.equal(v.apps.length,1);assert.equal(v.kinds[0].providerCount,0);
});
test('known mock device cannot reappear via catalog', () => {
 const v=build({devices:[{name:'host',is_mock:true}]},{devices:[{name:'host'}]}, {entries:[{name:'worker',kind:'mesh-app',instances:[instance]}]});
 assert.equal(v.devices.length,0);assert.equal(v.apps.length,0);assert.equal(v.hasMockData,true);
});
test('coherence mock identity also excludes catalog providers', () => {
 const v=build(null,{devices:[{name:'host',is_mock:true}]},{entries:[{name:'worker',kind:'mesh-app',instances:[instance]}]});
 assert.equal(v.devices.length,0);assert.equal(v.apps.length,0);
});
test('mock rows excluded', () => {
 const v=build(null,{devices:[{name:'fake',is_mock:true}]},{entries:[{name:'fake',kind:'mesh-app',is_mock:true}]});
 assert.equal(v.devices.length,0);assert.equal(v.kinds[0].catalogCount,0);
});
test('malformed input does not imply readiness', () => {
 const v=build({devices:[null,7,{name:5}]},{devices:{}},{entries:'bad'});assert.equal(v.devices.length,0);assert.equal(v.primaryRoutes.length,0);
});
test('old report is not a fresh health assertion', () => {
 const v=build({devices:[{name:'old',last_seen:'2000-01-01T00:00:00Z'},{name:'bad',last_seen:'nonsense'}]},null,null);
 assert.equal(v.devices.find(d=>d.name==='old').lastReported,'2000-01-01T00:00:00Z');assert.equal(v.devices.find(d=>d.name==='bad').lastReported,null);assert.equal('ready' in v.devices[0],false);
});
test('Open links limited to valid Isle hostnames', () => {
 assert.equal(url('API.Polari.isle'),'https://api.polari.isle/');
 for(const v of ['javascript:alert(1)','evil.test','good.isle/x','good.isle:443','user@good.isle','-bad.isle','bad..isle','a'.repeat(64)+'.isle'])assert.equal(url(v),null,v);
});
const { readCapabilityReport: read } = exportsObject;
const report = () => ({ ok:true, schema_version:1, action:'host', evaluated_at:'2026-10-30T00:00:00Z', entries:[{
 entry:'worker',kind:'mesh-app',status:'ready',targets:[{device:'host',status:'ready',checks:[{dep:'runtime',status:'ready',reason:'passed'}]}]
}] });
test('capability report accepted separately from inventory', () => {
 assert.equal(read(report(),'host').entries[0].targets[0].status,'ready');
});
test('wrong action or unsupported schema rejected', () => {
 assert.equal(read(report(),'use'),null);const r=report();r.schema_version=2;assert.equal(read(r,'host'),null);
});
test('aggregate ready requires an eligible target', () => {
 const r=report();r.entries[0].targets=[];assert.equal(read(r,'host'),null);
});
test('invalid status and malformed targets rejected', () => {
 const r=report();r.entries[0].targets[0].status='probably';assert.equal(read(r,'host'),null);
 r.entries[0].targets=[null];assert.equal(read(r,'host'),null);
});
test('missing service stays unknown rather than empty-ready', () => {
 assert.equal(read(null,'host'),null);assert.equal(read({ok:false},'host'),null);
});
test('older result retains verdict and actual observation date', () => {
 const r=report();r.entries[0].status='unknown';const t=r.entries[0].targets[0];
 t.status='unknown';t.last_reported_status='ready';
 t.checks=[{dep:'runtime',status:'unknown',reason:'Recheck',observed_at:'2026-10-29T00:00:00Z'}];
 const result=read(r,'host').entries[0].targets[0];
 assert.equal(result.status,'unknown');assert.equal(result.lastReportedStatus,'ready');
 assert.equal(result.observationDates.join(),'2026-10-29T00:00:00Z');
});
test('provider observation dates retained, invalid dates excluded', () => {
 const r=report();r.entries[0].targets[0].checks=[{status:'ready',candidates:[{checks:[
  {observed_at:'2026-10-29T00:00:00Z'},{observed_at:'bad'}]}]}];
 assert.equal(read(r,'host').entries[0].targets[0].observationDates.join(),'2026-10-29T00:00:00Z');
});
test('device responsibilities and hosted Polari sub-role stay distinct', () => {
 const v=build({devices:[{name:'core',router_running:true,os_hostname:'host-os'}]}, {polari:{instances:[node('core')]}},null);
 const d=v.devices[0];assert.equal(d.osHostname,'host-os');assert.equal(d.responsibilities.join(','),'Router host,Polari provider');
 assert.equal(d.hosted[0].kind,'polari-instance');assert.equal(d.hosted[0].subrole,'Shared frontend and API');
});
test('explicit hardware realization supplies hosting role', () => {
 const v=build(null,null,{entries:[{name:'vm',kind:'hardware-app',realization:'kvm',instances:[{app:'vm',device:'core',domain:'vm.isle'}]}]});
 assert.equal(v.devices[0].responsibilities.join(),'VM Hardware App host');
});
test('untyped registration does not invent hardware or device roles', () => {
 const v=build(null,{devices:[{name:'host-os',apps:[{name:'router',domain:'router.isle'}]}]},null);
 assert.equal(v.devices[0].responsibilities.length,0);assert.equal(v.devices[0].hosted[0].kind,'');
});
console.log(`${count} inventory tests passed`);
