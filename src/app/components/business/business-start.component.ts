import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { BizopsService } from '@services/bizops.service';

/**
 * biz-3 visual: /business/start — the guided walkthrough for a
 * brand-new business maker (stages 0-1 only), with the cited
 * shopping list, the live speculative-batch card, risk callouts
 * colored by severity, the earned readiness ladder, the local-
 * economy track, and the partnerships board with mined
 * suggestions. Every refusal renders as a sentence.
 */
@Component({
  standalone: true,
  selector: 'business-start',
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
  <div class="start">
    <h2>Start a business — the walked route</h2>
    <p class="hint">Stages 0–1 only for now. One person, off-time,
      buying what is available, selling at markets and online —
      every number below is cited or honestly flagged, every risk
      stated before it bites.</p>

    <div class="controls">
      <label>batch budget $
        <input type="number" [(ngModel)]="budget" min="20"
               step="20" (change)="load()"></label>
      <span class="muted" *ngIf="wt?.ok">
        plan for <b>{{ wt.business }}</b></span>
    </div>

    <div class="err" *ngIf="wt && !wt.ok">{{ wt.refusal }}</div>

    <div class="steps" *ngIf="wt?.ok">
      <div class="step" *ngFor="let st of wt.steps">
        <div class="step-head" (click)="toggle(st.step)">
          <span class="num">{{ st.order }}</span>
          <b>{{ st.title }}</b>
          <span class="chev">{{ open[st.step] ? '▾' : '▸' }}</span>
        </div>
        <div class="step-body" *ngIf="open[st.step]">
          <p>{{ st.what }}</p>
          <p class="why"><b>why:</b> {{ st.why }}</p>
          <p class="cost"><b>cost:</b> {{ st.cost }}</p>

          <table class="rows" *ngIf="st.shoppingList?.length">
            <tr class="head"><td>material</td><td>buy from</td>
              <td class="num">$/kg</td><td>citation</td></tr>
            <tr *ngFor="let i of st.shoppingList">
              <td>{{ i.item }}</td><td>{{ i.buyFrom }}</td>
              <td class="num">{{ i.usdPerKg | number:'1.2-2' }}
                <span *ngIf="i.estimateFlagged" class="muted"
                  title="estimate-flagged citation">~</span></td>
              <td class="muted">{{ i.citation }}</td>
            </tr>
          </table>

          <div class="batch" *ngIf="st.batchPlan?.ok">
            <div class="batch-row"
                 *ngFor="let b of st.batchPlan.batch">
              <b>{{ b.variant }}</b>
              <ng-container *ngIf="b.units > 0">
                × {{ b.units }} ({{ b.molds }} mold{{ b.molds > 1 ?
                's' : '' }}) — materials
                {{ b.materialCost | number:'1.2-2' }}$,
                {{ b.laborHours }}h, sell at
                {{ b.marketPriceEach | number:'1.2-2' }}$ each
                <span class="muted">(margin if ALL sells:
                  {{ b.marginIfAllSells | number:'1.0-0' }}$)</span>
              </ng-container>
              <span class="muted" *ngIf="b.units === 0">
                — {{ b.refusal }}</span>
            </div>
            <div class="muted">{{ st.batchPlan.learning }}</div>
          </div>

          <div class="ladder" *ngIf="st.readiness?.ok">
            <div *ngFor="let v of st.readiness.variants"
                 class="rung" [attr.class]="'rung lv-' + v.level">
              <b>{{ v.variant }}</b>
              <span class="chip">{{ v.level }}</span>
              <span class="muted">made {{ v.unitsMade }} · sold
                {{ v.unitsSold }}/{{ v.soldThreshold }} —
                next: {{ v.nextEscalation }}</span>
            </div>
          </div>

          <div class="sellability" *ngIf="st.sellability?.ok">
            <div class="hard-rule">{{ st.sellability.hardRule }}
            </div>
            <div class="ctx" *ngFor="let c of
                 st.sellability.contexts">
              <span class="chip" [class.on]="c.allowed"
                    [class.blocked]="!c.allowed">
                {{ c.allowed ? 'allowed' : 'BLOCKED' }}</span>
              <b>{{ c.context }}</b>
              <div class="blockers" *ngIf="c.blockers?.length">
                <div *ngFor="let b of c.blockers">✗ {{ b }}</div>
              </div>
              <div class="reqs">
                <span *ngFor="let r of c.requirements"
                      class="chip lvl"
                      [class.on]="r.met" [class.blocked]="!r.met"
                      [title]="r.reference">
                  {{ r.displayName }}: {{ r.attainedLevel }}
                  / needs {{ r.requiredLevel }}</span>
              </div>
            </div>
            <div class="muted">{{ st.sellability.disclaimer }}
            </div>
          </div>

          <div class="gate" *ngIf="st.gate">
            <b>the gate:</b> {{ st.gate }}</div>

          <div class="risk" *ngFor="let r of st.risks"
               [attr.class]="'risk sev-' + r.severity">
            <b>{{ r.severity }}:</b> {{ r.risk }}
            <div class="mit">→ {{ r.mitigation }}</div>
          </div>
        </div>
      </div>
    </div>

    <h3>Quality assurance — measured, or honestly not</h3>
    <div class="err" *ngIf="qa && !qa.ok">{{ qa.refusal }}</div>
    <table class="rows" *ngIf="qa?.ok">
      <tr class="head"><td>check</td><td>method</td>
        <td>acceptance</td><td>freq</td><td class="num">runs</td>
        <td class="num">units</td><td class="num">pass</td></tr>
      <tr *ngFor="let c of qa.checks">
        <td><b>{{ c.displayName }}</b></td>
        <td class="muted">{{ c.method }}</td>
        <td class="muted">{{ c.acceptance }}</td>
        <td class="muted">{{ c.frequency }}</td>
        <td class="num">{{ c.runs }}</td>
        <td class="num">{{ c.unitsChecked }}</td>
        <td class="num">
          <b *ngIf="c.passRatePct != null"
             [class.warn-t]="c.passRatePct < 90">
            {{ c.passRatePct }}%</b>
          <span class="muted" *ngIf="c.passRatePct == null">
            unmeasured</span></td>
      </tr>
    </table>
    <div class="muted" *ngIf="qa?.ok">{{ qa.note }}</div>

    <h3>Local economy — the baseline track</h3>
    <div class="err" *ngIf="eco && !eco.ok">{{ eco.refusal }}</div>
    <div *ngIf="eco?.ok">
      <div class="bar"><div class="fill"
        [style.width.%]="eco.progressPct"></div></div>
      <div class="muted">{{ eco.doneCount }}/{{ eco.totalCount }}
        milestones · next gap:
        <b>{{ eco.nextGap?.displayName || 'none — baseline!' }}</b>
      </div>
      <div class="ms" *ngFor="let m of eco.milestones"
           [class.done]="m.done">
        <span class="chip" [class.on]="m.done"
              [class.warn]="!m.done">{{ m.done ? '✓' : '·' }}</span>
        {{ m.displayName }}
        <span class="muted"> — {{ m.evidence }}</span>
      </div>
    </div>

    <h3>Partnerships</h3>
    <div class="err" *ngIf="deals && !deals.ok">
      {{ deals.refusal }}</div>
    <div class="cards" *ngIf="deals?.ok">
      <div class="card" *ngFor="let d of deals.deals">
        <div class="tile-head"><b>{{ d.displayName }}</b>
          <span class="chip">{{ d.status }}</span></div>
        <div class="muted">{{ d.kind }} ·
          {{ d.partyA }}<span class="warn-t"
            *ngIf="!d.partyAResolved"> (to be found)</span>
          ↔ {{ d.partyB }}<span class="warn-t"
            *ngIf="!d.partyBResolved"> (to be found)</span></div>
        <ul class="flows">
          <li *ngFor="let f of d.flows">
            {{ f.from }} → {{ f.to }}: <b>{{ f.item_ref }}</b>
            <span class="muted">({{ f.terms_note }})</span>
            <span class="chip on"
              *ngIf="f.coherentWithSupplies === true"
              title="the supplier's rows really supply this">
              coherent</span>
          </li>
        </ul>
        <div class="muted">{{ d.termsNote }}</div>
        <div class="window" *ngIf="windowFor(d.name) as w">
          <div *ngFor="let f of w.flows" class="win-row">
            <b>{{ f.item }}</b>
            <ng-container *ngIf="f.viable === true">
              window {{ f.floorUsdPerKg | number:'1.2-2' }}–{{
                f.ceilingUsdPerKg | number:'1.2-2' }} $/kg<span
                *ngIf="f.ceilingEstimate" class="muted"
                title="estimate-flagged ceiling">~</span>
              · suggest <b>{{ f.suggestedUsdPerKg |
                number:'1.2-2' }}</b>
              <span class="muted" *ngIf="f.currentTermPrice">
                (terms say {{ f.currentTermPrice |
                  number:'1.2-2' }})</span>
            </ng-container>
            <span class="muted" *ngIf="f.viable === null">
              {{ f.ask || f.note }}</span>
            <span class="warn-t" *ngIf="f.viable === false">
              {{ f.note }}</span>
          </div>
          <div class="muted">discovery is a suggestion — terms
            change only when both parties edit the deal</div>
        </div>
      </div>
    </div>
    <div *ngIf="suggestions?.ok && suggestions.suggestions?.length">
      <h4>Deal shapes nobody has drafted yet</h4>
      <div class="ms" *ngFor="let s of suggestions.suggestions">
        <b>{{ s.partyDemanding }}</b> needs
        <b>{{ s.items.join(', ') }}</b> —
        {{ s.partySupplying }} supplies it.
        <span class="muted">{{ s.action }}</span>
      </div>
    </div>

    <div class="links">
      <a routerLink="/business/odoo">odoo backbone</a> ·
      <a routerLink="/topology">topology</a>
    </div>
  </div>
  `,
  styles: [`
    .start { padding: 16px; color: var(--text-on-bg);
      max-width: 980px; }
    h3 { margin: 22px 0 8px; }
    .hint { color: var(--text-on-bg-muted); font-size: 12px; }
    .controls { display: flex; gap: 12px; align-items: center;
      margin: 10px 0; }
    .controls input { width: 90px; }
    .steps { display: flex; flex-direction: column; gap: 8px; }
    .step { border: 1px solid var(--border-light);
      border-radius: 8px; background: var(--surface-primary);
      color: var(--text-on-card); }
    .step-head { display: flex; align-items: center; gap: 10px;
      padding: 10px 12px; cursor: pointer; }
    .num { display: inline-flex; width: 24px; height: 24px;
      border-radius: 50%; align-items: center;
      justify-content: center; background: #3949ab; color: #fff;
      font-size: 12px; flex: none; }
    .chev { margin-left: auto;
      color: var(--text-on-card-muted); }
    .step-body { padding: 0 14px 12px 46px; font-size: 13px; }
    .why, .cost { color: var(--text-on-card-muted);
      font-size: 12px; margin: 4px 0; }
    .rows { border-collapse: collapse; font-size: 12px;
      width: 100%; margin: 8px 0; }
    .rows td { border-bottom: 1px solid var(--border-light);
      padding: 3px 8px 3px 0; }
    .rows .head td { color: var(--text-on-card-muted);
      font-size: 11px; }
    .num.rows td, td.num { text-align: right; }
    .batch { margin: 8px 0; font-size: 12px; display: flex;
      flex-direction: column; gap: 4px; }
    .ladder { margin: 8px 0; display: flex;
      flex-direction: column; gap: 4px; font-size: 12px; }
    .rung { padding: 4px 8px; border-left: 4px solid
      var(--border-light); }
    .lv-advance-orderable { border-left-color: #2e7d32; }
    .lv-market-proven { border-left-color: #558b2f; }
    .lv-produced { border-left-color: #f9a825; }
    .sellability { margin: 8px 0; font-size: 12px; padding: 8px;
      border: 1px solid var(--border-light); border-radius: 6px; }
    .hard-rule { font-weight: 600; color: #c62828;
      margin-bottom: 6px; }
    .ctx { padding: 4px 0; border-top: 1px solid
      var(--border-light); }
    .blockers { color: #ef6c00; font-size: 11px; margin: 2px 0; }
    .reqs { display: flex; flex-wrap: wrap; gap: 4px;
      margin-top: 3px; }
    .chip.lvl { font-size: 10px; }
    .chip.blocked { background: #c6282811;
      border-color: #c62828; }
    .gate { font-size: 12px; padding: 8px; margin: 8px 0;
      border-left: 4px solid #3949ab;
      background: var(--surface-app-background); }
    .risk { font-size: 12px; padding: 6px 10px; margin: 6px 0;
      border-radius: 6px; border: 1px solid var(--border-light);
      border-left-width: 4px; }
    .sev-safety-critical { border-left-color: #c62828;
      background: #c6282811; }
    .sev-high { border-left-color: #ef6c00;
      background: #ef6c0011; }
    .sev-medium { border-left-color: #f9a825; }
    .sev-low { border-left-color: var(--border-light); }
    .mit { color: var(--text-on-card-muted); margin-top: 2px; }
    .bar { height: 10px; border-radius: 5px;
      border: 1px solid var(--border-light); margin: 6px 0;
      overflow: hidden; }
    .fill { height: 100%; background: #2e7d32;
      transition: width .4s; }
    .ms { font-size: 12px; padding: 3px 0; }
    .ms.done { opacity: .85; }
    .chip { font-size: 11px; border-radius: 10px;
      padding: 1px 8px; border: 1px solid var(--border-light); }
    .chip.on { background: #2e7d3222; border-color: #2e7d32; }
    .chip.warn { opacity: .7; }
    .cards { display: flex; flex-direction: column; gap: 10px; }
    .card { border: 1px solid var(--border-light);
      border-radius: 8px; padding: 10px 12px;
      background: var(--surface-primary);
      color: var(--text-on-card); }
    .tile-head { display: flex; justify-content: space-between;
      align-items: center; }
    .flows { font-size: 12px; margin: 6px 0;
      padding-left: 18px; }
    .warn-t { color: #ef6c00; font-size: 11px; }
    .window { margin-top: 6px; font-size: 12px; padding: 6px 8px;
      border-left: 4px solid #558b2f;
      background: var(--surface-app-background); }
    .win-row { padding: 2px 0; }
    .err { color: #c62828; font-size: 12px; }
    .muted { color: var(--text-on-card-muted); }
    .links { font-size: 12px; margin-top: 18px; }
    .links a { color: var(--accent-primary, #3949ab); }
  `],
})
export class BusinessStartComponent implements OnInit {
  business = 'wax-mold-goods';
  budget = 120;
  wt: any = null;
  eco: any = null;
  qa: any = null;
  deals: any = null;
  pricing: any = null;
  suggestions: any = null;
  open: Record<string, boolean> = { prerequisites: true };

  constructor(private bizops: BizopsService) {}

  ngOnInit(): void {
    this.load();
    this.bizops.qa(this.business).then((r) => this.qa = r);
    this.bizops.economy().then((r) => this.eco = r);
    this.bizops.partnerships().then((r) => this.deals = r);
    this.bizops.dealPricing().then((r) => this.pricing = r);
    this.bizops.partnershipSuggestions()
      .then((r) => this.suggestions = r);
  }

  load(): void {
    this.bizops.walkthrough(this.business, this.budget)
      .then((r) => this.wt = r);
  }

  toggle(step: string): void {
    this.open[step] = !this.open[step];
  }

  windowFor(dealName: string): any | null {
    if (!this.pricing?.ok) return null;
    return this.pricing.deals.find(
      (d: any) => d.deal === dealName) ?? null;
  }
}
