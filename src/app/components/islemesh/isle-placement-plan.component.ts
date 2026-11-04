import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, timeout } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { RouterModule } from '@angular/router';
import { PolariService } from '@services/polari-service';
import { IslePlannedTopologyComponent } from './isle-planned-topology.component';
import { IsleResourceViewComponent } from './isle-resource-view.component';

@Component({selector:'app-isle-placement-plan',standalone:true,
 imports:[CommonModule,FormsModule,MatButtonModule,RouterModule,IsleResourceViewComponent,IslePlannedTopologyComponent],
 templateUrl:'./isle-placement-plan.component.html',styleUrls:['./isle-placement-plan.component.scss']})
export class IslePlacementPlanComponent implements OnInit, OnDestroy {
 @Input() currentDevice=''; @Input() catalog:any[]=[]; @Input() queueOnly=false;
 @Output() review=new EventEmitter<string>();
 busy=false;loaded=false;message='';resources:any[]=[];search='';selected:any=null;dragged='';dirty=false; menu:any=null; action:any=null; moveTarget='';library:any=null;planDialog='';planName='';inspection=false;usageHistory:any[]=[];safetyMessage='';planNotice='';updateInfo:any=null;updateDialog=false;updateDismissed=false;private timer:any;private polling=false;private lastUpdateCheck=0;
 saved:any={title:'Isle deployment plan',revision:0,items:[]};draft:any=structuredClone(this.saved);
 constructor(private http:HttpClient,private polari:PolariService){}
 ngOnInit(){void this.load();this.timer=setInterval(()=>{if(!document.hidden)void this.pollShared();},30000);}
 ngOnDestroy(){clearInterval(this.timer);}
 @HostListener('document:visibilitychange') visible(){if(!document.hidden)void this.pollShared();}
 signature(plan:any){return JSON.stringify({items:(plan.items||[]).filter((i:any)=>i.device===this.currentDevice),removals:(plan.removals||[]).filter((i:any)=>i.device===this.currentDevice)});}
 remember(plan:any){if(!this.currentDevice)return;const key='isle-plan-seen:'+this.currentDevice;const value=this.signature(plan);try{const old=localStorage.getItem(key);if(old&&old!==value)this.planNotice='The active plan changed for '+this.currentDevice+'. Review the planned additions and removals below.';else if(!old)localStorage.setItem(key,value);}catch{}}
 dismissPlanNotice(){this.planNotice='';try{localStorage.setItem('isle-plan-seen:'+this.currentDevice,this.signature(this.saved));}catch{}}
 dismissUpdate(){this.updateDismissed=true;try{localStorage.setItem('isle-release-seen:'+this.currentDevice,this.updateInfo.release.id);}catch{}}
 async checkUpdates(){if(!this.currentDevice||Date.now()-this.lastUpdateCheck<120000)return;this.lastUpdateCheck=Date.now();try{const u:any=await firstValueFrom(this.http.get(this.url('updates')+'?device='+encodeURIComponent(this.currentDevice),this.polari.backendRequestOptions).pipe(timeout(8000)));if(u.ok){this.updateInfo=u;try{this.updateDismissed=localStorage.getItem('isle-release-seen:'+this.currentDevice)===u.release?.id;}catch{}}}catch{}}
 async pollShared(){if(this.polling||this.busy||!this.loaded)return;this.polling=true;try{const p:any=await firstValueFrom(this.http.get(this.url('placement-plan'),this.polari.backendRequestOptions).pipe(timeout(8000)));if(p.ok){if(this.queueOnly){this.remember(p.plan);this.saved=p.plan;}else if((p.plan.id!==this.saved.id||p.plan.revision!==this.saved.revision)&&this.saved.active){this.planNotice=this.dirty?'The active plan changed elsewhere. Your unsaved draft is preserved; save a copy before reloading.':'A newer active plan is available. Reload to inspect its changes.';}await this.checkUpdates();}}catch{}finally{this.polling=false;}}

