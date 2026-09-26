import { CommonModule } from '@angular/common';
import { Component, Input, OnInit } from '@angular/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { RouterModule } from '@angular/router';
import { CRUDEservicesManager } from '@services/crude-services-manager';
import { AuthSessionService } from '@services/auth/auth-session.service';
import { friendlyError } from './friendly-error';
import { PeopleService } from '@services/people.service';
import { KatexDisplayComponent } from '@components/shared/katex-display/katex-display.component';

/**
 * Generic no-code class table: renders the live CRUDE rows of ANY
 * backend class, so a module's data gets a page by seeding a
 * DisplayDefinition — no per-module component work. Columns default
 * to the first row's simple fields (long text and *_json blobs are
 * skipped); pin them explicitly with the `columns` input when a page
 * wants a curated view.
 *
 * MULTI-REFERENCE USE. Set `filterField` + `filterValue` to make this
 * "the rows of X that reference THIS object" rather than "every row
 * of X" — the reference the page already knows, pushed down to the
 * server as a query param. That is the collection half of the
 * single-vs-multi reference pair; the single half is
 * `instance-detail-panel`.
 */
@Component({
  standalone: true,
  selector: 'class-rows-table',
  imports: [CommonModule, RouterModule, MatProgressSpinnerModule, KatexDisplayComponent],
  template: `
    <div class="class-rows-table">
      <div *ngIf="loading" class="state"><mat-spinner diameter="28"></mat-spinner></div>
      <div *ngIf="error" class="state error" [title]="errorDetail">{{ error }}
        <button *ngIf="errorSignIn" type="button" class="signin" (click)="signIn()">Sign in</button>
      </div>
      <table *ngIf="!loading && !error && rows.length > 0">
        <thead>
          <tr><th *ngFor="let column of activeColumns">{{ label(column) }}</th></tr>
        </thead>
        <tbody>
          <tr *ngFor="let row of rows; let i = index">
            <td *ngFor="let column of activeColumns"
                [title]="cellTitle(row, column)"
                [class.person]="formatOf(column) === 'person'"
                [class.latex]="formatOf(column) === 'latex'"
                [class.structured]="isJsonColumn(column)"
                [class.clamped]="isLong(row, column) && !isExpanded(i, column)"
                [class.person-unresolved]="formatOf(column) === 'person' && !personName(row, column)">
              <ng-container [ngSwitch]="kindOf(row, column)">
                <katex-display *ngSwitchCase="'latex'" [latex]="cell(row, column)" [displayMode]="false" placeholder=""></katex-display>
                <a *ngSwitchCase="'ref'" class="ref" [routerLink]="refTarget(column, cell(row, column))">{{ cell(row, column) }}</a>
                <ng-container *ngSwitchCase="'refs'">
                  <a *ngFor="let r of refsOf(row, column)" class="ref chip" [routerLink]="['/object', r.cls, r.name]" [title]="r.cls">{{ r.name }}</a>
                  <span *ngIf="!refsOf(row, column).length" class="muted">—</span>
                </ng-container>
                <a *ngSwitchCase="'link'" class="ref" [href]="cell(row, column)" target="_blank" rel="noopener">open ↗</a>
                <ng-container *ngSwitchCase="'json'">
                  <ng-container *ngIf="jsonPairs(row, column) as pairs">
                    <span *ngIf="!pairs.length" class="muted">—</span>
                    <div *ngFor="let kv of pairs" class="kv"><span class="k">{{ kv[0] }}</span><span class="v">{{ kv[1] }}</span></div>
                  </ng-container>
                </ng-container>
                <ng-container *ngSwitchDefault>{{ cell(row, column) }}</ng-container>
              </ng-container>
              <button *ngIf="isLong(row, column)" type="button" class="more" (click)="toggle(i, column)">{{ isExpanded(i, column) ? 'less' : 'more' }}</button>
            </td>
          </tr>
        </tbody>
      </table>
      <div *ngIf="!loading && !error && rows.length === 0" class="state">
        No {{ className }} rows.
      </div>
    </div>
  `,
  styles: [`
    .class-rows-table { overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; font-size: 0.9em; }
    th, td {
      text-align: left; padding: 6px 10px; vertical-align: top;
      border-bottom: 1px solid var(--border-medium, #ddd);
      /* bp-2c: cells WRAP (his: "I would like to enable wrapping"); a long one is clamped to three lines with a more/less toggle */
      white-space: normal; overflow-wrap: anywhere; max-width: 380px; min-width: 60px;
    }
    td.clamped { position: relative; }
    td.clamped > :not(.more) { display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
    td.structured { font-size: 0.92em; }
    .kv { display: flex; gap: 6px; line-height: 1.35; }
    .kv .k { color: var(--text-secondary, #666); flex: 0 0 auto; }
    .kv .k::after { content: ':'; }
    .kv .v { font-family: var(--font-mono, monospace); font-size: 0.95em; overflow-wrap: anywhere; }
    a.ref { color: var(--link-text, var(--brand-primary, #3f51b5)); text-decoration: none; border-bottom: 1px dotted currentColor; }
    a.ref:hover { border-bottom-style: solid; }
    a.ref.chip { display: inline-block; margin: 0 6px 2px 0; }
    .muted { color: var(--text-secondary, #666); }
    button.more { display: inline-block; margin-top: 2px; padding: 0 6px; border: 0; border-radius: 8px; background: var(--surface-variant, #eee); color: var(--text-secondary, #666); font: inherit; font-size: 0.8em; cursor: pointer; }
    .state.error .signin { margin-left: 10px; padding: 2px 10px; border-radius: 12px; border: 1px solid currentColor; background: transparent; color: inherit; cursor: pointer; font: inherit; font-size: .85em; }
    th { color: var(--text-secondary, #666); font-weight: 600; }
    td.latex { max-width: 520px; }
    td.person-unresolved {
      font-family: var(--font-mono, monospace);
      color: var(--text-secondary, #666);
    }
    .state { padding: 16px; color: var(--text-secondary, #666); }
    .state.error { color: var(--error-text, #b3261e); }
  `],
})
export class ClassRowsTableComponent implements OnInit {
  /** Backend class name, e.g. 'FoodItem', 'CompostLoopDefinition'. */
  @Input() className = '';
  /** Optional comma-separated column pin, e.g. 'name,status,notes'. */
  @Input() columns = '';
  /** Cap rendered rows (0 = all). */
  @Input() maxRows = 0;

