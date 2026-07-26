import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PsppService } from '@services/pspp/pspp.service';
import { SimSpaceViewerComponent } from '@components/sim-space/sim-space-viewer/sim-space-viewer.component';
import { SciSeries, SciXyChartComponent } from '@components/charts/sci-xy-chart.component';

/**
 * gsp-3 (GEOPOLYMER_STRUCTURE_SAMPLING_PLAN): the geopolymer
 * structure page — most-likely groups (Q-motif distribution) plus a
 * REPRESENTATIVE 3D sample drawn from that distribution, rendered
 * through the same SimSpace viewer as the crystal lattices.
 *
 * Amorphous honesty: every view is labeled a sample from the
 * ensemble, never THE structure; resampling (new seed) is a feature.
 * Styling: theme tokens only; the motif bar colors are fixed
 * data-mark colors (same palette as the proofing charts).
 */
@Component({
  selector: 'pspp-structure',
  standalone: true,
  imports: [CommonModule, FormsModule, SimSpaceViewerComponent,
            SciXyChartComponent],
  template: `<div class="page">
    <h2>Geopolymer structure — groups + sampled ensemble</h2>
    <p class="hint">Amorphous materials have DISTRIBUTIONS, not unit
      cells. Left: the most likely structural groups (Q-species
      motifs). Right: one representative cluster SAMPLED from that
      distribution — resample to see another equally valid
      realization.</p>

    <div class="controls">
      <label>mode
        <select [(ngModel)]="mode" (change)="loadGroups()">
          <option value="reference">reference (cation + MR)</option>
          <option value="state">material state</option>
          <option value="stepped">stepped network (gsp-4b)</option>
        </select>
      </label>
      <ng-container *ngIf="mode === 'reference'">
        <label>cation
          <select [(ngModel)]="cation" (change)="loadGroups()">
            <option>Na</option><option>K</option>
          </select>
        </label>
        <label>MR
          <input type="number" step="0.1" min="0"
                 [(ngModel)]="mr" (change)="loadGroups()">
        </label>
        <label>state
          <select [(ngModel)]="physicalState" (change)="loadGroups()">
            <option value="glass">glass</option>
            <option value="solution">solution</option>
          </select>
        </label>
      </ng-container>
      <ng-container *ngIf="mode === 'state'">
        <label>material
          <input [(ngModel)]="material" (change)="loadGroups()"
                 placeholder="MaterialsScienceMaterial name">
        </label>
        <label>state
          <input [(ngModel)]="state" (change)="loadGroups()"
                 placeholder="(canonical)">
        </label>
      </ng-container>
      <ng-container *ngIf="mode === 'stepped'">
        <label>cation
          <select [(ngModel)]="cation" (change)="loadGroups()">
            <option>Na</option><option>K</option>
          </select>
        </label>
        <label>MR
          <input type="number" step="0.1" min="0"
                 [(ngModel)]="mr" (change)="loadGroups()">
        </label>
        <label class="steps">network steps — one per line:
          rule-name [xN]
          <textarea rows="2" [(ngModel)]="stepsText"
                    (change)="loadGroups()"
                    placeholder="ortho-sialate-formation x2">
          </textarea>
        </label>
      </ng-container>
    </div>

    <div class="columns">
      <div class="panel">
        <h3>Most likely groups</h3>
        <ng-container *ngIf="groups?.ok">
          <div class="bar-row" *ngFor="let g of groups.groups">
            <span class="motif">{{ g.motif }}</span>
            <div class="bar-rail">
              <div class="bar" [style.width.%]="g.fraction * 100"
                   [style.background]="motifColor(g.motif)"></div>
            </div>
            <span class="pct">{{ g.fraction * 100 | number:'1.1-1'
              }}%</span>
            <span class="desc">{{ g.description }}</span>
          </div>
          <p class="cite" *ngIf="groups.evidence">{{ groups.evidence
            }}</p>
          <p class="caveat" *ngFor="let c of groups.caveats">⚠
            {{ c }}</p>
          <p class="note" *ngFor="let a of groups.assumptions">
            {{ a }}</p>
          <ng-container *ngIf="groups.mode === 'stepped'">
            <p class="note" *ngIf="groups.stepsApplied?.length">
              applied: <span *ngFor="let s of groups.stepsApplied">
                {{ s.rule }}×{{ s.times }} </span></p>
            <p class="caveat"
               *ngIf="objectKeys(groups.unmappedQuantified).length">
              outside the Q ledger:
              {{ objectKeys(groups.unmappedQuantified).join(', ')
              }}</p>
            <p class="note"
               *ngIf="groups.presentUnquantified?.length">
              present unquantified:
              {{ groups.presentUnquantified.join(', ') }}</p>
          </ng-container>
        </ng-container>
        <div class="refusal" *ngIf="groups && !groups.ok">
          <b>{{ groups.refusal }}</b>
          <div class="sugg" *ngIf="groups.suggestion">
            {{ groups.suggestion }}</div>
          <button *ngIf="mode === 'state'"
                  (click)="mode = 'reference'; loadGroups()">
            use reference mode instead</button>
        </div>
      </div>

      <div class="panel">
        <h3>Sampled cluster
          <span class="chip">sample ≠ structure</span></h3>
        <div class="knobs">
          <label>tetrahedra
            <input type="number" min="2" max="400"
                   [(ngModel)]="nTetrahedra"></label>
          <label>Si/Al
            <input type="number" step="0.5" min="1"
                   [(ngModel)]="siAlRatio"
                   placeholder="(none)"></label>
          <label>seed
            <input type="number" [(ngModel)]="seed"></label>
          <label>density g/cm³ (0 = open)
            <input type="number" step="0.1" min="0" max="4"
                   [(ngModel)]="targetDensity"></label>
          <button (click)="generate()"
                  [disabled]="busy || !groups?.ok">
            {{ busy ? 'sampling…' : 'generate 3D sample' }}</button>
          <button (click)="seed = seed + 1; generate()"
                  [disabled]="busy || !scene">resample</button>
        </div>
        <div class="viewer" *ngIf="scene?.sceneName">
          <sim-space-viewer [simSpaceName]="scene.sceneName"
                            [hideRunPanel]="true"
                            [clickNavigates]="false">
          </sim-space-viewer>
        </div>
        <ng-container *ngIf="scene?.ok">
          <table class="qq">
            <tr><th></th>
              <th *ngFor="let m of motifs">{{ m }}</th></tr>
            <tr><td>target</td>
              <td *ngFor="let m of motifs">{{ scene.targetQ[m] * 100
                | number:'1.0-1' }}%</td></tr>
            <tr><td>achieved</td>
              <td *ngFor="let m of motifs">{{ scene.achievedQ[m] * 100
                | number:'1.0-1' }}%</td></tr>
          </table>
          <div class="chips">
            <span class="chip">seed {{ scene.seed }}</span>
            <span class="chip">{{ scene.counts.tetrahedra }} tet /
              {{ scene.counts.atoms }} atoms</span>
            <span class="chip" *ngIf="scene.density">
              packed {{ scene.density.achievedGCm3 }} g/cm³
              (target {{ scene.density.targetGCm3 }})</span>
            <span class="chip warn"
                  *ngIf="scene.honesty.parityAdjusted">
              parity-adjusted</span>
            <span class="chip warn"
                  *ngIf="scene.honesty.unpairedStubs">
              {{ scene.honesty.unpairedStubs }} unpaired stubs →
              terminal O</span>
            <span class="chip warn"
                  *ngIf="scene.honesty.loewensteinViolations">
              {{ scene.honesty.loewensteinViolations }} Al-O-Al
              violations</span>
          </div>
          <p class="note">Bridging O bright, terminal O pale;
            {{ cation }}⁺ beside each AlO₄⁻.</p>
        </ng-container>
        <div class="refusal" *ngIf="scene && !scene.ok">
          <b>{{ scene.refusal || scene.error }}</b>
          <div class="sugg" *ngIf="scene.suggestion">
            {{ scene.suggestion }}</div>
        </div>

        <div class="xrd-block">
          <button (click)="runXrd()"
                  [disabled]="busy || !groups?.ok">
            {{ xrdBusy ? 'diffracting…' : 'simulate XRD (Debye)' }}
          </button>
          <ng-container *ngIf="xrd?.ok">
            <sci-xy-chart [series]="xrdSeries"
                          [height]="220" [width]="480"
                          xLabel="2θ (deg, CuKα)"
                          yLabel="I / I₀"
                          title="Finite-cluster Debye pattern"
                          [note]="'residual above the size-envelope '
                            + 'baseline; peaks: ' + peakSummary">
            </sci-xy-chart>
            <div class="chips">
              <span class="chip"
                    [class.warn]="!xrd.halo.anyPeakInBand">
                gel halo band {{ xrd.halo.band?.[0] }}–{{
                  xrd.halo.band?.[1] }}°:
                {{ xrd.halo.anyPeakInBand ? 'peak in band'
                   : 'no peak in band' }}</span>
              <span class="chip" *ngFor="let p of xrd.peaks">
                {{ p.position2Theta }}° (d={{ p.dSpacingA }} Å)</span>
            </div>
            <p class="note" *ngFor="let a of xrd.assumptions">
              {{ a }}</p>
          </ng-container>
          <div class="refusal" *ngIf="xrd && !xrd.ok">
            <b>{{ xrd.refusal }}</b>
            <div class="sugg" *ngIf="xrd.suggestion">
              {{ xrd.suggestion }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>`,
  styles: [`
    :host { display: block; color: var(--text-on-bg); }
    .card, .panel, .section, .form, .pspp-chart-card, .home a.card { color: var(--text-on-card); }
    .page { max-width: 1100px; margin: 0 auto; padding: 12px; }
    .hint { font-size: 12px; color: var(--text-on-bg-muted); }
    .controls, .knobs { display: flex; flex-wrap: wrap; gap: 10px;
      align-items: end; margin: 10px 0; }
    label { display: flex; flex-direction: column; gap: 2px;
      font-size: 11px; color: var(--text-secondary); }
    input, select { padding: 3px 6px; font-size: 12px;
      background: var(--surface-primary);
      color: var(--text-primary);
      border: 1px solid var(--border-medium); border-radius: 4px; }
    button { padding: 4px 10px; font-size: 12px; cursor: pointer;
      background: var(--brand-indigo); color: var(--text-on-primary);
      border: none; border-radius: 4px; }
    button:disabled { opacity: 0.5; cursor: default; }
    .columns { display: grid; gap: 12px;
      grid-template-columns: repeat(auto-fit, minmax(340px, 1fr)); }
    .panel { border: 1px solid var(--border-light); border-radius: 8px;
      padding: 10px; background: var(--surface-primary); }
    .bar-row { display: grid; align-items: center; gap: 8px;
      grid-template-columns: 26px 1fr 48px minmax(120px, 1.4fr);
      font-size: 11px; margin: 4px 0; }
    .motif { font-weight: 600; }
    .bar-rail { height: 12px; border-radius: 3px;
      background: var(--surface-hover); overflow: hidden; }
    .bar { height: 100%; }
    .pct { text-align: right; }
    .desc { color: var(--text-secondary); }
    .cite, .note { font-size: 10px; color: var(--text-tertiary);
      margin: 4px 0 0; }
    .caveat { font-size: 11px; color: var(--color-warn-text);
      margin: 4px 0 0; }
    .refusal { border: 1px dashed var(--color-warn-border);
      border-radius: 8px; padding: 8px; margin-top: 8px;
      background: var(--color-warn-bg); font-size: 12px; }
    .sugg { color: var(--text-secondary); font-size: 11px;
      margin-top: 3px; }
    .viewer { height: 360px; margin: 8px 0;
      border: 1px solid var(--border-light); border-radius: 8px;
      overflow: hidden; }
    .qq { font-size: 11px; border-collapse: collapse; margin: 6px 0; }
    .qq td, .qq th { padding: 2px 8px; text-align: right;
      border-bottom: 1px solid var(--border-light); }
    .chips { display: flex; flex-wrap: wrap; gap: 6px; margin: 6px 0; }
    .chip { font-size: 10px; padding: 2px 8px; border-radius: 12px;
      background: var(--surface-secondary);
      color: var(--text-secondary); }
    .chip.warn { background: var(--color-warn-bg);
      color: var(--color-warn-text); }
    .xrd-block { margin-top: 10px; border-top: 1px solid
      var(--border-light); padding-top: 8px; }
    label.steps { min-width: 260px; }
    textarea { font-size: 11px; background: var(--surface-primary);
      color: var(--text-primary);
      border: 1px solid var(--border-medium); border-radius: 4px; }
  `],
})
export class PsppStructureComponent implements OnInit {
  motifs = ['Q0', 'Q1', 'Q2', 'Q3', 'Q4'];
  mode: 'reference' | 'state' | 'stepped' = 'reference';
  stepsText = '';
  xrd: any = null;
  xrdBusy = false;
  objectKeys = (o: any) => Object.keys(o ?? {});
  cation = 'Na';
  mr = 1.0;
  physicalState = 'glass';
  material = '';
  state = '';
  nTetrahedra = 60;
  seed = 1;
  siAlRatio: number | null = null;
  targetDensity = 2.0;
  groups: any = null;
  scene: any = null;
  busy = false;

