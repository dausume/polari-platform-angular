/**
 * object-detail-page — /object/:class/:name (bp-2c, his: "for critical objects and interconnects between them …
 * we should be able to click on them and see object detail views. Polari enables auto-defining generic detail
 * views for arbitrary objects").
 *
 * The GENERIC detail view of one row of any backend class, auto-defined from the row itself — no per-class
 * component:
 *   · the class explained in plain words (GET /api/plain, the class's `plain_words`) and its expert docstring,
 *   · the row's references as LINKS to their own detail views — every "Class:name" string, every `*_refs_json`
 *     list, and the well-known name columns (tree, node, parent, source_node, target_node, claim, discharged_by,
 *     rule, mapping, tensor, dimension) — so the interconnects between objects are one click,
 *   · the record itself through the existing structured-payload-panel (scalars as chips, prose as paragraphs,
 *     JSON fields parsed so lists and objects render as tables and key/values, never a JSON dump),
 *   · a link to the class page, where a configured instance display can refine this generic view.
 * The row is read through the same CRUDE door every table uses (filter by name); the page shows the friendly
 * wording when it cannot (sign in / not allowed / no such row).
 */
import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { CRUDEservicesManager } from '@services/crude-services-manager';
import { PolariService } from '@services/polari-service';
import { AuthSessionService } from '@services/auth/auth-session.service';
import { StructuredPayloadPanelComponent } from '@components/magnetics/structured-payload-panel.component';
import { friendlyError } from '@components/dashboard/generic/friendly-error';

/** name column → the class its value names (the interconnects the tensor / proofs pages use) */
const KNOWN_REF_COLUMNS: Record<string, string> = {
  tree: 'TensorTreeDefinition', node: 'TensorNode', parent: 'TensorNode', source_node: 'TensorNode', target_node: 'TensorNode',
  claim: 'MathClaim', discharged_by: 'MathClaim', rule: 'InferenceRule', mapping: 'TensorMapping', tensor: 'Tensor',
  dimension: 'TensorDimension', operator: 'TensorOperator', rung: 'ComputeLOD', expression_ref: 'TensorMathExpression',
  coupling_ref: 'SimulationCouplingDefinition', binding_ref: 'SimSpaceBindingDefinition', concept_node: 'TechNode',
};

interface Ref { cls: string; name: string; from: string; }

