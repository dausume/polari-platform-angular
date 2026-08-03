import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { PolariService } from '@services/polari-service';
import { GraphRendererComponent }
  from '@components/graph-config/graph-renderer/graph-renderer';
import { NamedGraphConfig } from '@models/graphs/NamedGraphConfig';

/**
 * /co2/health — the CO2 and human health study page.
 *
 * THE POINT OF THIS PAGE IS THE PROVENANCE CHIP. A measured
 * 427 ppm and a modelled crossing year of 2049 are utterly
 * different epistemic objects, and rendering them in the same
 * typeface is how a reader mistakes a simulation for evidence.
 * Every claim value therefore carries its class, the legend that
 * defines the four classes is always visible, and the wording of
 * those definitions is whatever /api/climate/claims returns —
 * never restated here, so it stays in one place.
 *
 * Refusals are first-class: a section with no payload, a graph
 * whose series is not ingested, a panel whose endpoint is down —
 * each renders its own reason. Nothing is silently omitted.
 */

/** The four classes in the order a reader should meet them. */
const PROVENANCE_ORDER = ['measured', 'cited', 'derived',
                          'modelled'];

/** Which seeded graphs belong under which view section. */
const SECTION_GRAPHS: { [section: string]: string[] } = {
  'outdoor-record': ['climate-co2-instrumental'],
  // The trajectory answers "when does an urban sealed bedroom
  // reach 3000 ppm" — it belongs beside the crossings, which is
  // the section that asks when each line arrives.
  'crossings': ['climate-urban-bedroom-trajectory'],
  'human-history': ['climate-co2-800kyr'],
  'trend-fits': ['climate-co2-growth-rate'],
  'carbon-sinks': ['climate-source-sink-differential',
                   'climate-sink-composition'],
};

/** Stable empty list — a fresh [] per change detection loops. */
const NO_GRAPHS: string[] = [];

