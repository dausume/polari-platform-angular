const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript'),assert=require('node:assert/strict');
const cache=new Map();
function load(file){
 file=path.resolve(file);if(cache.has(file))return cache.get(file);
 const exports={};cache.set(file,exports);
 const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInNewContext(code,{exports,require:name=>load(path.resolve(path.dirname(file),name+'.ts'))});return exports;
}
const root=path.resolve(__dirname,'../src/app/components/islemesh');
const {buildTypeCards:build,typeId,appTargets}=load(root+'/isle-store-types.ts');
const {readCapabilityReport:read}=load(root+'/isle-device-inventory.ts');
const app=(name,kind='mesh-app',extra={})=>({name,kind,...extra});
const target=(device,status='ready',old=status)=>({device,status,lastReportedStatus:old,reasons:[],observationDates:['2026-10-30T00:00:00Z']});
const report=(entries)=>({evaluatedAt:'2026-10-30T00:01:00Z',entries});
const entry=(app,targets)=>({entry:app.name,kind:app.kind,targets});
let count=0;function test(name,fn){fn();console.log('PASS '+name);count++;}
test('landing includes standard types even with no published apps',()=>{
 const cards=build([],['econ-core'],{});assert.ok(cards.some(c=>c.id==='mesh-app'));assert.ok(cards.some(c=>c.id==='hardware-bridge'));
 assert.ok(cards.every(c=>c.count===0));assert.match(cards[0].devices[0].summary,/No apps published/);
});
test('device eligibility is for some apps, not blanket kind support',()=>{
 const a=app('a'),b=app('b');const card=build([a,b],['econ'],{host:report([entry(a,[target('econ')]),entry(b,[target('econ','resource-limited')])])}).find(c=>c.id==='mesh-app');
 assert.equal(card.devices[0].ready,1);assert.equal(card.devices[0].total,2);assert.match(card.devices[0].summary,/1 of 2/);
});
test('old pass and original observation date retained without fresh readiness',()=>{
 const a=app('a');const d=build([a],[],{host:report([entry(a,[target('econ','unknown','ready')])])}).find(c=>c.id==='mesh-app').devices[0];
 assert.equal(d.ready,0);assert.equal(d.previouslyReady,1);assert.match(d.summary,/recheck needed/);assert.equal(d.dates.join(),'2026-10-30T00:00:00Z');
});
test('Polari launcher checks do not borrow host or access verdicts',()=>{
 const a=app('pol','polari-app');assert.equal(appTargets(a,{host:report([entry(a,[target('core')])])}).length,0);
 assert.equal(appTargets(a,{launcher:report([entry(a,[target('client')])])})[0].device,'client');
});
test('modules use module action and options share Polari Apps category',()=>{
 assert.equal(typeId(app('opt','polari-app-option')),'polari-app');const a=app('module','polari-module');
 assert.equal(appTargets(a,{module:report([entry(a,[target('pol')])])})[0].device,'pol');
});
test('VM and bridge realizations do not share device verdicts',()=>{
 const a=app('vm','hardware-app',{realization:'kvm'}),b=app('bridge','hardware-app',{realization:'bridge'});
 const cards=build([a,b],[],{host:report([entry(a,[target('core')]),entry(b,[target('pol')])])});
 assert.equal(cards.find(c=>c.id==='hardware-vm').devices[0].name,'core');assert.equal(cards.find(c=>c.id==='hardware-bridge').devices[0].name,'pol');
 assert.equal(typeId(app('unspecified','hardware-app')),'hardware-app');
});
test('missing report lists known devices without inventing eligibility',()=>{
 const d=build([app('a')],['pol','econ'],{}).find(c=>c.id==='mesh-app').devices;
 assert.equal(d.length,2);assert.ok(d.every(d=>d.ready===0 && /Not reported/.test(d.summary)));
});
test('partial failures do not claim complete unsupported coverage',()=>{
 const a=app('a'),b=app('b');const d=build([a,b],['econ'],{host:report([entry(a,[target('econ','unsupported')])])}).find(c=>c.id==='mesh-app').devices[0];
 assert.match(d.summary,/more checks needed/);
});
test('mock apps excluded and duplicate catalog rows do not inflate counts',()=>{
 const a=app('a');const c=build([a,a,app('fake','mesh-app',{is_mock:true})],[],{}).find(c=>c.id==='mesh-app');assert.equal(c.count,1);
});
test('custom types remain browsable',()=>{
 assert.equal(build([app('x','custom-type')],[],{}).find(c=>c.id==='custom-type').count,1);
});
test('same app name under another kind cannot lend readiness',()=>{
 assert.equal(appTargets(app('a','mesh-app'),{host:report([entry(app('a','ai-tool'),[target('core')])])}).length,0);
});
test('launcher and module API reports parsed only under matching action',()=>{
 for(const action of ['launcher','module']){
  const r={ok:true,schema_version:1,action,evaluated_at:'2026-10-30T00:00:00Z',entries:[]};assert.ok(read(r,action));assert.equal(read(r,'host'),null);
 }
});
console.log(count+' app type tests passed');
