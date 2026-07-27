import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { PsppService } from '@services/pspp/pspp.service';

/**
 * mtt-2 ceramics inspector + sintering-stage sampler.
 *
 * Four views over the ceramics data surface, every value read from
 * editable rows (CeramicSample / LadderRung / DigitizedDataset):
 *  - Samples: the gradual-escalating temperature ladder, with a
 *    steelmaking-temperature filter (local vs carbon-negative tracks)
 *    and a precursor/feedstock inspector per sample.
 *  - Furnace ladder: the geopolymer-oven -> steelmaking bootstrapping
 *    rungs + the physical consistency (fireable-below/survive-here).
 *  - Geopolymer -> ceramic: the DATA-BACKED thermal conversion
 *    (Table 8.8 porosity + XRD phases) + the honest glass branch.
 *  - Sinter sampler: fire a schedule and watch the ceramic at
 *    different STAGES during sintering (rho/grain refuse in place
 *    where their calibration is absent — refusals are RENDERED).
 *  - Glass (viscous): the refinement surface (viscosity ladder +
 *    exact VFT fit + fining/forming/annealing/devit gates graded at
 *    a probed temperature) and a viscous frit firing (Λ always;
 *    Frenkel-while-valid / master curve / MS-from-measured; every
 *    missing calibration refuses in place).
 */
