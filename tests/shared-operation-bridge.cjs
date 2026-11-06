// Headless test of the actual bridge serializer. No native execution or network.
const fs=require('fs'), vm=require('vm'), assert=require('assert'), ts=require('typescript');
const source=fs.readFileSync('src/app/services/shell-bridge.service.ts','utf8');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,experimentalDecorators:true}}).outputText;
const calls=[], exported={};
const context={exports:exported,require:name=>{assert.equal(name,'@angular/core');return {Injectable:()=>x=>x}},window:{cefQuery:q=>{calls.push(JSON.parse(q.request));q.onSuccess(JSON.stringify({payload:{ok:true,operationId:'a'.repeat(32)}}));}},console};
vm.runInNewContext(js,context);
(async()=>{
 const bridge=new exported.ShellBridgeService();
 for(const name of ['odoo','board-engines']) { const result=await bridge.install(name);assert.equal(result.operationId,'a'.repeat(32));assert.equal(calls.at(-1).type,'store.install');assert.deepEqual(calls.at(-1).payload,{name}); }
 for(const [call,type,payload] of [
  [()=>bridge.updatePlan(),'device.updatePlan',{}],
  [()=>bridge.updateApply('b'.repeat(64)),'device.updateApply',{releaseId:'b'.repeat(64)}],
  [()=>bridge.operationStatus('a'.repeat(32)),'operation.status',{id:'a'.repeat(32)}],
  [()=>bridge.operationRetry('a'.repeat(32)),'operation.retry',{id:'a'.repeat(32)}],
  [()=>bridge.reconcile(),'device.reconcile',{}]]) {
  await call();assert.equal(calls.at(-1).type,type);assert.deepEqual(calls.at(-1).payload,payload);
 }
 console.log('PASS: two unrelated installs share dispatch; update/status/retry/reconcile serialize only parameters and preserve operation ID');
})().catch(e=>{console.error(e);process.exitCode=1;});
