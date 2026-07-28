import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { OdooBusinessService } from '@services/odoo-business.service';

/**
 * od-7: /business/odoo — the business backbone surface.
 *
 * Instances with their MODE + write knobs (knobs shown AS knobs,
 * never editable-by-accident here), scenario cards with assumptions
 * and plan-first previews, sync/scenario receipts, and the sourcing
 * make-vs-buy verdicts. Refusals render with their suggestions —
 * a gated-off module or a down Odoo is a message, never a blank.
 */
@Component({
  standalone: true,
  selector: 'odoo-business',
  imports: [CommonModule, RouterModule],
  template: `
  <div class="biz">
    <h2>Odoo — business sims &amp; real ops</h2>
    <p class="hint">odoo_sim writes freely; odoo_ops is REAL business
      data behind push_enabled + typed confirmation. Scenarios run in
      throwaway databases; harvests land on the economy tree.</p>

    <h3>Instances</h3>
    <div class="err" *ngIf="status && !status.ok">
      {{ status.refusal }}</div>
    <div class="tiles" *ngIf="status?.ok">
      <div class="tile" *ngFor="let s of status.statuses"
           [class.mode-ops]="s.mode === 'operations'">
        <div class="tile-head">
          <b>{{ s.name }}</b>
          <span class="chip" [class.on]="s.reachable"
                [class.warn]="!s.reachable">
            {{ s.reachable ? 'reachable' : 'down' }}</span>
        </div>
        <div class="tile-body">
          <span>mode: <b>{{ s.mode }}</b> · db {{ s.db }}</span>
          <span *ngIf="s.serverVersion">odoo {{ s.serverVersion }}
          </span>
          <span class="knobs">
            <span class="chip" [class.on]="s.pushEnabled"
                  [class.warn]="!s.pushEnabled">push
              {{ s.pushEnabled ? 'ON' : 'off' }}</span>
            <span class="chip" [class.warn]="s.readOnly">
              {{ s.readOnly ? 'read-only' : 'writable' }}</span>
          </span>
          <span class="err" *ngIf="s.refusal">{{ s.refusal }}</span>
        </div>
      </div>
    </div>

    <h3>Scenarios (throwaway-DB business sims)</h3>
    <div class="err" *ngIf="scenarios && !scenarios.ok">
      {{ scenarios.refusal }}</div>
    <div class="cards" *ngIf="scenarios?.ok">
      <div class="card" *ngFor="let s of scenarios.scenarios">
        <div class="tile-head">
          <b>{{ s.displayName || s.name }}</b>
          <button (click)="togglePlan(s.name)">
            {{ plans[s.name] ? 'hide plan' : 'plan' }}</button>
        </div>
        <div class="muted">db {{ s.scenarioDb }} · apps
          {{ s.requiredModules }}</div>
        <ul class="assump">
          <li *ngFor="let a of s.assumptions">{{ a }}</li>
        </ul>
        <div class="plan" *ngIf="plans[s.name] as p">
          <div class="err" *ngIf="!p.ok">{{ p.refusal }}</div>
          <ol *ngIf="p.ok">
            <li *ngFor="let step of p.steps">
              <b>{{ step.phase }}</b>
              <span class="muted"> ({{ step.runBy }})</span>
              <code *ngIf="step.command"> {{ step.command }}</code>
              <span *ngIf="step.what"> — {{ step.what }}</span>
            </li>
          </ol>
        </div>
      </div>
    </div>

    <h3>Make vs buy (cited prices)</h3>
    <div class="cards">
      <div class="card" *ngFor="let c of compares">
        <div class="tile-head"><b>{{ c.item }}</b></div>
        <div class="err" *ngIf="c.data && !c.data.ok">
          {{ c.data.refusal }}</div>
        <ng-container *ngIf="c.data?.ok">
          <table class="rows">
            <tr *ngFor="let r of c.data.rows">
              <td>{{ r.name }}</td>
              <td class="kind">{{ r.kind }}</td>
              <td class="num">
                <ng-container *ngIf="r.usdPerKg != null">
                  {{ r.usdPerKg | number:'1.2-2' }} $/kg
                  <span *ngIf="r.anyEstimate" class="muted"
                        title="carries estimate-flagged citations">
                    ~</span>
                </ng-container>
                <span class="muted" *ngIf="r.usdPerKg == null">
                  {{ r.refusal || 'uncited' }}</span>
              </td>
            </tr>
          </table>
          <div class="verdict" *ngIf="c.data.verdict as v">
            <b>{{ v.ours.name }}</b>
            ({{ v.ours.usdPerKg | number:'1.2-2' }} $/kg) beats
            <b>{{ v.substitute.name }}</b>
            ({{ v.substitute.usdPerKg | number:'1.2-2' }} $/kg) by
            <b>{{ v.oursCheaperPct | number:'1.0-1' }}%</b>
            <ul class="assump">
              <li *ngFor="let cav of v.substitute.caveats">
                {{ cav }}</li>
            </ul>
          </div>
        </ng-container>
      </div>
    </div>

    <h3>Receipts (every pull/push/scenario phase)</h3>
    <div class="err" *ngIf="receipts && !receipts.ok">
      {{ receipts.refusal }}</div>
    <table class="rows" *ngIf="receipts?.ok">
      <tr class="head"><td>when</td><td>kind</td><td>binding /
        scenario</td><td>instance</td><td class="num">created</td>
        <td class="num">updated</td><td class="num">skipped</td>
        <td class="num">conflicts</td></tr>
      <tr *ngFor="let r of receipts.receipts">
        <td class="muted">{{ r.createdAt }}</td>
        <td>{{ r.kind }}</td><td>{{ r.binding }}</td>
        <td>{{ r.instance }}</td>
        <td class="num">{{ r.created }}</td>
        <td class="num">{{ r.updated }}</td>
        <td class="num">{{ r.skipped }}</td>
        <td class="num" [class.err]="r.conflicts > 0">
          {{ r.conflicts }}</td>
      </tr>
    </table>
    <div class="muted" *ngIf="receipts?.ok
         && !receipts.receipts?.length">
      no receipts yet — nothing has synced or run</div>

    <h3>Bindings (data, not code)</h3>
    <div class="err" *ngIf="bindings && !bindings.ok">
      {{ bindings.refusal }}</div>
    <table class="rows" *ngIf="bindings?.ok">
      <tr class="head"><td>binding</td><td>odoo model</td>
        <td>polari class</td><td>direction</td><td>instance</td></tr>
      <tr *ngFor="let b of bindings.bindings">
        <td>{{ b.name }}</td><td><code>{{ b.odooModel }}</code></td>
        <td>{{ b.polariClass }}</td><td>{{ b.direction }}</td>
        <td>{{ b.instanceRef }}</td>
      </tr>
    </table>

    <div class="links">
      <a routerLink="/topology">topology</a> ·
      <a routerLink="/modules/bringup">module bring-up</a>
    </div>
  </div>
  `,
  styles: [`
    .biz { padding: 16px; color: var(--text-on-bg); }
    h3 { margin: 18px 0 8px; }
    .hint { color: var(--text-on-bg-muted); font-size: 12px; }
    .tiles { display: grid;
      grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
      gap: 8px; }
    .tile, .card { border: 1px solid var(--border-light);
      border-radius: 8px; padding: 10px 12px;
      background: var(--surface-primary);
      color: var(--text-on-card); }
    .mode-ops { border-left: 4px solid #f9a825; }
    .cards { display: flex; flex-direction: column; gap: 10px; }
    .tile-head { display: flex; justify-content: space-between;
      align-items: center; gap: 8px; }
    .tile-body { font-size: 12px; margin-top: 6px; display: flex;
      flex-direction: column; gap: 3px;
      color: var(--text-on-card-muted); }
    .chip { font-size: 11px; border-radius: 10px; padding: 1px 8px;
      border: 1px solid var(--border-light); }
    .chip.on { background: #2e7d3222; border-color: #2e7d32; }
    .chip.warn { background: #f9a82522; border-color: #f9a825; }
    .knobs { display: flex; gap: 6px; }
    .assump { font-size: 11px; margin: 6px 0 0;
      padding-left: 18px; color: var(--text-on-card-muted); }
    .plan { margin-top: 8px; font-size: 12px; }
    .plan code { font-size: 11px; }
    .rows { border-collapse: collapse; font-size: 12px;
      width: 100%; }
    .rows td { border-bottom: 1px solid var(--border-light);
      padding: 3px 8px 3px 0; }
    .rows .head td { color: var(--text-on-card-muted);
      font-size: 11px; }
    .num { text-align: right; }
    .kind { color: var(--text-on-card-muted); font-size: 11px; }
    .verdict { margin-top: 8px; font-size: 12px; padding: 8px;
      border-left: 4px solid #2e7d32;
      background: var(--surface-app-background); }
    .err { color: #c62828; font-size: 12px; }
    .muted { color: var(--text-on-card-muted); }
    button { font-size: 11px; cursor: pointer; }
    .links { font-size: 12px; margin-top: 16px; }
    .links a { color: var(--accent-primary, #3949ab); }
  `],
})
export class OdooBusinessComponent implements OnInit, OnDestroy {
  status: any = null;
  scenarios: any = null;
  receipts: any = null;
  bindings: any = null;
  plans: Record<string, any> = {};
  compares: { item: string; data: any }[] = [
    { item: 'geopolymer-mix', data: null },
    { item: 'natural-print-wax-blend', data: null },
  ];
  private timer: any = null;

  constructor(private odoo: OdooBusinessService) {}

  ngOnInit(): void {
    this.refresh();
    this.timer = setInterval(() => this.refreshLive(), 15000);
  }

  ngOnDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  refresh(): void {
    this.refreshLive();
    this.odoo.scenarios().then((r) => this.scenarios = r);
    this.odoo.bindings().then((r) => this.bindings = r);
    for (const c of this.compares) {
      this.odoo.compare(c.item).then((r) => c.data = r);
    }
  }

  refreshLive(): void {
    this.odoo.status().then((r) => this.status = r);
    this.odoo.receipts().then((r) => this.receipts = r);
  }

  togglePlan(name: string): void {
    if (this.plans[name]) {
      delete this.plans[name];
      return;
    }
    this.odoo.scenarioPlan(name).then((r) => this.plans[name] = r);
  }
}
