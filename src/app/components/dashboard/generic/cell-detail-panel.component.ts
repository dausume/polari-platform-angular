import { CommonModule } from '@angular/common';
import { Component, Input, OnChanges, OnInit, SimpleChanges } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { PolariService } from '@services/polari-service';
import { SimSpaceViewerComponent } from '@components/sim-space/sim-space-viewer/sim-space-viewer.component';
import { statusClass } from './evidence-types';

/**
 * Cell arc (2026-08-31) — the general cell + its FET-configuration
 * selector on ONE panel. Fetches /api/fet/cell/{cell}/summary for
 * the device-independent identity, proof and configuration index,
 * and on selection /api/fet/cellcfg/{cell}/{device}/summary for the
 * specific case: score vs THAT FET's intrinsic limits, leakage per
 * input state, the characterize acts — or the fill affordance
 * verbatim when uncharacterized. Proven-free + characterized
 * pairings are flagged OPEN-SOURCE SAMPLE. `?device=` preselects a
 * configuration.
 */
@Component({
  standalone: true,
  selector: 'cell-detail-panel',
  imports: [CommonModule, FormsModule, MatProgressSpinnerModule,
            SimSpaceViewerComponent],
  template: `
  <div class="cellp">
    <div *ngIf="loading" class="state"><mat-spinner diameter="24"></mat-spinner></div>
    <div *ngIf="error && !loading" class="state error">{{ error }}</div>

    <ng-container *ngIf="summary && !loading">
      <div class="chips head">
        <span class="chip chip-strong">{{ id.function || cell }}</span>
        <span class="chip">{{ id.kind }}</span>
        <span class="chip">{{ id.inputs?.join(', ') }} → {{ id.output }}</span>
        <span class="chip">{{ id.fet_count_x1 }} FETs (x1)</span>
        <span class="chip" *ngIf="id.unate">{{ id.unate }} unate</span>
        <span class="chip" [ngClass]="statusClass(summary.proof?.status)">
          {{ summary.proof?.status }}</span>
        <span class="chip" *ngIf="id.composed_of?.length">
          composed of {{ id.composed_of.join(' + ') }}</span>
      </div>
      <div class="muted small">{{ summary.note }}</div>

      <div class="selector">
        <label>configuration
          <select [(ngModel)]="selected" (ngModelChange)="pick()">
            <option [ngValue]="null">General (device-independent)</option>
            <option *ngFor="let c of summary.configurations" [ngValue]="c">
              {{ c.device }} — {{ c.characterized ? 'characterized' : 'not characterized' }},
              {{ c.proofStatus }}{{ c.openSourceSample ? ' · OPEN-SOURCE SAMPLE' : '' }}
            </option>
          </select>
        </label>
        <span class="muted small" *ngIf="summary.openSourceSamples?.length">
          {{ summary.openSourceSamples.length }} open-source sample(s)
          available</span>
      </div>

      <div class="general" *ngIf="!selected">
        <p>{{ summary.openSourceNote }}</p>
      </div>

      <div *ngIf="selected">
        <div *ngIf="cfgLoading" class="state"><mat-spinner diameter="20"></mat-spinner></div>
        <div *ngIf="cfgError && !cfgLoading" class="state error">{{ cfgError }}</div>
        <ng-container *ngIf="cfg && !cfgLoading">
          <div class="chips">
            <span class="chip chip-strong">{{ cfg.config }}</span>
            <span class="chip" [ngClass]="statusClass(cfg.proof?.status)">
              {{ cfg.proof?.status }}</span>
            <span class="chip is-ok" *ngIf="cfg.openSourceSample">OPEN-SOURCE SAMPLE</span>
            <span class="chip" *ngIf="cfg.run">run: {{ cfg.run }}</span>
          </div>
          <div class="muted small" *ngIf="cfg.proof?.rule">{{ cfg.proof.rule }}</div>

          <div class="state error" *ngIf="cfg.refusal">{{ cfg.refusal }}</div>

          <ng-container *ngIf="cfg.characterized">
            <h4>Score vs this FET's intrinsic limits</h4>
            <div class="state error" *ngIf="cfg.score?.refusal">{{ cfg.score.refusal }}</div>
            <table class="tbl" *ngIf="cfg.score?.terms">
              <tr><th>term</th><th>actual</th><th>ideal</th><th>normalized</th></tr>
              <tr *ngFor="let t of cfg.score.terms">
                <td>{{ t.label || t.term }}</td>
                <td class="num">{{ fmt(t.actual ?? t.raw) }}</td>
                <td class="num">{{ fmt(t.ideal) }}</td>
                <td class="num">{{ fmt(t.normalized) }}</td>
              </tr>
              <tr><td><b>score</b></td><td colspan="3" class="num">
                <b>{{ fmt(cfg.score.score) }}</b>
                (τ_int {{ fmt(cfg.score.tau_int_ps) }} ps,
                Vdd {{ fmt(cfg.score.vdd_v) }} V)</td></tr>
            </table>

            <h4>Power on this FET</h4>
            <div class="state error" *ngIf="cfg.power?.refusal">{{ cfg.power.refusal }}</div>
            <ng-container *ngIf="cfg.power && !cfg.power.refusal">
              <table class="tbl" *ngIf="cfg.power.states?.length">
                <tr><th>inputs</th><th>leakage (A)</th></tr>
                <tr *ngFor="let s of cfg.power.states">
                  <td>{{ s.when }}</td><td class="num">{{ fmt(s.i_leak_a) }}</td>
                </tr>
              </table>
              <div class="muted small">
                static (mean): {{ fmt(cfg.power.static_w) }} W ·
                max {{ fmt(cfg.power.static_max_w) }} W
                <span *ngIf="cfg.power.stack_effect"> · {{ cfg.power.stack_effect }}</span>
              </div>
              <div class="muted small" *ngIf="cfg.power.dynamic">
                dynamic: {{ fmt(cfg.power.dynamic.e_per_transition_j ?? cfg.power.dynamic.e_switch_j) }} J/transition ·
                {{ fmt(cfg.power.dynamic_w) }} W at the activity knobs
              </div>
              <div class="state error" *ngIf="cfg.power.dynamic_refusal">
                {{ cfg.power.dynamic_refusal }}</div>
            </ng-container>
          </ng-container>

          <div class="acts muted small">
            simulate / characterize: POST {{ cfg.acts?.characterize }}
            to {{ cfg.acts?.actTarget }} · {{ cfg.acts?.logicStep }}
          </div>
        </ng-container>

        <div class="viz">
          <h4>Visualize — {{ selected.device }} FETs plugged into
            {{ cell }}</h4>
          <div class="selector small">
            <label>view
              <select [(ngModel)]="vizDim" (ngModelChange)="visualize()">
                <option value="3d">3-D</option>
                <option value="2d">2-D (layout boxes)</option>
              </select></label>
            <label>detail
              <select [(ngModel)]="vizLod" (ngModelChange)="visualize()">
                <option value="real">real FET geometry (math shapes)</option>
                <option value="blackbox">black-box stand-ins (carry FET data)</option>
              </select></label>
            <button *ngIf="!vizScene && !vizLoading" (click)="visualize()">
              build scene</button>
          </div>
          <div *ngIf="vizLoading" class="state">
            <mat-spinner diameter="20"></mat-spinner></div>
          <div *ngIf="vizError && !vizLoading" class="state error">{{ vizError }}</div>
          <ng-container *ngIf="vizScene && !vizLoading">
            <div class="muted small">{{ vizNote }}</div>
            <div class="vizhost">
              <sim-space-viewer [simSpaceName]="vizScene"
                                [hideRunPanel]="true"></sim-space-viewer>
            </div>
          </ng-container>
        </div>
      </div>
    </ng-container>
  </div>
  `,
  styles: [`
    .cellp { width: 100%; }
    .state { display: flex; align-items: center; gap: 8px; padding: 10px; }
    .state.error { color: var(--warn-text, #b71c1c); white-space: pre-wrap; }
    .chips { display: flex; flex-wrap: wrap; gap: 6px; margin: 4px 0; }
    .chips.head { margin-bottom: 8px; }
    .chip { padding: 2px 10px; border-radius: 10px; font-size: 0.82em;
      background: rgba(127,127,127,0.16); }
    .chip-strong { font-weight: 600; }
    .is-ok { background: #c8e6c9; }
    .is-warn { background: #ffe0b2; }
    .is-error { background: #ffcdd2; }
    .is-muted { opacity: 0.7; }
    .selector { margin: 10px 0; display: flex; gap: 12px;
      align-items: center; flex-wrap: wrap; }
    .selector select { max-width: 100%; }
    h4 { margin: 12px 0 4px; }
    .tbl { border-collapse: collapse; width: 100%; font-size: 0.85em; }
    .tbl th, .tbl td { border-bottom: 1px dashed rgba(127,127,127,0.4);
      padding: 3px 8px; text-align: left; }
    .tbl .num { text-align: right; font-variant-numeric: tabular-nums; }
    .muted { color: var(--text-secondary, #777); }
    .small { font-size: 0.8em; }
    .acts { margin-top: 10px; }
    .viz { margin-top: 14px; }
    .vizhost { height: 420px; margin-top: 6px;
      border: 1px solid rgba(127,127,127,0.3); border-radius: 6px;
      overflow: hidden; }
  `],
})
export class CellDetailPanelComponent implements OnInit, OnChanges {
  /** Library cell key ('cinv', 'cnand2', …). Required. */
  @Input() cell = '';

