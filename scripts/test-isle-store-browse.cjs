const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript'),assert=require('node:assert/strict');
const cache=new Map();
function load(file){
 file=path.resolve(file);if(cache.has(file))return cache.get(file);
 const exports={};cache.set(file,exports);
 const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInNewContext(code,{exports,require:name=>load(path.resolve(path.dirname(file),name+'.ts'))});return exports;
}
const root=path.resolve(__dirname,'../src/app/components/islemesh');
const {filterApps,purposeIds}=load(root+'/isle-store-browse.ts');
const app={name:'registry',title:'Container Registry',description:'Versioned images',kind:'mesh-app'};
assert.equal(purposeIds(app).join(','),'infrastructure,software-distribution');
assert.equal(filterApps([app,app],'','mesh-app','infrastructure').length,1);
assert.equal(filterApps([app],'IMAGES registry','','software-distribution').length,1);
assert.equal(filterApps([app],'missing').length,0);
assert.equal(filterApps([app],'','hardware-vm').length,0);
assert.equal(filterApps([app],'','','',true).length,0);
assert.equal(filterApps([{...app,instances:[{device:'econ'}]}],'','','',true).length,1);
assert.equal(filterApps([{...app,instances:[{device:'econ',is_mock:true}]}],'','','',true).length,0);
assert.equal(purposeIds({name:'openwrt',kind:'hardware-app',realization:'kvm'}).join(','),'networking');
assert.equal(filterApps([{name:'new',kind:'new-kind'}],'','','other').length,1);
assert.equal(filterApps([{name:'x',kind:'shell-app'}]).length,0);
assert.equal(filterApps([{name:'x',kind:'shell-app',instances:[{device:'core'}]}]).length,1);
assert.equal(filterApps([{name:'x',kind:'polari-app',management_system:'polari'}]).length,0);
assert.equal(filterApps([{...app,is_mock:true}]).length,0);
assert.equal(filterApps([{...app,realization:'a'},{...app,realization:'b'}]).length,2);
console.log('15 browse/search/category assertions passed');