@Component({
  standalone: true,
  selector: 'co2-health',
  imports: [CommonModule, RouterModule, GraphRendererComponent],
  template: `
  <div class="cv-page">
    <h2>CO2 and human health</h2>
    <p class="hint">What the outdoor record is, what it becomes
      indoors, what is claimed to happen to a person at those
      levels, and when each line arrives. Every number below
      states the reason you may or may not believe it.</p>

    <!-- ============ THE LEGEND — always visible ============ -->
    <div class="card legend" *ngIf="claims?.ok">
      <div class="label">how to read every number on this page</div>
      <div class="legend-grid">
        <div class="cls" *ngFor="let key of provenanceOrder"
             [class.model-cls]="key === 'modelled'">
          <span class="chip"
                [class.ok]="claims.classes[key]?.tone === 'ok'"
                [class.warn]="claims.classes[key]?.tone === 'warn'"
                [class.bad]="claims.classes[key]?.tone === 'bad'"
                [class.model]="key === 'modelled'">
            {{ claims.classes[key]?.shortLabel }}</span>
          <b class="cls-label">{{ claims.classes[key]?.label }}</b>
          <div class="cls-meaning">
            {{ claims.classes[key]?.meaning }}</div>
          <div class="hint" *ngIf="claims.byClass">
            {{ claims.byClass[key] }} claim(s) on this page</div>
        </div>
      </div>
      <p class="hint" *ngIf="claims.note">{{ claims.note }}</p>
    </div>

    <!-- the sentence that stops the category error -->
    <div class="callout" *ngIf="claims?.speculationNote">
      {{ claims.speculationNote }}</div>

    <div class="err" *ngIf="errors['claims']">
      provenance legend unavailable: {{ errors['claims'] }}</div>
    <div class="hint" *ngIf="loading['claims']">
      loading claims…</div>

    <!-- ============ is this new? — the era answer ============ -->
    <div class="card" *ngIf="settings?.ok && settings.eraExposure">
      <div class="label">{{ settings.eraExposure.question }}</div>
      <p class="answer">{{ settings.eraExposure.answer }}</p>
      <div class="cols">
        <div class="card sub" *ngIf="settings.eraExposure.floor">
          <b>{{ settings.eraExposure.floor.label }}</b>
          <p class="lead">
            {{ settings.eraExposure.floor.verdict }}</p>
          <div class="hint">
            {{ settings.eraExposure.floor.evidence }}</div>
        </div>
        <div class="card sub" *ngIf="settings.eraExposure.peak">
          <b>{{ settings.eraExposure.peak.label }}</b>
          <p class="lead">
            {{ settings.eraExposure.peak.verdict }}</p>
          <div class="hint">
            {{ settings.eraExposure.peak.evidence }}</div>
        </div>
      </div>
      <p class="hint"
         *ngIf="settings.eraExposure.whatWasWorseInThePast">
        {{ settings.eraExposure.whatWasWorseInThePast }}</p>
      <p class="hint" *ngIf="settings.eraExposure.whyTheFloorMatters">
        {{ settings.eraExposure.whyTheFloorMatters }}</p>
    </div>

    <!-- ============ the view's sections, IN ORDER ============ -->
    <div class="err" *ngIf="errors['view']">
      view unavailable: {{ errors['view'] }}</div>
    <div class="hint" *ngIf="loading['view']">loading sections…</div>
    <div class="err" *ngIf="view && !view.ok">{{ view.refusal }}</div>

    <div class="card sec" *ngFor="let s of view?.sections">
      <div class="sec-head">
        <b>{{ s.section }}</b>
        <span class="chip src" *ngIf="s.source">{{ s.source }}</span>
      </div>
      <p class="lead" *ngIf="s.lead">{{ s.lead }}</p>
      <div class="links" *ngIf="s.links?.length">
        <a class="lnk" *ngFor="let lk of s.links"
           [attr.href]="lk.route">
          {{ lk.label }}
          <span class="chip kind">{{ lk.kind }}</span>
        </a>
      </div>

      <ng-container *ngIf="s.payload; else sectionRefused">
        <p class="lead" *ngIf="s.payload.question">
          {{ s.payload.question }}</p>
        <p class="lead" *ngIf="s.payload.framing">
          {{ s.payload.framing }}</p>
        <p class="hint" *ngIf="s.payload.note">
          {{ s.payload.note }}</p>

        <!-- headline numbers, the ok/warn/bad chip table -->
        <table class="tbl" *ngIf="s.payload.headline?.length">
          <tr><th>what</th><th>value</th><th>what it means</th></tr>
          <tr *ngFor="let h of s.payload.headline">
            <td>{{ h.label }}</td>
            <td class="nums"><span class="chip"
                  [class.ok]="h.verdict === 'ok'"
                  [class.warn]="h.verdict === 'warn'"
                  [class.bad]="h.verdict === 'bad'"
                  *ngIf="h.verdict">{{ h.value }}</span>
              <span *ngIf="!h.verdict">{{ h.value }}</span></td>
            <td>{{ h.note }}</td></tr>
        </table>

        <!-- the claims this section produced, each with its class -->
        <div class="claims" *ngIf="claimsFor(s.section).length">
          <div class="label">numbers, and why you may believe
            them</div>
          <div class="claim" *ngFor="let c of claimsFor(s.section)"
               [class.model-claim]="c.provenance === 'modelled'">
            <div class="claim-head">
              <span class="claim-label">{{ c.label }}</span>
              <span class="claim-value nums">{{ c.value }}
                <span class="unit" *ngIf="c.unit">{{ c.unit }}</span>
              </span>
              <span class="chip"
                    [class.ok]="c.tone === 'ok'"
                    [class.warn]="c.tone === 'warn'"
                    [class.bad]="c.tone === 'bad'"
                    [class.model]="c.provenance === 'modelled'"
                    [title]="c.provenanceMeaning">
                {{ c.provenanceShort }}</span>
            </div>
            <div class="claim-sub" *ngIf="c.method">
              method: {{ c.method }}</div>
            <div class="claim-sub bad-text"
                 *ngIf="c.provenance === 'modelled' && !c.method">
              this modelled number arrived with no method — treat it
              as unsupported.</div>
            <div class="claim-sub" *ngIf="c.caveat">
              caveat: {{ c.caveat }}</div>
            <div class="claim-sub" *ngIf="c.sourceRef">
              source: {{ c.sourceRef }}</div>
          </div>
        </div>

        <!-- the graphs that belong to this section -->
        <div class="graph" *ngFor="let gn of graphsFor(s.section)">
          <div class="label">{{ gn }}</div>
          <div class="hint" *ngIf="loading[gn]">loading graph…</div>
          <ng-container *ngIf="graphs[gn] as g">
            <ng-container
              *ngIf="g.ok && graphConfigs[gn]; else graphRefused">
              <graph-renderer [config]="graphConfigs[gn]"
                              [instanceData]="g.rows || []"
                              [classTypeData]="{}">
              </graph-renderer>
              <div class="warn-text"
                   *ngIf="spliceKinds(g).length > 1">
                SPLICE: this curve joins
                {{ spliceKinds(g).length }} different measurement
                kinds ({{ spliceKinds(g).join(', ') }}) — the seam
                is a change of instrument, not of the world.
              </div>
              <div class="cites" *ngIf="g.citations?.length">
                <div class="label">citations for exactly this
                  window</div>
                <div class="cite" *ngFor="let line of g.citations">
                  {{ line }}</div>
              </div>
              <p class="hint" *ngIf="g.note">{{ g.note }}</p>
            </ng-container>
            <ng-template #graphRefused>
              <div class="refusal">
                <b>no chart here, and here is why:</b>
                <div class="bad-text">{{ g.refusal
                  || 'this graph returned no data' }}</div>
              </div>
            </ng-template>
          </ng-container>
        </div>

        <!-- generic fallback: the honest full payload -->
        <details>
          <summary class="label">full payload</summary>
          <pre class="raw">{{ stringify(s.payload) }}</pre>
        </details>
      </ng-container>
      <ng-template #sectionRefused>
        <div class="refusal">
          <div class="bad-text">refused: {{ s.refusal }}</div>
          <div class="warn-text" *ngIf="s.suggestion">
            knob: {{ stringify(s.suggestion) }}</div>
        </div>
      </ng-template>
    </div>

    <!-- ============ the symptom ladder ============ -->
    <div class="card sec">
      <div class="sec-head"><b>symptom ladder</b></div>
      <div class="hint" *ngIf="loading['symptoms']">
        loading symptoms…</div>
      <div class="err" *ngIf="errors['symptoms']">
        symptom ladder unavailable: {{ errors['symptoms'] }}</div>
      <div class="bad-text" *ngIf="symptoms && !symptoms.ok">
        refused: {{ symptoms.refusal }}</div>
      <ng-container *ngIf="symptoms?.ok">
        <table class="tbl" *ngIf="symptoms.ladder?.length">
          <tr><th>symptom</th><th>from (ppm)</th><th>severity</th>
            <th>reversible</th><th>evidence</th><th>source</th></tr>
          <tr *ngFor="let r of symptoms.ladder"
              [class.lethal]="r.isLethal">
            <td>{{ r.symptomDisplay }}
              <span class="chip bad" *ngIf="r.isLethal">LETHAL</span>
              <div class="hint" *ngIf="r.onsetNote">
                {{ r.onsetNote }}</div>
              <div class="hint" *ngIf="r.quote">
                &ldquo;{{ r.quote }}&rdquo;</div></td>
            <td class="nums">{{ r.ppmFrom }}</td>
            <td class="nums">{{ r.severityRank }}</td>
            <td>{{ r.reversible ? 'yes' : 'no' }}</td>
            <td>{{ r.evidenceGrade }}</td>
            <td>{{ r.citationLine || r.sourceRef }}
              <span class="chip src" *ngIf="r.sourceKind">
                {{ r.sourceKind }}</span></td></tr>
        </table>
        <div class="hint" *ngIf="symptoms.lethalFrom">
          lethal from {{ symptoms.lethalFrom }} ppm.</div>
        <p class="hint" *ngIf="symptoms.reversibilityNote">
          {{ symptoms.reversibilityNote }}</p>
        <p class="hint" *ngIf="symptoms.disagreementNote">
          {{ symptoms.disagreementNote }}</p>
        <p class="hint" *ngIf="symptoms.note">{{ symptoms.note }}</p>
      </ng-container>
    </div>

    <!-- ============ outdoor + indoor settings ============ -->
    <div class="card sec">
      <div class="sec-head"><b>outdoor is not one number</b></div>
      <div class="hint" *ngIf="loading['settings']">
        loading settings…</div>
      <div class="err" *ngIf="errors['settings']">
        settings unavailable: {{ errors['settings'] }}</div>
      <div class="bad-text" *ngIf="settings && !settings.ok">
        refused: {{ settings.refusal }}</div>
      <ng-container *ngIf="settings?.ok">
        <div class="hint" *ngIf="settings.backgroundPpm">
          global background: {{ settings.backgroundPpm }} ppm</div>
        <table class="tbl" *ngIf="settings.outdoor?.settings?.length">
          <tr><th>outdoor setting</th><th>local outdoor (ppm)</th>
            <th>low</th><th>high</th><th>citation</th></tr>
          <tr *ngFor="let o of settings.outdoor.settings">
            <td>{{ o.displayName }}
              <div class="hint" *ngIf="o.notes">{{ o.notes }}</div>
            </td>
            <td class="nums">{{ o.localOutdoorPpm }}</td>
            <td class="nums">{{ o.lowPpm }}</td>
            <td class="nums">{{ o.highPpm }}</td>
            <td>{{ o.citation }}</td></tr>
        </table>
        <p class="hint" *ngIf="settings.outdoor?.note">
          {{ settings.outdoor.note }}</p>

        <div class="label">rooms, on their own local outdoor</div>
        <table class="tbl" *ngIf="settings.indoor?.spaces?.length">
          <tr><th>room</th><th>local outdoor (ppm)</th>
            <th>indoor (ppm)</th>
            <th>indoor on GLOBAL background (ppm) — what this app
              reported before local outdoor settings existed</th>
            <th>understated by (ppm)</th>
            <th>measured cross-check</th></tr>
          <tr *ngFor="let sp of settings.indoor.spaces">
            <td>{{ sp.displayName }}
              <span class="chip bad" *ngIf="sp.refused">refused
              </span>
              <div class="bad-text" *ngIf="sp.refusal">
                {{ sp.refusal }}</div></td>
            <td class="nums">{{ sp.localOutdoorPpm }}</td>
            <td class="nums">{{ sp.indoorPpm }}</td>
            <td class="nums">{{ sp.indoorPpmOnGlobalBackground }}</td>
            <td class="nums">{{ sp.understatedByPpm }}</td>
            <td>
              <span class="chip" *ngIf="sp.observedCheck"
                    [class.ok]="sp.observedCheck.insideObservedRange"
                    [class.warn]="!sp.observedCheck
                                  .insideObservedRange">
                {{ sp.observedCheck.observedLow }}–{{
                  sp.observedCheck.observedHigh }}</span>
              <div class="hint" *ngIf="sp.observedCheck">
                {{ sp.observedCheck.verdict }}</div>
              <span class="hint" *ngIf="!sp.observedCheck">
                no published counterpart</span></td></tr>
        </table>
        <p class="hint" *ngIf="settings.indoor?.note">
          {{ settings.indoor.note }}</p>
      </ng-container>
    </div>

    <!-- ============ threshold citations ============ -->
    <div class="card sec">
      <div class="sec-head"><b>where each threshold comes
        from</b></div>
      <div class="hint" *ngIf="loading['citations']">
        loading citations…</div>
      <div class="err" *ngIf="errors['citations']">
        citations unavailable: {{ errors['citations'] }}</div>
      <div class="bad-text" *ngIf="citations && !citations.ok">
        refused: {{ citations.refusal }}</div>
      <ng-container *ngIf="citations?.ok">
        <table class="tbl" *ngIf="citations.thresholds?.length">
          <tr><th>threshold</th><th>ppm</th><th>evidence grade</th>
            <th>source kind</th><th>citation</th></tr>
          <tr *ngFor="let t of citations.thresholds">
            <td>{{ t.displayName }}</td>
            <td class="nums">{{ t.ppm }}</td>
            <td>{{ t.evidenceGrade }}</td>
            <td>{{ t.sourceKind }}
              <span class="chip warn" *ngIf="!t.resolved">
                unresolved</span></td>
            <td><a *ngIf="t.url" [attr.href]="t.url"
                   target="_blank" rel="noopener">
                {{ t.citationLine || t.url }}</a>
              <span *ngIf="!t.url">{{ t.citationLine
                || t.citationText }}</span></td></tr>
        </table>
        <p class="hint" *ngIf="citations.note">
          {{ citations.note }}</p>
        <p class="hint" *ngIf="citations.journalismRule">
          {{ citations.journalismRule }}</p>
      </ng-container>
    </div>

    <!-- claims that name no section still get shown -->
    <div class="card sec" *ngIf="orphanClaims.length">
      <div class="sec-head"><b>other numbers on this page</b></div>
      <div class="claim" *ngFor="let c of orphanClaims"
           [class.model-claim]="c.provenance === 'modelled'">
        <div class="claim-head">
          <span class="claim-label">{{ c.label }}</span>
          <span class="claim-value nums">{{ c.value }}
            <span class="unit" *ngIf="c.unit">{{ c.unit }}</span>
          </span>
          <span class="chip"
                [class.ok]="c.tone === 'ok'"
                [class.warn]="c.tone === 'warn'"
                [class.bad]="c.tone === 'bad'"
                [class.model]="c.provenance === 'modelled'"
                [title]="c.provenanceMeaning">
            {{ c.provenanceShort }}</span>
        </div>
        <div class="claim-sub" *ngIf="c.method">
          method: {{ c.method }}</div>
        <div class="claim-sub bad-text"
             *ngIf="c.provenance === 'modelled' && !c.method">
          this modelled number arrived with no method — treat it as
          unsupported.</div>
        <div class="claim-sub" *ngIf="c.caveat">
          caveat: {{ c.caveat }}</div>
      </div>
    </div>

    <p class="hint" *ngIf="view?.note">{{ view.note }}</p>
  </div>
  `,
  styles: [`
    .cv-page { padding: 14px 18px;
      color: var(--text-on-bg, inherit); }
    .lead { margin: 6px 0 4px; font-size: 0.92em;
      color: var(--text-on-card); }
    .answer { margin: 6px 0 10px; font-size: 1.05em;
      font-weight: 600; color: var(--text-on-card); }
    .links { display: flex; flex-wrap: wrap; gap: 6px;
      margin: 4px 0 6px; }
    .lnk { display: inline-flex; align-items: center; gap: 5px;
      border: 1px solid var(--surface-outline, #8884);
      background: var(--surface-primary);
      color: var(--text-on-card); border-radius: 12px;
      padding: 2px 10px; cursor: pointer; font-size: 0.85em;
      text-decoration: underline; }
    .lnk:hover { background: var(--surface-hover, #8882); }
    .hint { color: var(--text-on-bg-muted,
      var(--text-on-card-muted)); font-size: 0.9em; }
    .err { color: #d33; }
    .card { border: 1px solid var(--surface-outline, #8884);
      border-radius: 8px; padding: 12px;
      background: var(--surface-primary);
      color: var(--text-on-card); margin-bottom: 12px; }
    .card .hint { color: var(--text-on-card-muted); }
    .sub { flex: 1 1 320px; min-width: 280px; }
    .cols { display: flex; gap: 14px; flex-wrap: wrap; }
    .sec { display: block; }
    .sec-head { display: flex; gap: 8px; align-items: center;
      margin-bottom: 6px; }
    .chip { border: 1px solid var(--surface-outline, #8884);
      border-radius: 10px; padding: 0 8px; font-size: 0.76em; }
    .chip.src { color: var(--text-on-card-muted); }
    .chip.kind { color: var(--text-on-card-muted); }
    .chip.ok { border-color: #2a4; color: #2a4; }
    .chip.warn { border-color: #c80; color: #c80; }
    .chip.bad { border-color: #d33; color: #d33; }
    /* the fourth class must not read like the other three */
    .chip.model { background: #d33; color: #fff;
      border-color: #d33; font-weight: 700;
      letter-spacing: 0.06em; padding: 1px 10px; }
    .label { color: var(--text-on-card-muted); font-size: 0.8em;
      text-transform: uppercase; letter-spacing: 0.04em;
      margin-top: 8px; }
    .bad-text { color: #d33; font-size: 0.9em; margin-top: 4px; }
    .warn-text { color: #c80; font-size: 0.9em; margin-top: 4px; }
    .tbl { border-collapse: collapse; font-size: 0.85em;
      margin: 6px 0; width: 100%; }
    .tbl th, .tbl td { border: 1px solid
      var(--surface-outline, #8884); padding: 3px 8px;
      text-align: left; color: var(--text-on-card);
      vertical-align: top; }
    .tbl tr.lethal td { border-left-color: #d33;
      background: rgba(221, 51, 51, 0.10); }
    .tbl tr.lethal td:first-child { border-left: 4px solid #d33; }
    .nums { font-variant-numeric: tabular-nums; }
    .raw { max-height: 320px; overflow: auto; font-size: 0.78em;
      background: var(--surface-app-background, #14161a);
      color: var(--text-on-card); padding: 8px;
      border-radius: 6px; }
    .legend-grid { display: flex; gap: 12px; flex-wrap: wrap;
      margin-top: 6px; }
    .cls { flex: 1 1 230px; min-width: 210px;
      border: 1px solid var(--surface-outline, #8884);
      border-radius: 8px; padding: 8px 10px;
      color: var(--text-on-card); }
    .cls.model-cls { border-color: #d33; border-left: 4px solid #d33;
      background: rgba(221, 51, 51, 0.10); }
    .cls-label { display: block; margin-top: 4px;
      color: var(--text-on-card); }
    .cls-meaning { font-size: 0.86em; margin-top: 3px;
      color: var(--text-on-card-muted); }
    .callout { border: 2px solid #d33; border-radius: 8px;
      padding: 10px 12px; margin-bottom: 14px;
      background: rgba(221, 51, 51, 0.10);
      color: var(--text-on-card);
      font-size: 0.95em; }
    .claims { margin-top: 4px; }
    .claim { border: 1px solid var(--surface-outline, #8884);
      border-radius: 8px; padding: 6px 10px; margin: 6px 0;
      color: var(--text-on-card); }
    .claim.model-claim { border-color: #d33;
      border-left: 4px solid #d33;
      background: rgba(221, 51, 51, 0.06); }
    .claim-head { display: flex; gap: 10px; align-items: center;
      flex-wrap: wrap; }
    .claim-label { color: var(--text-on-card); }
    .claim-value { font-weight: 600;
      color: var(--text-on-card); }
    .unit { font-weight: 400;
      color: var(--text-on-card-muted); }
    .claim-sub { font-size: 0.82em; margin-top: 2px;
      color: var(--text-on-card-muted); }
    .claim-sub.bad-text { color: #d33; }
    .graph { margin: 10px 0; }
    graph-renderer { display: block; overflow-x: auto; }
    .refusal { border: 1px solid #d33; border-radius: 8px;
      padding: 8px 10px; margin: 6px 0;
      color: var(--text-on-card); }
    .cites { margin-top: 4px; }
    .cite { font-size: 0.8em; margin-top: 2px;
      color: var(--text-on-card-muted); }
    a { color: var(--text-on-card); }
  `],
})
export class Co2HealthComponent implements OnInit {
  view: any = null;
  claims: any = null;
  citations: any = null;
  symptoms: any = null;
  settings: any = null;
  graphs: { [name: string]: any } = {};
  graphConfigs: { [name: string]: NamedGraphConfig } = {};
  loading: { [panel: string]: boolean } = {};
  errors: { [panel: string]: string } = {};
  orphanClaims: any[] = [];