  loading = true;
  error: string | null = null;
  summary: any = null;
  selected: any = null;
  cfg: any = null;
  cfgLoading = false;
  cfgError: string | null = null;
  statusClass = statusClass;

  /** Multiscale visualize state — GET /api/fet/scene/cell/… upserts
   *  the SimSpaceDefinition on demand; refusals (entry budget)
   *  surface verbatim. */
  vizDim: '2d' | '3d' = '3d';
  vizLod: 'real' | 'blackbox' = 'real';
  vizScene: string | null = null;
  vizNote = '';
  vizLoading = false;
  vizError: string | null = null;

  constructor(private http: HttpClient,
              private polariService: PolariService,
              private route: ActivatedRoute) {}

  visualize(): void {
    if (!this.selected) { return; }
    this.vizLoading = true;
    this.vizError = null; this.vizScene = null;
    const p = `/api/fet/scene/cell/${this.cell}/${this.selected.device}`
      + `?dim=${this.vizDim}&lod=${this.vizLod}`;
    const url = this.polariService.getBackendBaseUrl() + p;
    this.http.get<any>(url, this.polariService.backendRequestOptions).subscribe({
      next: (body: any) => {
        this.vizLoading = false;
        if (!body || body.ok === false) {
          this.vizError = body?.error || `GET ${p}: not ok`;
          return;
        }
        this.vizScene = body.scene;
        this.vizNote = `${body.entries} entries · ${body.instances}`
          + ` FET instances · lod ${body.lod}`;
      },
      error: (err: any) => {
        this.vizLoading = false;
        this.vizError = err?.error?.error || `GET ${p} failed`;
      },
    });
  }

