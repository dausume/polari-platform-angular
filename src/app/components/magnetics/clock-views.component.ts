import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule }
  from '@angular/router';
import { DISPLAY_COMPONENT_REGISTRY }
  from '@models/dashboards/ComponentRegistry';
import { MotorsService } from '@services/motors.service';
import { ClockSceneComponent } from './clock-scene.component';
import { registerDisplayComponent }
  from '@models/dashboards/ComponentRegistry';
import { MotorMaterialsPanelComponent }
  from './motor-materials-panel.component';
import { MotorWindingPanelComponent }
  from './motor-winding-panel.component';
import { MotorPartsPanelComponent }
  from './motor-parts-panel.component';
import { MotorDrivePanelComponent }
  from './motor-drive-panel.component';

/** Panels this view can dispatch to by name.
 *
 *  Registered in the SAME registry the no-code displays use, so a
 *  seeded DisplayDefinition can drop these onto a page too — the
 *  point of naming renderers as data rather than branching in a
 *  template.
 *
 *  All four names declared by clock_views.SECTION_RENDERERS now
 *  resolve. The winding / parts / drive panels were extracted from
 *  the markup that already existed inside clock-motor and motor-view,
 *  so both surfaces draw one answer the same way instead of one
 *  rendering it and the other dumping JSON. */
let magneticsPanelsRegistered = false;
function registerMagneticsSectionPanels(): void {
  if (magneticsPanelsRegistered) { return; }
  magneticsPanelsRegistered = true;
  registerDisplayComponent(
    'motor-materials-panel', MotorMaterialsPanelComponent, {
      displayName: 'Motor Materials Accountability',
      description: 'Per-part material provenance, substitutions and '
        + 'the honest gaps (input: trail / payload)',
      defaultInputs: {},
    });
  registerDisplayComponent(
    'motor-winding-panel', MotorWindingPanelComponent, {
      displayName: 'Motor Winding',
      description: 'Gauge, turns, fill, resistance and the drive '
        + 'voltage a coil actually needs — plus per-phase rows and '
        + 'the imbalance where a rung has several coils '
        + '(input: payload)',
      defaultInputs: {},
    });
  registerDisplayComponent(
    'motor-parts-panel', MotorPartsPanelComponent, {
      displayName: 'Motor Mass Bill',
      description: 'Every piece with its volume, mass, material and '
        + 'the provenance of each measured property (input: payload)',
      defaultInputs: {},
    });
  registerDisplayComponent(
    'motor-drive-panel', MotorDrivePanelComponent, {
      displayName: 'Motor Drive Profile',
      description: 'Board, pole pairs, phase-to-terminal bindings and '
        + 'the generated controller config (input: payload)',
      defaultInputs: {},
    });
}

/**
 * view-1 (goal-5b): /magnetics/clock-views — ONE renderer over the
 * ClockViewDefinition rows.
 *
 * The views are DATA: discipline tabs come from the registry, each
 * view's sections from its row, and every panel is whatever its
 * engine answered — including refusals, which render as first-class
 * cards with their reason and knob, never dropped. The knob bar
 * (goal / policy / component / design) re-runs the view with
 * overrides, which is how "switch scales and modulate goals" works.
 */