  provenanceOrder = PROVENANCE_ORDER;

  /** Claims bucketed by their `section`, computed once per load. */
  private claimsBySection: { [section: string]: any[] } = {};

  constructor(private http: HttpClient,
              private polariService: PolariService) {}

  async ngOnInit(): Promise<void> {
    // Every panel loads independently: one dead endpoint must
    // leave the rest of the page standing.
    await Promise.all([
      this.load('view', '/api/climate/view/view-co2-health',
                (body) => { this.view = body; }),
      this.load('claims', '/api/climate/claims',
                (body) => { this.claims = body; }),
      this.load('citations', '/api/climate/citations',
                (body) => { this.citations = body; }),
      this.load('symptoms', '/api/climate/symptoms',
                (body) => { this.symptoms = body; }),
      this.load('settings', '/api/climate/settings',
                (body) => { this.settings = body; }),
      ...this.allGraphNames().map((name) => this.loadGraph(name)),
    ]);
    // Bucketing needs BOTH answers: the claims and the section
    // order they belong to. Doing it here removes the race.
    this.bucketClaims(this.claims);
  }

  /** Every graph this page renders, across all sections. */
  private allGraphNames(): string[] {
    const out: string[] = [];
    for (const key of Object.keys(SECTION_GRAPHS)) {
      for (const name of SECTION_GRAPHS[key]) { out.push(name); }
    }
    return out;
  }

