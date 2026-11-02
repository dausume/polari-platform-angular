import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, timeout } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { RouterModule } from '@angular/router';
import { PolariService } from '@services/polari-service';
import { IsleResourceViewComponent } from './isle-resource-view.component';

@Component({selector:'app-isle-placement-plan',standalone:true,imports:[CommonModule,FormsModule,MatButtonModule,RouterModule,IsleResourceViewComponent],template:`
<section *ngIf="queue.length" class="planned-here" aria-label="Planned for this device">
 <h2>Planned for this device · {{currentDevice}}</h2><p>{{saved.title}} · Saved {{saved.updatedAt | date:'medium'}}. Review the plan and local readiness before installing.</p>
 <article *ngFor="let item of queue"><h3>{{item.title}}</h3><p>{{cost(item)}} · {{item.notes}}</p>
  <button mat-stroked-button *ngIf="item.kind==='catalog' && catalogEntry(item.app)" (click)="review.emit(item.app)">Review local installation</button>
  <a mat-stroked-button *ngIf="item.kind==='polari'" routerLink="/module-management">Open Polari module management</a>
  <p *ngIf="item.kind==='task' || (item.kind==='catalog' && !catalogEntry(item.app))">Planning task — no supported catalog installation action available.</p>
 </article>
</section>
<div class="plan-toolbar"><button mat-stroked-button (click)="planning=!planning">{{planning ? 'Close planning mode' : 'Plan app placement'}}</button><span *ngIf="!currentDevice"> Open the native Isle App to identify this device and see its planned installation queue.</span></div>
<section *ngIf="planning" class="planner" aria-label="Shared placement plan">
 <h2>Plan across the Isle</h2><p>This is shared deployment intent, not an installation or resource reservation. Installations stay local to the detected device. Polari configurations remain managed by Polari.</p>
 <p role="status">{{message}}</p>
 <div class="plan-toolbar"><button mat-stroked-button (click)="load()" [disabled]="busy">Reload saved plan</button><button mat-stroked-button (click)="electronics()" [disabled]="busy || draft.items.length>0">Start Electronics draft</button><button mat-raised-button (click)="save()" [disabled]="busy || !loaded">Save shared plan</button></div>
 <label>Plan name <input [(ngModel)]="draft.title" maxlength="120"></label>
 <p *ngIf="draft.updatedAt">Last saved {{draft.updatedAt | date:'medium'}} · revision {{draft.revision}}</p>
 <p>Blank estimates mean “not estimated”; zero means no additional cost. Only planned additions count below. Existing/deferred work is excluded. Keep at least2GiB RAM headroom; estimates need testing before installation.</p>
 <section class="budgets"><article *ngFor="let b of budgets"><h3>{{b.device}}</h3><p>{{b.cost}}</p><p>{{b.ram}}</p><p>{{b.disk}}</p><p>{{b.cpu}}</p><strong>{{b.warning}}</strong></article></section>
 <details><summary>Inspect reported device resources</summary><app-isle-resource-view [entries]="resources"></app-isle-resource-view></details>
 <datalist id="planning-devices"><option *ngFor="let d of resources" [value]="d.device"></option></datalist>
 <article class="plan-item" *ngFor="let item of draft.items;let i=index">
  <h3>{{i+1}}. {{item.title || 'New placement'}}</h3><div class="fields">
  <label>Device <input list="planning-devices" [(ngModel)]="item.device" maxlength="80" placeholder="Device name"></label>
  <label>Management <select [(ngModel)]="item.kind"><option value="catalog">Isle catalog app</option><option value="polari">Polari configuration</option><option value="task">Planning task</option></select></label>
  <label *ngIf="item.kind==='catalog'">App <select [(ngModel)]="item.app" (ngModelChange)="chooseApp(item)"><option value="">Select catalog app</option><option *ngFor="let app of installCatalog" [value]="app.name">{{app.title || app.name}}</option></select></label>
  <label>Title <input [(ngModel)]="item.title" maxlength="160"></label>
  <label>Stage <select [(ngModel)]="item.state"><option value="planned">Planned addition</option><option value="existing">Keep existing</option><option value="deferred">Deferred / optional</option></select></label>
  <label>Additional RAM (MiB)<input type="number" min="0" [(ngModel)]="item.ramMiB" placeholder="Not estimated"></label>
  <label>Additional storage (MiB)<input type="number" min="0" [(ngModel)]="item.diskMiB" placeholder="Not estimated"></label>
  <label>CPU budget (threads)<input type="number" min="0" step="0.25" [(ngModel)]="item.cpus" placeholder="Not estimated"></label>
  <label>Storage mount<input [(ngModel)]="item.volume" placeholder="/ or reported mount"></label>
  <label>Data access <select [(ngModel)]="item.access"><option value="frequent">Frequent / latency-sensitive</option><option value="occasional">Occasional</option><option value="archive">Archive / cold data</option></select></label>
  </div><label>Dependencies, role and evidence<textarea [(ngModel)]="item.notes" maxlength="2000" rows="3"></textarea></label>
  <p *ngIf="item.kind==='catalog' && !catalogEntry(item.app)">This app is not currently offered by the Isle catalog; no installation will be offered.</p>
  <button mat-button (click)="draft.items.splice(i,1)">Remove from draft</button>
 </article>
 <button mat-stroked-button (click)="add()" [disabled]="draft.items.length>=128">Add placement</button> <button mat-raised-button (click)="save()" [disabled]="busy || !loaded">Save shared plan</button>
</section>`,styles:[`
.planned-here,.planner {border:2px solid currentColor;border-radius:12px;padding:1rem;margin-bottom:1rem;}
.plan-toolbar {display:flex;gap:.75rem;align-items:center;flex-wrap:wrap;margin-block:1rem;}
.fields,.budgets {display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr));gap:1rem;}
label {display:flex;flex-direction:column;gap:.35rem;min-width:0;} input,select,textarea {font:inherit;padding:.5rem;min-width:0;max-width:100%;color:inherit;background:var(--surface-app-background);border:1px solid currentColor;border-radius:4px;}
.plan-item {border-top:1px solid currentColor;padding-block:1rem;} .budgets article {border:1px solid currentColor;border-radius:8px;padding:.75rem;} textarea {width:100%;box-sizing:border-box;} p {overflow-wrap:anywhere;}
`]})
export class IslePlacementPlanComponent implements OnInit {
 @Input() currentDevice=''; @Input() catalog:any[]=[]; @Output() review=new EventEmitter<string>();
 planning=false;busy=false;loaded=false;message='';resources:any[]=[];
 saved:any={title:'Isle deployment plan',revision:0,items:[]};draft:any=structuredClone(this.saved);
 constructor(private http:HttpClient,private polari:PolariService){}
 ngOnInit(){void this.load();}
 get installCatalog(){return this.catalog.filter(a=>!a.is_mock && a.management_system!=='polari' && !['polari-module','polari-app-option'].includes(a.kind));}
 catalogEntry(name:string){return this.installCatalog.find(a=>a.name===name);}
 get queue(){return this.currentDevice?this.saved.items.filter((i:any)=>i.device===this.currentDevice && i.state==='planned'):[];}
 url(path:string){return this.polari.getBackendBaseUrl()+'/api/islemesh/'+path;}
 async load(){this.busy=true;try{const p:any=await firstValueFrom(this.http.get(this.url('placement-plan'),this.polari.backendRequestOptions).pipe(timeout(10000)));if(!p.ok)throw Error(p.error);this.saved=p.plan;this.draft=structuredClone(p.plan);this.loaded=true;this.message='Saved plan loaded.';}catch(e:any){this.message='Could not load shared plan: '+(e.error?.error||e.message);this.loaded=false;}
 try{const g:any=await firstValueFrom(this.http.get(this.url('graph'),this.polari.backendRequestOptions).pipe(timeout(10000)));this.resources=g.resources?.devices||[];}catch{this.message+=' Resource reports could not be refreshed.';}this.busy=false;}
 async save(){this.busy=true;try{const p:any=await firstValueFrom(this.http.put(this.url('placement-plan'),this.draft,this.polari.backendRequestOptions).pipe(timeout(10000)));if(!p.ok)throw Error(p.error);this.saved=p.plan;this.draft=structuredClone(p.plan);this.message='Shared plan saved. Each device will see its planned additions when it opens the Isle App.';}catch(e:any){this.message=e.error?.error||e.message;}this.busy=false;}
 add(){this.draft.items.push({id:crypto.randomUUID(),device:this.currentDevice||'',kind:'catalog',app:'',title:'',state:'planned',access:'frequent',volume:'/',ramMiB:null,diskMiB:null,cpus:null,notes:''});}
 chooseApp(i:any){i.title=this.catalogEntry(i.app)?.title||i.app;}
 cost(i:any){return `${i.ramMiB??'not estimated'} MiB RAM · ${i.diskMiB??'not estimated'} MiB storage · ${i.cpus??'not estimated'} CPU threads`;}
 get budgets(){return [...new Set<string>(this.draft.items.map((i:any)=>i.device).filter(Boolean))].map(device=>{
 const items=this.draft.items.filter((i:any)=>i.device===device && i.state==='planned');const entry=this.resources.find(r=>r.device===device);const r=entry?.reportedAvailability||{};
 const sum=(k:string)=>items.reduce((s:number,i:any)=>s+(typeof i[k]==='number'?i[k]:0),0);const incomplete=items.some((i:any)=>['ramMiB','diskMiB','cpus'].some(k=>i[k]===null||i[k]===undefined));
 const free=r.availableRamMb?.value;const remaining=typeof free==='number'?free-sum('ramMiB')-2048:null;
 const volumes=entry?.resourceDetail?.value?.storage?.volumes||[];
 let diskWarning=false;let diskStale=false;const mounts=[...new Set<string>(items.filter((i:any)=>i.diskMiB!==0).map((i:any)=>i.volume||'/'))];
 const disk=mounts.map(m=>{const v=volumes.find((v:any)=>v.mounts?.includes(m));const available=v?.availableMiB??(m==='/'?r.freeDiskMb?.value:undefined);if(!(v?entry?.resourceDetail?.fresh:r.freeDiskMb?.fresh))diskStale=true;const needed=items.filter((i:any)=>(i.volume||'/')===m).reduce((s:number,i:any)=>s+(i.diskMiB||0),0);if(typeof available!=='number'){diskWarning=true;return m+': no capacity report';}if(needed>available)diskWarning=true;return m+': '+Math.round((available-needed)/1024*10)/10+' GiB after planned storage';}).join(' · ');
 return {device,cost:this.cost({ramMiB:sum('ramMiB'),diskMiB:sum('diskMiB'),cpus:sum('cpus')}),ram:remaining===null?'No RAM availability report.':(remaining/1024).toFixed(1)+' GiB remains after additions and2GiB headroom · reported '+r.availableRamMb.observedAt,disk:disk||'No additional storage planned.',cpu:sum('cpus')+' planned CPU threads / '+(r.threads?.value??'unreported')+' total; not exclusive or idle capacity.',warning:!items.length?'Existing/deferred work only.':incomplete?'Incomplete cost estimates.':!entry?'Device has not reported; readiness unverified.':remaining===null||!r.availableRamMb?.fresh||!r.threads?.fresh||diskStale?'Fresh RAM, CPU and storage reports needed.':remaining<0||diskWarning||sum('cpus')>(r.threads?.value??Infinity)?'Review resource budget before installing.':'Estimates fit this snapshot; per-app capabilities and dependencies still need validation.'};
 });}
 electronics(){if(this.draft.items.length)return;this.draft.title='Electronics distributed test';const make=(id:string,device:string,kind:string,title:string,state:string,app:string,ramMiB:number|null,diskMiB:number|null,cpus:number|null,notes:string)=>({id,device,kind,title,state,app,ramMiB,diskMiB,cpus,notes,volume:'/',access:'frequent'});
 this.draft.items=[
 make('core-router','isle-core','task','Keep OpenWrt and Isle networking','existing','',0,0,0,'Existing Hardware App. Preserve networking and rollback; do not replace during Electronics tests.'),
 make('core-polari','isle-core','task','Keep Polari frontend and core backend','existing','',0,0,0,'Retain the working frontend and backend. Extra compute belongs on remote devices; keep core build headroom.'),
 make('econ-polari','econ-core','catalog','Polari backend for Electronics workers','planned','polari-instance',1024,4096,1,'Provisional planning budget, not a measured minimum. Backend-only role; reuse a verified existing backend if present. Core frontend remains shared; validate CORS and image availability.'),
 make('econ-engines','econ-core','polari','Electronics workers and hardware bridge configuration','planned','',1536,6144,2,'Provisional combined incremental budget. Current board/ESP/PCB/bridge engine definitions are Polari-managed. Confirm modules and dependencies with Claude. Real hardware bridge tests need attached boards and permissions; no VM required on econ.'),
 make('pol-backend','pol-core','catalog','Polari backend for Electronics compute','planned','polari-instance',1024,4096,1,'Inspect and reuse the existing Polari backend where possible, then mark this existing. Device report must be refreshed before admitting new work; do not replace the current stack blindly.'),
 make('pol-electronics','pol-core','polari','Electronics app configuration and simulation coordination','planned','',1024,4096,1,'Provisional incremental budget. Confirm the actual Electronics app/module definition and runtime placement with Claude. Configure remote worker bindings through Polari.'),
 make('pol-mcu-vm','pol-core','catalog','Optional MCU Hardware App simulation','deferred','uno_core_demo',null,null,null,'Optional only. Verify this catalog realization, QEMU/KVM support, image availability and measured cost before enabling. Keep deferred until the container/Polari path is working.')];this.message='Electronics draft created. Estimates are provisional; review device reports and dependencies, then save.';}
}