@Component({
  standalone: true,
  selector: 'clock-views',
  imports: [CommonModule, FormsModule, RouterModule,
            ClockSceneComponent],
  template: `
  <div class="cv-page">
    <h2>Discipline views — one machine at a time, split by
      discipline</h2>
    <p class="hint">Views are rows, not components: each tab is a
      ClockViewDefinition, each panel an engine's answer. A refused
      panel states its reason and the knob that would open it.</p>

    <div class="tabs" *ngIf="registry?.ok">
      <button *ngFor="let v of registry.views"
              [class.active]="v.name === current"
              (click)="select(v.name)">
        {{ v.displayName }}
        <span class="chip chip-outline" *ngIf="v.scaleSupport === 'any-scale'">
          any scale</span>
      </button>
    </div>
    <div class="err" *ngIf="registry && !registry.ok">
      {{ registry.refusal }}</div>

    <div class="knobs">
      <label>goal
        <select [(ngModel)]="goal" (change)="reload()">
          <option value="">(view default)</option>
          <option *ngFor="let g of goalRows" [value]="g.name">
            {{ g.displayName }}</option>
        </select></label>
      <label>policy
        <select [(ngModel)]="policy" (change)="reload()">
          <option value="">(default)</option>
          <option value="local-made-only">local-made-only</option>
          <option value="local-plus-imported-wire">
            local + imported wire</option>
          <option value="any">any</option>
        </select></label>
      <label>component
        <input [(ngModel)]="component" placeholder="(all)"
               (change)="reload()" size="18"/></label>
      <button (click)="openComponent()"
              [disabled]="!component">component view</button>
    </div>

    <!-- viz-2: the discipline's 3D face — layers switch with the
         tab and stack in any combination; the cards below are the
         numbers behind the picture. -->
    <clock-scene *ngIf="current" [view]="current"></clock-scene>

    <div class="hint" *ngIf="view?.scaleSupport === 'm0-only'">
      This view runs the deep engines on the built M0 and says so —
      per-scale depth is the growth path, not an assumption.</div>

    <div class="cols" *ngIf="view?.ok">
      <div class="card sec" *ngFor="let s of view.sections">
        <div class="sec-head">
          <b>{{ s.section }}</b>
          <span class="chip chip-outline src">{{ s.source }}</span>
        </div>
        <!-- nav-4: the section LEADS with its insight + links into
             the visuals; the payload is the expander, not the face. -->
        <p class="lead" *ngIf="s.lead">{{ s.lead }}</p>
        <div class="links" *ngIf="s.links?.length">
          <button class="lnk" *ngFor="let lk of s.links"
                  (click)="goLink(lk)">
            {{ lk.label }}
            <span class="chip chip-outline kind">{{ lk.kind }}</span>
          </button>
        </div>
        <ng-container *ngIf="s.payload; else refused">
          <details class="sec-details">
          <summary class="label">details &amp; numbers</summary>
          <!-- specialized renderings where structure is known -->
          <table class="tbl" *ngIf="s.payload.summary?.length">
            <tr><th>scale</th><th>verdict</th><th>score</th>
              <th>blockers</th><th>gaps</th></tr>
            <tr *ngFor="let r of s.payload.summary">
              <td>{{ r.scale }}</td>
              <td><span class="chip chip-outline" [class.ok]="r.verdict === 'feasible'"
                    [class.warn]="r.verdict === 'unassessed'"
                    [class.bad]="r.verdict === 'blocked'">
                  {{ r.verdict }}</span></td>
              <td class="nums">{{ r.score }}</td>
              <td class="nums">{{ r.blockerCount }}</td>
              <td class="nums">{{ r.gapCount }}</td></tr>
          </table>
          <div *ngIf="s.payload.blockers?.length" class="blockers">
            <div class="label">blockers — these decide</div>
            <div class="bad-text" *ngFor="let b of s.payload.blockers">
              ✖ {{ b }}</div>
          </div>
          <div *ngIf="s.payload.gaps?.length" class="gaps">
            <div class="label">gaps — a measurement away</div>
            <div class="warn-text" *ngFor="let g of s.payload.gaps">
              ? {{ g }}</div>
          </div>
          <div *ngIf="s.payload.conditions?.length">
            <table class="tbl">
              <tr><th>mode</th><th>at</th>
                <th>you would observe</th><th>modelled</th></tr>
              <tr *ngFor="let c of s.payload.conditions">
                <td>{{ c.mode }}</td><td>{{ c.at }}</td>
                <td>{{ c.youWouldObserve }}</td>
                <td>{{ c.modelled ? 'yes' : 'NAMED GAP' }}</td></tr>
            </table>
          </div>
          <!-- goal-feasibility SLOT requirements (guarded by
               shape: m1-axis carries a same-named field of plain
               value rows, which renders in the table below). -->
          <div *ngIf="s.payload.requirements?.length
                      && s.payload.requirements[0].slot">
            <div class="part" *ngFor="let r of s.payload.requirements">
              <div class="part-head"><b>{{ r.slot }}</b>
                <span class="chip chip-outline fn">{{ r.archetype }}</span></div>
              <div class="nums" *ngIf="r.demands">
                {{ stringify(r.demands) }}</div>
              <div class="hint">viable: {{ r.materialCandidates?.join(', ')
                || '(none yet)' }}<span *ngIf="r.unassessed?.length">
                 · unassessed: {{ r.unassessed?.join(', ') }}</span></div>
            </div>
          </div>
          <!-- m1-5: axis requirement VALUE rows -->
          <table class="tbl" *ngIf="s.payload.requirements?.length
                                    && s.payload.requirements[0].unit">
            <tr><th>requirement</th><th>value</th><th>basis</th></tr>
            <tr *ngFor="let r of s.payload.requirements">
              <td>{{ r.name }}</td>
              <td class="nums">{{ r.value }} {{ r.unit }}</td>
              <td>{{ r.basis }}</td></tr>
          </table>
          <!-- m2-8: HEADLINE numbers — any engine may offer a
               flat {label, value, note} list, and a PROOF should:
               its answer rendered as raw JSON is an answer
               nobody reads. Shape-gated like every renderer
               above (the m1-8 lesson). -->
          <table class="tbl" *ngIf="s.payload.headline?.length">
            <tr><th>what</th><th>value</th><th>what it means</th></tr>
            <tr *ngFor="let h of s.payload.headline">
              <td>{{ h.label }}</td>
              <td class="nums"><span class="chip chip-outline"
                    [class.ok]="h.verdict === 'ok'"
                    [class.warn]="h.verdict === 'warn'"
                    [class.bad]="h.verdict === 'bad'"
                    *ngIf="h.verdict">{{ h.value }}</span>
                <span *ngIf="!h.verdict">{{ h.value }}</span></td>
              <td>{{ h.note }}</td></tr>
          </table>
          <!-- The section's DECLARED renderer (clock_views
               SECTION_RENDERERS, overridable per seeded section).
               Resolved through the same ComponentRegistry the
               no-code displays use, so a section slot and a display
               slot are the same kind of thing. Unresolvable names
               fall through to the payload block below, which makes
               declaring a renderer safe before its panel exists. -->
          <ng-container *ngIf="rendererFor(s) as declared">
            <ng-container
              *ngComponentOutlet="declared.component;
                                  inputs: declared.inputs">
            </ng-container>
          </ng-container>
          <!-- Last resort, and named as such: no renderer is
               declared for this source yet. -->
          <details *ngIf="!rendererFor(s)">
            <summary class="label">full payload (no renderer
              declared for "{{ s.source }}")</summary>
            <pre class="raw">{{ stringify(s.payload) }}</pre>
          </details>
          </details>
        </ng-container>
        <ng-template #refused>
          <div class="bad-text">refused: {{ s.refusal }}</div>
          <div class="warn-text" *ngIf="s.suggestion">
            knob: {{ stringify(s.suggestion) }}</div>
        </ng-template>
      </div>
    </div>
    <div class="err" *ngIf="view && !view.ok">{{ view.refusal }}</div>

    <div *ngIf="compView" class="comp">
      <h3>Component view — {{ compView.component }}</h3>
      <div class="cols">
        <div class="card sec" *ngFor="let s of compView.sections">
          <div class="sec-head"><b>{{ s.section }}</b></div>
          <div class="bad-text" *ngIf="!s.payload">
            refused: {{ s.refusal }}</div>
          <ng-container *ngIf="s.payload && rendererFor(s) as declared">
            <ng-container
              *ngComponentOutlet="declared.component;
                                  inputs: declared.inputs">
            </ng-container>
          </ng-container>
          <details *ngIf="s.payload && !rendererFor(s)" open>
            <summary class="label">answer (no renderer declared for
              "{{ s.section }}")</summary>
            <pre class="raw">{{ stringify(s.payload) }}</pre>
          </details>
        </div>
      </div>
    </div>
  </div>
  `,
  styles: [`
    .cv-page { padding: 14px 18px;
      color: var(--text-on-bg, inherit); }
    .lead { margin: 6px 0 4px; font-size: 0.92em;
      color: var(--text-on-card); }
    .links { display: flex; flex-wrap: wrap; gap: 6px;
      margin: 4px 0 6px; }
    .lnk { display: inline-flex; align-items: center; gap: 5px;
      border: 1px solid var(--surface-outline, #8884);
      background: var(--surface-primary);
      color: var(--text-on-card); border-radius: 12px;
      padding: 2px 10px; cursor: pointer; font-size: 0.85em;
      text-decoration: underline; }
    .lnk:hover { background: var(--surface-hover, #8882); }
    .sec-details > summary { cursor: pointer; }
    .hint { color: var(--text-on-bg-muted,
      var(--text-on-card-muted)); font-size: 0.9em; }
    .err { color: #d33; }
    .tabs { display: flex; gap: 6px; flex-wrap: wrap;
      margin: 10px 0; }
    .tabs button { border: 1px solid var(--surface-outline, #8884);
      border-radius: 8px; padding: 5px 10px; cursor: pointer;
      background: var(--surface-primary);
      color: var(--text-on-card); }
    .tabs button.active { border-color: #46f;
      box-shadow: inset 0 -2px 0 #46f; }
    .knobs { display: flex; gap: 12px; align-items: center;
      flex-wrap: wrap; margin: 8px 0 14px; font-size: 0.9em; }
    .knobs label { display: flex; gap: 5px; align-items: center;
      color: var(--text-on-bg-muted, var(--text-on-card-muted)); }
    .cols { display: flex; gap: 14px; flex-wrap: wrap; }
    .card { border: 1px solid var(--surface-outline, #8884);
      border-radius: 8px; padding: 12px;
      background: var(--surface-primary);
      color: var(--text-on-card); margin-bottom: 12px; }
    .sec { flex: 1 1 420px; min-width: 340px; }
    .sec-head { display: flex; gap: 8px; align-items: center;
      margin-bottom: 6px; }
    /* base chip recipe + semantic states live in
       _chip-patterns.css; .fn is this page's own identity marker */
    .chip.fn { border-color: var(--color-info-text);
      color: var(--color-info-text); }
    .chip.bad { border-color: #d33; color: #d33; }
    .label { color: var(--text-on-card-muted); font-size: 0.8em;
      text-transform: uppercase; letter-spacing: 0.04em; }
    .bad-text { color: #d33; font-size: 0.9em; margin-top: 4px; }
    .warn-text { color: #c80; font-size: 0.9em; margin-top: 4px; }
    .tbl { border-collapse: collapse; font-size: 0.85em;
      margin: 6px 0; }
    .tbl th, .tbl td { border: 1px solid
      var(--surface-outline, #8884); padding: 3px 8px;
      text-align: left; }
    .nums { font-variant-numeric: tabular-nums; }
    .part { border: 1px solid var(--surface-outline, #8884);
      border-left: 4px solid #46f; border-radius: 8px;
      padding: 8px 10px; margin: 6px 0; }
    .part-head { display: flex; gap: 8px; align-items: center; }
    .raw { max-height: 320px; overflow: auto; font-size: 0.78em;
      background: var(--surface-app-background, #14161a);
      color: var(--text-on-card); padding: 8px;
      border-radius: 6px; }
    .comp { margin-top: 18px; }
  `],
})
export class ClockViewsComponent implements OnInit {
  registry: any = null;
  view: any = null;
  compView: any = null;
  goalRows: any[] = [];
  current = 'view-goal-explorer';
  goal = '';
  policy = '';
  component = '';
  design = 'clock-lavet-m0';

