const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript'),assert=require('node:assert/strict');
const file=path.resolve(__dirname,'../src/app/components/islemesh/isle-store.component.ts');
const source=ts.createSourceFile(file,fs.readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true);
const cls=source.statements.find(n=>ts.isClassDeclaration(n)&&n.name.text==='IsleStoreComponent');
const method=cls.members.find(n=>n.name?.getText(source)==='installNative');
const js=ts.transpileModule('async function installNative(entry) '+method.body.getText(source),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
const ctx={};vm.runInNewContext(js,ctx);
(async()=>{
 for(const patch of [{plan:{ok:false}},{plan:null},{currentDevice:''},{planLoading:true},{installing:true},{selected:{name:'other'}}]){
  let calls=0;const target={currentDevice:'econ-core',plan:{ok:true},selected:{name:'app'},bridge:{available:true,install:async()=>{calls++;return {ok:true}}},...patch};
  await ctx.installNative.call(target,{name:'app'});assert.equal(calls,0);
 }
 let calls=0;const target={currentDevice:'econ-core',plan:{ok:true},selected:{name:'app'},bridge:{available:true,install:async(name)=>{assert.equal(name,'app');calls++;return {ok:true,output:'installed'}}}};
 await ctx.installNative.call(target,{name:'app'});assert.equal(calls,1);assert.equal(target.installOk,true);assert.equal(target.installing,false);
 console.log('PASS actual native install method: six blocked states and one valid local plan');
})().catch(e=>{console.error(e);process.exitCode=1});
