import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { scaleLinear } from 'd3';

@Component({selector:'app-isle-planned-topology',standalone:true,imports:[CommonModule],template:`
<section><h3>Planned topology</h3><p>Desired app placement. Lines connect apps to their planned devices; they do not represent physical network links. Select an app to edit its placement.</p>
<div class="graph-scroll"><svg [attr.viewBox]="'0 0 '+width+' '+height" [style.min-width.px]="width" role="group" aria-label="Desired device and app topology">
<g *ngFor="let name of names;let col=index" [attr.transform]="'translate('+(col*270)+',0)'">
 <rect x="10" y="8" width="250" [attr.height]="height-16" rx="12" fill="#f5f1fa" stroke="#8796a6"/>
 <rect x="10" y="8" width="250" height="42" rx="10" fill="#544170"/><text x="135" y="34" text-anchor="middle" fill="white" font-size="15">{{name || 'Unassigned'}}</text>
 <g *ngFor="let item of on(name);let row=index" [attr.transform]="'translate(0,'+(65+row*70)+')'" role="button" tabindex="0" [attr.aria-label]="item.title+' planned on '+(name||'no device')" (contextmenu)="context($event,item)" (click)="choose.emit(item)" (keydown.enter)="choose.emit(item)">
  <path d="M135 -15V0" stroke="#8e44ad" stroke-width="2"/>
  <rect x="25" width="220" height="54" rx="8" fill="white" stroke="#8e44ad" stroke-width="2"/><title>{{item.title}} · {{item.state}}</title>
  <text x="135" y="23" text-anchor="middle" fill="#263445" font-size="12">{{item.title.length>29 ? item.title.slice(0,27)+'…' : item.title}}</text><text x="135" y="42" text-anchor="middle" fill="#53687c" font-size="11">{{item.state}}</text>
 </g>
</g></svg></div>
<h3>Planned device utilization</h3><p>Purple is the desired app budget out of reported total capacity. This includes retained apps with defined requirements. It is not measured usage or a reservation; OS overhead and unprofiled apps are not included.</p>
<div class="utilization"><article *ngFor="let device of devices"><h4>{{device.device}}</h4>
 <ng-container *ngFor="let metric of metrics"><strong>{{metric.label}} · {{sum(device.device,metric.key) | number:'1.0-2'}} / {{capacity(device,metric.report) ?? 'not reported'}} {{metric.unit}}</strong>
 <svg viewBox="0 0 480 25" role="img" [attr.aria-label]="metric.label+' desired budget versus device capacity'"><rect x="1" y="1" width="478" height="22" rx="4" fill="#edf2f7" stroke="#50677a" stroke-width="1.5"/><rect x="2" y="2" [attr.width]="bar(sum(device.device,metric.key),capacity(device,metric.report))" height="20" rx="3" [attr.fill]="sum(device.device,metric.key)>capacity(device,metric.report)?'#c62828':'#7b1fa2'"/></svg>
 <small>{{missing(device.device,metric.key)}} apps without a defined {{metric.label}} budget <span *ngIf="sum(device.device,metric.key)>capacity(device,metric.report)">· exceeds reported capacity</span></small>
 </ng-container><small>Capacity report: {{device.reportedAvailability?.ramMb?.observedAt | date:'medium'}} <span *ngIf="!device.reportedAvailability?.ramMb?.fresh">· refresh needed</span></small>
 </article></div></section>`,styles:[`
.graph-scroll {overflow:auto;max-height:420px;border-radius:10px;} svg {width:100%;display:block;} g[role=button]{cursor:pointer;} g:focus{outline:2px solid #1565c0;}
.utilization{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr));gap:1rem;margin-bottom:1rem;}.utilization article{border:1px solid #8796a6;border-radius:10px;padding:.8rem;min-width:0;}.utilization small{display:block;margin:.3rem 0 .8rem;}.utilization strong{font-size:.85rem;}
`]})
export class IslePlannedTopologyComponent {
 @Input() items:any[]=[];@Input() devices:any[]=[];@Output() choose=new EventEmitter<any>();@Output() menu=new EventEmitter<any>();
 context(event:MouseEvent,item:any){event.preventDefault();this.menu.emit({item,x:event.clientX,y:event.clientY});}
 metrics=[{key:'ramMiB',report:'ramMb',label:'RAM',unit:'MiB'},{key:'diskMiB',report:'diskMb',label:'Storage',unit:'MiB'},{key:'cpus',report:'threads',label:'CPU',unit:'threads'}];
 get names(){return [...new Set<string>([...this.devices.map(d=>d.device),...this.items.filter(i=>i.state!=='deferred').map(i=>i.device)])];}
 on(name:string){return this.items.filter(i=>i.device===name&&i.state!=='deferred');}
 get width(){return Math.max(540,this.names.length*270);}
 get height(){return 95+Math.max(1,...this.names.map(n=>this.on(n).length))*70;}
 sum(name:string,key:string){return this.on(name).reduce((s,i)=>s+(typeof i[key]==='number'?i[key]:0),0);}
 missing(name:string,key:string){return this.on(name).filter(i=>typeof i[key]!=='number'||!i.requirementsBased).length;}
 capacity(d:any,key:string){return d.reportedAvailability?.[key]?.value;}
 bar(value:number,capacity:number){return capacity>0?scaleLinear().domain([0,capacity]).range([0,476]).clamp(true)(value):0;}
}
