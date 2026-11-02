import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { scaleLinear } from 'd3';
import { DragDropModule, CdkDragDrop } from '@angular/cdk/drag-drop';

@Component({selector:'app-isle-planned-topology',standalone:true,imports:[CommonModule,DragDropModule],template:`
<section><h3>Planned placement</h3><p>Drag a card by its grip to a device. Right-click for details, move or removal. Changes update the resource projections below.</p>
<div class="placement-board" cdkDropListGroup>
 <section class="device-lane" *ngFor="let name of names" [class.unassigned]="!name">
  <header><span class="device-symbol" aria-hidden="true">{{name ? '▣' : '＋'}}</span><div><h4>{{name===':deferred' ? 'Deferred' : name || 'Unassigned'}}</h4><small>{{on(name).length}} apps · {{name ? 'Desired placement' : 'Drag onto a device'}}</small></div></header>
  <div class="drop-zone" cdkDropList [cdkDropListData]="name" [cdkDropListSortingDisabled]="true" (cdkDropListDropped)="drop($event)">
   <article *ngFor="let item of on(name);trackBy:identify" class="placement-card" cdkDrag [cdkDragData]="item" (cdkDragStarted)="dragging=true" (cdkDragEnded)="dragging=false" (contextmenu)="context($event,item)" [class.existing]="item.state==='existing'">
    <button class="grip" cdkDragHandle aria-label="Drag app to a device" title="Drag to another device">⠿</button>
    <button class="card-details" (click)="choose.emit(item)"><strong>{{item.title}}</strong><span>{{item.kind==='task' ? 'Planning task' : item.kind==='polari' ? 'Polari app' : 'Isle app'}} · {{item.state}}</span><small>{{item.ramMiB ?? '—'}} MiB RAM · {{item.cpus ?? '—'}} CPU</small></button>
    <button class="card-menu" aria-label="App actions" (click)="menu.emit({item:item,x:$event.clientX,y:$event.clientY})">⋮</button>
    <div *cdkDragPlaceholder class="card-placeholder">Drop to place here</div>
    <div *cdkDragPreview class="drag-preview"><span>⠿</span><div><strong>{{item.title}}</strong><small>{{item.ramMiB ?? '—'}} MiB RAM · {{item.cpus ?? '—'}} CPU</small></div></div>
   </article>
   <p class="empty-lane" *ngIf="!on(name).length">{{dragging ? 'Drop app here' : 'Drop an app here to assign it'}}</p>
  </div>
 </section>
</div>
<h3>Planned device utilization</h3><p>Purple is the desired app budget out of reported total capacity. This includes retained apps with defined requirements. It is not measured usage or a reservation; OS overhead and unprofiled apps are not included.</p>
<div class="utilization"><article *ngFor="let device of devices"><h4>{{device.device}}</h4>
 <ng-container *ngFor="let metric of metrics"><strong>{{metric.label}} · {{sum(device.device,metric.key) | number:'1.0-2'}} / {{capacity(device,metric.report) ?? 'not reported'}} {{metric.unit}}</strong>
 <svg viewBox="0 0 480 25" role="img" [attr.aria-label]="metric.label+' desired budget versus device capacity'"><rect x="1" y="1" width="478" height="22" rx="4" fill="#edf2f7" stroke="#50677a" stroke-width="1.5"/><rect x="2" y="2" [attr.width]="bar(sum(device.device,metric.key),capacity(device,metric.report))" height="20" rx="3" [attr.fill]="sum(device.device,metric.key)>capacity(device,metric.report)?'#c62828':'#7b1fa2'"/></svg>
 <small>{{missing(device.device,metric.key)}} apps without a defined {{metric.label}} budget <span *ngIf="sum(device.device,metric.key)>capacity(device,metric.report)">· exceeds reported capacity</span></small>
 </ng-container><small>Capacity report: {{device.reportedAvailability?.ramMb?.observedAt | date:'medium'}} <span *ngIf="!device.reportedAvailability?.ramMb?.fresh">· refresh needed</span></small>
 </article></div></section>`,styles:[`
.placement-board{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:14px;margin-bottom:24px;align-items:start;}.device-lane{background:#edf2f7;border:1px solid #bac8d5;border-radius:16px;overflow:hidden;}.device-lane.unassigned{background:#f7f5fa;border-style:dashed;}.device-lane header{display:flex;gap:10px;align-items:center;padding:16px;border-bottom:1px solid #d7e0e8;}.device-lane h4{margin:0;color:#23384c;font-weight:650;}.device-lane small{display:block;color:#526577;font-size:12px;}.device-symbol{background:#fff;border:1px solid #c6d4df;border-radius:10px;padding:6px 10px;color:#62508a;font-size:22px;}.drop-zone{min-height:150px;padding:10px;transition:background 160ms;}.drop-zone.cdk-drop-list-receiving{outline:2px dashed #8c6bbc;outline-offset:-5px;}.drop-zone.cdk-drop-list-dragging{background:#e2d7f5;}.placement-card{display:flex;align-items:center;gap:4px;background:#fff;border:1px solid #d2dce5;border-left:4px solid #8861b6;border-radius:10px;margin-bottom:9px;box-shadow:0 2px 4px #2030400a;}.placement-card.existing{border-left-color:#3a8990;}.grip,.card-menu{border:0;background:transparent;color:#697b8c;font-size:23px;padding:9px 4px;}.grip{cursor:grab;touch-action:none;}.grip:active{cursor:grabbing;}.card-menu{cursor:pointer;}.card-details{flex:1;min-width:0;text-align:left;background:none;border:0;cursor:pointer;color:#20384b;padding:12px 2px;}.card-details strong{display:block;font-size:13px;line-height:1.4;overflow-wrap:anywhere;}.card-details span,.card-details small{display:block;font-size:11px;margin-top:5px;color:#5b7183;}.card-placeholder{min-height:82px;border:2px dashed #7951a7;border-radius:10px;background:#eee5fa;display:grid;place-items:center;color:#64418e;font-size:12px;margin-bottom:9px;}.drag-preview{box-sizing:border-box;display:flex;gap:10px;align-items:center;background:#fff;border:2px solid #8054ac;border-radius:12px;padding:15px;color:#20384b;box-shadow:0 16px 32px #25334f55;max-width:310px;transform:rotate(2deg);}.drag-preview small{display:block;margin-top:6px;}.drag-preview>span{font-size:26px;color:#8054ac;}.cdk-drag-animating{transition:transform 180ms cubic-bezier(.2,.8,.2,1);}.empty-lane{font-size:13px;text-align:center;padding:22px 8px;color:#63778b;} svg{width:100%;display:block;}
.utilization{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr));gap:1rem;margin-bottom:1rem;}.utilization article{border:1px solid #8796a6;border-radius:10px;padding:.8rem;min-width:0;}.utilization small{display:block;margin:.3rem 0 .8rem;}.utilization strong{font-size:.85rem;}
`]})
export class IslePlannedTopologyComponent {
 @Input() items:any[]=[];@Input() devices:any[]=[];@Output() choose=new EventEmitter<any>();@Output() menu=new EventEmitter<any>();@Output() moved=new EventEmitter<any>();
 dragging=false;
 identify(_index:number,item:any){return item.id;}
 drop(event:CdkDragDrop<string>){if(event.previousContainer!==event.container)this.moved.emit({item:event.item.data,device:event.container.data});}
 context(event:MouseEvent,item:any){event.preventDefault();this.menu.emit({item,x:event.clientX,y:event.clientY});}
 metrics=[{key:'ramMiB',report:'ramMb',label:'RAM',unit:'MiB'},{key:'diskMiB',report:'diskMb',label:'Storage',unit:'MiB'},{key:'cpus',report:'threads',label:'CPU',unit:'threads'}];
 get names(){return [...new Set<string>(['',...(this.items.some(i=>i.state==='deferred')?[':deferred']:[]),...this.devices.map(d=>d.device),...this.items.filter(i=>i.state!=='deferred').map(i=>i.device)])];}
 on(name:string){return this.items.filter(i=>name===':deferred'?i.state==='deferred':i.device===name&&i.state!=='deferred');}
 get width(){return Math.max(540,this.names.length*270);}
 get height(){return 95+Math.max(1,...this.names.map(n=>this.on(n).length))*70;}
 sum(name:string,key:string){return this.on(name).reduce((s,i)=>s+(typeof i[key]==='number'?i[key]:0),0);}
 missing(name:string,key:string){return this.on(name).filter(i=>typeof i[key]!=='number'||!i.requirementsBased).length;}
 capacity(d:any,key:string){return d.reportedAvailability?.[key]?.value;}
 bar(value:number,capacity:number){return capacity>0?scaleLinear().domain([0,capacity]).range([0,476]).clamp(true)(value):0;}
}
