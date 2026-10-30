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
console.log(`${count} inventory tests passed`);