@Component({
  standalone: true,
  selector: 'object-detail-page',
  imports: [CommonModule, RouterModule, StructuredPayloadPanelComponent],
  template: `
    <div class="object-page">
      <div class="crumbs">
        <a [routerLink]="['/class-main-page', className]">{{ className }}</a>
        <span class="sep">›</span>
        <b>{{ objectName }}</b>
      </div>
      <p class="plain" *ngIf="plain">{{ plain }}</p>
      <p class="plain muted" *ngIf="!plain && expert">{{ expert }}</p>

      <div *ngIf="loading" class="state">Loading…</div>
      <div *ngIf="error" class="state error" [title]="errorDetail">{{ error }}
        <button *ngIf="errorSignIn" type="button" class="signin" (click)="signIn()">Sign in</button>
      </div>

      <ng-container *ngIf="!loading && !error && row">
        <!-- bp-3: the row explained — what it says, what was done, with what, the result, how to do it again -->
        <section class="explain" *ngIf="explain">
          <p class="one" *ngIf="explain['in one sentence']">{{ explain['in one sentence'] }}</p>
          <div class="ex-grid">
            <div class="ex" *ngIf="explain['what was done']"><h4>What was done</h4><p>{{ explain['what was done'] }}</p></div>
            <div class="ex" *ngIf="explainInputs.length"><h4>With what</h4>
              <table class="kv"><tr *ngFor="let kv of explainInputs"><td class="k">{{ kv[0] }}</td><td>{{ kv[1] }}</td></tr></table></div>
            <div class="ex" *ngIf="explain['result']"><h4>Result</h4><p>{{ explain['result'] }}</p></div>
            <div class="ex" *ngIf="explain['how far to trust it']"><h4>How far to trust it</h4><p>{{ explain['how far to trust it'] }}</p></div>
            <div class="ex" *ngIf="explain['evidence']"><h4>Evidence</h4><p>{{ explain['evidence'] }}</p></div>
            <div class="ex wide" *ngIf="explainSteps.length"><h4>How to reproduce it</h4><pre>{{ explainSteps.join('\n') }}</pre></div>
          </div>
          <div class="ex-note" *ngIf="explain['note']">{{ explain['note'] }}</div>
          <div class="ex-by">explained by {{ explain['explained_by'] }}</div>
        </section>
        <div class="refs" *ngIf="refs.length">
          <span class="lbl">Connected to</span>
          <a *ngFor="let r of refs" class="chip" [routerLink]="['/object', r.cls, r.name]" [title]="r.from + ' → ' + r.cls">{{ r.name }}<small>{{ r.cls }}</small></a>
        </div>
        <structured-payload-panel [payload]="record"></structured-payload-panel>
        <div class="foot">A generic detail view, defined from the row itself. A configured instance display on the
          <a [routerLink]="['/class-main-page', className]">{{ className }} class page</a> refines what every reference to one of its rows shows.</div>
      </ng-container>
    </div>
  `,
  styles: [`
    .object-page { padding: 16px; max-width: 1100px; margin: 0 auto; color: var(--text-primary, inherit); }
    .crumbs { font-size: 1.15em; margin-bottom: 8px; }
    .crumbs a { color: var(--link-text, var(--brand-primary, #3f51b5)); text-decoration: none; }
    .crumbs .sep { margin: 0 8px; opacity: .6; }
    .plain { font-size: 1em; line-height: 1.45; max-width: 80ch; }
    .plain.muted { opacity: .8; }
    .refs { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; margin: 10px 0 14px; }
    .refs .lbl { color: var(--text-secondary, #666); margin-right: 4px; }
    .chip { display: inline-flex; flex-direction: column; padding: 3px 10px; border-radius: 12px; background: var(--surface-variant, #eef); color: inherit; text-decoration: none; line-height: 1.15; }
    .chip small { font-size: .7em; opacity: .7; }
    .state { padding: 12px 0; color: var(--text-secondary, #666); }
    .state.error { color: var(--error-text, #b3261e); }
    .signin { margin-left: 10px; padding: 2px 10px; border-radius: 12px; border: 1px solid currentColor; background: transparent; color: inherit; cursor: pointer; font: inherit; font-size: .85em; }
    .foot { margin-top: 14px; font-size: .85em; color: var(--text-secondary, #666); }
    .explain { margin: 6px 0 16px; padding: 12px 14px; border-radius: 10px; background: var(--surface-variant, #f4f4fa); }
    .explain .one { font-size: 1.05em; line-height: 1.45; margin: 0 0 10px; }
    .ex-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 10px 18px; }
    .ex h4 { margin: 0 0 4px; font-size: .8em; text-transform: uppercase; letter-spacing: .04em; color: var(--text-secondary, #666); }
    .ex p { margin: 0; line-height: 1.4; }
    .ex.wide { grid-column: 1 / -1; }
    .ex pre { margin: 0; padding: 10px; border-radius: 8px; background: var(--surface, #fff); overflow-x: auto; font-size: .85em; line-height: 1.45; white-space: pre-wrap; }
    table.kv { border-collapse: collapse; }
    table.kv td { padding: 2px 8px 2px 0; vertical-align: top; line-height: 1.35; }
    table.kv td.k { color: var(--text-secondary, #666); white-space: nowrap; }
    .ex-note, .ex-by { margin-top: 8px; font-size: .8em; color: var(--text-secondary, #666); }
    .foot a { color: inherit; }
  `],
})
export class ObjectDetailPageComponent implements OnInit, OnDestroy {
  className = '';
  objectName = '';
  plain = '';
  expert = '';
  row: any = null;
  record: any = null;
  refs: Ref[] = [];
  /** bp-3: GET /api/explain — what this row says, what was done, how to reproduce it (absent when the door has nothing) */
  explain: Record<string, any> | null = null;
  explainInputs: [string, string][] = [];
  explainSteps: string[] = [];
  loading = true;
  error = '';
  errorDetail = '';
  errorSignIn = false;
  private sub?: Subscription;

  constructor(private route: ActivatedRoute, private crude: CRUDEservicesManager, private http: HttpClient,
              private polari: PolariService, private authSession: AuthSessionService) {}

  ngOnInit(): void {
    this.sub = this.route.paramMap.subscribe((p) => {
      this.className = p.get('class') || '';
      this.objectName = p.get('name') || '';
      this.load();
    });
  }

  ngOnDestroy(): void { this.sub?.unsubscribe(); }

  signIn(): void { void this.authSession.login(); }

