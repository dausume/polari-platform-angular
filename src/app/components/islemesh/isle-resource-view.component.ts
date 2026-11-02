import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { scaleLinear } from 'd3';

@Component({selector:'app-isle-resource-view',standalone:true,imports:[CommonModule],template:`
<div class="resource-grid">
 <article *ngFor="let entry of entries" class="resource-device">
  <h3>{{entry.device}}</h3>
  <ng-container *ngIf="entry.reportedAvailability as report">
   <h4>RAM</h4>
   <ng-container *ngIf="valid(report.ramMb?.value) && valid(report.availableRamMb?.value); else noRam">
    <svg viewBox="0 0 480 30" role="img" [attr.aria-label]="ramText(report)"><title>{{ramText(report)}}</title>
     <rect width="480" height="26" rx="5" fill="#d7e5ee"/><rect [attr.width]="usedWidth(report.ramMb.value,report.availableRamMb.value)" height="26" rx="5" fill="#1976d2"/>
    </svg>
    <p>{{ramText(report)}}</p><small>Reported {{report.availableRamMb.observedAt | date:'medium'}} {{report.availableRamMb.fresh ? '' : '— older snapshot'}}</small>
   </ng-container>
   <ng-template #noRam><p>RAM capacity and availability have not both been reported.</p></ng-template>
  </ng-container>
  <p>Profile estimates: {{entry.consumed?.ramMbTotal || 0 | number:'1.0-0'}} MiB RAM. These overlap actual usage; they are not extra measured consumption or enforced reservations.</p>
  <ng-container *ngIf="entry.resourceDetail as detail; else noDetail">
   <p><small>Hardware report {{detail.observedAt | date:'medium'}} {{detail.fresh ? '' : '— older snapshot; refresh on this device'}}</small></p>
   <h4>CPU threads</h4>
   <p>Each tile is a logical CPU; hover, focus or select for its physical core and workload affinity. Activity is a short sample.</p>
   <svg *ngIf="detail.value.cpus?.length" viewBox="0 0 480 120" [attr.viewBox]="'0 0 480 '+cpuHeight(detail.value.cpus)" role="group" aria-label="CPU activity and affinity">
    <g *ngFor="let cpu of detail.value.cpus; let i=index" [attr.transform]="'translate('+((i%8)*60)+','+(Math.floor(i/8)*52)+')'" tabindex="0" role="button" [attr.aria-label]="cpuText(cpu,detail.value)" (click)="cpuSelection[entry.device]=cpuText(cpu,detail.value)" (keydown.enter)="cpuSelection[entry.device]=cpuText(cpu,detail.value)" (focus)="cpuSelection[entry.device]=cpuText(cpu,detail.value)">
     <title>{{cpuText(cpu,detail.value)}}</title><rect x="2" y="2" width="54" height="46" rx="5" [attr.fill]="!cpu.online?'#616161':affinity(cpu,detail.value).length?'#6a1b9a':'#1565c0'" [attr.stroke]="cpu.isolated?'#ffb300':'none'" stroke-width="3"/>
     <text x="29" y="21" text-anchor="middle" fill="white" font-size="12">CPU {{cpu.id}}</text><text x="29" y="38" text-anchor="middle" fill="white" font-size="11">{{cpu.online ? (valid(cpu.busyPercent) ? cpu.busyPercent+'%' : 'no sample') : 'offline'}}</text>
    </g>
   </svg>
   <p>Blue: shared host CPU · Purple: explicit workload affinity · Grey: offline · Amber outline: kernel isolation</p>
   <p *ngIf="cpuSelection[entry.device]" role="status">{{cpuSelection[entry.device]}}</p>
   <p>{{detail.value.allocationNote}}</p>
   <details><summary>Running workload allocations</summary><p>VMs: {{detail.value.vmStatus}}. Containers: {{detail.value.containerStatus}}.</p>
    <ul><li *ngFor="let a of detail.value.allocations">{{a.name}} ({{a.kind}}): {{a.vcpus ? a.vcpus+' vCPUs; ' : ''}}{{a.quotaCpus ? 'quota '+a.quotaCpus+' CPUs; ' : ''}}{{a.cpus?.length ? 'allowed CPUs '+a.cpus.join(', ') : a.pins?.length ? 'per-vCPU affinity — inspect CPU tiles' : 'shared scheduling; no explicit CPU set'}}. Exclusivity not established.</li></ul>
   </details>
   <h4>Storage tiers</h4><p>Grouped by reported media class. Retrieval speed depends on workload and has not been benchmarked.</p>
   <p *ngIf="!detail.value.storage?.volumes?.length">No mounted block-volume capacity reported. Probe: {{detail.value.storageStatus}}.</p>
   <section *ngFor="let volume of volumes(detail.value)" class="volume"><strong>{{volume.mounts?.join(', ')}} · {{tier(volume.tier)}}</strong><small> {{volume.name}} · {{volume.transport || 'transport not reported'}}</small>
    <svg *ngIf="valid(volume.totalMiB) && valid(volume.availableMiB)" viewBox="0 0 480 22" role="img" [attr.aria-label]="storageText(volume)"><title>{{storageText(volume)}}</title><rect width="480" height="20" rx="4" fill="#d7e5ee"/><rect [attr.width]="usedWidth(volume.totalMiB,volume.availableMiB)" height="20" rx="4" fill="#00897b"/></svg><p>{{storageText(volume)}}</p>
   </section>
   <details><summary>Physical drives (do not add these to volume totals)</summary><p *ngFor="let disk of detail.value.storage?.drives">{{disk.name}} · {{tier(disk.tier)}} · {{gib(disk.sizeMiB)}} GiB</p></details>
  </ng-container>
  <ng-template #noDetail><p>Detailed CPU and drive reports have not arrived. Update the device reporter to populate these visuals.</p></ng-template>
 </article>
</div>`,styles:[`
.resource-grid { display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,430px),1fr));gap:1rem; }
.resource-device { border:1px solid currentColor;border-radius:10px;padding:1rem;min-width:0; }
svg { width:100%;display:block; } p { overflow-wrap:anywhere; } h4 { margin-bottom:.5rem; }
.volume { margin-block:1rem; } small { display:block; } g[role=button] { cursor:pointer; } g:focus { outline:2px solid currentColor; }
`]})
export class IsleResourceViewComponent {
 @Input() entries:any[]=[];
 readonly Math=Math; cpuSelection:Record<string,string>={};
 valid(n:any){return typeof n==='number' && Number.isFinite(n) && n>=0;}
 gib(n:number){return this.valid(n)?(n/1024).toFixed(1):'not reported';}
 usedWidth(total:number,available:number){return total>0?scaleLinear().domain([0,total]).range([0,480]).clamp(true)(total-available):0;}
 ramText(r:any){return this.gib(Math.max(0,r.ramMb.value-r.availableRamMb.value))+' GiB in use / '+this.gib(r.ramMb.value)+' GiB total · '+this.gib(r.availableRamMb.value)+' GiB available (includes reclaimable memory)';}
 storageText(v:any){return this.valid(v.totalMiB)&&this.valid(v.availableMiB)?this.gib(Math.max(0,v.totalMiB-v.availableMiB))+' GiB used or filesystem-reserved / '+this.gib(v.totalMiB)+' GiB total · '+this.gib(v.availableMiB)+' GiB available':'Capacity not reported';}
 cpuHeight(cpus:any[]){return Math.ceil(cpus.length/8)*52;}
 affinity(cpu:any,d:any){return (d.allocations||[]).filter((a:any)=>(a.cpus||[]).includes(cpu.id)||(a.pins||[]).some((p:any)=>(p.cpus||[]).includes(cpu.id))).map((a:any)=>a.name);}
 cpuText(c:any,d:any){const a=this.affinity(c,d);return 'CPU '+c.id+' · socket '+(c.socket??'not reported')+' / core '+(c.core??'not reported')+' · '+(!c.online?'offline':this.valid(c.busyPercent)?c.busyPercent+'% active':'activity not reported')+(c.isolated?' · kernel-isolated':'')+' · '+(a.length?'affinity: '+a.join(', ')+'; not proven exclusive':'no explicit workload affinity reported; shared scheduling');}
 tier(t:string){return ({nvme:'NVMe solid state','solid-state':'Solid state',rotational:'Rotational (HDD)',mixed:'Mixed backing media'} as Record<string,string>)[t]||'Unclassified media';}
 volumes(d:any){const rank:Record<string,number>={nvme:0,'solid-state':1,rotational:2,mixed:3};return [...(d.storage?.volumes||[])].sort((a,b)=>(rank[a.tier]??4)-(rank[b.tier]??4));}
}
