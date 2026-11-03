const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),assert=require('node:assert/strict');
const rx=require('rxjs');
function load(file){const exports={};const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,experimentalDecorators:true}}).outputText;vm.runInNewContext(code,{exports,window:{location:{protocol:'https:',hostname:'polari.isle'}},navigator:{onLine:true},AbortController,URL,setTimeout,clearTimeout,console,fetch:async()=>({ok:true}),require:n=>n==='@angular/core'?{Injectable:()=>x=>x}:n==='rxjs'?rx:n==='rxjs/operators'?require(n):n.includes('environment')?{environment:{}}:{}});return exports;}
const {RuntimeConfigService}=load('src/app/services/runtime-config.service.ts');
const {CertificateTrustService}=load('src/app/services/certificate-trust.service.ts');
(async()=>{
const runtime=new RuntimeConfigService({});runtime.configLoaded.next(true);runtime.backendProtocol$.next('https');runtime.backendUrl$.next('api.example');runtime.backendPort$.next('443');
runtime.startupConfig={keycloak:{authority:'https://auth.example/realms/Polari',clientId:'frontend'}};
assert.ok(runtime.getKeycloakConfig(),'legacy configured deployments stay enabled');
runtime.startupConfig.keycloak.enabled=false;
assert.equal(runtime.getKeycloakConfig(),null,'disabled sign-in is not configured for OIDC');
const service=new CertificateTrustService(runtime);await service.checkAllEndpoints();assert.equal(service.showPrompt,false);assert.equal(service.endpointStatuses.length,1,'disabled Keycloak is not probed');
runtime.startupConfig.keycloak.requiredBy=['Private files'];await service.checkAllEndpoints();assert.equal(service.showPrompt,true);assert.equal(service.failedEndpoints[0].state,'configuration-error');assert.match(service.failedEndpoints[0].error,/Private files/);
runtime.startupConfig.keycloak.enabled=true;service.reset();await service.checkAllEndpoints();assert.equal(service.showPrompt,false);assert.equal(service.endpointStatuses.length,2,'enabled Keycloak is checked');
console.log('PASS legacy, disabled, required-but-disabled, and enabled reachable Keycloak behavior');
})().catch(e=>{console.error(e);process.exitCode=1});
