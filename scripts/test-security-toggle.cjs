const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),assert=require('node:assert/strict');
const exportsBox={};let reloads=0;
const code=ts.transpileModule(fs.readFileSync('src/app/components/islemesh/isle-security.component.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,experimentalDecorators:true}}).outputText;
vm.runInNewContext(code,{exports:exportsBox,window:{location:{reload:()=>reloads++}},require:n=>n==='@angular/core'?{Component:()=>x=>x}:{}});
(async()=>{
let result={ok:true,state:{local:true,enabled:false}};let calls=0;
const runtime={getKeycloakSecurity:()=>({enabled:false,requiredBy:[],configurationError:null})};
const shell={available:true,securityStatus:async()=>result,setKeycloak:async()=>{calls++;return result;}};
const c=new exportsBox.IsleSecurityComponent(runtime,shell);await c.refresh();assert.equal(c.local,true);
result={ok:false,exitCode:126,cancelled:true};const event={checked:true,source:{checked:true}};await c.change(event);assert.equal(event.source.checked,false);assert.equal(reloads,0);assert.match(c.message,/cancelled/);
result={ok:false,error:'Required by private-files'};await c.change(event);assert.equal(reloads,0);assert.match(c.message,/private-files/);
result={ok:true,state:{ok:true,enabled:true}};await c.change(event);assert.equal(reloads,1);
c.local=false;await c.change(event);assert.equal(calls,3,'remote hosting cannot invoke toggle');
console.log('PASS local-only toggle, pending visual state, cancellation, refusal, success reload');
})().catch(e=>{console.error(e);process.exitCode=1});
