import { Component, Input, OnChanges, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PsppService } from '@services/pspp/pspp.service';

/**
 * MaterialState DAG viewer (pspp-V3): one material's durable-state
 * history as a graph — implicit canonical included, virtual states
 * dashed (real as subjects, row-less until written), plus the
 * pspp-11 wax feedstock routes derived live from feedstock rows.
 * Usable routed (/pspp/states) or mounted with [material] on any
 * display page (e.g. beside material-detail).
 */
@Component({
  selector: 'pspp-state-dag',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
  <div class="wrap">
    <h2 *ngIf="!embedded">Material state DAG</h2>
    <div class="controls" *ngIf="!embedded">
      <label>material
        <input [(ngModel)]="material" (change)="load()"
               placeholder="e.g. beeswax"></label>
      <label>wax feedstock route
        <select [(ngModel)]="waxRoute" (change)="applyWaxRoute()">
          <option value="">(none — material's own rows)</option>
          <option *ngFor="let r of waxRoutes" [value]="r.feedstock">
            {{ r.feedstock }} ({{ r.material }})</option>
        </select></label>
    </div>
    <svg *ngIf="nodes.length" [attr.viewBox]="viewBox"
         preserveAspectRatio="xMinYMin meet">
      <g *ngFor="let e of edgeLines">
        <path [attr.d]="e.d" class="edge"></path>
      </g>
      <g *ngFor="let n of nodes"
         [attr.transform]="'translate(' + n.x + ',' + n.y + ')'"
         (click)="selected = n">
        <rect rx="8" [attr.width]="nodeW" [attr.height]="nodeH"
              [class.canonical]="n.isCanonical"
              [class.virtual]="n.virtual"
              [class.selected]="n === selected"></rect>
        <text x="8" y="16" class="name">{{ n.stateName }}</text>
        <text x="8" y="30" class="stage">{{ n.processingStage
          || '(unstaged)' }}</text>
        <text x="8" y="42" class="badge" *ngIf="n.isCanonical">
          canonical</text>
        <text x="8" y="42" class="badge" *ngIf="n.virtual
          && !n.isCanonical">virtual</text>
      </g>
    </svg>
    <div class="empty" *ngIf="!nodes.length && payload">
      no states — {{ payload.refusal || 'unknown material' }}
    </div>
    <div class="detail" *ngIf="selected">
      <b>{{ selected.stateKey }}</b>
      <div>stage: {{ selected.processingStage || '—' }} · phase:
        {{ selected.thermodynamicPhase || '—' }} · validation:
        {{ selected.validationStatus }}</div>
      <div *ngIf="selected.environmentalSnapshot">env:
        {{ selected.environmentalSnapshot | json }}</div>
      <div *ngIf="selected.producingExecution">produced by:
        {{ selected.producingExecution }}</div>
      <div class="note" *ngIf="selected.note">{{ selected.note }}</div>
      <div class="note" *ngIf="selected.virtual">Virtual state —
        real as a subject, row-less until something writes to it
        (absence is honest data).</div>
    </div>
  </div>`,
  styles: [`
    .wrap { max-width: 860px; margin: 0 auto; padding: 12px;
      font-size: 12px; }
    .controls { display: flex; gap: 12px; margin-bottom: 8px;
      font-size: 11px; }
    .controls label { display: flex; flex-direction: column;
      gap: 2px; }
    svg { width: 100%; border: 1px solid #e6e0d1; border-radius: 8px;
      background: #fffdf7; }
    rect { fill: #fff; stroke: #8a8069; stroke-width: 1.2;
      cursor: pointer; }
    rect.canonical { stroke: #4c5b8f; stroke-width: 2; }
    rect.virtual { stroke-dasharray: 5 3; fill: #fbfaf4; }
    rect.selected { fill: #eef2ff; }
    .name { font-size: 11px; font-weight: 600; }
    .stage { font-size: 9px; fill: #6b6455; }
    .badge { font-size: 8px; fill: #4c5b8f; }
    .edge { fill: none; stroke: #b4ab97; stroke-width: 1.2;
      marker-end: none; }
    .detail { border: 1px solid #d7d2c4; border-radius: 8px;
      margin-top: 8px; padding: 8px; background: #fffdf7;
      font-size: 11px; }
    .note { color: #6b6455; font-size: 10px; margin-top: 4px; }
    .empty { color: #6b6455; padding: 12px; }
  `],
})
export class PsppStateDagComponent implements OnInit, OnChanges {
  @Input() material = '';
  @Input() embedded = false;

  payload: any = null;
  nodes: any[] = [];
  edgeLines: { d: string }[] = [];
  selected: any = null;
  waxRoutes: any[] = [];
  waxRoute = '';
  nodeW = 170;
  nodeH = 48;
  viewBox = '0 0 800 200';

  constructor(private pspp: PsppService) {}

  async ngOnInit(): Promise<void> {
    const wax = await this.pspp.waxStates();
    this.waxRoutes = wax?.routes ?? [];
    if (this.material) { await this.load(); }
  }

  async ngOnChanges(): Promise<void> {
    if (this.material) { await this.load(); }
  }

  async load(): Promise<void> {
    this.waxRoute = '';
    this.selected = null;
    this.payload = await this.pspp.states(this.material);
    this.layout(this.payload?.states ?? [],
                this.payload?.edges ?? []);
  }

  /** Show a pspp-11 wax feedstock route (virtual states derived
   *  live from the feedstock row). */
  applyWaxRoute(): void {
    const route = this.waxRoutes
      .find((r) => r.feedstock === this.waxRoute);
    if (!route) { return; }
    this.selected = null;
    this.material = route.material;
    const edges = route.states.flatMap((s: any) =>
      s.parents.map((p: string) => ({ from: p, to: s.stateKey })));
    this.layout(route.states, edges);
  }

  /** Depth-column layout: roots left, children one column right. */
  private layout(states: any[], edges: any[]): void {
    const depth = new Map<string, number>();
    const parentsOf = (s: any) => (s.parents ?? []) as string[];
    const byKey = new Map(states.map((s) => [s.stateKey, s]));
    const resolve = (key: string, seen: Set<string>): number => {
      if (depth.has(key)) { return depth.get(key)!; }
      if (seen.has(key)) { return 0; }
      seen.add(key);
      const s = byKey.get(key);
      const parents = s ? parentsOf(s)
        .filter((p) => byKey.has(p)) : [];
      const d = parents.length
        ? Math.max(...parents.map((p) => resolve(p, seen))) + 1 : 0;
      depth.set(key, d);
      return d;
    };
    states.forEach((s) => resolve(s.stateKey, new Set()));
    const columns = new Map<number, number>();
    this.nodes = states.map((s) => {
      const d = depth.get(s.stateKey) ?? 0;
      const row = columns.get(d) ?? 0;
      columns.set(d, row + 1);
      return { ...s, x: 20 + d * (this.nodeW + 40),
               y: 20 + row * (this.nodeH + 18) };
    });
    const at = new Map(this.nodes.map((n) => [n.stateKey, n]));
    this.edgeLines = edges
      .filter((e) => at.has(e.from) && at.has(e.to))
      .map((e) => {
        const a = at.get(e.from)!;
        const b = at.get(e.to)!;
        const x1 = a.x + this.nodeW; const y1 = a.y + this.nodeH / 2;
        const x2 = b.x; const y2 = b.y + this.nodeH / 2;
        const mx = (x1 + x2) / 2;
        return { d: `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, `
                    + `${x2} ${y2}` };
      });
    const maxX = Math.max(0, ...this.nodes.map((n) => n.x))
      + this.nodeW + 20;
    const maxY = Math.max(0, ...this.nodes.map((n) => n.y))
      + this.nodeH + 20;
    this.viewBox = `0 0 ${Math.max(400, maxX)} ${Math.max(120, maxY)}`;
  }
}