  // fixed data-mark palette — same series colors as the proofing
  // charts (Q0..Q4); deliberately NOT theme tokens.
  private palette: Record<string, string> = {
    Q0: '#4269d0', Q1: '#efb118', Q2: '#ff725c',
    Q3: '#6cc5b0', Q4: '#3ca951',
  };

  constructor(private pspp: PsppService) {}

  ngOnInit(): void {
    this.loadGroups();
  }

  motifColor(motif: string): string {
    return this.palette[motif] ?? 'var(--text-tertiary)';
  }

  /** "rule-name [xN]" lines -> [{rule, times}] */
  parseSteps(): { rule: string; times: number }[] {
    return this.stepsText.split('\n')
      .map((line) => line.trim()).filter(Boolean)
      .map((line) => {
        const m = line.match(/^(\S+)(?:\s+x(\d+))?$/i);
        return { rule: m ? m[1] : line,
                 times: m?.[2] ? parseInt(m[2], 10) : 1 };
      });
  }

  async loadGroups(): Promise<void> {
    this.groups = null;
    this.scene = null;
    this.xrd = null;
    this.buildXrdSeries();
    if (this.mode === 'state') {
      this.groups = await this.pspp.structureGroups(
        { material: this.material, state: this.state });
    } else if (this.mode === 'stepped') {
      this.groups = await this.pspp.structureSteppedGroups(
        { cation: this.cation, mr: this.mr,
          steps: this.parseSteps() });
    } else {
      this.groups = await this.pspp.structureGroups(
        { cation: this.cation, mr: this.mr,
          physicalState: this.physicalState });
    }
  }