 @HostListener('window:isle-plan-changed') planChanged(){if(this.queueOnly)void this.load();}
 get installCatalog(){return this.catalog.filter(a=>!a.is_mock);}
 get filteredCatalog(){const s=this.search.toLowerCase();return this.installCatalog.filter(a=>(a.title+' '+a.name+' '+a.kind).toLowerCase().includes(s));}
 catalogEntry(name:string){return this.installCatalog.find(a=>a.name===name);}
 get removals(){return (this.saved.removals||[]).filter((i:any)=>i.device===this.currentDevice && (!this.catalogEntry(i.app) || (this.catalogEntry(i.app).instances||[]).some((r:any)=>r.device===this.currentDevice)));}
 get queue(){return this.currentDevice?this.saved.items.filter((i:any)=>i.device===this.currentDevice && i.state==='planned'):[];}
 url(path:string){return this.polari.getBackendBaseUrl()+'/api/islemesh/'+path;}
 async load(){if(this.dirty && !confirm('Discard unsaved planning changes and reload?'))return;this.busy=true;
 try{const p:any=await firstValueFrom(this.http.get(this.url('placement-plan'),this.polari.backendRequestOptions).pipe(timeout(10000)));if(!p.ok)throw Error(p.error);this.saved=p.plan;this.draft=structuredClone(p.plan);this.loaded=true;this.dirty=false;this.selected=null;this.message='Saved plan loaded.';}catch(e:any){this.message='Could not load shared plan: '+(e.error?.error||e.message);this.loaded=false;}
 if(!this.queueOnly){
 const results=await Promise.allSettled(['catalog','graph'].map(path=>firstValueFrom(this.http.get<any>(this.url(path),this.polari.backendRequestOptions).pipe(timeout(10000)))));
 const c=results[0],g=results[1];
 if(c.status==='fulfilled'&&c.value.ok){this.catalog=c.value.entries;this.usageHistory=c.value.usageHistory||[];}else this.message+=' App definitions could not be refreshed.';
 if(g.status==='fulfilled'&&g.value.ok)this.resources=g.value.resources?.devices||[];else this.message+=' Resource reports could not be refreshed.';
 if(this.loaded && c.status==='fulfilled' && g.status==='fulfilled' && !this.draft.baselineInitialized)this.seedExisting();
 }
 this.busy=false;if(this.queueOnly)this.remember(this.saved);void this.checkUpdates();}
 openSave(){this.planName=this.draft.title;this.planDialog='save';}
 async save(asNew=false){this.busy=true;try{const payload={...this.draft,title:this.planName||this.draft.title,operation:asNew?'saveAs':'save'};const p:any=await firstValueFrom(this.http.put(this.url('placement-plan'),payload,this.polari.backendRequestOptions).pipe(timeout(10000)));if(!p.ok)throw Error(p.error);this.saved=p.plan;this.draft=structuredClone(p.plan);this.selected=null;this.dirty=false;this.inspection=false;this.planDialog='';window.dispatchEvent(new Event('isle-plan-changed'));this.message=p.plan.active?'Active plan saved. Planned additions and removals are available locally on each device.':'Inactive plan saved. Activate it to publish its planned changes.';}catch(e:any){this.message=e.error?.error||e.message;}this.busy=false;}
 async openLibrary(){try{this.library=await firstValueFrom(this.http.get(this.url('plan-library'),this.polari.backendRequestOptions).pipe(timeout(10000)));this.planDialog='library';}catch(e:any){this.message=e.error?.error||e.message;}}
 async inspectPlan(id:string,revision:number){if(this.dirty&&!confirm('Discard unsaved edits to inspect this saved plan?'))return;try{const p:any=await firstValueFrom(this.http.get(this.url('placement-plan')+'?id='+encodeURIComponent(id)+'&revision='+revision,this.polari.backendRequestOptions).pipe(timeout(10000)));if(!p.ok)throw Error(p.error);this.saved=p.plan;this.draft=structuredClone(p.plan);this.dirty=false;this.inspection=true;this.selected=null;this.planDialog='';this.message='Inspecting a saved plan. Edit and save a new copy, or activate the latest saved revision.';}catch(e:any){this.message=e.error?.error||e.message;}}
 async activate(){this.busy=true;try{const p:any=await firstValueFrom(this.http.put(this.url('placement-plan'),{operation:'activate',id:this.saved.id,generation:this.saved.generation,revision:this.saved.revision},this.polari.backendRequestOptions).pipe(timeout(10000)));if(!p.ok)throw Error(p.error);this.saved=p.plan;this.draft=structuredClone(p.plan);this.inspection=false;this.planDialog='';window.dispatchEvent(new Event('isle-plan-changed'));this.message='Active plan switched. No running apps were changed.';}catch(e:any){this.message=e.error?.error||e.message;}this.busy=false;}
 roles(i:any):string[]{const n=(i.app||i.title||'').toLowerCase();return (({openwrt:['router'],apt:['apt'],polari:['frontend'],'polari (launcher)':['frontend'],'polari-api':['backend'],'polari-instance':['backend'],'polari-frontend':['frontend'],'polari-backend':['backend']} as Record<string,string[]>)[n]||[]).concat(i.protectedRoles||[]);}
 protection(i:any,destination?:string){const explanations:Record<string,string>={router:'OpenWrt provides the Isle network and DNS. Keep the router on its current device.',apt:'Keep at least one apt service so devices can obtain Isle packages.',frontend:'Keep at least one Polari frontend so users can open Isle applications.',backend:'Keep at least one Polari backend so the Isle and its applications can function.'};for(const role of this.roles(i)){if(role==='router'&&destination!==i.device)return explanations[role];if(!destination&&!this.draft.items.some((j:any)=>j!==i&&j.device&&j.state!=='deferred'&&this.roles(j).includes(role)))return explanations[role];}return '';}
 observed(i:any){return this.usageHistory.filter(r=>r.app===(i.app||i.title).toLowerCase()||r.app===this.catalogEntry(i.app)?.service).sort((a,b)=>b.lastAt.localeCompare(a.lastAt));}
 useObserved(i:any,row:any){for(const k of ['ramMiB','cpus']){const m=row.metrics[k];if(m)i[k]=Math.ceil(Math.max(m.mean*1.25,m.peak,this.requirements(i)?.minimum?.[k]||0)*100)/100;}i.requirementsBased=false;i.notes=(i.notes+' Observed estimate from '+row.device+' at '+row.lastAt+'; peak or mean +25%, not a minimum.').slice(-2000);this.dirty=true;}
 get devices(){const names=new Set<string>([...this.resources.map(r=>r.device),...this.draft.items.map((i:any)=>i.device).filter(Boolean)]);return [...names].map(device=>this.resources.find(r=>r.device===device)||{device});}
 items(device:string){return this.draft.items.filter((i:any)=>i.device===device);}
 requirements(i:any){return this.catalogEntry(i.app)?.planningRequirements;}
 minimumText(i:any){const req=this.requirements(i);return req?this.cost(req.minimum):'App resource minimums have not been defined.';}
 hasMinimum(i:any){return Object.values(this.requirements(i)?.minimum||{}).some(v=>typeof v==='number');}
 applyRequirements(i:any){const minimum=this.requirements(i)?.minimum||{};i.requirementsBased=true;for(const k of ['ramMiB','diskMiB','cpus'])i[k]=typeof minimum[k]==='number'?Math.round(minimum[k]*(i.multiplier||1)*1000)/1000:null;this.dirty=true;}
 scale(i:any,value:any){i.multiplier=Math.max(1,Math.min(2,Number(value)));this.applyRequirements(i);if(i.originDevice===i.device)i.state=i.multiplier>1?'planned':'existing';}
 addApp(app:any){if(this.draft.items.length>=128)return;const item={id:crypto.randomUUID(),device:'',originDevice:'',kind:app.management_system==='polari'||['polari-module','polari-app-option'].includes(app.kind)?'polari':'catalog',app:app.name,title:app.title||app.name,state:'planned',access:'frequent',volume:'/',multiplier:1,notes:'',requirementsBased:true};this.applyRequirements(item);this.draft.items.push(item);this.selected=item;this.message='App added to Unassigned. Drag it onto a device or use the device field.';}
 seedExisting(){let added=0;const seen=new Set(this.draft.items.filter((i:any)=>i.state==='existing').map((i:any)=>i.app+'@'+i.device));
 const add=(name:string,device:string,title:string)=>{const key=name+'@'+device;if(!device||seen.has(key)||this.draft.items.length>=128)return;seen.add(key);const app=this.catalogEntry(name);const i:any={id:crypto.randomUUID(),device,originDevice:device,kind:app?(app.management_system==='polari'?'polari':'catalog'):'task',app:app?.name||'',title:app?.title||title,state:'existing',access:'frequent',volume:'/',multiplier:1,notes:'Reported existing app. Removing this card only excludes it from the plan.'};this.applyRequirements(i);this.draft.items.push(i);added++;};
 for(const app of this.installCatalog)for(const instance of app.instances||[])add(app.name,instance.device,app.title||app.name);
 for(const r of this.resources)for(const w of r.appWorkloads||[])add(w.name,r.device,w.name);
 this.draft.baselineInitialized=true;this.dirty=true;this.message=`Added ${added} reported apps as the starting layout. Save to keep this baseline; removing cards does not uninstall apps.`;
 }
 openMenu(event:MouseEvent,item:any){event.preventDefault();this.showMenu({item,x:event.clientX,y:event.clientY});}
 showMenu(menu:any){this.menu={...menu,x:Math.min(menu.x,window.innerWidth-220),y:Math.min(menu.y,window.innerHeight-180)};}
 requestAction(kind:string,item:any){this.menu=null;if(kind==='remove'){const why=this.protection(item);if(why){this.safetyMessage=why;return;}}this.action={kind,item};this.moveTarget=item.device;}
 confirmAction(){if(!this.action)return;const {kind,item}=this.action;if(kind==='remove')this.remove(item);else this.move(item,this.moveTarget);this.action=null;}
 remove(i:any){const why=this.protection(i);if(why){this.safetyMessage=why;return;}if(i.originDevice){this.draft.removals??=[];const app=i.app||i.title.toLowerCase();if(/^[a-z0-9_.-]+$/.test(app)&&!this.draft.removals.some((r:any)=>r.app===app&&r.device===i.originDevice))this.draft.removals.push({app,device:i.originDevice,title:i.title});}this.draft.items=this.draft.items.filter((x:any)=>x.id!==i.id);if(this.selected===i)this.selected=null;this.dirty=true;}
 move(i:any,device:string){if(device===':deferred'){this.setStage(i,'deferred');return;}const why=this.protection(i,device);if(why){this.safetyMessage=why;return;}if(i.originDevice&&i.originDevice!==device){this.draft.removals??=[];const app=i.app||i.title.toLowerCase();if(/^[a-z0-9_.-]+$/.test(app)&&!this.draft.removals.some((r:any)=>r.app===app&&r.device===i.originDevice))this.draft.removals.push({app,device:i.originDevice,title:i.title});}this.draft.removals=(this.draft.removals||[]).filter((r:any)=>!(r.app===(i.app||i.title.toLowerCase())&&r.device===device));i.device=device;i.state=i.originDevice===device&&(i.multiplier||1)===1?'existing':'planned';this.dirty=true;}
 setStage(i:any,state:string){if(state==='deferred'){const why=this.protection(i);if(why){this.safetyMessage=why;return;}}i.state=state;this.dirty=true;}
 startDrag(event:DragEvent,i:any){this.dragged=i.id;event.dataTransfer?.setData('text/plain',i.id);if(event.dataTransfer)event.dataTransfer.effectAllowed='move';}
 allowDrop(event:DragEvent){event.preventDefault();if(event.dataTransfer)event.dataTransfer.dropEffect='move';}
 drop(event:DragEvent,device:string){event.preventDefault();const id=event.dataTransfer?.getData('text/plain')||this.dragged;const i=this.draft.items.find((x:any)=>x.id===id);if(i)this.move(i,device);this.dragged='';}
 incremental(i:any){if(i.state==='existing')return {ramMiB:0,diskMiB:0,cpus:0,volume:i.volume};if(i.originDevice===i.device&&i.requirementsBased){const m=this.requirements(i)?.minimum||{};return {...i,...Object.fromEntries(['ramMiB','diskMiB','cpus'].map(k=>[k,typeof i[k]==='number'&&typeof m[k]==='number'?Math.max(0,i[k]-m[k]):null]))};}return i;}
 planned(device:string){return this.items(device).filter((i:any)=>i.state!=='deferred').map((i:any)=>this.incremental(i));}
 budget(device:string){return this.budgets.find(b=>b.device===device);}
 cost(i:any){return `${i.ramMiB??'not defined'} MiB RAM · ${i.diskMiB??'not defined'} MiB storage · ${i.cpus??'not defined'} CPU threads`;}
 get budgets(){return [...new Set<string>(this.draft.items.map((i:any)=>i.device).filter(Boolean))].map(device=>{
 const items=this.draft.items.filter((i:any)=>i.device===device && i.state!=='deferred').map((i:any)=>this.incremental(i));const entry=this.resources.find(r=>r.device===device);const r=entry?.reportedAvailability||{};
 const sum=(k:string)=>items.reduce((s:number,i:any)=>s+(typeof i[k]==='number'?i[k]:0),0);const incomplete=items.some((i:any)=>['ramMiB','diskMiB','cpus'].some(k=>i[k]===null||i[k]===undefined));
 const free=r.availableRamMb?.value;const remaining=typeof free==='number'?free-sum('ramMiB')-2048:null;
 const volumes=entry?.resourceDetail?.value?.storage?.volumes||[];
 let diskWarning=false;let diskStale=false;const mounts=[...new Set<string>(items.filter((i:any)=>i.diskMiB!==0).map((i:any)=>i.volume||'/'))];
 const disk=mounts.map(m=>{const v=volumes.find((v:any)=>v.mounts?.includes(m));const available=v?.availableMiB??(m==='/'?r.freeDiskMb?.value:undefined);if(!(v?entry?.resourceDetail?.fresh:r.freeDiskMb?.fresh))diskStale=true;const needed=items.filter((i:any)=>(i.volume||'/')===m).reduce((s:number,i:any)=>s+(i.diskMiB||0),0);if(typeof available!=='number'){diskWarning=true;return m+': no capacity report';}if(needed>available)diskWarning=true;return m+': '+Math.round((available-needed)/1024*10)/10+' GiB after planned storage';}).join(' · ');
 return {device,cost:this.cost({ramMiB:sum('ramMiB'),diskMiB:sum('diskMiB'),cpus:sum('cpus')}),ram:remaining===null?'No RAM availability report.':(remaining/1024).toFixed(1)+' GiB remains after additions and 2GiB headroom · reported '+r.availableRamMb.observedAt,disk:disk||'No additional storage planned.',cpu:sum('cpus')+' planned CPU threads / '+(r.threads?.value??'unreported')+' total; not exclusive or idle capacity.',warning:!items.length?'Existing/deferred work only.':incomplete?'Incomplete cost estimates.':!entry?'Device has not reported; readiness unverified.':remaining===null||!r.availableRamMb?.fresh||!r.threads?.fresh||diskStale?'Fresh RAM, CPU and storage reports needed.':remaining<0||diskWarning||sum('cpus')>(r.threads?.value??Infinity)?'Review resource budget before installing.':'Estimates fit this snapshot; per-app capabilities and dependencies still need validation.'};
 });}
}