  /**
   * Per-column rendering, as `column:format` pairs —
   * e.g. 'actor:person'. Two formats: `latex` — the cell is a LaTeX string
   * DERIVED by the backend (mathproofs: MathClaim.statement_latex from the
   * term, never authored) and is rendered through the shared katex-display
   * (pf-3: the LaTeX rendered from the term; no new component). And `person`:
   *
   *   PEOPLE (his rule D18-1). A Polari row keys a person by their opaque
   *   Keycloak subject id and never by a name, so an `actor` column holds a
   *   UUID. A `person` cell shows the first 8 characters of it with the
   *   whole id in the tooltip, and — when the viewer is signed in — the
   *   visible rows' subs go to `POST /api/security/people` in ONE batched
   *   call per render; whatever comes back replaces the short id with the
   *   name. The name is never stored: not in the row, not in localStorage,
   *   only in PeopleService's in-memory map for this tab. A viewer who may
   *   not resolve names (403) just keeps seeing the short id — no error.
   */
  @Input() columnFormats = '';

  /** Field on this class holding the reference to filter by
   *  (e.g. 'design_ref'). Empty = unfiltered. */
  @Input() filterField = '';

  /** The reference value the page is scoped to
   *  (e.g. 'clock-lavet-m0'). */
  @Input() filterValue = '';

  /** Show `*_json` config blobs as columns. Off by default because
   *  they are unreadable inline — but a curated page that has no
   *  better renderer yet can opt in rather than falling back to a
   *  whole-payload JSON dump. */
  @Input() includeJsonFields = false;

  rows: any[] = [];
  activeColumns: string[] = [];
  loading = true;
  error: string | null = null;

  /** column -> format, parsed from `columnFormats` once. */
  private formats: Record<string, string> = {};
  /** Bumped when names arrive, so the template re-reads the person cells. */
  private resolvedAt = 0;

