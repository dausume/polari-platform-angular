import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { PsppService } from '@services/pspp/pspp.service';

/**
 * mtt-2 research surface: how a maker SEES what a material is, and the
 * open-source instruments to build for it. Three views:
 *  - Characterization: XRD vs FTIR, explained in plain language (what
 *    each measures, how it works, the diagnostic signals + meanings).
 *  - FTIR sampler: enter a composition, get the diagnostic bands + a
 *    plain reading (positions approximate; intensities refuse).
 *  - Research tools: buildable instruments (easiest first) with parts,
 *    accessibility, difficulty and safety — the measurement half of
 *    the open-source economy, for goal accountability.
 */
@Component({
  selector: 'pspp-research',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
  <div class="research">
    <h2>PSPP — Research: characterization + open-source tools</h2>
    <p class="hint">How you SEE what a material is doing, and the
      instruments a community can build to do it. Plain-language
      throughout; approximate values say so, and refusals are
      shown.</p>

    <div class="tabs">
      <button *ngFor="let t of tabList" (click)="tab = t.key"
              [class.active]="tab === t.key">{{ t.label }}</button>
    </div>

    <!-- ============ METHODS ============ -->
    <div *ngIf="tab === 'methods'" class="panel">
      <div class="method" *ngFor="let m of methods">
        <div class="m-head">
          <b>{{ m.display_name }}</b>
          <span class="chip"
                [class.hazard]="m.local_buildable === 'hard'"
                [class.ok]="m.safety.toLowerCase().includes('safe')">
            build: {{ m.local_buildable }}</span>
        </div>
        <p class="measures"><b>Measures:</b> {{ m.measures }}</p>
        <p class="how">{{ m.how_plain }}</p>
        <table class="signals">
          <tr><th>you see…</th><th>…which means</th></tr>
          <tr *ngFor="let s of m.key_signals">
            <td>{{ s.signal }}</td>
            <td class="muted">{{ s.means }}</td>
          </tr>
        </table>
        <p class="suits"><b>Best for:</b> {{ m.suits }}
          <span *ngIf="m.weak_on"> · <em>weak on:</em> {{ m.weak_on
            }}</span></p>
        <p class="safety" [class.warn]="m.local_buildable === 'hard'">
          <b>Safety:</b> {{ m.safety }}</p>
        <p class="cite" *ngIf="m.build_note">{{ m.build_note }}</p>
      </div>
    </div>

    <!-- ============ FTIR SAMPLER ============ -->
    <div *ngIf="tab === 'ftir'" class="panel">
      <p class="hint">FTIR reads the BONDS, so it works on amorphous
        geopolymers/gels where XRD sees only a halo. Enter a
        composition and watch the diagnostic bands.</p>
      <div class="controls">
        <label>Si:Al ratio<input type="number" step="0.5"
               [(ngModel)]="siAl"/></label>
        <label class="chk"><input type="checkbox"
               [(ngModel)]="hasWater"/> water present</label>
        <label class="chk"><input type="checkbox"
               [(ngModel)]="hasCarbonate"/> carbonate (CO₂ reacted in)</label>
        <button (click)="runFtir()">Show bands</button>
      </div>

      <div *ngIf="ftirResult?.ok" class="ftir">
        <!-- schematic spectrum: bands drawn at their wavenumber -->
        <svg class="spectrum" viewBox="0 0 400 90"
             preserveAspectRatio="xMidYMid meet">
          <line x1="0" y1="70" x2="400" y2="70" class="axis"></line>
          <ng-container *ngFor="let b of ftirResult.bands">
            <line *ngIf="bandX(b) !== null" [attr.x1]="bandX(b)"
                  y1="70" [attr.x2]="bandX(b)"
                  [attr.y2]="b.approxPositionCm ? 20 : 40"
                  [attr.class]="'band ' + bandClass(b)"></line>
          </ng-container>
          <text x="4" y="86" class="axtext">4000 cm⁻¹</text>
          <text x="330" y="86" class="axtext">400 cm⁻¹</text>
        </svg>
        <table class="bands">
          <tr><th>band</th><th>region</th><th>≈ position</th>
            <th>what it tells you</th></tr>
          <tr *ngFor="let b of ftirResult.bands">
            <td>{{ b.assignment }}</td>
            <td>{{ b.region_cm }}</td>
            <td>{{ b.approxPositionCm ? (b.approxPositionCm + ' cm⁻¹')
              : '—' }}</td>
            <td class="muted">{{ b.reading }}</td>
          </tr>
        </table>
        <p class="interp">{{ ftirResult.interpretation }}</p>
        <div class="refusals">
          <p *ngFor="let r of ftirResult.refusals" class="refuse">
            ⚠ {{ r }}</p>
        </div>
      </div>
    </div>

    <!-- ============ RESEARCH TOOLS ============ -->
    <div *ngIf="tab === 'tools'" class="panel">
      <div class="controls">
        <label>domain
          <select [(ngModel)]="domain" (ngModelChange)="loadTools()">
            <option value="">all</option>
            <option *ngFor="let d of domains" [value]="d">{{ d }}</option>
          </select></label>
        <span class="hint">easiest to build first.</span>
      </div>
      <div class="tool" *ngFor="let t of tools">
        <div class="t-head">
          <b>{{ t.displayName }}</b>
          <span class="chip" [attr.class]="'chip diff-' + t.difficulty">
            {{ t.difficulty }}</span>
          <span class="chip" [attr.class]="'chip tier-' + t.accessibilityTier">
            {{ t.accessibilityTier }}</span>
          <span class="chip dom" *ngFor="let d of t.domains">{{ d }}</span>
        </div>
        <p class="measures"><b>Measures:</b> {{ t.measures }}</p>
        <p class="how">{{ t.howPlain }}</p>
        <p class="caveat" *ngIf="t.correlationCaveat">⚠
          {{ t.correlationCaveat }}</p>
        <div class="parts">
          <span class="chip part" *ngFor="let p of t.parts"
                [attr.class]="'chip part tier-' + p.tier"
                [title]="p.note">{{ p.part }}</span>
        </div>
        <p class="safety"><b>Safety:</b> {{ t.safety }}</p>
        <p class="cite" *ngIf="t.notes">{{ t.notes }}</p>
      </div>
    </div>
  </div>`,
  styles: [`
    :host { display: block; color: var(--text-on-bg); }
    .research { max-width: 820px; margin: 0 auto; padding: 12px; }
    .panel, .method, .tool, .ftir { color: var(--text-on-card); }
    .hint { font-size: 12px; color: var(--text-on-bg-muted); }
    .tabs { display: flex; gap: 6px; margin: 10px 0; flex-wrap: wrap; }
    .tabs button { padding: 6px 12px; border: 1px solid var(--border-light);
      background: var(--surface-primary); color: var(--text-primary);
      border-radius: 6px; cursor: pointer; font-size: 13px; }
    .tabs button.active { background: var(--accent-primary, #3949ab);
      color: #fff; border-color: var(--accent-primary, #3949ab); }
    .panel { border: 1px solid var(--border-light); border-radius: 8px;
      padding: 12px; background: var(--surface-primary); }
    .method, .tool { border-top: 1px solid var(--border-light);
      padding: 10px 0; }
    .m-head, .t-head { display: flex; gap: 8px; align-items: center;
      flex-wrap: wrap; }
    .measures { font-size: 13px; margin: 4px 0; }
    .how { font-size: 12px; color: var(--text-on-card-muted);
      line-height: 1.5; }
    .suits, .safety { font-size: 12px; }
    .safety.warn { color: #c62828; }
    table { width: 100%; border-collapse: collapse; font-size: 12px;
      margin: 6px 0; }
    td, th { padding: 3px 8px; border-bottom: 1px solid var(--border-light);
      text-align: left; vertical-align: top; }
    .muted { color: var(--text-on-card-muted); }
    .cite, .caveat { font-size: 11px; color: var(--text-secondary); }
    .caveat { color: #b26a00; }
    .controls { display: flex; gap: 10px; align-items: center;
      flex-wrap: wrap; margin-bottom: 8px; }
    .controls label { display: flex; flex-direction: column;
      font-size: 11px; color: var(--text-on-card-muted); }
    .chk { flex-direction: row !important; gap: 4px; align-items: center;
      font-size: 12px; color: var(--text-on-card); }
    input, select { padding: 4px 6px; border: 1px solid var(--border-light);
      border-radius: 4px; background: var(--surface-app-background);
      color: var(--text-primary); }
    button { padding: 5px 12px; border: 1px solid var(--accent-primary, #3949ab);
      background: var(--accent-primary, #3949ab); color: #fff;
      border-radius: 5px; cursor: pointer; }
    .chip { font-size: 10px; padding: 2px 6px; border-radius: 10px;
      background: var(--surface-app-background); color: var(--text-on-bg-muted);
      border: 1px solid var(--border-light); display: inline-block; }
    .chip.ok { background: #2e7d32; color: #fff; border: none; }
    .chip.hazard { background: #c62828; color: #fff; border: none; }
    .chip.diff-trivial { background: #2e7d32; color: #fff; border: none; }
    .chip.diff-low { background: #7cb342; color: #000; border: none; }
    .chip.diff-moderate { background: #f9a825; color: #000; border: none; }
    .chip.diff-high { background: #c62828; color: #fff; border: none; }
    .chip.tier-household { background: #2e7d32; color: #fff; border: none; }
    .chip.tier-common-industrial { background: #f9a825; color: #000; border: none; }
    .chip.tier-mined-nonlocal { background: #8e24aa; color: #fff; border: none; }
    .chip.tier-lab-reagent { background: #c62828; color: #fff; border: none; }
    .chip.dom { background: transparent; }
    .chip.part { margin: 2px; }
    .parts { display: flex; flex-wrap: wrap; margin: 4px 0; }
    .spectrum { width: 100%; height: 90px; background: var(--surface-app-background);
      border-radius: 6px; margin: 6px 0; }
    .axis { stroke: var(--border-light); stroke-width: 1; }
    .band { stroke: var(--accent-primary, #3949ab); stroke-width: 2; }
    .band.carbonate { stroke: #2e7d32; stroke-width: 3; }
    .band.water { stroke: #1e88e5; }
    .axtext { fill: var(--text-on-card-muted); font-size: 8px; }
    .interp { font-size: 12px; color: var(--text-on-card); margin-top: 6px; }
    .refuse { color: #c62828; font-size: 11px; margin: 2px 0; }
  `],
})
export class PsppResearchComponent implements OnInit {
  tab = 'methods';
  tabList = [
    { key: 'methods', label: 'How we see materials' },
    { key: 'ftir', label: 'FTIR sampler' },
    { key: 'tools', label: 'Research tools' },
  ];

  methods: any[] = [];
  siAl = 2.0; hasWater = true; hasCarbonate = false;
  ftirResult: any = null;

  tools: any[] = [];
  domain = '';
  domains = ['materials', 'food', 'water', 'soil', 'carbon'];

  constructor(private pspp: PsppService) {}

  ngOnInit(): void {
    this.pspp.characterizationMethods().then(
      (r) => (this.methods = r?.methods || []));
    this.runFtir();
    this.loadTools();
  }

  runFtir(): void {
    this.pspp.ftir({ siAlRatio: this.siAl, hasWater: this.hasWater,
      hasCarbonate: this.hasCarbonate })
      .then((r) => (this.ftirResult = r));
  }

  loadTools(): void {
    this.pspp.researchTools(this.domain || undefined)
      .then((r) => (this.tools = r?.tools || []));
  }

  // map a wavenumber (400..4000 cm-1) to an x in 0..400 (reversed:
  // FTIR spectra run high->low wavenumber left->right).
  bandX(b: any): number | null {
    const cm = b.approxPositionCm || this.regionMid(b.region_cm);
    if (cm == null) return null;
    const clamped = Math.max(400, Math.min(4000, cm));
    return ((4000 - clamped) / 3600) * 380 + 5;
  }
  private regionMid(region: string): number | null {
    const nums = (region || '').match(/\d+/g);
    if (!nums) return null;
    const vals = nums.map(Number);
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  }
  bandClass(b: any): string {
    const a = (b.assignment || '').toLowerCase();
    if (a.includes('carbonate')) return 'carbonate';
    if (a.includes('water') || a.includes('o-h')) return 'water';
    return '';
  }
}