  private sampleBody(): any {
    const body: any = {
      nTetrahedra: this.nTetrahedra, seed: this.seed,
      cation: this.cation,
    };
    if (this.siAlRatio) { body.siAlRatio = this.siAlRatio; }
    body.targetDensity = this.targetDensity || 0;
    if (this.mode === 'state') {
      body.material = this.material;
      if (this.state) { body.state = this.state; }
    } else if (this.mode === 'stepped') {
      // stepped fractions ride along explicitly — the sample/xrd
      // endpoints take qFractions directly
      body.qFractions = {};
      for (const g of this.groups?.groups ?? []) {
        body.qFractions[g.motif] = g.fraction;
      }
      body.mr = this.mr;
    } else {
      body.mr = this.mr;
      body.physicalState = this.physicalState;
    }
    return body;
  }

  // Materialized ONCE per XRD result — must NOT be getters. A getter
  // bound to [series] allocates a new array every change-detection
  // cycle, sci-xy-chart re-renders Observable Plot each time, that DOM
  // work retriggers CD, and the page freezes in a render storm (the
  // "browser slowdown → renders only after Stop" bug). Stable field
  // references break the loop.
  xrdSeries: SciSeries[] = [];
  peakSummary = '';

  private buildXrdSeries(): void {
    if (!this.xrd?.ok) { this.xrdSeries = []; this.peakSummary = '';
                         return; }
    const tt = this.xrd.curve.twoTheta;
    this.xrdSeries = [
      { label: 'I(2θ)', kind: 'line',
        points: tt.map((x: number, i: number) =>
          ({ x, y: this.xrd.curve.intensity[i] })) },
      { label: 'residual ×10', kind: 'line', color: '#ff725c',
        points: tt.map((x: number, i: number) =>
          ({ x, y: this.xrd.curve.residual[i] * 10 })) },
    ];
    this.peakSummary = (this.xrd.peaks ?? [])
      .map((p: any) => `${p.position2Theta}°`).join(', ');
  }

  async runXrd(): Promise<void> {
    this.xrdBusy = true;
    try {
      this.xrd = await this.pspp.structureXrd(this.sampleBody());
      this.buildXrdSeries();
    } finally {
      this.xrdBusy = false;
    }
  }

  async generate(): Promise<void> {
    this.busy = true;
    try {
      this.scene = await this.pspp.structureScene(this.sampleBody());
    } finally {
      this.busy = false;
    }
  }
}