  errorDetail = '';
  errorSignIn = false;
  /** column -> format argument (`name:ref:MathClaim` → 'MathClaim'). */
  private formatArgs: Record<string, string> = {};
  private expandedCells = new Set<string>();

  constructor(
    private crudeManager: CRUDEservicesManager,
    private people: PeopleService,
    private authSession: AuthSessionService,
  ) {}

  signIn(): void { void this.authSession.login(); }

  ngOnInit(): void {
    if (!this.className) {
      this.loading = false;
      this.error = 'class-rows-table: no className input.';
      return;
    }
    this.formats = this.parseFormats(this.columnFormats);
    // bp-2a: a comma-separated filterValue is a SET (the page scope's `{scope:tree.nodes}`): read all, keep members
    const isSet = !!this.filterValue && this.filterValue.includes(',');
    const filter = this.filterField && this.filterValue && !isSet
      ? { [this.filterField]: this.filterValue }
      : undefined;
    const members = isSet ? new Set(this.filterValue.split(',').map((v) => v.trim()).filter(Boolean)) : null;
    this.crudeManager.getCRUDEclassService(this.className).readAll(filter).subscribe({
      next: (envelope: any) => {
        let rows = envelope?.[0]?.[this.className]?.[0]?.data ?? [];
        if (members && this.filterField) { rows = rows.filter((r: any) => members.has(String(r?.[this.filterField] ?? ''))); }
        this.rows = this.maxRows > 0 ? rows.slice(0, this.maxRows) : rows;
        this.activeColumns = this.columns
          ? this.columns.split(',').map((column) => column.trim()).filter(Boolean)
          : this.deriveColumns(this.rows[0]);
        this.loading = false;
        this.resolvePeople();
      },
      error: (err: any) => {
        this.loading = false;
        const f = friendlyError(err, `read ${this.className}`);
        this.error = f.text; this.errorDetail = f.detail; this.errorSignIn = f.signIn;
      },
    });
  }

  private deriveColumns(first: any): string[] {
    if (!first || typeof first !== 'object') {
      return [];
    }
    return Object.keys(first)
      .filter((key) => this.includeJsonFields || !key.endsWith('_json'))
      .filter((key) => !key.startsWith('_'))
      .filter((key) => {
        const value = first[key];
        return value === null
          || ['string', 'number', 'boolean'].includes(typeof value);
      })
      .filter((key) => String(first[key] ?? '').length <= 120)
      .slice(0, 8);
  }

  private parseFormats(spec: string): Record<string, string> {
    const out: Record<string, string> = {};
    (spec || '').split(',').forEach((pair) => {
      const [column, format, arg] = pair.split(':').map((part) => (part || '').trim());
      if (column && format) { out[column] = format; if (arg) { this.formatArgs[column] = arg; } }
    });
    return out;
  }

  /** '' when the column renders plainly, else the format it was marked with. */
  formatOf(column: string): string {
    return this.formats[column] || '';
  }

  /**
   * ONE batched call per table render: every distinct subject id in the
   * `person` columns of the rows now on screen. Names come back into the
   * service's in-memory map; the cells re-read them.
   */
  private resolvePeople(): void {
    const personColumns = this.activeColumns.filter((c) => this.formatOf(c) === 'person');
    if (personColumns.length === 0) { return; }
    const subs: string[] = [];
    this.rows.forEach((row) => personColumns.forEach((column) => {
      const value = String(row?.[column] ?? '').trim();
      if (value) { subs.push(value); }
    }));
    if (subs.length === 0) { return; }
    this.people.resolve(subs).then(() => { this.resolvedAt = Date.now(); });
  }

  /** The resolved name for a person cell, or '' while it is (or stays) a bare id. */
  personName(row: any, column: string): string {
    void this.resolvedAt;                    // re-read once the batch has answered
    return this.people.nameFor(String(row?.[column] ?? '').trim());
  }

  /** The tooltip: a person cell always shows the WHOLE subject id it stands for. */
  cellTitle(row: any, column: string): string {
    const raw = this.raw(row, column);
    if (this.formatOf(column) !== 'person' || !raw) { return raw; }
    const name = this.personName(row, column);
    return name ? `${name} — ${raw}` : raw;
  }