  private url(path: string): string {
    return `${this.polariService.getBackendBaseUrl()}${path}`;
  }

  /** GET one panel; refusal bodies resolve, transport dies. */
  private async load(panel: string, path: string,
                     assign: (body: any) => void): Promise<void> {
    this.loading[panel] = true;
    try {
      const body = await firstValueFrom(this.http.get<any>(
        this.url(path), this.polariService.backendRequestOptions));
      assign(body);
    } catch (err: any) {
      // A refusal-shaped body on an error status is still an
      // answer — render it rather than the transport failure.
      if (err?.error && typeof err.error === 'object') {
        assign(err.error);
      } else {
        this.errors[panel] = `backend unreachable or module off `
          + `(${err?.status ?? '?'}) — is 'climate' in `
          + `POLARI_MODULES?`;
      }
    } finally {
      this.loading[panel] = false;
    }
  }

  private async loadGraph(name: string): Promise<void> {
    await this.load(name, `/api/climate/graph/${name}`, (body) => {
      this.graphs[name] = body;
      if (body?.ok && body.graphConfig) {
        // The API already returns a GraphConfigData blob — hand it
        // to the model layer's own parser rather than re-deriving
        // the defaults here.
        this.graphConfigs[name] = NamedGraphConfig.fromBackend({
          id: name, name, description: body.note || '',
          source_class: body.series || '',
          definition: { graphConfig: body.graphConfig },
        });
      }
    });
    if (!this.graphs[name] && this.errors[name]) {
      this.graphs[name] = { ok: false, refusal: this.errors[name] };
    }
  }

