import { CommonModule } from '@angular/common';
import { Component, Input, OnChanges, OnInit, SimpleChanges } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { RouterModule } from '@angular/router';

import { PolariService } from '@services/polari-service';
import { errorText } from './api-structured-panel.component';
import { statusClass } from './evidence-types';
import { FreedomProofPanelComponent } from './freedom-proof-panel.component';
import { NamedGraphPanelComponent } from './named-graph-panel.component';

/** One backend fetch: its state, never a raw blob on screen. */
export interface Slot<T = any> {
  loading: boolean;
  error: string | null;
  data: T | null;
}

const SLOT_PATHS: Record<string, string> = {
  score: '/score?samples=0',
  taxonomy: '/taxonomy',
  compare: '/compare',
  proof: '/proof',
  power: '/power',
  characterization: '/characterization',
  links: '/links',
  coverage: '/cell-coverage',
  signal: '/signal-score',
  transport: '/transport?vg=0.6&vd=0.6',
};

export interface KeyRow {
  term: string; label: string; unit: string; equation?: string;
  actual: number | null; ideal: number | null; distance: number | null;
  normalized: number | null; why?: string;
}

export interface RegionRow {
  name: string; display_name: string; meaning: string; criteria: string;
  boundaries: Array<{ label: string; value: string }>;
}

export interface RankRow {
  rank: number; device: string; score: number; valid: boolean;
  isFocus: boolean; proofStatus: string; usable: boolean | null;
  usageLabel: string; failed: string[];
}

/**
 * fet-overview — THE generic FET display. One component renders the
 * SAME structure for every FET (CNT or Si): header chips, key numbers
 * vs ideal, validity proofs, regions, the conditional sub-displays the
 * device's OWN data selects (switching- vs signal-optimized), the
 * competitive ranking, cell coverage, the freedom proof and the links
 * strip. Every number and every word comes from the backend; a fetch
 * that fails or answers ok:false shows the backend's error / refusal
 * text verbatim in its card — never a JSON blob.
 */
@Component({
  standalone: true,
  selector: 'fet-overview',
  imports: [CommonModule, RouterModule, MatProgressSpinnerModule,
            NamedGraphPanelComponent, FreedomProofPanelComponent],
  templateUrl: './fet-overview.component.html',
  styleUrls: ['./fet-overview.component.scss'],
})
export class FetOverviewComponent implements OnInit, OnChanges {
  /** Device key, e.g. 'cnt-aligned-s1' or 'si-nmos-planar-90'. Required. */
  @Input() device = '';

  slots: Record<string, Slot> = {};
  statusClass = statusClass;

  // ---- derived (recomputed after every slot lands) ----
  technology = 'FET';
  isCnt = false;
  polarity = '';
  shape = '';
  suitedTo = '';
  optimizationLabel = '';
  optimizationWhy = '';
  usage: any = null;
  proofStatus = '';
  keyRows: KeyRow[] = [];
  score: number | null = null;
  valid: boolean | null = null;
  failedProofs: string[] = [];
  checks: any[] = [];
  regions: RegionRow[] = [];
  ranking: RankRow[] = [];
  losesMostOn = '';
  focusRank: number | null = null;
  rankOf: number | null = null;
  signalRows: KeyRow[] = [];
  signalScore: number | null = null;
  switchingScore: number | null = null;
  powerFet: Array<{ label: string; value: string; equation?: string }> = [];
  powerGaps: Array<{ label: string; text: string }> = [];
  budgetRows: any[] = [];
  /** targets the FET is ENGINEERED FOR (pass/fail is meaningful) */
  powerTargets: any[] = [];
  /** every other target — informational only (would / would not meet) */
  powerOther: any[] = [];
  engineeredFor: { targets: string[]; why: string; mapped: boolean } | null = null;
  transportLine = '';
  transportRefusal = '';
  coverage: any = null;
  missingCells: Array<{ cell: string; kind: string; fill: string }> = [];
  pages: Array<{ route: string; title: string; what?: string }> = [];
  partner = '';
  partnerRole = '';
  apiList: Array<[string, string]> = [];

  constructor(private http: HttpClient,
              private polariService: PolariService) {}