  constructor(private motors: MotorsService,
              private router: Router,
              private route: ActivatedRoute) {
    registerMagneticsSectionPanels();
  }

  goLink(lk: any): void {
    if (lk?.route) { this.router.navigateByUrl(lk.route); }
  }

  async ngOnInit(): Promise<void> {
    // m1-8: nav rows deep-link a specific view (?view=view-m1-…).
    const wanted = this.route.snapshot.queryParamMap.get('view');
    if (wanted) { this.current = wanted; }
    this.registry = await this.motors.clockViews();
    const goals = await this.motors.goals();
    this.goalRows = goals?.ok ? goals.goals : [];
    await this.reload();
  }

  select(name: string): void {
    this.current = name;
    this.compView = null;
    void this.reload();
  }

  async reload(): Promise<void> {
    this.view = await this.motors.clockView(this.current, {
      goal: this.goal, policy: this.policy,
      component: this.component, design: this.design,
    });
  }

  async openComponent(): Promise<void> {
    this.compView = await this.motors.componentView(
      this.component, this.design);
  }

  /** Resolve a section's DECLARED renderer to a real component.
   *
   *  The section row says how it draws (`renderer`, defaulted by
   *  clock_views.SECTION_RENDERERS); this looks that name up in the
   *  same ComponentRegistry the no-code displays use. Returning null
   *  when the name is unknown is deliberate: it lets the backend
   *  declare a renderer before its panel has been extracted, and the
   *  view degrades to the named payload block instead of erroring.
   *
   *  Memoized because Angular calls this on every change-detection
   *  pass and `inputs` must be referentially stable — a fresh object
   *  each tick would re-create the component forever. */
  rendererFor(section: any):
      { component: any; inputs: Record<string, unknown> } | null {
    const name = section?.renderer;
    if (!name || !section?.payload) {
      return null;
    }
    const cached = this.rendererCache.get(section);
    if (cached !== undefined) {
      return cached;
    }
    const entry = DISPLAY_COMPONENT_REGISTRY.getComponent(name);
    const resolved = entry
      ? {
          component: entry.component,
          inputs: {
            ...(entry.defaultInputs || {}),
            ...(section.payload || {}),
            payload: section.payload,
            design: this.design,
          },
        }
      : null;
    this.rendererCache.set(section, resolved);
    return resolved;
  }

  /** section object -> resolved renderer (or null). Keyed by the
   *  section instance, so a reload naturally invalidates it. */
  private rendererCache =
    new WeakMap<object, { component: any;
                          inputs: Record<string, unknown> } | null>();

  stringify(o: unknown): string {
    return JSON.stringify(o, null, 1);
  }
}
