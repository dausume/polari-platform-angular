import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { PsppService } from '@services/pspp/pspp.service';

interface NetNode {
  id: string; kind: string; label: string; x: number; y: number;
  stage?: string; stageIndex?: number; hypothesisStatus?: string;
  siteConstraint?: string; kineticsStatus?: string;
  topologyChange?: string; source?: string; competingWith?: string[];
  family?: string; speciesKind?: string; formula?: string;
  notes?: string; qn?: number;
}

/**
 * The reaction network drawn from ReactionRule/ChemicalSpecies rows:
 * rules sit in columns by reusable stage (activation → dissolution →
 * ortho-sialate generation → branch selection → framework growth),
 * species between them. Styling IS evidence: solid border =
 * book-supported, dashed = mechanistic proposal, red = contested;
 * ▲ surface-only / ▼ interior-only marks Fig 8.21 transport
 * selection. Click anything for its citation and topology change —
 * scientists add rules as rows and they appear here.
 */
@Component({
  selector: 'pspp-network',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
  <div class="net-page">
    <h2>PSPP — Reaction network</h2>
    <p class="hint">Rules are DATA (competing hypotheses, cited,
      kinetics-free until calibrated). Solid = book-supported ·
      dashed = proposal · ▲ surface-only · ▼ interior-only.</p>
    <div class="wrap">
      <svg [attr.viewBox]="viewBox" class="net-svg">
        <g *ngFor="let s of stageLabels">
          <text [attr.x]="s.x" y="16" class="stage">{{ s.label }}</text>
        </g>
        <path *ngFor="let e of paths" [attr.d]="e.d"
              [class.product]="e.role === 'product'" class="edge"/>
        <g *ngFor="let n of nodes" (click)="selected = n"
           class="node" [attr.transform]="'translate('+n.x+','+n.y+')'">
          <circle *ngIf="n.kind === 'species'" r="9"
                  [attr.class]="'sp sp-' + n.speciesKind"/>
          <rect *ngIf="n.kind === 'rule'" x="-11" y="-11" width="22"
                height="22" rx="4"
                [attr.class]="'rule hyp-' + n.hypothesisStatus"/>
          <text *ngIf="n.kind === 'rule' && n.siteConstraint"
                class="site" y="-14">
            {{ n.siteConstraint === 'surface-only' ? '▲' : '▼' }}</text>
          <text class="lbl" y="22">{{ n.label }}</text>
        </g>
      </svg>
    </div>
    <div *ngIf="selected" class="panel">
      <div class="p-title">{{ selected.label }}
        <span class="p-kind">({{ selected.kind }})</span></div>
      <div *ngIf="selected.kind === 'rule'">
        <div><b>Stage:</b> {{ selected.stage }} ·
          <b>Status:</b> {{ selected.hypothesisStatus }} ·
          <b>Kinetics:</b> {{ selected.kineticsStatus }}
          (rate queries refuse until a cited calibration loads)</div>
        <div *ngIf="selected.siteConstraint"><b>Transport:</b>
          {{ selected.siteConstraint }} (Fig 8.21 selection)</div>
        <div *ngIf="selected.competingWith?.length">
          <b>Competes with:</b> {{ selected.competingWith }}</div>
        <div class="p-topo">{{ selected.topologyChange }}</div>
        <div class="p-src">{{ selected.source }}</div>
        <a class="edit" routerLink="/class-main-page/ReactionRule">
          edit ReactionRule rows (auto-CRUDE) — the graph re-derives
          from rows</a>
      </div>
      <div *ngIf="selected.kind === 'species'">
        <div><b>{{ selected.formula || selected.id }}</b>
          · {{ selected.speciesKind }}</div>
        <div class="p-topo">{{ selected.notes }}</div>
        <a class="edit" routerLink="/class-main-page/ChemicalSpecies">
          edit ChemicalSpecies rows (auto-CRUDE)</a>
      </div>
    </div>
  </div>`,
  styles: [`
    :host { display: block; color: var(--text-on-bg); }
    .card, .panel, .section, .form, .pspp-chart-card, .home a.card { color: var(--text-on-card); }
    .net-page { padding: 12px; }
    .hint { font-size: 12px; color: var(--text-on-bg-muted); }
    .wrap { overflow: auto; border: 1px solid var(--border-light);
      border-radius: 8px; background: var(--surface-primary); }
    .net-svg { min-width: 1200px; }
    .stage { font-size: 11px; fill: var(--chart-text); font-weight: 600; }
    .edge { fill: none; stroke: #b8b09d; stroke-width: 1.1; }
    .edge.product { stroke: #7c9a6d; stroke-width: 1.5; }
    .node { cursor: pointer; }
    .sp { fill: #e8e2d2; stroke: #8a8272; }
    .sp-ion { fill: #dbe9f6; stroke: #5b82a6; }
    .sp-motif { fill: #efe3c8; stroke: #a98f4f; }
    .sp-framework { fill: #dcebd8; stroke: #5d8352; }
    .rule { fill: #fff; stroke-width: 1.6; }
    .hyp-book-supported { stroke: #4a6b8a; }
    .hyp-mechanistic-proposal { stroke: #4a6b8a;
      stroke-dasharray: 4 3; }
    .hyp-contested { stroke: #b0523f; stroke-dasharray: 2 2; }
    .site { font-size: 9px; text-anchor: middle; fill: #7a5c30; }
    .lbl { font-size: 8.5px; text-anchor: middle; fill: #4b4639; }
    .panel { border: 1px solid var(--border-light); border-radius: 8px;
      padding: 10px; margin-top: 8px; font-size: 12px;
      background: var(--surface-primary); }
    .p-title { font-weight: 600; }
    .p-kind { color: var(--text-tertiary); font-weight: 400; }
    .p-topo { margin-top: 4px; }
    .p-src { margin-top: 4px; font-size: 11px; color: var(--text-secondary); }
  `],
})
export class PsppNetworkComponent implements OnInit {
  nodes: NetNode[] = [];
  paths: { d: string; role: string }[] = [];
  stageLabels: { x: number; label: string }[] = [];
  viewBox = '0 0 1200 600';
  selected: NetNode | null = null;

  constructor(private pspp: PsppService) {}

  async ngOnInit(): Promise<void> {
    const net = await this.pspp.network();
    if (!net?.ok) { return; }
    this.layout(net);
  }

  private layout(net: any): void {
    const colWidth = 200;
    const rowHeight = 64;
    const rules = net.nodes.filter((n: any) => n.kind === 'rule');
    const species = net.nodes.filter((n: any) => n.kind === 'species');
    const stageX = (i: number) => 140 + i * 2 * colWidth;
    this.stageLabels = net.stages.map((label: string, i: number) =>
      ({ x: stageX(i) - 60, label }));

    const perCol: Record<number, number> = {};
    for (const r of rules) {
      const col = r.stageIndex >= 0 ? r.stageIndex : 0;
      perCol[col] = (perCol[col] ?? 0) + 1;
      r.x = stageX(col);
      r.y = 40 + perCol[col] * rowHeight;
    }
    const adjacency: Record<string, number[]> = {};
    for (const e of net.edges) {
      const rule = rules.find((r: any) =>
        r.id === e.from || r.id === e.to);
      const sp = e.from === rule?.id ? e.to : e.from;
      if (rule) {
        (adjacency[sp] = adjacency[sp] ?? []).push(
          rule.x + (e.role === 'reactant' ? -colWidth : colWidth));
      }
    }
    const speciesPerX: Record<number, number> = {};
    for (const s of species) {
      const xs = adjacency[s.id];
      s.x = xs?.length
        ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length / 20) * 20
        : 40;
      speciesPerX[s.x] = (speciesPerX[s.x] ?? 0) + 1;
      s.y = 30 + speciesPerX[s.x] * (rowHeight * 0.72);
    }
    this.nodes = [...species, ...rules];
    const byId: Record<string, NetNode> = {};
    for (const n of this.nodes) { byId[n.id] = n; }
    this.paths = net.edges
      .filter((e: any) => byId[e.from] && byId[e.to])
      .map((e: any) => {
        const a = byId[e.from]; const b = byId[e.to];
        const mx = (a.x + b.x) / 2;
        return { role: e.role,
          d: `M${a.x},${a.y} C${mx},${a.y} ${mx},${b.y} ${b.x},${b.y}` };
      });
    const maxY = Math.max(...this.nodes.map((n) => n.y)) + 60;
    const maxX = Math.max(...this.nodes.map((n) => n.x)) + 160;
    this.viewBox = `0 0 ${maxX} ${maxY}`;
  }
}