  ngOnInit(): void { this.loadAll(); }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['device'] && !changes['device'].firstChange) { this.loadAll(); }
  }

  // ---- paths the template embeds ----
  path(suffix: string): string { return `/api/cntfet/device/${this.device}${suffix}`; }
  points(curve: string): string {
    return this.path(`/points?curve=${curve}&samples=0`);
  }
  scoreRoute(device: string): string { return `/display/cntfet-score-${device}`; }

  get isSwitching(): boolean { return this.suitedTo === 'switching-optimized'; }
  get isSignal(): boolean { return this.suitedTo === 'signal-optimized'; }

  slot(name: string): Slot {
    return this.slots[name] || { loading: true, error: null, data: null };
  }

  // ---- formatting ----
  fmt(v: any, unit = ''): string {
    if (v === null || v === undefined || v === '') { return '—'; }
    if (typeof v === 'boolean') { return v ? 'yes' : 'no'; }
    if (typeof v !== 'number') { return String(v); }
    if (!Number.isFinite(v)) { return '—'; }
    const a = Math.abs(v);
    const s = (a !== 0 && (a >= 1e5 || a < 1e-3))
      ? v.toExponential(2)
      : String(Number(v.toPrecision(4)));
    return unit ? `${s} ${unit}` : s;
  }

  pct(v: number | null | undefined): string {
    return (v == null || !Number.isFinite(v)) ? '0%'
      : `${Math.max(0, Math.min(1, v)) * 100}%`;
  }

  usageClass(u: any): string {
    if (!u) { return 'is-muted'; }
    if (u.usable_in_open_chips) { return 'is-ok'; }
    return u.intended_use === 'reference-only' ? 'is-muted' : 'is-warn';
  }

  usageLabel(u: any): string {
    if (!u) { return 'usage unknown'; }
    if (u.usable_in_open_chips) { return 'USABLE'; }
    return u.intended_use === 'reference-only' ? 'REFERENCE' : 'CANDIDATE — not yet';
  }

  trackTerm(_i: number, r: KeyRow): string { return r.term; }
  trackRank(_i: number, r: RankRow): string { return r.device; }

  // ---- loading ----
  private loadAll(): void {
    this.slots = {};
    if (!this.device) {
      this.slots['score'] = { loading: false, data: null,
                              error: 'fet-overview: no device input.' };
      return;
    }
    const device = this.device;
    for (const [name, suffix] of Object.entries(SLOT_PATHS)) {
      const p = this.path(suffix);
      this.slots[name] = { loading: true, error: null, data: null };
      const url = this.polariService.getBackendBaseUrl() + p;
      this.http.get<any>(url, this.polariService.backendRequestOptions).subscribe({
        next: (body: any) => {
          if (device !== this.device) { return; }
          const s = this.slots[name];
          s.loading = false;
          if (!body || typeof body !== 'object') {
            s.error = `GET ${p}: empty response`;
          } else if (body.ok === false) {
            s.error = body.error || body.refusal || `GET ${p}: not ok`;
          } else {
            s.data = body;
          }
          this.derive();
        },
        error: (err: any) => {
          if (device !== this.device) { return; }
          const s = this.slots[name];
          s.loading = false;
          s.error = errorText(err, p);
          this.derive();
        },
      });
    }
  }

  // ---- derivation: backend data -> what the template shows ----
  private derive(): void {
    const score = this.slot('score').data;
    const tax = this.slot('taxonomy').data;
    const cmp = this.slot('compare').data;
    const proof = this.slot('proof').data;
    const power = this.slot('power').data;
    const ch = this.slot('characterization').data;
    const links = this.slot('links').data;
    const cov = this.slot('coverage').data;
    const sig = this.slot('signal').data;
    const tr = this.slot('transport');

    const name = this.device.toLowerCase();
    const shapeName = String(tax?.shape?.shape || tax?.shape?.row?.name
                             || tax?.shape?.name || '');
    this.isCnt = name.startsWith('cnt-') || shapeName.toLowerCase().startsWith('cnt');
    this.technology = name.startsWith('si-') ? 'Silicon'
      : (this.isCnt ? 'CNT' : 'FET');
    this.polarity = score?.polarity || ch?.polarity || '';
    this.shape = tax?.shape?.row?.display_name || shapeName;

    this.suitedTo = tax?.optimization?.suited_to || '';
    this.optimizationLabel = this.suitedTo === 'switching-optimized'
      ? 'Switching-optimized'
      : (this.suitedTo === 'signal-optimized' ? 'Signal-optimized'
         : (this.suitedTo || ''));
    this.optimizationWhy = tax?.optimization?.why || '';
    this.switchingScore = num(tax?.optimization?.switching_score ?? score?.score);
    this.signalScore = num(tax?.optimization?.signal_score ?? sig?.score);

    this.usage = proof?.usage || score?.provenance?.usage || null;
    this.proofStatus = proof?.status || score?.provenance?.proofStatus || '';

    this.keyRows = (score?.idealTable || []).map((r: any) => this.keyRow(r));
    this.score = num(score?.score);
    this.valid = score?.validity?.valid ?? null;
    this.failedProofs = score?.validity?.failed || [];
    this.checks = score?.validity?.checks || [];

    this.regions = (tax?.regions?.regions || []).map((r: any) => ({
      name: r.name, display_name: r.display_name || r.name,
      meaning: r.meaning || '', criteria: r.criteria || '',
      boundaries: this.boundaryChips(r.boundaries || {}),
    }));

    this.ranking = (cmp?.ranking || []).map((r: any) => {
      const u = r.provenance?.usage;
      return {
        rank: r.rank, device: r.device, score: num(r.score) ?? 0,
        valid: !!r.valid, isFocus: !!r.isFocus || r.device === this.device,
        proofStatus: r.provenance?.proofStatus || '',
        usable: u ? !!u.usable_in_open_chips : null,
        usageLabel: this.usageLabel(u), failed: r.failed || [],
      } as RankRow;
    });
    this.losesMostOn = cmp?.loses_most_on || '';
    this.focusRank = num(cmp?.focusRank);
    this.rankOf = num(cmp?.of);

    this.signalRows = (sig?.idealTable || []).map((r: any) => this.keyRow(r));

    this.derivePower(power);

    this.transportLine = '';
    this.transportRefusal = tr.error || '';
    if (tr.data) {
      const d = tr.data;
      const regime = d.regime?.display_name || d.regime?.name || '';
      const t = num(d.regime?.t_regime ?? d.transmission_total ?? d.transmission);
      const top = typeof d.topContributor === 'string' ? d.topContributor
        : (d.topContributor?.display_name || d.topContributor?.name || '');
      const parts = [
        regime ? `regime: ${regime}` : '',
        t != null ? `T = ${this.fmt(t)}` : '',
        top ? `top contributor: ${top}` : '',
        d.temperature_k != null ? `${this.fmt(d.temperature_k)} K` : '',
      ].filter(Boolean);
      this.transportLine = parts.join(' · ');
    }

    this.coverage = cov;
    this.missingCells = (cov?.cells || [])
      .filter((c: any) => !c.covered)
      .map((c: any) => ({ cell: c.cell, kind: c.kind || '', fill: c.fill || '' }));

    this.pages = links?.pages || [];
    this.partner = links?.complementary?.partner || tax?.complementary?.partner || '';
    this.partnerRole = links?.complementary?.role || tax?.complementary?.role || '';
    this.apiList = Object.entries(links?.api || {}) as Array<[string, string]>;
  }

  private keyRow(r: any): KeyRow {
    return {
      term: r.term, label: r.label || r.term, unit: r.unit || '',
      equation: r.equation, actual: num(r.actual ?? r.raw),
      ideal: num(r.ideal), distance: num(r.distance),
      normalized: num(r.normalized), why: r.why || r.ideal_why,
    };
  }

  /** Region boundaries as "label = value" chips; per-Vg lists fold to
   *  one chip per entry, nothing is left as JSON. */
  private boundaryChips(b: Record<string, any>): Array<{ label: string; value: string }> {
    const out: Array<{ label: string; value: string }> = [];
    for (const [k, v] of Object.entries(b)) {
      if (v === null || v === undefined) { continue; }
      if (Array.isArray(v)) {
        for (const e of v) {
          if (e && typeof e === 'object') {
            const vg = e.vgs_v != null ? `Vg ${this.fmt(e.vgs_v)} V` : k;
            const val = e.refusal ? String(e.refusal)
              : (e.vdsat_v != null ? `Vdsat ${this.fmt(e.vdsat_v)} V` : this.fmt(e));
            out.push({ label: vg, value: val });
          } else {
            out.push({ label: k, value: this.fmt(e) });
          }
        }
        continue;
      }
      if (typeof v === 'object') {
        for (const [k2, v2] of Object.entries(v)) {
          if (typeof v2 !== 'object') { out.push({ label: `${k}.${k2}`, value: this.fmt(v2) }); }
        }
        continue;
      }
      out.push({ label: this.boundaryLabel(k), value: this.fmt(v, this.unitOf(k)) });
    }
    return out;
  }

  private boundaryLabel(k: string): string {
    return k.replace(/_v$/, '').replace(/_mv_per_dec$/, '')
      .replace(/_mv_per_v$/, '').replace(/_/g, ' ');
  }

  private unitOf(k: string): string {
    if (k.endsWith('_mv_per_dec')) { return 'mV/dec'; }
    if (k.endsWith('_mv_per_v')) { return 'mV/V'; }
    if (k.endsWith('_v')) { return 'V'; }
    if (k.endsWith('_k')) { return 'K'; }
    return '';
  }

  private derivePower(power: any): void {
    this.powerFet = [];
    this.powerGaps = [];
    this.budgetRows = [];
    if (!power) { return; }
    const fet = power.fet || {};
    const dyn = fet.dynamic || {};
    const add = (label: string, v: any, unit: string, equation?: string) => {
      if (v !== undefined && v !== null) {
        this.powerFet.push({ label, value: this.fmt(v, unit), equation });
      }
    };
    add('static (Vdd·Ioff)', fet.static_w, 'W', power.equations?.static);
    add('Ioff', fet.ioff_a, 'A');
    add('Ion', fet.ion_a, 'A');
    add('E per switch', dyn.e_switch_j, 'J');
    add('dynamic', dyn.p_dyn_w ?? fet.dynamic_w, 'W');
    add('temperature', fet.temperature_k, 'K');
    for (const [k, v] of Object.entries(fet.leakage_components || {}) as Array<[string, any]>) {
      if (v?.value_w != null) {
        add(`${k} leakage`, v.value_w, 'W', v.equation);
      } else if (v?.refusal) {
        this.powerGaps.push({ label: k, text: String(v.refusal) });
      }
    }
    const mapChecks = (checks: any[]) => (checks || []).map((r: any) => ({
      subject: r.subject, budget: r.budget, scope: r.scope, pass: r.pass,
      failed: r.failed || [],
      checks: (r.checks || []).map((c: any) => ({
        limit: c.limit, pass: c.pass,
        text: c.value == null
          ? (c.why || 'unevaluated')
          : `${this.fmt(c.value, c.unit)} vs max ${this.fmt(c.max, c.unit)}`,
      })),
    }));
    const ef = power.engineeredFor;
    this.engineeredFor = ef ? { targets: ef.targets || [], why: ef.engineered_for || '', mapped: !!ef.mapped } : null;
    const targets: any[] = power.targets || [];
    this.powerTargets = targets.filter(t => t.mapped).map(t => ({
      ...t, checks: mapChecks(t.checks),
      failingCount: (t.checks || []).filter((c: any) => (c.failed || []).length).length,
      evaluatedCount: (t.checks || []).filter((c: any) => c.pass !== null && c.pass !== undefined).length,
    }));
    this.powerOther = targets.filter(t => !t.mapped).map(t => ({
      ...t,
      wouldMeet: t.informational,
      failingCount: (t.checks || []).filter((c: any) => (c.failed || []).length).length,
      evaluatedCount: (t.checks || []).filter((c: any) => c.pass !== null && c.pass !== undefined).length,
    }));
    this.budgetRows = (power.results || []).map((r: any) => ({
      subject: r.subject, budget: r.budget, scope: r.scope, pass: r.pass,
      failed: r.failed || [],
      checks: (r.checks || []).map((c: any) => ({
        limit: c.limit, pass: c.pass,
        text: c.value == null
          ? (c.why || 'unevaluated')
          : `${this.fmt(c.value, c.unit)} vs max ${this.fmt(c.max, c.unit)}`,
      })),
    }));
    if (power.honesty) {
      this.powerGaps.push({ label: 'density', text: String(power.honesty) });
    }
  }
}

function num(v: any): number | null {
  if (v === null || v === undefined || v === '') { return null; }
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