  private load(): void {
    this.loading = true; this.error = ''; this.row = null; this.record = null; this.refs = []; this.plain = ''; this.expert = '';
    this.explain = null; this.explainInputs = []; this.explainSteps = [];
    if (!this.className || !this.objectName) { this.loading = false; this.error = 'No object named in the address.'; return; }
    const base = this.polari.getBackendBaseUrl();
    this.http.get<any>(`${base}/api/plain?classes=${encodeURIComponent(this.className)}`, this.polari.backendRequestOptions).subscribe({
      next: (b: any) => {
        const key = Object.keys(b || {}).find((k) => !['ok', 'note', 'missing'].includes(k));
        if (key) { if (b.note) { this.expert = b[key]; } else { this.plain = b[key]; } }
      },
      error: () => { /* the words are optional */ },
    });
    this.http.get<any>(`${base}/api/explain?class=${encodeURIComponent(this.className)}&name=${encodeURIComponent(this.objectName)}`, this.polari.backendRequestOptions).subscribe({
      next: (b: any) => {
        if (!b || b.ok === false) { return; }
        this.explain = b;
        const inputs = b['inputs'];
        this.explainInputs = inputs && typeof inputs === 'object' && !Array.isArray(inputs)
          ? Object.keys(inputs).map((k) => [k, this.flat(inputs[k])] as [string, string]) : [];
        const steps = b['how to reproduce'];
        this.explainSteps = Array.isArray(steps) ? steps.map((x: any) => String(x)) : (steps ? [String(steps)] : []);
      },
      error: () => { /* the explanation is optional; the record still renders */ },
    });
    this.crude.getCRUDEclassService(this.className).readAll({ name: this.objectName }).subscribe({
      next: (envelope: any) => {
        const rows: any[] = envelope?.[0]?.[this.className]?.[0]?.data ?? [];
        this.row = rows.find((r) => String(r?.name) === this.objectName) ?? rows[0] ?? null;
        this.loading = false;
        if (!this.row) { this.error = `There is no ${this.className} named "${this.objectName}" on this instance.`; return; }
        this.record = this.shape(this.row);
        this.refs = this.collectRefs(this.row);
      },
      error: (err: any) => {
        this.loading = false;
        const f = friendlyError(err, `read ${this.className}`);
        this.error = f.text; this.errorDetail = f.detail; this.errorSignIn = f.signIn;
      },
    });
  }

  /** A nested inputs value as one line: {voltage: 1.8, corner: tt} → 'voltage 1.8; corner tt'. */
  private flat(v: any): string {
    if (v === null || v === undefined) { return ''; }
    if (Array.isArray(v)) { return v.map((x) => this.flat(x)).join(', '); }
    if (typeof v === 'object') { return Object.keys(v).map((k) => `${k} ${this.flat(v[k])}`).join('; '); }
    return String(v);
  }

  /** Inside a parsed JSON field, a list of scalars becomes one readable string ("0 … 0.002") so the structured panel
   *  renders the object as key/values instead of folding it into "unrendered fields" (no JSON on a screen). */
  private readable(v: any): any {
    if (Array.isArray(v)) {
      if (v.every((x) => x === null || typeof x !== 'object')) { return v.map((x) => String(x)).join(', '); }
      return v.map((x) => this.readable(x));
    }
    if (v && typeof v === 'object') {
      const o: Record<string, any> = {};
      for (const k of Object.keys(v)) { o[k] = this.readable(v[k]); }
      return o;
    }
    return v;
  }

  /** JSON fields parsed so the structured panel renders them as tables / key-values; internals dropped. */
  private shape(row: any): any {
    const out: Record<string, any> = {};
    for (const k of Object.keys(row)) {
      if (k.startsWith('_') || k === 'id') { continue; }
      let v = row[k];
      if (k.endsWith('_json') && typeof v === 'string' && v.trim()) {
        try { v = JSON.parse(v); } catch { /* keep the string */ }
        if (v === null || (Array.isArray(v) && !v.length) || (typeof v === 'object' && !Array.isArray(v) && !Object.keys(v).length)) { continue; }
        out[k.replace(/_json$/, '')] = this.readable(v);
      } else if (v !== null && v !== undefined && v !== '') {
        out[k] = v;
      }
    }
    return out;
  }

  private collectRefs(row: any): Ref[] {
    const seen = new Set<string>(); const out: Ref[] = [];
    const add = (cls: string, name: string, from: string) => {
      if (!cls || !name || (cls === this.className && name === this.objectName)) { return; }
      const k = `${cls}:${name}`; if (seen.has(k)) { return; } seen.add(k); out.push({ cls, name, from });
    };
    const refString = (t: string, from: string) => { const i = t.indexOf(':'); if (i > 0 && /^[A-Z][A-Za-z0-9]*$/.test(t.slice(0, i))) { add(t.slice(0, i), t.slice(i + 1), from); } };
    for (const k of Object.keys(row)) {
      const v = row[k];
      if (typeof v === 'string' && KNOWN_REF_COLUMNS[k] && v) { add(KNOWN_REF_COLUMNS[k], v, k); continue; }
      if (typeof v === 'string' && /refs?_json$/.test(k) && v.trim()) {
        try {
          const arr = JSON.parse(v);
          if (Array.isArray(arr)) { for (const e of arr) { if (typeof e === 'string') { refString(e, k); } else if (e && typeof e === 'object' && (e.class || e.cls) && e.name) { add(String(e.class || e.cls), String(e.name), k); } } }
        } catch { /* not a list */ }
        continue;
      }
      if (typeof v === 'string' && v.length < 120) { refString(v, k); }
    }
    return out;
  }
}