  get id(): any { return this.summary?.identity || {}; }

  ngOnInit(): void { this.load(); }
  ngOnChanges(ch: SimpleChanges): void {
    if (ch['cell'] && !ch['cell'].firstChange) { this.load(); }
  }

  fmt(v: any): string {
    if (v === null || v === undefined || v === '') { return '—'; }
    const n = Number(v);
    if (!Number.isFinite(n)) { return String(v); }
    const a = Math.abs(n);
    return (a !== 0 && (a >= 1e5 || a < 1e-3))
      ? n.toExponential(2) : String(Number(n.toPrecision(4)));
  }

  private load(): void {
    this.loading = true; this.error = null;
    this.summary = this.selected = this.cfg = null;
    if (!this.cell) {
      this.loading = false;
      this.error = 'cell-detail-panel: no cell input.';
      return;
    }
    const p = `/api/fet/cell/${this.cell}/summary`;
    const url = this.polariService.getBackendBaseUrl() + p;
    this.http.get<any>(url, this.polariService.backendRequestOptions).subscribe({
      next: (body: any) => {
        this.loading = false;
        if (!body || body.ok === false) {
          this.error = body?.error || `GET ${p}: not ok`;
          return;
        }
        this.summary = body;
        // ?device= preselects a configuration (links from FET pages)
        const dev = this.route.snapshot.queryParamMap.get('device');
        if (dev) {
          this.selected = (body.configurations || [])
            .find((c: any) => c.device === dev) || null;
          if (this.selected) { this.pick(); }
        }
      },
      error: (err: any) => {
        this.loading = false;
        this.error = err?.error?.error || `GET ${p} failed`;
      },
    });
  }

  pick(): void {
    this.cfg = null; this.cfgError = null;
    this.vizScene = null; this.vizError = null; this.vizNote = '';
    if (!this.selected) { return; }
    this.cfgLoading = true;
    const p = this.selected.summaryPath
      || `/api/fet/cellcfg/${this.cell}/${this.selected.device}/summary`;
    const url = this.polariService.getBackendBaseUrl() + p;
    this.http.get<any>(url, this.polariService.backendRequestOptions).subscribe({
      next: (body: any) => {
        this.cfgLoading = false;
        if (!body || body.ok === false) {
          this.cfgError = body?.error || `GET ${p}: not ok`;
          return;
        }
        this.cfg = body;
      },
      error: (err: any) => {
        this.cfgLoading = false;
        this.cfgError = err?.error?.error || `GET ${p} failed`;
      },
    });
  }
}
