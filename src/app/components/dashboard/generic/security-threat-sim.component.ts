import { CommonModule } from '@angular/common';
import { Component, Input, OnChanges, OnDestroy, OnInit, SimpleChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

import { PolariService } from '@services/polari-service';

/**
 * security-threat-sim — the threat analysis simulation ON the security
 * topology (his ask 2026-09-12). GETs /api/security/threats for a scenario
 * and a mode, lists the threats, and for the selected one animates a red
 * token from the actor through each boundary (the systems consulted, in
 * order, each labelled with its provenance: stock docker / qemu / Polari)
 * until a policy blocks it — the block is drawn and the policy line shown —
 * or it reaches the target. Beneath it, in green, the COUNTEREXAMPLE: the
 * actor / group / permission that legitimately reaches the same target,
 * through the intended means, and the chain that lets it. The mode selector
 * replays the same threat under stock docker, today, a warn-only apply, or
 * every Polari ring enforced. Honours prefers-reduced-motion (final frame).
 */
interface Hop { node: string; kind: string; title?: string; provenance?: string; decision: string; note?: string; }
interface Path { actor: string; means: string; target: string; verdict: string; path: Hop[]; stops_at: number | null; }
interface Threat extends Path {
  name: string; view: string; title: string; story: string; blocked_by: string; policy: string; why: string;
  counter: Path & { group: string; story: string; note: string };
}

@Component({
  standalone: true,
  selector: 'security-threat-sim',
  imports: [CommonModule, FormsModule],
  template: `
    <div class="sts">
      <div class="sts-bar">
        <label>Threat
          <select [(ngModel)]="selectedName" (ngModelChange)="select($event)">
            <option *ngFor="let t of threats" [value]="t.name">{{ t.view }} · {{ t.title }}</option>
          </select>
        </label>
        <label>Mode
          <select [(ngModel)]="modeSel" (ngModelChange)="load()">
            <option value="stock">stock docker / qemu only</option>
            <option value="today">as applied today</option>
            <option value="complain">warn-only apply everywhere</option>
            <option value="enforce">every Polari ring enforced</option>
          </select>
        </label>
        <button type="button" (click)="play()" [disabled]="!threat">Replay</button>
        <span class="sts-reading" *ngIf="reading">{{ reading }}</span>
      </div>
      <div class="sts-error" *ngIf="error">{{ error }}</div>
      <div class="sts-story" *ngIf="threat">
        <strong>{{ threat.title }}</strong> — {{ threat.story }}
      </div>
      <svg *ngIf="threat" [attr.viewBox]="'0 0 ' + W + ' ' + H" class="sts-svg" role="img" [attr.aria-label]="threat.title">
        <ng-container *ngFor="let lane of lanes; let li = index">
          <text [attr.x]="16" [attr.y]="lane.y - 46" class="lane-label" [class.threat]="li === 0" [class.counter]="li === 1">{{ lane.label }}</text>
          <line [attr.x1]="lane.x0" [attr.x2]="lane.x1" [attr.y1]="lane.y" [attr.y2]="lane.y" class="rail"></line>
          <g *ngFor="let h of lane.hops; let i = index">
            <rect [attr.x]="h.x - 58" [attr.y]="lane.y - 22" width="116" height="44" rx="4"
                  [class]="'node ' + h.kind + ' ' + (h.provenance || '') + (h.reached ? ' reached' : '') + (h.decision ? ' ' + h.decision : '')"></rect>
            <text [attr.x]="h.x" [attr.y]="lane.y - 4" class="node-title">{{ h.label }}</text>
            <text [attr.x]="h.x" [attr.y]="lane.y + 12" class="node-sub">{{ h.sub }}</text>
            <text *ngIf="h.reached && h.decision" [attr.x]="h.x" [attr.y]="lane.y + 40" class="decision" [class.blocked]="h.decision === 'blocked'" [class.logged]="h.decision === 'logged'">{{ h.decision }}</text>
            <g *ngIf="h.reached && h.decision === 'blocked'">
              <line [attr.x1]="h.x - 14" [attr.x2]="h.x + 14" [attr.y1]="lane.y - 14" [attr.y2]="lane.y + 14" class="x"></line>
              <line [attr.x1]="h.x - 14" [attr.x2]="h.x + 14" [attr.y1]="lane.y + 14" [attr.y2]="lane.y - 14" class="x"></line>
            </g>
          </g>
          <circle [attr.cx]="lane.tokenX" [attr.cy]="lane.y" r="9" [class]="'token ' + (li === 0 ? 'threat' : 'counter') + (lane.done ? ' done' : '')"></circle>
        </ng-container>
      </svg>
      <div class="sts-notes" *ngIf="threat">
        <div class="note threat">
          <span class="tag">threat · {{ threat.verdict }}</span>
          <span *ngIf="threat.verdict === 'blocked'">blocked by <strong>{{ threat.blocked_by }}</strong>: {{ threat.policy }}</span>
          <span *ngIf="threat.verdict === 'logged'">not denied — <strong>logged</strong> (warn-only): this is what enforcing would stop.</span>
          <span *ngIf="threat.verdict === 'allowed'">gets through: {{ threat.why }}</span>
        </div>
        <div class="note counter">
          <span class="tag">counterexample · {{ threat.counter.verdict }}</span>
          <strong>{{ threat.counter.group }}</strong> — {{ threat.counter.means }}. {{ threat.counter.story }}
          <em *ngIf="threat.counter.note"> {{ threat.counter.note }}.</em>
        </div>
        <div class="legend"><span class="sw stock"></span> stock docker / the kernel <span class="sw qemu"></span> qemu / libvirt <span class="sw polari"></span> Polari renders it</div>
      </div>
    </div>
  `,
  styles: [`
    .sts { font-size: 13px; }
    .sts-bar { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; margin-bottom: 8px; }
    .sts-bar label { display: flex; gap: 6px; align-items: center; }
    .sts-bar select { max-width: 420px; }
    .sts-reading { opacity: .8; }
    .sts-error { color: #b23a3a; }
    .sts-story { margin: 4px 0 8px; }
    .sts-svg { width: 100%; height: auto; display: block; }
    .lane-label { font-size: 12px; font-weight: 600; fill: currentColor; }
    .lane-label.threat { fill: #b23a3a; } .lane-label.counter { fill: #2e7d4f; }
    .rail { stroke: currentColor; stroke-opacity: .25; stroke-width: 2; }
    .node { fill: rgba(127,127,127,.10); stroke: currentColor; stroke-opacity: .35; }
    .node.actor { stroke-opacity: .7; } .node.target { stroke-opacity: .7; stroke-dasharray: 4 3; }
    .node.boundary.stock { stroke: #5a6b7c; } .node.boundary.qemu { stroke: #7a5aa8; } .node.boundary.polari { stroke: #b8730a; }
    .node.reached.blocked { fill: rgba(178,58,58,.18); } .node.reached.logged { fill: rgba(184,115,10,.18); } .node.reached.allowed { fill: rgba(46,125,79,.14); }
    .node-title { font-size: 11px; text-anchor: middle; fill: currentColor; font-weight: 600; }
    .node-sub { font-size: 9.5px; text-anchor: middle; fill: currentColor; opacity: .75; }
    .decision { font-size: 10px; text-anchor: middle; fill: #2e7d4f; text-transform: uppercase; letter-spacing: .06em; }
    .decision.blocked { fill: #b23a3a; } .decision.logged { fill: #b8730a; }
    .x { stroke: #b23a3a; stroke-width: 3; }
    .token { transition: cx .9s ease-in-out; }
    .token.threat { fill: #b23a3a; } .token.counter { fill: #2e7d4f; } .token.done { opacity: .9; }
    @media (prefers-reduced-motion: reduce) { .token { transition: none; } }
    .sts-notes { display: grid; gap: 6px; margin-top: 6px; }
    .note { padding: 6px 10px; border-left: 3px solid; }
    .note.threat { border-color: #b23a3a; } .note.counter { border-color: #2e7d4f; }
    .tag { font-size: 10px; text-transform: uppercase; letter-spacing: .08em; margin-right: 8px; opacity: .8; }
    .legend { font-size: 11px; opacity: .8; display: flex; gap: 10px; align-items: center; }
    .sw { display: inline-block; width: 22px; height: 3px; } .sw.stock { background: #5a6b7c; } .sw.qemu { background: #7a5aa8; } .sw.polari { background: #b8730a; }
  `],
})
export class SecurityThreatSimComponent implements OnInit, OnChanges, OnDestroy {
  @Input() path = '/api/security/threats';
  @Input() scenario = '';
  @Input() mode = 'today';

  threats: Threat[] = [];
  threat: Threat | null = null;
  selectedName = '';
  modeSel = 'today';
  reading = '';
  error = '';
  W = 960; H = 330;
  lanes: Array<{ label: string; y: number; x0: number; x1: number; hops: any[]; tokenX: number; done: boolean }> = [];
  private timers: any[] = [];

  constructor(private http: HttpClient, private polariService: PolariService) {}

  ngOnInit(): void { this.modeSel = this.mode || 'today'; this.load(); }
  ngOnChanges(ch: SimpleChanges): void { if (ch['scenario'] || ch['path'] || ch['mode']) { this.modeSel = this.mode || this.modeSel; this.load(); } }
  ngOnDestroy(): void { this.clearTimers(); }

  load(): void {
    this.error = '';
    const q = [this.scenario ? `scenario=${encodeURIComponent(this.scenario)}` : '', `mode=${encodeURIComponent(this.modeSel)}`].filter(Boolean).join('&');
    const url = this.polariService.getBackendBaseUrl() + this.path + (q ? '?' + q : '');
    this.http.get<any>(url, this.polariService.backendRequestOptions).subscribe({
      next: (body: any) => {
        if (!body || body.ok === false) { this.error = (body && body.error) || `GET ${this.path}: empty response`; return; }
        this.threats = body.threats || [];
        this.reading = body.reading || '';
        const keep = this.threats.find(t => t.name === this.selectedName) || this.threats[0] || null;
        this.selectedName = keep ? keep.name : '';
        this.threat = keep;
        this.play();
      },
      error: (err: any) => { this.error = `GET ${this.path} failed: ${err?.status || ''} ${err?.message || ''}`.trim(); },
    });
  }

  select(name: string): void { this.threat = this.threats.find(t => t.name === name) || null; this.play(); }

  private layout(p: Path, label: string, y: number) {
    const hops = p.path;
    const x0 = 100, x1 = this.W - 100;
    const step = hops.length > 1 ? (x1 - x0) / (hops.length - 1) : 0;
    return {
      label, y, x0, x1, tokenX: x0, done: false,
      hops: hops.map((h, i) => ({
        ...h, x: x0 + i * step, reached: false,
        label: (h.kind === 'boundary' ? (h.title || h.node) : h.node).slice(0, 22),
        sub: h.kind === 'boundary' ? (h.provenance || '') : (h.kind === 'actor' ? (label === 'threat' ? 'the attacker' : 'legitimate') : 'target'),
      })),
    };
  }

  play(): void {
    this.clearTimers();
    if (!this.threat) { this.lanes = []; return; }
    const t = this.threat;
    this.lanes = [this.layout(t, 'threat', 110), this.layout(t.counter, 'counterexample', 250)];
    const reduced = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.lanes.forEach((lane, li) => {
      const stop = li === 0 ? t.stops_at : t.counter.stops_at;
      const last = stop === null || stop === undefined ? lane.hops.length - 1 : stop;
      const advance = (i: number) => {
        lane.hops[i].reached = true; lane.tokenX = lane.hops[i].x;
        if (i >= last) { lane.done = true; return; }
        this.timers.push(setTimeout(() => advance(i + 1), reduced ? 0 : 1000));
      };
      this.timers.push(setTimeout(() => advance(0), reduced ? 0 : 300 + li * 1500));
    });
  }

  private clearTimers(): void { this.timers.forEach(clearTimeout); this.timers = []; }
}
