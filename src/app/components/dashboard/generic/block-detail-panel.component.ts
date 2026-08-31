import { CommonModule } from '@angular/common';
import { Component, Input, OnChanges, OnInit, SimpleChanges } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { PolariService } from '@services/polari-service';
import { SimSpaceViewerComponent } from '@components/sim-space/sim-space-viewer/sim-space-viewer.component';
import { statusClass } from './evidence-types';

/**
 * Block level (rank 3 of FET → cell → BLOCK → core → chip) — the
 * general functional block + its FET-configuration selector.
 * /api/fet/block/{key}/summary for the device-independent identity,
 * exhaustive proof and configuration index; on selection
 * /api/fet/blockcfg/{key}/{device}/summary for OpenSTA timing over
 * that device's Liberty, power + provenance roll-ups, and the
 * COMPOSITION table — the level-up linkage, each row linking DOWN
 * to its CellFETConfiguration page. `?device=` preselects.
 */
@Component({
  standalone: true,
  selector: 'block-detail-panel',
  imports: [CommonModule, FormsModule, RouterModule,
            MatProgressSpinnerModule, SimSpaceViewerComponent],
  template: `
  <div class="blockp">
    <div *ngIf="loading" class="state"><mat-spinner diameter="24"></mat-spinner></div>
    <div *ngIf="error && !loading" class="state error">{{ error }}</div>

    <ng-container *ngIf="summary && !loading">
      <div class="chips head">
        <span class="chip chip-strong">{{ id.display_name || block }}</span>
        <span class="chip">{{ id.cell_count }} cells / {{ id.fet_count }} FETs</span>
        <span class="chip">{{ id.inputs?.length }} in → {{ id.outputs?.length }} out</span>
        <span class="chip" *ngIf="id.state_bits">{{ id.state_bits }} state bits · clk {{ id.clock }}</span>
        <span class="chip" [ngClass]="summary.proof?.proven ? 'is-ok' : 'is-warn'">
          {{ summary.proof?.proven ? 'proven exhaustively' : 'unproven' }}</span>
      </div>
      <p class="muted small">{{ id.description }}</p>
      <div class="muted small">{{ summary.ladder }}</div>

      <div class="selector">
        <label>configuration
          <select [(ngModel)]="selected" (ngModelChange)="pick()">
            <option [ngValue]="null">General (device-independent)</option>
            <option *ngFor="let c of summary.configurations" [ngValue]="c">
              {{ c.device }} — {{ c.cellsReady ? 'cells ready' :
                 (c.missingCells?.length + ' cells missing') }}
            </option>
          </select>
        </label>
      </div>

      <div *ngIf="!selected" class="chips">
        <span class="chip" *ngFor="let kv of cellCounts">
          {{ kv[1] }}× {{ kv[0] }}</span>
      </div>

      <div *ngIf="selected">
        <div *ngIf="cfgLoading" class="state"><mat-spinner diameter="20"></mat-spinner></div>
        <div *ngIf="cfgError && !cfgLoading" class="state error">{{ cfgError }}</div>
        <ng-container *ngIf="cfg && !cfgLoading">
          <div class="chips">
            <span class="chip chip-strong">{{ cfg.config }}</span>
            <span class="chip" [ngClass]="statusClass(cfg.proof?.status)">{{ cfg.proof?.status }}</span>
            <span class="chip is-ok" *ngIf="cfg.openSourceSample">OPEN-SOURCE SAMPLE</span>
            <span class="chip" [ngClass]="cfg.cellsReady ? 'is-ok' : 'is-warn'">
              {{ cfg.cellsReady ? 'all cells characterized' : 'cells missing' }}</span>
          </div>
          <div class="state error" *ngIf="!cfg.cellsReady && cfg.acts?.fillCells">
            {{ cfg.acts.fillCells }}</div>

          <h4>Composition — the level-up linkage (block → cells → this FET)</h4>
          <table class="tbl">
            <tr><th>cell</th><th>instances</th><th>characterized</th><th>configuration</th></tr>
            <tr *ngFor="let c of cfg.composition">
              <td><a [routerLink]="'/display/cell-detail'"
                     [queryParams]="{ object: c.cell, device: cfg.device }">{{ c.cell }}</a></td>
              <td class="num">{{ c.instances }}</td>
              <td>{{ c.characterized ? '✓' : '—' }}</td>
              <td class="muted small">{{ c.cellConfig }}</td>
            </tr>
          </table>

          <h4>Timing (OpenSTA over this device's Liberty)</h4>
          <div class="state error" *ngIf="cfg.timing?.refusal || cfg.timing?.error">
            {{ cfg.timing.refusal || cfg.timing.error }}</div>
          <div *ngIf="cfg.timing?.ok" class="chips">
            <span class="chip" *ngIf="cfg.timing.criticalPath_ps != null">
              critical path {{ fmt(cfg.timing.criticalPath_ps) }} ps</span>
            <span class="chip" *ngIf="cfg.timing.fmax_ghz != null">
              fmax {{ fmt(cfg.timing.fmax_ghz) }} GHz</span>
            <span class="chip muted" *ngIf="cfg.timing.grade">{{ cfg.timing.grade }}</span>
          </div>

          <h4>Power roll-up</h4>
          <div class="state error" *ngIf="cfg.power?.refusal || cfg.power?.error">
            {{ cfg.power.refusal || cfg.power.error }}</div>
          <div *ngIf="cfg.power?.ok" class="chips">
            <span class="chip" *ngIf="cfg.power.static_w != null">
              static {{ fmt(cfg.power.static_w) }} W</span>
            <span class="chip" *ngIf="cfg.power.dynamic_w != null">
              dynamic {{ fmt(cfg.power.dynamic_w) }} W</span>
          </div>
          <div class="muted small">{{ cfg.note }}</div>
        </ng-container>

        <div class="viz">
          <h4>Visualize — {{ block }} as instancable cells on
            {{ selected.device }}</h4>
          <div class="selector small">
            <label>view
              <select [(ngModel)]="vizDim" (ngModelChange)="visualize()">
                <option value="3d">3-D</option>
                <option value="2d">2-D</option>
              </select></label>
            <label>detail
              <select [(ngModel)]="vizLod" (ngModelChange)="visualize()">
                <option value="blackbox">black-box cells (carry real cell data)</option>
                <option value="real">real geometry (budget-guarded)</option>
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
    .blockp { width: 100%; }
    .state { display: flex; align-items: center; gap: 8px; padding: 10px; }
    .state.error { color: var(--warn-text, #b71c1c); white-space: pre-wrap; }
    .chips { display: flex; flex-wrap: wrap; gap: 6px; margin: 4px 0; }
    .chip { padding: 2px 10px; border-radius: 10px; font-size: 0.82em;
      background: rgba(127,127,127,0.16); }
    .chip-strong { font-weight: 600; }
    .is-ok { background: #c8e6c9; }
    .is-warn { background: #ffe0b2; }
    .is-error { background: #ffcdd2; }
    .is-muted { opacity: 0.7; }
    .selector { margin: 10px 0; }
    h4 { margin: 12px 0 4px; }
    .tbl { border-collapse: collapse; width: 100%; font-size: 0.85em; }
    .tbl th, .tbl td { border-bottom: 1px dashed rgba(127,127,127,0.4);
      padding: 3px 8px; text-align: left; }
    .tbl .num { text-align: right; }
    .muted { color: var(--text-secondary, #777); }
    .small { font-size: 0.8em; }
    .viz { margin-top: 14px; }
    .viz .selector { display: flex; gap: 12px; flex-wrap: wrap;
      align-items: center; }
    .vizhost { height: 420px; margin-top: 6px;
      border: 1px solid rgba(127,127,127,0.3); border-radius: 6px;
      overflow: hidden; }
  `],
})
export class BlockDetailPanelComponent implements OnInit, OnChanges {
  /** Block key ('alu4', 'reg4', 'ctr4', 'fsm-traffic'). Required. */
  @Input() block = '';