  private bucketClaims(body: any): void {
    this.claimsBySection = {};
    this.orphanClaims = [];
    const sections = new Set<string>(
      ((this.view?.sections ?? []) as any[])
        .map((s) => String(s?.section ?? '')));
    for (const c of (body?.claims ?? []) as any[]) {
      const key = String(c?.section ?? '');
      if (!key) { this.orphanClaims.push(c); continue; }
      if (!this.claimsBySection[key]) {
        this.claimsBySection[key] = [];
      }
      this.claimsBySection[key].push(c);
    }
    // Claims naming a section this view does not render would
    // otherwise vanish; they get their own panel instead.
    for (const key of Object.keys(this.claimsBySection)) {
      if (!sections.has(key)) {
        this.orphanClaims.push(...this.claimsBySection[key]);
      }
    }
  }

  claimsFor(section: string): any[] {
    return this.claimsBySection[section] ?? [];
  }

  graphsFor(section: string): string[] {
    return SECTION_GRAPHS[section] ?? NO_GRAPHS;
  }

  /** Distinct measurement kinds behind one curve. */
  spliceKinds(graph: any): string[] {
    const out: string[] = [];
    for (const span of (graph?.spans ?? []) as any[]) {
      const kind = typeof span === 'string'
        ? span : String(span?.measurementKind ?? '');
      if (kind && out.indexOf(kind) === -1) { out.push(kind); }
    }
    return out;
  }

  stringify(o: unknown): string {
    return JSON.stringify(o, null, 1);
  }
}