  cell(row: any, column: string): string {
    const raw = this.raw(row, column);
    if (this.formatOf(column) !== 'person' || !raw) { return raw; }
    return this.personName(row, column) || PeopleService.short(raw);
  }


  // ---- bp-2c: readable cells — JSON as key/value lines, references as links, long text clamped ----------------

  /** A column header a person reads: `about_refs_json` → 'about refs', `source_node` → 'source node'. */
  label(column: string): string {
    return column.replace(/_json$/, '').replace(/_/g, ' ');
  }

  /** `*_json` columns render as structure unless a format says otherwise. */
  isJsonColumn(column: string): boolean {
    const f = this.formatOf(column);
    return f === 'json' || (!f && column.endsWith('_json'));
  }

  kindOf(row: any, column: string): string {
    const f = this.formatOf(column);
    if (f === 'latex' && this.cell(row, column)) { return 'latex'; }
    if (f === 'ref' && this.cell(row, column)) { return 'ref'; }
    if (f === 'refs') { return 'refs'; }
    if (f === 'link' && /^https?:\/\//.test(this.cell(row, column))) { return 'link'; }
    if (this.isJsonColumn(column)) { return 'json'; }
    return 'plain';
  }

  /** The detail view of the object a `ref` cell names: /object/<Class>/<name>; the class comes from the format argument. */
  refTarget(column: string, name: string): any[] {
    return ['/object', this.formatArgs[column] || 'Object', name];
  }

  private parsed(row: any, column: string): any {
    const v = row?.[column];
    if (v === null || v === undefined || v === '') { return null; }
    if (typeof v !== 'string') { return v; }
    try { return JSON.parse(v); } catch { return v; }
  }

  /** A `refs` cell: JSON ["Class:name", …], [{class,name}], or a csv of "Class:name". */
  refsOf(row: any, column: string): { cls: string; name: string }[] {
    let v = this.parsed(row, column);
    if (typeof v === 'string') { v = v.split(',').map((x) => x.trim()).filter(Boolean); }
    if (!Array.isArray(v)) { return []; }
    return v.map((e: any) => {
      if (e && typeof e === 'object') { return { cls: String(e.class || e.cls || e.className || 'Object'), name: String(e.name || '') }; }
      const t = String(e); const i = t.indexOf(':');
      return i > 0 ? { cls: t.slice(0, i), name: t.slice(i + 1) } : { cls: this.formatArgs[column] || 'Object', name: t };
    }).filter((r) => r.name);
  }

  /** JSON as lines a person reads: an object → its key/values; a list → numbered values; scalars → one line. */
  jsonPairs(row: any, column: string): [string, string][] {
    const v = this.parsed(row, column);
    if (v === null) { return []; }
    const short = (x: any): string => (x !== null && typeof x === 'object') ? JSON.stringify(x) : String(x);
    if (Array.isArray(v)) {
      if (!v.length) { return []; }
      if (v.every((x) => x === null || typeof x !== 'object')) { return [['', v.map(short).join(', ')]]; }
      return v.map((x, i) => [String(i + 1), short(x)] as [string, string]);
    }
    if (typeof v === 'object') { return Object.keys(v).map((k) => [k, short(v[k])] as [string, string]); }
    return [['', String(v)]];
  }

  isLong(row: any, column: string): boolean {
    if (this.formatOf(column) === 'latex') { return false; }
    const n = this.isJsonColumn(column) ? this.jsonPairs(row, column).reduce((a, kv) => a + kv[0].length + kv[1].length + 2, 0) : this.raw(row, column).length;
    return n > 160;
  }

  isExpanded(i: number, column: string): boolean { return this.expandedCells.has(`${i}:${column}`); }

  toggle(i: number, column: string): void {
    const k = `${i}:${column}`;
    if (this.expandedCells.has(k)) { this.expandedCells.delete(k); } else { this.expandedCells.add(k); }
  }

  private raw(row: any, column: string): string {
    const value = row?.[column];
    if (value === null || value === undefined) {
      return '';
    }
    return typeof value === 'object' ? JSON.stringify(value) : String(value);
  }
}