  loading = true;
  error: string | null = null;
  summary: any = null;
  selected: any = null;
  cfg: any = null;
  cfgLoading = false;
  cfgError: string | null = null;
  statusClass = statusClass;

  /** Multiscale visualize — blocks default to black-box cell
   *  stand-ins carrying the real characterized data; lod=real is
   *  budget-guarded and its refusal shows verbatim. */
  vizDim: '2d' | '3d' = '3d';
  vizLod: 'real' | 'blackbox' = 'blackbox';
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
    const p = `/api/fet/scene/block/${this.block}/${this.selected.device}`
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
        this.vizNote = `${body.entries} cell instances · lod ${body.lod}`;
      },
      error: (err: any) => {
        this.vizLoading = false;
        this.vizError = err?.error?.error || `GET ${p} failed`;
      },
    });
  }

  get id(): any { return this.summary?.identity || {}; }
  get cellCounts(): Array<[string, number]> {
    return Object.entries(this.id.cells || {}) as Array<[string, number]>;
  }

  ngOnInit(): void { this.load(); }
  ngOnChanges(ch: SimpleChanges): void {
    if (ch['block'] && !ch['block'].firstChange) { this.load(); }
  }

  fmt(v: any): string {
    const n = Number(v);
    if (!Number.isFinite(n)) { return String(v ?? '—'); }
    const a = Math.abs(n);
    return (a !== 0 && (a >= 1e5 || a < 1e-3))
      ? n.toExponential(2) : String(Number(n.toPrecision(4)));
  }

  private load(): void {
    this.loading = true; this.error = null;
    this.summary = this.selected = this.cfg = null;
    if (!this.block) {
      this.loading = false;
      this.error = 'block-detail-panel: no block input.';
      return;
    }
    const p = `/api/fet/block/${this.block}/summary`;
    const url = this.polariService.getBackendBaseUrl() + p;
    this.http.get<any>(url, this.polariService.backendRequestOptions).subscribe({
      next: (body: any) => {
        this.loading = false;
        if (!body || body.ok === false) {
          this.error = body?.error || `GET ${p}: not ok`;
          return;
        }
        this.summary = body;
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
      || `/api/fet/blockcfg/${this.block}/${this.selected.device}/summary`;
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