@Component({
  selector: 'pspp-ceramics',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
  <div class="ceramics">
    <h2>PSPP — Ceramics: precursors, samples + sintering stages</h2>
    <p class="hint">Temperatures are literature-approximate cited
      claims; densification + carbon-negative NUMBERS refuse until
      digitized. Every panel reads editable rows.</p>

    <div class="tabs">
      <button *ngFor="let t of tabList" (click)="tab = t.key"
              [class.active]="tab === t.key">{{ t.label }}</button>
    </div>

    <!-- ============ SAMPLES ============ -->
    <div *ngIf="tab === 'samples'" class="panel">
      <div class="controls">
        <label>Meets service temp (&deg;C)</label>
        <input type="number" [(ngModel)]="minTemp"
               placeholder="e.g. 1600" min="0"/>
        <label class="chk"><input type="checkbox"
               [(ngModel)]="localOnly"/> local only</label>
        <label class="chk"><input type="checkbox"
               [(ngModel)]="carbonNegOnly"/> carbon-negative</label>
        <button (click)="loadSamples()">Filter</button>
        <button class="ghost" (click)="clearFilter()">Show ladder</button>
      </div>
      <p *ngIf="filterActive" class="hint">Linings that can survive
        {{ minTemp }} &deg;C{{ localOnly ? ', local track only' : '' }}{{
        carbonNegOnly ? ', carbon-negative only' : '' }}.</p>

      <div class="ladder-bars" *ngIf="samples.length">
        <div class="bar-row" *ngFor="let s of samples"
             (click)="select(s)" [class.sel]="selected?.name === s.name">
          <span class="bar-label">{{ s.displayName }}</span>
          <svg class="bar" [attr.viewBox]="'0 0 ' + barMax + ' 20'"
               preserveAspectRatio="none">
            <rect x="0" y="4" [attr.width]="s.maxServiceTempC" height="12"
                  rx="2" [attr.class]="'seg track-' + s.track"></rect>
          </svg>
          <span class="bar-temp">{{ s.maxServiceTempC }}&deg;C</span>
          <span class="chip" [attr.class]="'chip tier-' + s.accessibilityTier">
            {{ s.accessibilityTier }}</span>
          <span class="chip"
                [class.cneg]="s.carbonProfile === 'carbon-negative-capable'"
                [class.cpos]="s.carbonProfile === 'carbon-positive'">
            {{ carbonLabel(s.carbonProfile) }}</span>
        </div>
      </div>
      <p *ngIf="!samples.length" class="empty">No samples match.</p>

      <!-- precursor / feedstock inspector -->
      <div class="detail" *ngIf="selected">
        <h3>{{ selected.displayName }}</h3>
        <div class="meta">
          <span>family: <b>{{ selected.family }}</b></span>
          <span>track: <b>{{ selected.track }}</b></span>
          <span>refractory: <b>{{ selected.refractoryClass }}</b></span>
          <span>thermal shock: <b>{{ selected.thermalShock }}</b></span>
          <span>fire at: <b>{{ selected.peakFiringTempC }}&deg;C</b></span>
          <span>service: <b>{{ selected.maxServiceTempC }}&deg;C</b>
            <em>({{ selected.tempClaimStatus }})</em></span>
        </div>
        <h4>Precursors / feedstocks</h4>
        <table class="feed">
          <tr><th>material</th><th>accessibility</th><th>note</th></tr>
          <tr *ngFor="let f of selected.feedstocks">
            <td>{{ f.material }}</td>
            <td><span class="chip" [attr.class]="'chip tier-' + f.tier">
              {{ f.tier }}</span></td>
            <td class="muted">{{ f.note }}</td>
          </tr>
        </table>
        <h4>Use cases</h4>
        <ul><li *ngFor="let u of selected.useCases">{{ u }}</li></ul>
        <p class="cite">{{ selected.source }}</p>
        <p class="note" *ngIf="selected.notes">{{ selected.notes }}</p>
      </div>
    </div>

    <!-- ============ FURNACE LADDER ============ -->
    <div *ngIf="tab === 'ladder'" class="panel">
      <p class="hint">Each rung is built from the OUTPUT of the one
        below it — the thermal strain of material refinement.</p>
      <div class="rungs" *ngIf="ladder?.rungs">
        <div class="rung" *ngFor="let r of ladder.rungs"
             [class.branch]="r.gateKind !== 'thermal'">
          <div class="rung-head">
            <span class="rung-temp">{{ r.maxTempC }}&deg;C</span>
            <b>{{ r.displayName }}</b>
            <span class="chip" *ngIf="r.gateKind !== 'thermal'">
              gate: {{ r.gateKind }}</span>
          </div>
          <div class="rung-body">
            <span class="prereq" *ngIf="r.prerequisiteRung">from
              &larr; {{ r.prerequisiteRung }}</span>
            <div class="linings">lining:
              <span class="chip" *ngFor="let o of r.liningOptions"
                    [class.nonlocal]="o.track === 'non-local'">
                {{ o.sample || 'geopolymer body' }}
                <em>({{ o.track }})</em></span>
            </div>
            <div class="unlocks">unlocks:
              <span class="chip up" *ngFor="let u of r.unlocks">
                {{ u.ref }}</span>
            </div>
          </div>
        </div>
      </div>
      <div class="warns" *ngIf="ladder?.bootstrapCheck">
        <p [class.ok]="ladder.bootstrapCheck.ok">
          bootstrapping: {{ ladder.bootstrapCheck.ok ? 'consistent' :
          'HAS ERRORS' }} ·
          {{ warnCount }} prompt(s) to confirm sourcing</p>
        <ul>
          <li *ngFor="let f of ladder.bootstrapCheck.findings"
              [class.err]="f.severity === 'error'">
            <b>{{ f.severity }}</b> · {{ f.rung }} · {{ f.issue }}</li>
        </ul>
      </div>
    </div>

    <!-- ============ GEOPOLYMER -> CERAMIC ============ -->
    <div *ngIf="tab === 'geopolymer'" class="panel">
      <p class="hint" *ngIf="transition?.ok">Measured (Table 8.8):
        the same cured geopolymer body climbs from an amorphous gel to
        a crystalline refractory ceramic. Porosity + phases are
        DATA.</p>
      <div *ngIf="transition?.ok">
        <div class="gp-track">
          <div class="gp-stage" *ngFor="let s of transition.stages"
               [attr.class]="'gp-stage stg-' + s.stage">
            <span class="gp-temp">{{ s.temperatureC }}&deg;C</span>
            <svg class="gp-bar" viewBox="0 0 100 40"
                 preserveAspectRatio="none">
              <rect x="0" [attr.y]="poreY(s.openPorosityPct)"
                    width="100" [attr.height]="poreH(s.openPorosityPct)"
                    class="pore"></rect>
            </svg>
            <span class="gp-por">{{ s.openPorosityPct == null ? '—' :
              s.openPorosityPct + '%' }}</span>
            <span class="gp-phase">{{ s.xrdPhases }}</span>
          </div>
        </div>
        <table class="stage-tbl">
          <tr><th>&deg;C</th><th>stage</th><th>porosity</th>
            <th>phases</th><th>what happens</th></tr>
          <tr *ngFor="let s of transition.stages">
            <td>{{ s.temperatureC }}</td>
            <td>{{ s.stage }}</td>
            <td>{{ s.openPorosityPct == null ? '—' :
              s.openPorosityPct + '%' }}</td>
            <td>{{ s.xrdPhases }}</td>
            <td class="muted">{{ s.whatHappens }}</td>
          </tr>
        </table>
        <div class="glass" *ngIf="transition.glassBranch">
          <b>Glass branch (&gt; {{ transition.glassBranch.onsetC
            }} &deg;C):</b>
          <span class="refuse">above the measured range — specifics
            refuse</span>
          <p class="muted">{{ transition.glassBranch.what }}</p>
        </div>
        <p class="cite">{{ transition.evidence?.source }}</p>
      </div>
      <p *ngIf="transition && !transition.ok" class="refuse">
        {{ transition.refusal }}</p>
    </div>

    <!-- ============ SINTER SAMPLER ============ -->
    <div *ngIf="tab === 'sinter'" class="panel">
      <p class="hint">Fire a schedule and watch the ceramic at
        different STAGES during sintering. &Theta; (work of sintering)
        is pure math; density needs a calibrated master curve and
        refuses without one — the refusal is shown, not faked.</p>
      <div class="controls wrap">
        <label>ramp to (&deg;C)<input type="number"
               [(ngModel)]="peakC"/></label>
        <label>ramp (min)<input type="number"
               [(ngModel)]="rampMin"/></label>
        <label>hold (min)<input type="number"
               [(ngModel)]="holdMin"/></label>
        <label>Q (J/mol)<input type="number"
               [(ngModel)]="activationEnergy"/></label>
        <label>stages<input type="number" [(ngModel)]="nStages"
               min="2" max="10"/></label>
        <label class="chk"><input type="checkbox"
               [(ngModel)]="withGrain"/> grain growth</label>
        <label class="chk"><input type="checkbox"
               [(ngModel)]="withCurve"/> use master curve</label>
        <button (click)="fire()">Fire</button>
      </div>

      <div *ngIf="stages?.ok" class="stages">
        <svg class="theta-plot" viewBox="0 0 320 120"
             preserveAspectRatio="xMidYMid meet">
          <polyline [attr.points]="thetaPoints" class="theta-line"
                    fill="none"></polyline>
          <circle *ngFor="let p of thetaDots" [attr.cx]="p.x"
                  [attr.cy]="p.y" r="3" class="theta-dot"></circle>
        </svg>
        <table class="stage-tbl">
          <tr><th>stage</th><th>log &Theta;</th><th>density</th>
            <th *ngIf="withGrain">grain (&micro;m)</th></tr>
          <tr *ngFor="let s of stages.stages; let i = index">
            <td>{{ (s.fraction * 100) | number:'1.0-0' }}%</td>
            <td>{{ s.work?.logTheta | number:'1.1-2' }}</td>
            <td [class.refuse]="!s.density?.ok">
              <span *ngIf="s.density?.ok">{{ s.density.relativeDensity
                | number:'1.2-3' }}</span>
              <span *ngIf="!s.density?.ok" class="tiny">refused</span>
            </td>
            <td *ngIf="withGrain">{{ s.grain?.ok ?
              (s.grain.grainSizeUm | number:'1.1-2') : '—' }}</td>
          </tr>
        </table>
        <p class="refuse" *ngIf="densityRefusal">density:
          {{ densityRefusal }}</p>
        <p class="muted">{{ stages.note }}</p>
      </div>
      <p *ngIf="stages && !stages.ok" class="refuse">
        {{ stages.refusal }}</p>
    </div>

    <!-- ============ GLASS (REFINEMENT + VISCOUS SINTER) ============ -->
    <div *ngIf="tab === 'glass'" class="panel">
      <p class="hint">Glass refines and sinters by VISCOSITY, not
        diffusion. The fixed-point log-viscosities are definitions;
        the soda-lime temperatures are cited approximate data; the
        VFT curve is solved EXACTLY through them (residuals shown,
        nothing fitted). Devit kinetics + mid-stage densities refuse
        until their datasets are digitized.</p>

      <div *ngIf="glass?.ok">
        <h4>Viscosity ladder (soda-lime)</h4>
        <div class="visc-row" *ngFor="let p of glass.referencePoints">
          <span class="visc-name">{{ p.name }}</span>
          <svg class="bar" [attr.viewBox]="'0 0 15 20'"
               preserveAspectRatio="none">
            <rect x="0" y="4" [attr.width]="p.log10ViscosityPaS + 1"
                  height="12" rx="2" class="visc-seg"></rect>
          </svg>
          <span class="visc-eta">10<sup>{{ p.log10ViscosityPaS
            }}</sup> Pa·s</span>
          <span class="visc-temp">{{ p.temperatureC }}&deg;C</span>
          <span class="muted tiny">{{ p.what }}</span>
        </div>
        <p class="cite" *ngIf="glass.vftFit?.ok">
          VFT (exact solve): A = {{ glass.vftFit.A | number:'1.2-2'
          }}, B = {{ glass.vftFit.B_K | number:'1.0-0' }} K,
          T0 = {{ glass.vftFit.T0_C | number:'1.0-0' }} &deg;C ·
          residuals
          <span *ngFor="let r of glass.vftFit.residuals">
            {{ r.temperatureC }}&deg;C: {{ r.residual }}&nbsp;</span>
        </p>

        <h4>What can you do at&hellip;</h4>
        <div class="controls">
          <input type="number" [(ngModel)]="probeC"
                 placeholder="temperature C"/>
          <button (click)="probe()">Grade the gates</button>
        </div>
        <div *ngIf="probed?.ok" class="gates">
          <p class="cite" *ngIf="probed.viscosity?.ok">
            log10 &eta; = {{ probed.viscosity.log10ViscosityPaS
            | number:'1.1-2' }} Pa·s at
            {{ probed.temperatureC }}&deg;C</p>
          <p class="refuse" *ngIf="probed.viscosity &&
                !probed.viscosity.ok">
            {{ probed.viscosity.refusal }}</p>
          <div class="gate" *ngFor="let g of probed.gates">
            <span class="chip" [class.g-open]="g.open"
                  [class.g-closed]="g.open === false"
                  [class.g-warn]="g.grade === 'marginal'">
              {{ g.window }} · {{ g.grade || 'refused' }}</span>
            <span class="muted tiny">{{ g.behaviorNote ||
              g.refusal }}</span>
          </div>
        </div>
        <p class="cite">Devit-risk zone {{ glass.devitrification
          ?.zoneC?.[0] }}&ndash;{{ glass.devitrification?.zoneC?.[1]
          }}&deg;C · {{ glass.devitrification?.kinetics }}</p>
      </div>

      <h4>Viscous frit firing</h4>
      <div class="controls wrap">
        <label>peak (&deg;C)<input type="number"
               [(ngModel)]="gPeakC"/></label>
        <label>ramp (min)<input type="number"
               [(ngModel)]="gRampMin"/></label>
        <label>hold (min)<input type="number"
               [(ngModel)]="gHoldMin"/></label>
        <label>particle r (&micro;m)<input type="number"
               [(ngModel)]="gRadiusUm"/></label>
        <label>green &rho;<input type="number" step="0.01"
               [(ngModel)]="gGreen"/></label>
        <label class="chk"><input type="checkbox"
               [(ngModel)]="gWithCurve"/> use master curve</label>
        <label class="chk"><input type="checkbox"
               [(ngModel)]="gMeasured"/> measured checkpoint</label>
        <label *ngIf="gMeasured">measured &rho;<input type="number"
               step="0.01" [(ngModel)]="gMeasRho"/></label>
        <label *ngIf="gMeasured">pore r (&micro;m)<input type="number"
               [(ngModel)]="gPoreUm"/></label>
        <button (click)="fireGlass()">Fire</button>
      </div>
      <div *ngIf="glassFire" class="stages">
        <p *ngIf="glassFire.work?.ok">
          &Lambda; = {{ glassFire.work.lambda | number:'1.3-4' }}
          (log10 {{ glassFire.work.log10Lambda | number:'1.1-2' }})
          — pure math over the cited &gamma;/VFT/r.</p>
        <p class="refuse" *ngIf="glassFire.work &&
              !glassFire.work.ok">{{ glassFire.work.refusal }}</p>
        <p *ngIf="glassFire.density?.ok">
          &rho; = {{ glassFire.density.relativeDensity
          | number:'1.3-4' }}
          <span class="chip">{{ glassFire.density.stage }}</span></p>
        <p class="refuse" *ngIf="glassFire.density &&
              !glassFire.density.ok">density:
          {{ glassFire.density.refusal }} —
          {{ glassFire.density.suggestion }}</p>
        <p *ngIf="glassFire.finalStage?.ok">
          final stage (MS from measured checkpoint): &rho; =
          {{ glassFire.finalStage.relativeDensity
          | number:'1.3-4' }}</p>
        <p class="refuse" *ngIf="glassFire.finalStage &&
              !glassFire.finalStage.ok">final stage:
          {{ glassFire.finalStage.refusal }}</p>
        <p class="muted tiny" *ngIf="glassFire.structurePlan?.ok">
          proposes {{ glassFire.structurePlan.proposedRows.length }}
          L2 rows (amorphous matrix + pores — no grain row: glass
          has no grains).</p>
      </div>
    </div>
  </div>`,
  styles: [`
    :host { display: block; color: var(--text-on-bg); }
    .ceramics { max-width: 860px; margin: 0 auto; padding: 12px; }
    .panel, .detail, .warns, .glass { color: var(--text-on-card); }
    .hint { font-size: 12px; color: var(--text-on-bg-muted); }
    .tabs { display: flex; gap: 6px; margin: 10px 0; flex-wrap: wrap; }
    .tabs button { padding: 6px 12px; border: 1px solid var(--border-light);
      background: var(--surface-primary); color: var(--text-primary);
      border-radius: 6px; cursor: pointer; font-size: 13px; }
    .tabs button.active { background: var(--accent-primary, #3949ab);
      color: #fff; border-color: var(--accent-primary, #3949ab); }
    .panel { border: 1px solid var(--border-light); border-radius: 8px;
      padding: 12px; background: var(--surface-primary); }
    .controls { display: flex; gap: 8px; align-items: center;
      flex-wrap: wrap; margin-bottom: 8px; }
    .controls.wrap label { display: flex; flex-direction: column;
      font-size: 11px; color: var(--text-on-card-muted); }
    input, select { padding: 4px 6px; border: 1px solid var(--border-light);
      border-radius: 4px; background: var(--surface-app-background);
      color: var(--text-primary); }
    button { padding: 5px 12px; border: 1px solid var(--accent-primary, #3949ab);
      background: var(--accent-primary, #3949ab); color: #fff;
      border-radius: 5px; cursor: pointer; }
    button.ghost { background: transparent; color: var(--text-primary);
      border-color: var(--border-light); }
    .chk { flex-direction: row !important; gap: 4px; align-items: center;
      font-size: 12px; color: var(--text-on-card); }
    .bar-row { display: grid; grid-template-columns: 200px 1fr 70px 120px 110px;
      gap: 8px; align-items: center; padding: 3px 4px; cursor: pointer;
      border-radius: 4px; }
    .bar-row:hover, .bar-row.sel { background: var(--surface-app-background); }
    .bar-label { font-size: 12px; }
    .bar { width: 100%; height: 20px; }
    .seg.track-local { fill: #43a047; }
    .seg.track-non-local { fill: #8e24aa; }
    .bar-temp { font-size: 12px; text-align: right; }
    .chip { font-size: 10px; padding: 2px 6px; border-radius: 10px;
      background: var(--surface-app-background); color: var(--text-on-bg-muted);
      border: 1px solid var(--border-light); display: inline-block; }
    .chip.tier-household { background: #2e7d32; color: #fff; border: none; }
    .chip.tier-common-industrial { background: #f9a825; color: #000; border: none; }
    .chip.tier-mined-nonlocal { background: #8e24aa; color: #fff; border: none; }
    .chip.tier-lab-reagent { background: #c62828; color: #fff; border: none; }
    .chip.cneg { background: #1b5e20; color: #fff; border: none; }
    .chip.cpos { background: #6d4c41; color: #fff; border: none; }
    .chip.nonlocal { border-color: #8e24aa; }
    .chip.up { background: var(--accent-primary, #3949ab); color: #fff; border: none; }
    .detail { margin-top: 12px; border-top: 1px solid var(--border-light);
      padding-top: 10px; }
    .meta { display: flex; flex-wrap: wrap; gap: 10px; font-size: 12px;
      color: var(--text-on-card-muted); }
    .meta em { color: var(--text-secondary); }
    table { width: 100%; border-collapse: collapse; font-size: 12px;
      margin: 6px 0; }
    td, th { padding: 3px 8px; border-bottom: 1px solid var(--border-light);
      text-align: left; }
    .muted { color: var(--text-on-card-muted); }
    .cite, .note { font-size: 11px; color: var(--text-secondary); }
    .empty { color: var(--text-on-bg-muted); font-style: italic; }
    .rung { border: 1px solid var(--border-light); border-radius: 6px;
      padding: 8px; margin: 6px 0; background: var(--surface-app-background); }
    .rung.branch { border-style: dashed; }
    .rung-head { display: flex; gap: 8px; align-items: center; }
    .rung-temp { font-weight: 700; color: var(--accent-primary, #3949ab); }
    .rung-body { font-size: 12px; margin-top: 4px; display: flex;
      flex-direction: column; gap: 3px; }
    .prereq { color: var(--text-on-card-muted); }
    .linings, .unlocks { display: flex; gap: 4px; flex-wrap: wrap;
      align-items: center; }
    .warns { margin-top: 10px; font-size: 12px; }
    .warns p.ok { color: #2e7d32; } .warns li.err { color: #c62828; }
    .gp-track { display: flex; gap: 4px; overflow-x: auto; padding: 6px 0; }
    .gp-stage { min-width: 74px; text-align: center; font-size: 10px;
      display: flex; flex-direction: column; gap: 2px; }
    .gp-bar { width: 100%; height: 40px; background: var(--surface-app-background); }
    .pore { fill: #90caf9; }
    .stg-amorphous-geopolymer .gp-temp { color: #6d4c41; }
    .stg-crystallizing-kalsilite .gp-temp,
    .stg-ceramic-leucite .gp-temp,
    .stg-ceramic-distorted-kalsilite .gp-temp { color: #c62828; }
    .gp-phase { color: var(--text-on-card-muted); }
    .glass { margin-top: 10px; padding: 8px; border: 1px dashed var(--border-light);
      border-radius: 6px; }
    .refuse { color: #c62828; font-size: 12px; }
    .tiny { font-size: 10px; }
    .theta-plot { width: 100%; height: 120px; background: var(--surface-app-background);
      border-radius: 6px; }
    .theta-line { stroke: var(--accent-primary, #3949ab); stroke-width: 2; }
    .theta-dot { fill: var(--accent-primary, #3949ab); }
    .visc-row { display: grid;
      grid-template-columns: 150px 1fr 110px 70px minmax(160px, 2fr);
      gap: 8px; align-items: center; padding: 2px 4px; font-size: 12px; }
    .visc-seg { fill: var(--accent-primary, #3949ab); }
    .visc-eta { text-align: right; }
    .visc-temp { font-weight: 700; }
    .gates { display: flex; flex-direction: column; gap: 4px;
      margin: 6px 0; }
    .gate { display: flex; gap: 8px; align-items: baseline; }
    .chip.g-open { background: #2e7d32; color: #fff; border: none; }
    .chip.g-closed { background: #c62828; color: #fff; border: none; }
    .chip.g-warn { background: #f9a825; color: #000; border: none; }
    h4 { margin: 12px 0 4px; }
  `],
})
export class PsppCeramicsComponent implements OnInit {
  tab = 'samples';
  tabList = [
    { key: 'samples', label: 'Samples + precursors' },
    { key: 'ladder', label: 'Furnace ladder' },
    { key: 'geopolymer', label: 'Geopolymer → ceramic' },
    { key: 'sinter', label: 'Sinter sampler' },
    { key: 'glass', label: 'Glass (viscous)' },
  ];

  samples: any[] = [];
  selected: any = null;
  barMax = 2100;
  minTemp: number | null = null;
  localOnly = false;
  carbonNegOnly = false;
  filterActive = false;

  ladder: any = null;
  transition: any = null;

  // sinter sampler inputs
  peakC = 1500; rampMin = 180; holdMin = 120;
  activationEnergy = 500000; nStages = 5;
  withGrain = true; withCurve = false;
  stages: any = null;
  thetaPoints = ''; thetaDots: { x: number; y: number }[] = [];
  densityRefusal = '';

  // glass tab (refinement + viscous firing)
  glass: any = null;
  probeC = 725; probed: any = null;
  gPeakC = 650; gRampMin = 60; gHoldMin = 60;
  gRadiusUm = 100; gGreen = 0.6;
  gWithCurve = false; gMeasured = false;
  gMeasRho = 0.92; gPoreUm = 10;
  glassFire: any = null;

  constructor(private pspp: PsppService) {}

  ngOnInit(): void {
    this.clearFilter();
    this.pspp.ceramicsLadder().then((r) => (this.ladder = r));
    this.pspp.geopolymerTransition().then((r) => (this.transition = r));
    this.pspp.glassRefinement().then((r) => (this.glass = r));
  }

  probe(): void {
    if (this.probeC == null) return;
    this.pspp.glassRefinement(this.probeC)
      .then((r) => (this.probed = r));
  }

  fireGlass(): void {
    const body: any = {
      schedule: [
        { ramp_from_c: 25, ramp_to_c: this.gPeakC,
          minutes: this.gRampMin },
        { hold_c: this.gPeakC, minutes: this.gHoldMin },
      ],
      particleRadiusUm: this.gRadiusUm,
      greenDensity: this.gGreen,
      stateKey: 'soda-lime-frit#fired',
    };
    if (this.gWithCurve) {
      body.masterCurve = 'glass-frit-viscous-sintering-master-curve';
    }
    if (this.gMeasured) {
      body.measured = { density: this.gMeasRho,
                        poreRadiusUm: this.gPoreUm };
    }
    this.pspp.sinterViscous(body).then((r) => (this.glassFire = r));
  }

  clearFilter(): void {
    this.filterActive = false;
    this.minTemp = null;
    this.pspp.ceramicsSamples().then((r) => {
      this.samples = r?.ladder || [];
      this.selected = this.samples[0] || null;
    });
  }

  loadSamples(): void {
    if (this.minTemp == null) { this.clearFilter(); return; }
    this.filterActive = true;
    this.pspp.ceramicsSamples({ minTemp: this.minTemp,
      local: this.localOnly, carbonNegative: this.carbonNegOnly })
      .then((r) => {
        this.samples = r?.samples || [];
        this.selected = this.samples[0] || null;
      });
  }

  select(s: any): void { this.selected = s; }

  carbonLabel(p: string): string {
    return p === 'carbon-negative-capable' ? 'carbon−'
      : p === 'carbon-positive' ? 'carbon+' : 'neutral';
  }

  get warnCount(): number {
    return (this.ladder?.bootstrapCheck?.findings || [])
      .filter((f: any) => f.severity === 'warn').length;
  }

  // geopolymer porosity bar geometry (0..60% mapped into 40px)
  poreY(p: number | null): number {
    if (p == null) return 40;
    return 40 - Math.min(40, (p / 60) * 40);
  }
  poreH(p: number | null): number {
    if (p == null) return 0;
    return Math.min(40, (p / 60) * 40);
  }

  fire(): void {
    const schedule = [
      { ramp_from_c: 25, ramp_to_c: this.peakC, minutes: this.rampMin },
      { hold_c: this.peakC, minutes: this.holdMin },
    ];
    const body: any = {
      schedule, activationEnergy: this.activationEnergy,
      nStages: this.nStages,
    };
    if (this.withGrain) {
      body.grain = { d0: 0.5, n: 3, k0: 1e12, Qg: 250000 };
    }
    if (this.withCurve) {
      body.masterCurve = 'alumina-densification-master-curve';
    }
    this.pspp.sinterStages(body).then((r) => {
      this.stages = r;
      this.densityRefusal = '';
      if (r?.ok) this.plotTheta(r.stages);
      const bad = (r?.stages || []).find((s: any) => !s.density?.ok);
      if (bad) this.densityRefusal = bad.density?.refusal || '';
    });
  }

  private plotTheta(stages: any[]): void {
    const logs = stages.map((s) => s.work?.logTheta ?? 0);
    const lo = Math.min(...logs), hi = Math.max(...logs);
    const span = hi - lo || 1;
    const pts = stages.map((s, i) => {
      const x = 10 + (300 * i) / Math.max(1, stages.length - 1);
      const y = 110 - (100 * ((s.work?.logTheta ?? lo) - lo)) / span;
      return { x, y };
    });
    this.thetaDots = pts;
    this.thetaPoints = pts.map((p) => `${p.x},${p.y}`).join(' ');
  }
}
